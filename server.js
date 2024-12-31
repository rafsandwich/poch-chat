// Environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const { MongoClient } = require('mongodb');

// Create an Express app
const app = express();
const PORT = 3000;

// URI should be connection string
const uri = process.env.MONGO_URI;

// Create a MongoDB client
const client = new MongoClient(uri);

// Middleware to parse JSON requests
app.use(express.json());

// Connect to the database
async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    }
}
connectToDatabase();

// Example route to test the server
app.get('/', (req, res) => {
    res.send('Server is running and poch-chat is poching ...');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});