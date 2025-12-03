const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

// @route   GET api/messages/:channelId
// @desc    Get messages for a channel
// @access  Private
router.get('/:channelId', auth, messageController.getMessages);

// @route   POST api/messages
// @desc    Create a message
// @access  Private
router.post('/', auth, messageController.createMessage);

// @route   DELETE api/messages/:id
// @desc    Delete a message
// @access  Private
router.delete('/:id', auth, messageController.deleteMessage);

module.exports = router;
