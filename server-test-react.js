// Test server to switch between React and Vanilla versions
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3003; // Different port for testing

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'static')));

// API endpoints (same as original server)
// Include all API endpoints from original server.js here...

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: Math.floor(Date.now() / 1000),
      version: 'React Test Server'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React build
app.use(express.static(path.join(__dirname, 'build')));

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

app.listen(PORT, () => {
  console.log(`React Test Server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});