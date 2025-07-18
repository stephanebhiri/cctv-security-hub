const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { videoMetadata } = require('../utils/videoTools');
const { CCTV } = require('../config/constants');
const { authenticate } = require('../utils/auth');
const ApiResponse = require('../utils/responseFormatter');

// Note: Using res.sendFile for cached videos - Express handles ranges automatically

// Middleware to handle video file requests with progressive streaming
async function handleVideoRequest(req, res) {
  const filename = req.params.filename;
  const cachePath = path.join(__dirname, '..', '..', 'static', 'cache', 'videos', filename);
  
  console.log(`📹 Video request: ${filename}`);
  
  // Check if file exists - serve with proper headers like legacy
  if (fs.existsSync(cachePath)) {
    console.log(`✅ Serving cached video: ${filename}`);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    return res.sendFile(cachePath);
  }
  
  // Extract camera ID and timestamp from filename
  const match = filename.match(/cam(\d+)_(\d+)_([a-f0-9]+)\.mp4/);
  if (!match) {
    console.error(`❌ Invalid video filename format: ${filename}`);
    return ApiResponse.notFound(res, 'Video');
  }
  
  const cameraId = parseInt(match[1]);
  const timestamp = parseInt(match[2]);
  
  try {
    // Get video metadata if available
    const metadata = videoMetadata.get(filename);
    if (!metadata) {
      console.log(`⚠️  No metadata for video: ${filename}`);
      return ApiResponse.notFound(res, 'Video metadata');
    }
    
    // Get authentication token and stream video directly
    console.log(`📡 Streaming video directly: ${filename}`);
    const token = await authenticate();
    
    const url = `${CCTV.baseUrl}/cgi-bin/filemanager/utilRequest.cgi`;
    const params = new URLSearchParams({
      func: 'get_viewer',
      sid: token,
      source_path: metadata.path,
      source_file: metadata.filename
    });
    
    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
      console.error(`❌ Failed to stream video: ${response.status} ${response.statusText}`);
      return ApiResponse.serviceUnavailable(res, 'Video streaming service', `HTTP ${response.status}`);
    }
    
    // Set headers for video streaming - Safari needs Content-Length
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    // Optimized streaming: Pipe directly to client and cache simultaneously
    console.log(`📡 Streaming video with concurrent caching: ${filename}`);
    
    // Create write stream for caching (non-blocking)
    const cacheStream = fs.createWriteStream(cachePath);
    
    // Handle cache write errors without affecting client response
    cacheStream.on('error', (cacheError) => {
      console.error(`⚠️  Cache write failed for ${filename}:`, cacheError.message);
    });
    
    cacheStream.on('finish', () => {
      console.log(`💾 Video cached: ${filename}`);
    });
    
    // Stream to both client and cache simultaneously
    response.body.pipe(res);
    response.body.pipe(cacheStream);
    
    console.log(`✅ Video served: ${filename}`);
    
  } catch (error) {
    console.error(`💥 Error handling video request:`, error);
    return ApiResponse.internalError(res, error);
  }
}

module.exports = { handleVideoRequest };