const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const auth = require('../middleware/auth');

// @route   POST api/channels
// @desc    Create a new channel
// @access  Private
router.post('/', auth, channelController.createChannel);

// @route   GET api/channels
// @desc    Get all channels (for initial load)
// @access  Private
router.get('/', auth, channelController.getChannels);

// @route   GET api/channels/search
// @desc    Search channels
// @access  Private
router.get('/search', auth, channelController.searchChannels);

// @route   GET api/channels/:id
// @desc    Get channel details
// @access  Private
router.get('/:id', auth, channelController.getChannelDetails);

// @route   POST api/channels/:id/join
// @desc    Join a channel
// @access  Private
router.post('/:id/join', auth, channelController.joinChannel);

// @route   POST api/channels/approve
// @desc    Approve join request (Admin)
// @access  Private
router.post('/approve', auth, channelController.approveJoinRequest);

// @route   POST api/channels/remove-user
// @desc    Remove user (Admin)
// @access  Private
router.post('/remove-user', auth, channelController.removeUser);

// @route   POST api/channels/dm
// @desc    Get or Create DM
// @access  Private
router.post('/dm', auth, channelController.createOrGetDirectMessage);

// @route   POST api/channels/reject
// @desc    Reject join request (Admin)
// @access  Private
router.post('/reject', auth, channelController.rejectJoinRequest);

router.post('/toggle-privacy', auth, channelController.togglePrivacy);

module.exports = router;
