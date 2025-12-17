const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Channel = require('./models/Channel');
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
app.use('/uploads', express.static('uploads'));
app.set('socketio', io); // Make io accessible in controllers

// Socket.IO Middleware for Authentication
io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['x-auth-token'];
    if (!token) return next(new Error('Authentication error'));

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded.user;
        next();
    } catch (err) {
        next(new Error('Authentication error'));
    }
});

io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id, socket.user ? socket.user.id : 'unknown');

    // Join a room with their own user ID for direct notifications
    // Handle both 'id' and '_id' depending on JWT payload structure
    const userId = socket.user ? (socket.user.id || socket.user._id) : null;
    if (socket.user && userId) {
        socket.join(userId);
        console.log(`User ${socket.user.username || 'User'} (${userId}) joined personal room`);
        // We also need to normalize socket.user.id so subsequent calls work
        socket.user.id = userId;

        // Auto-join all channels the user is a member of
        try {
            const userChannels = await Channel.find({ members: userId });
            userChannels.forEach(channel => {
                socket.join(channel._id.toString());
                console.log(`User ${userId} auto-joined channel room ${channel._id}`);
            });
        } catch (err) {
            console.error('Error auto-joining user to channels:', err);
        }

        // Update status to Online
        try {
            await User.findByIdAndUpdate(userId, { isOnline: true });
            io.emit('user_status_change', { userId: userId, isOnline: true });
        } catch (err) {
            console.error('Error updating user status:', err);
        }

    } else {
        console.log('Socket connection missing user data');
    }

    socket.on('join_channel', (channelId) => {
        socket.join(channelId);
        console.log(`User ${socket.user.id} joined channel ${channelId}`);
        // Notify others in the channel
        io.to(channelId).emit('user_joined', {
            channelId,
            user: {
                _id: socket.user.id,
                username: socket.user.username,
                email: socket.user.email,
                isOnline: true
            }
        });
    });

    socket.on('send_message', (data) => {
        io.to(data.channel).emit('receive_message', data);
    });

    socket.on('delete_message', (data) => {
        // Broadcast the entire updated message (data) so clients know the new content
        io.to(data.channel).emit('message_deleted', data);
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
app.use('/api/users', require('./routes/users'));
app.use('/api/channels', require('./routes/channels'));
app.use('/api/messages', require('./routes/messages'));

app.get('/', (req, res) => {
    res.send('Mini Team Chat API is running');
});

const PORT = process.env.PORT || 5001;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB Connected');
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
    });
