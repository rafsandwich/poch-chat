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

    socket.on('sendMessage', async (msg) => {
        try {
            const { token, content, user } = msg;

            // Validate the token
            jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
                if (err) {
                    console.error('Invalid token:', err);
                    socket.emit('errorMessage', 'Invalid token');
                    return;
                }

                // Ensure the username in the token matches the message's user field
                if (decoded.username !== user) {
                    console.error('Username mismatch');
                    return;
                }

                console.log('Decoded token:', decoded);

                const messagesCollection = client.db('poch-chat-db').collection('messages');
                const newMessage = { user, content, timestamp: new Date() };
                await messagesCollection.insertOne(newMessage); // Save message to DB

                io.emit('newMessage', newMessage); // Emit to all connected users
            });
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
app.get('/messages', authenticateToken, async (req, res) => {
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
app.get('/messages/:user', authenticateToken, async (req, res) => {
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

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Registration endpoint
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const usersCollection = client.db('poch-chat-db').collection('users');
        
        // Check if username already exists
        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user into database
        const newUser = { username, passwordHash, online: false };
        await usersCollection.insertOne(newUser);

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Brute force attack prevention
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login attempts per window
    message: 'Too many login attempts. Please try again later.',
});

// Login endpoint
app.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    try {
        const usersCollection = client.db('poch-chat-db').collection('users');

        // Find user in the database
        const user = await usersCollection.findOne({ username });
        if (!user) {
            console.log(`Login failed: User '${username}' not found.`);
            return res.status(404).json({ message: 'User not found' });
        }

        // Compare the password with the hashed password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            console.log(`Login failed: Invalid password for user '${username}'.`);
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Generate a JWT
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Successful response
        res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// JWT verification middleware
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorised' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        req.user = user; // Attach user info to the request
        next();
    });
}

// Start the server
server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});