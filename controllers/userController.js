const User = require('../models/User');
const Message = require('../models/Message');

// Send Friend Request
exports.sendFriendRequest = async (req, res) => {
    try {
        const { userId } = req.body;
        const senderId = req.user.id;

        if (userId === senderId) {
            return res.status(400).json({ msg: 'Cannot send friend request to yourself' });
        }

        const recipient = await User.findById(userId);
        const sender = await User.findById(senderId);

        if (!recipient) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Check if already friends
        if (recipient.friends && recipient.friends.some(f => f.toString() === senderId)) {
            return res.status(400).json({ msg: 'Already friends' });
        }

        // Check if request already exists
        const existingRequest = recipient.friendRequests.find(
            req => req.sender.toString() === senderId && req.status === 'pending'
        );

        if (existingRequest) {
            return res.status(400).json({ msg: 'Friend request already sent' });
        }

        recipient.friendRequests.push({ sender: senderId });
        await recipient.save();

        // Notify recipient via socket
        const io = req.app.get('socketio');
        io.to(userId).emit('new_friend_request', {
            sender: { _id: senderId, username: req.user.username } // minimal data for notification
        });

        res.json({ msg: 'Friend request sent' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Accept/Reject Friend Request
exports.respondToFriendRequest = async (req, res) => {
    try {
        const { requestId, status } = req.body; // status: 'accepted' or 'rejected'
        const userId = req.user.id;

        const user = await User.findById(userId);
        const request = user.friendRequests.id(requestId);

        if (!request) {
            return res.status(404).json({ msg: 'Friend request not found' });
        }

        if (status === 'accepted') {
            const sender = await User.findById(request.sender);

            // Add to friends lists
            user.friends.push(request.sender);
            sender.friends.push(userId);

            await sender.save();
        }

        request.status = status;

        // Optionally remove the request after handling, but keeping history is fine or just filter 'pending'
        // For now, let's keep it but mark status. Or remove if accepted? 
        // User asked for "accepted their friend request", usually implies state change.
        // Let's remove from array if accepted/rejected to keep document size small?
        // Or keep logic simple: update status.
        // Actually, removing processed requests is cleaner for MongoDB document limits.
        user.friendRequests = user.friendRequests.filter(req => req._id.toString() !== requestId);

        await user.save();

        res.json({ msg: `Friend request ${status}`, friendId: status === 'accepted' ? request.sender : null });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Get Friends
exports.getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('friends', 'username email isOnline');
        res.json(user.friends);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Get Pending Friend Requests
exports.getFriendRequests = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('friendRequests.sender', 'username email');
        const pendingRequests = user.friendRequests.filter(req => req.status === 'pending');
        res.json(pendingRequests);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Search Users (Global Search)
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        const userId = req.user.id;

        if (!query) return res.json([]);

        // Find users matching query (excluding self)
        const users = await User.find({
            $and: [
                { _id: { $ne: userId } },
                {
                    $or: [
                        { username: { $regex: query, $options: 'i' } },
                        { email: { $regex: query, $options: 'i' } }
                    ]
                }
            ]
        }).select('username email isOnline');

        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Get User Profile (for public channel view)
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -friendRequests -friends'); // Hide private info
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Check if I am friends with them
        const me = await User.findById(req.user.id);
        const isFriend = me.friends.includes(req.params.id);
        const hasPending = me.friendRequests.some(r => r.sender.toString() === req.params.id && r.status === 'pending');
        // Check if I sent them a request
        const sentRequest = await User.findOne({
            _id: req.params.id,
            'friendRequests.sender': req.user.id,
            'friendRequests.status': 'pending'
        });

        res.json({
            ...user.toObject(),
            isFriend,
            hasPendingRequest: !!hasPending,
            requestSent: !!sentRequest
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}
