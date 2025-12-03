const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("Error: MONGODB_URI is not defined in .env file.");
} else {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB connection error:', err));
}

// Socket.io Middleware for Auth
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded.user;
        next();
    } catch (err) {
        next(new Error('Authentication error'));
    }
});

// Socket.io
io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id, socket.user.id);

    // Update user status to online
    await User.findByIdAndUpdate(socket.user.id, { isOnline: true });
    io.emit('user_status_change', { userId: socket.user.id, isOnline: true });

    socket.on('join_channel', (channelId) => {
        socket.join(channelId);
        console.log(`User ${socket.user.id} joined channel ${channelId}`);
    });

    socket.on('send_message', (data) => {
        // data is the message object, so it has .channel property
        io.to(data.channel).emit('receive_message', data);
    });

    socket.on('delete_message', (data) => {
        io.to(data.channel).emit('message_deleted', data._id);
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        // Update user status to offline
        await User.findByIdAndUpdate(socket.user.id, { isOnline: false });
        io.emit('user_status_change', { userId: socket.user.id, isOnline: false });
    });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/channels', require('./routes/channels'));
app.use('/api/messages', require('./routes/messages'));

app.get('/', (req, res) => {
    res.send('Mini Team Chat API is running');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
