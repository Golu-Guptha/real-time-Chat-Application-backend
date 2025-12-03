const Message = require('../models/Message');

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

        const newMessage = new Message({
            sender: senderId,
            channel: channelId,
            content
        });

        const savedMessage = await newMessage.save();
        const populatedMessage = await savedMessage.populate('sender', 'username');

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

        // Check user
        if (message.sender.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        message.isDeleted = true;
        message.content = 'This message was deleted';

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
