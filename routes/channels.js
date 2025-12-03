const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const auth = require('../middleware/auth');

// @route   POST api/channels
// @desc    Create a new channel
// @access  Private
router.post('/', auth, channelController.createChannel);

// @route   GET api/channels
// @desc    Get all channels
// @access  Private
router.get('/', auth, channelController.getChannels);

// @route   POST api/channels/:id/join
// @desc    Join a channel
// @access  Private
router.post('/:id/join', auth, channelController.joinChannel);

module.exports = router;
