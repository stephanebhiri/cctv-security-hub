const express = require('express');
const path = require('path');
const app = express();

// Serve static files
app.use(express.static(__dirname));

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working' });
});

// Serve videos with proper headers
app.get('/static/cache/videos/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'static', 'cache', 'videos', filename);
    
    console.log(`Serving video: ${filename}`);
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error serving video:', err);
            res.status(404).send('Video not found');
        }
    });
});

const PORT = 3003;
app.listen(PORT, () => {
    console.log(`Simple server running on port ${PORT}`);
});