const Message = require('../models/Message');
const Channel = require('../models/Channel');

exports.getMessages = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const messages = await Message.find({ channel: channelId })
            .sort({ timestamp: -1 }) // Newest first
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('sender', 'username');

        // Reverse to show oldest first in the chat view, but we fetched newest first for pagination
        res.json(messages.reverse());
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.createMessage = async (req, res) => {
    try {
        const { channelId, content } = req.body;
        const senderId = req.user.id;

        // Validation: Must have content OR file
        if (!content && !req.file) {
            return res.status(400).json({ msg: 'Message must have content or file' });
        }

        const newMessage = new Message({
            sender: senderId,
            channel: channelId,
            content: content || '', // Allow empty content if file exists
            fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
            fileType: req.file ? (req.file.mimetype.startsWith('image/') ? 'image' : 'file') : null
        });

        const savedMessage = await newMessage.save();
        const populatedMessage = await savedMessage.populate('sender', 'username');

        // Update Channel lastMessageAt
        await Channel.findByIdAndUpdate(channelId, { lastMessageAt: new Date() });

        res.status(201).json(populatedMessage);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ msg: 'Message not found' });
        }

        const channel = await Channel.findById(message.channel);
        if (!channel) {
            return res.status(404).json({ msg: 'Channel not found' });
        }

        const isSender = message.sender.toString() === req.user.id;

        let isAdmin = false;
        if (channel.admin) {
            // Handle if admin is populated (object) or unpopulated (id)
            const adminId = channel.admin._id ? channel.admin._id.toString() : channel.admin.toString();
            isAdmin = adminId === req.user.id;
        }

        console.log(`[DELETE MSG] User=${req.user.id} MsgID=${req.params.id} ChannelID=${channel._id} Admin=${channel.admin} IsSender=${isSender} IsAdmin=${isAdmin}`);

        if (!isSender && !isAdmin) {
            // Return 403 FORBIDDEN so the user is not logged out (401 triggers logout)
            return res.status(403).json({ msg: 'User not authorized to delete this message' });
        }

        message.isDeleted = true;
        message.deletedBy = req.user.id;

        // Set specific text based on who deleted it
        if (isAdmin && !isSender) {
            message.content = 'Admin has deleted that message';
        } else {
            message.content = 'This message was deleted';
        }

        await message.save();

        // Populate sender for consistency in frontend
        await message.populate('sender', 'username');

        res.json(message);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Message not found' });
        }
        res.status(500).send('Server Error');
    }
};
