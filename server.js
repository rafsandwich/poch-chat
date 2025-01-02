// Environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const { MongoClient } = require('mongodb');

const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// For serving static files
const path = require('path');

// Create an express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

// Using environment variable for MongoDB URI
const uri = process.env.MONGO_URI;

// Create a MongoDB client
const client = new MongoClient(uri);

// Middleware to parse JSON requests
app.use(cors());
app.use(express.json());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    }
}
connectToDatabase();

// Socket.IO for real-time messaging
io.on('connection', (socket) => {
    console.log('A user connected');

    // When a user sends a message, save it to MongoDB and broadcast it
    socket.on('sendMessage', async (msg) => {
        try {
            const messagesCollection = client.db('poch-chat-db').collection('messages');
            await messagesCollection.insertOne(msg);  // Save message to DB
            io.emit('newMessage', msg);  // Emit to all connected users
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Example route to test the server
app.get('/', (req, res) => {
    res.send('Server is running and poch-chat is poching ...');
});

// API route to fetch messages
app.get('/messages', async (req, res) => {
    try {
        const messagesCollection = client.db('poch-chat-db').collection('messages');
        const messages = await messagesCollection.find().toArray(); // Get all messages
        res.json(messages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).send('Error fetching messages');
    }
});

// Testing getting users messages
app.get('/messages/:user', async (req, res) => {
    const { user } = req.params;
    try {
        const messagesCollection = client.db('poch-chat-db').collection('messages');
        const userMessages = await messagesCollection.find({ user }).toArray();
        res.json(userMessages);
    } catch (err) {
        console.error('Error fetching user messages:', err);
        res.status(500).send('Error fetching messages');
    }
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});