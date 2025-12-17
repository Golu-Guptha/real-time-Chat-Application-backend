const Channel = require('../models/Channel');
const User = require('../models/User');

exports.createChannel = async (req, res) => {
    try {
        const { name, description, isPrivate } = req.body;

        let channel = await Channel.findOne({ name });
        if (channel) {
            return res.status(400).json({ message: 'Channel already exists' });
        }

        channel = new Channel({
            name,
            description,
            isPrivate: isPrivate || false,
            admin: req.user.id,
            members: [req.user.id] // Creator is automatically a member
        });

        await channel.save();
        res.status(201).json(channel);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getChannels = async (req, res) => {
    try {
        const channels = await Channel.find()
            .populate('members', 'username isOnline')
            .populate('admin', 'username');
        res.json(channels);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.searchChannels = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);

        const channels = await Channel.find({
            name: { $regex: query, $options: 'i' }
        }).select('name description isPrivate members _id'); // Return basic info

        // Add member count for frontend display
        const results = channels.map(c => ({
            ...c.toObject(),
            memberCount: c.members.length,
            members: undefined // Don't send full member list for search results optimization (optional)
        }));

        res.json(results);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.joinChannel = async (req, res) => {
    try {
        const channelId = req.params.id;
        const userId = req.user.id;

        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        if (channel.members.includes(userId)) {
            return res.status(400).json({ message: 'User already in channel' });
        }

        if (channel.bannedUsers.includes(userId)) {
            return res.status(403).json({ message: 'You are banned from this channel' });
        }

        if (channel.isPrivate) {
            if (channel.joinRequests.includes(userId)) {
                return res.status(400).json({ message: 'Join request already sent' });
            }
            channel.joinRequests.push(userId);
            await channel.save();

            // Notify the channel admin immediately via socket
            // Fetch full user details first because req.user only has ID
            const joinUser = await User.findById(userId).select('username email _id');

            const io = req.app.get('socketio');
            if (io && channel.admin) {
                console.log(`Emitting 'new_join_request' to admin ${channel.admin.toString()} with user ${joinUser.username}`);
                io.to(channel.admin.toString()).emit('new_join_request', {
                    channelId: channel._id,
                    user: joinUser
                });
            }

            return res.json({ message: 'Join request sent', status: 'pending' });
        }

        channel.members.push(userId);
        await channel.save();

        // Populate so frontend doesn't crash
        const populatedChannel = await Channel.findById(channel._id)
            .populate('members', 'username isOnline')
            .populate('admin', 'username');

        res.json({ message: 'Joined channel successfully', status: 'joined', channel: populatedChannel });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Admin: Approve Join Request
exports.approveJoinRequest = async (req, res) => {
    try {
        const { channelId, userId } = req.body;

        const channel = await Channel.findById(channelId);
        if (!channel) return res.status(404).json({ message: 'Channel not found' });

        if (channel.admin && channel.admin.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (!channel.joinRequests.includes(userId)) {
            return res.status(400).json({ message: 'Request not found' });
        }

        // Remove from requests
        channel.joinRequests = channel.joinRequests.filter(id => id.toString() !== userId);
        // Add to members
        channel.members.push(userId);

        await channel.save();

        // Notify the user via socket
        const io = req.app.get('socketio');
        if (io) {
            console.log(`Emitting 'join_request_approved' to user ${userId} for channel ${channel._id}`);
            // Populate channel for the joining user to have full info immediately
            const fullChannel = await Channel.findById(channel._id)
                .populate('members', 'username isOnline')
                .populate('admin', 'username');

            // Emit to the specific user (joined to room userId)
            io.to(userId).emit('join_request_approved', {
                channel: fullChannel
            });
            // Also notify channel members (admin/others) to update list?
            // Actually 'user_joined' might be appropriate to broadcast to channel room so others see him online
            io.to(channelId).emit('user_joined', {
                channelId,
                user: await User.findById(userId).select('username _id email isOnline')
            });
        }

        res.json({ message: 'User approved' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Admin: Remove User
exports.removeUser = async (req, res) => {
    try {
        const { channelId, userId } = req.body;

        const channel = await Channel.findById(channelId);
        if (!channel) return res.status(404).json({ message: 'Channel not found' });

        if (channel.admin.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (userId === channel.admin.toString()) {
            return res.status(400).json({ message: 'Cannot remove admin' });
        }

        channel.members = channel.members.filter(id => id.toString() !== userId);

        // Optional: Ban them? Prompt says "remove user", doesn't explicitly force ban, but often implied.
        // Let's just remove for now. 

        await channel.save();
        res.json({ message: 'User removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Admin: Toggle Privacy
exports.togglePrivacy = async (req, res) => {
    try {
        const { channelId } = req.body;

        const channel = await Channel.findById(channelId);
        if (!channel) return res.status(404).json({ message: 'Channel not found' });

        if (channel.admin.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        channel.isPrivate = !channel.isPrivate;
        await channel.save();

        res.json({ message: `Channel is now ${channel.isPrivate ? 'private' : 'public'}`, isPrivate: channel.isPrivate });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}

// Get Channel Details (including requests for admin)
exports.getChannelDetails = async (req, res) => {
    try {
        const channel = await Channel.findById(req.params.id)
            .populate('members', 'username isOnline')
            .populate('joinRequests', 'username email')
            .populate('admin', 'username');

        if (!channel) return res.status(404).json({ message: 'Channel not found' });

        // If private and user not member/admin, show limited info?
        const isMember = channel.members.some(m => m._id.toString() === req.user.id);
        const isAdmin = channel.admin && channel.admin._id.toString() === req.user.id;

        if (channel.isPrivate && !isMember && !isAdmin) {
            return res.json({
                _id: channel._id,
                name: channel.name,
                description: channel.description,
                isPrivate: true,
                memberCount: channel.members.length,
                isAdmin: false,
                isMember: false
            });
        }

        res.json({
            ...channel.toObject(),
            isAdmin,
            isMember
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}
// Get or Create Direct Message Channel
exports.createOrGetDirectMessage = async (req, res) => {
    try {
        const { recipientId } = req.body;
        const userId = req.user.id;

        // Check if DM exists
        let channel = await Channel.findOne({
            isDirectMessage: true,
            members: { $all: [userId, recipientId], $size: 2 }
        }).populate('members', 'username isOnline');

        if (channel) {
            return res.json(channel);
        }

        // Create new DM
        // Generate a unique internal name
        const recipient = await User.findById(recipientId);
        if (!recipient) return res.status(404).json({ message: 'User not found' });

        channel = new Channel({
            name: `dm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Internal unique name
            description: 'Direct Message',
            isPrivate: true,
            isDirectMessage: true,
            members: [userId, recipientId],
            admin: userId // Technically no admin in DM, but need schema validity
        });

        await channel.save();

        // Populate
        const populatedChannel = await Channel.findById(channel._id).populate('members', 'username isOnline');

        // Notify recipient via socket
        const io = req.app.get('socketio');
        if (io) {
            console.log(`[DM] Emitting 'new_channel' to recipient ${recipientId} for channel ${channel._id}`);
            io.to(recipientId).emit('new_channel', populatedChannel);

            // Also emit to the sender to ensure they join the room/update list if needed (though they likely have it via API response)
            // But strict real-time consistency suggests emitting to both or handling via response.
            // Emitting to sender as well can't hurt for consistency across devices?
            // io.to(userId).emit('new_channel', populatedChannel); 
        } else {
            console.log('[DM] Socket.io not found in request');
        }

        res.status(201).json(populatedChannel);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Admin: Reject Join Request
exports.rejectJoinRequest = async (req, res) => {
    try {
        const { channelId, userId } = req.body;

        const channel = await Channel.findById(channelId);
        if (!channel) return res.status(404).json({ message: 'Channel not found' });

        if (channel.admin && channel.admin.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Remove from requests
        channel.joinRequests = channel.joinRequests.filter(id => id.toString() !== userId);

        await channel.save();
        res.json({ message: 'Request rejected' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
