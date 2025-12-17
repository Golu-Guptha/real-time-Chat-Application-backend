const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // 5MB limit is handled by limits option, checking mime/ext if needed
    // Prompt says "files images and file s must be under 5mb"
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: fileFilter
});


// @route   GET api/messages/:channelId
// @desc    Get messages for a channel
// @access  Private
router.get('/:channelId', auth, messageController.getMessages);

// @route   POST api/messages
// @desc    Send a message (with optional file)
// @access  Private
router.post('/', auth, upload.single('file'), messageController.createMessage);

// @route   DELETE api/messages/:id
// @desc    Delete a message
// @access  Private
router.delete('/:id', auth, messageController.deleteMessage);

module.exports = router;
