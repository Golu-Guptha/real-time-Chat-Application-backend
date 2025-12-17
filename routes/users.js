const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

// @route   POST api/users/friend-request
// @desc    Send a friend request
// @access  Private
router.post('/friend-request', auth, userController.sendFriendRequest);

// @route   POST api/users/friend-request/respond
// @desc    Accept or reject a friend request
// @access  Private
router.post('/friend-request/respond', auth, userController.respondToFriendRequest);

// @route   GET api/users/friends
// @desc    Get all friends
// @access  Private
router.get('/friends', auth, userController.getFriends);

// @route   GET api/users/friend-requests
// @desc    Get pending friend requests
// @access  Private
router.get('/friend-requests', auth, userController.getFriendRequests);

// @route   GET api/users/search
// @desc    Search users (friends)
// @access  Private
router.get('/search', auth, userController.searchUsers);

// @route   GET api/users/profile/:id
// @desc    Get user profile (public info)
// @access  Private
router.get('/profile/:id', auth, userController.getUserProfile);

module.exports = router;
