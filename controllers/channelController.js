const Channel = require('../models/Channel');
const User = require('../models/User');

exports.createChannel = async (req, res) => {
    try {
        const { name, description } = req.body;

        let channel = await Channel.findOne({ name });
        if (channel) {
            return res.status(400).json({ message: 'Channel already exists' });
        }

        channel = new Channel({
            name,
            description,
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
        const channels = await Channel.find().populate('members', 'username isOnline');
        res.json(channels);
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

        channel.members.push(userId);
        await channel.save();

        res.json(channel);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
