require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { DOMParser } = require('xmldom');
const mysql = require('mysql2/promise');
const { LRUCache } = require('lru-cache');

const app = express();
const PORT = process.env.PORT || 3002;

// Validate required environment variables
const requiredEnvVars = ['DB_PASSWORD', 'CCTV_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('💡 Please check your .env file');
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));
app.use('/static', express.static(path.join(__dirname, 'static')));

// CCTV Configuration
const CCTV_CONFIG = {
  baseUrl: process.env.CCTV_BASE_URL || 'http://xxx.xxx.fr:8090',
  login: process.env.CCTV_LOGIN || 'CCTV',
  password: process.env.CCTV_PASSWORD,
  cameras: {
    1: '/CCTV/RecSpace_360673CBB6824C65B7CB3A2F611A6110/CH001_50F36D36752750F36D36752750F30000/Regular',
    2: '/CCTV/RecSpace_360673CBB6824C65B7CB3A2F611A6110/CH002_50F36D36752750F36D36752750F30001/Regular',
    3: '/CCTV/RecSpace_360673CBB6824C65B7CB3A2F611A6110/CH003_50F36D36752750F36D36752750F30002/Regular',
    4: '/CCTV/RecSpace_360673CBB6824C65B7CB3A2F611A6110/CH004_50F36D36752750F36D36752750F30003/Regular',
    5: '/CCTV/RecSpace_360673CBB6824C65B7CB3A2F611A6110/CH005_50F36D36752750F36D36752750F30004/Regular',
    6: '/CCTV/RecSpace_360673CBB6824C65B7CB3A2F611A6110/CH006_50F36D36752750F36D36752750F30005/Regular'
  }
};

// Global auth token management
let authToken = null;
let tokenExpiry = 0;

// Database configuration (same as PHP version)
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'actuauser',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'actinvent'
};

// Database connection helper
async function getConnection() {
  try {
    const connection = await mysql.createConnection(DB_CONFIG);
    return connection;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

// Helper function to authenticate
async function authenticate() {
  if (authToken && Date.now() < tokenExpiry) {
    console.log(`🔐 Using cached token (expires in ${Math.round((tokenExpiry - Date.now()) / 1000)}s)`);
    return authToken;
  }

  try {
    console.log(`🔐 Authenticating with CCTV server...`);
    const url = `${CCTV_CONFIG.baseUrl}/cgi-bin/authLogin.cgi`;
    const params = new URLSearchParams({
      user: CCTV_CONFIG.login,
      serviceKey: '1',
      pwd: CCTV_CONFIG.password
    });

    console.log(`🌐 Auth URL: ${url}?${params}`);
    
    const response = await fetch(`${url}?${params}`);
    const xmlText = await response.text();
    
    console.log(`📝 Auth response: ${xmlText.substring(0, 200)}...`);
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const authSidElements = xmlDoc.getElementsByTagName('authSid');
    
    if (authSidElements.length === 0) {
      console.error('❌ No authSid element found in XML response');
      throw new Error('Failed to extract auth token from response');
    }

    authToken = authSidElements[0].textContent;
    tokenExpiry = Date.now() + (50 * 60 * 1000); // 50 minutes
    
    console.log(`✅ Authentication successful! Token: ${authToken?.substring(0, 20)}...`);
    return authToken;
  } catch (error) {
    console.error('💥 Authentication failed:', error);
    throw error;
  }
}

// Helper function to format date path
function formatDatePath(timestamp) {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  
  return {
    date: `${year}-${month}-${day}`,
    hour
  };
}

// Helper function to extract timestamp from filename
function extractTimestampFromFilename(filename) {
  console.log(`🔍 Extracting timestamp from filename: ${filename}`);
  
  // Try multiple patterns
  const patterns = [
    /(\d{8})_(\d{6})/,  // 20250715_081000
    /(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/,  // 2025-07-15_08-10-00
    /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/,  // 20250715_081000
    /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/   // 20250715081000
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      let year, month, day, hour, minute, second;
      
      if (match.length === 3) {
        // Pattern: YYYYMMDD_HHMMSS
        const dateStr = match[1];
        const timeStr = match[2];
        
        year = parseInt(dateStr.substr(0, 4));
        month = parseInt(dateStr.substr(4, 2)) - 1;
        day = parseInt(dateStr.substr(6, 2));
        hour = parseInt(timeStr.substr(0, 2));
        minute = parseInt(timeStr.substr(2, 2));
        second = parseInt(timeStr.substr(4, 2));
      } else if (match.length === 7) {
        // Pattern: YYYY-MM-DD_HH-MM-SS or YYYYMMDD_HHMMSS
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
        hour = parseInt(match[4]);
        minute = parseInt(match[5]);
        second = parseInt(match[6]);
      }
      
      const date = new Date(year, month, day, hour, minute, second);
      const timestamp = Math.floor(date.getTime() / 1000);
      
      console.log(`✅ Extracted timestamp: ${timestamp} (${date.toISOString()}) from ${filename}`);
      return timestamp;
    }
  }
  
  console.log(`❌ Could not extract timestamp from: ${filename}`);
  return 0;
}

// Helper function to list videos in a path with camera availability checking
async function listVideosInPath(cameraPath, datePath, token, cameraId = null) {
  try {
    const url = `${CCTV_CONFIG.baseUrl}/cgi-bin/filemanager/utilRequest.cgi`;
    const params = new URLSearchParams({
      func: 'get_list',
      sid: token,
      is_iso: '0',
      list_mode: 'all',
      path: `${cameraPath}/${datePath}/`,
      hidden_file: '0',
      dir: 'ASC',
      limit: '200',
      sort: 'filename',
      start: '0'
    });

    console.log(`🔍 Checking path: ${cameraPath}/${datePath}/`);
    console.log(`📡 Request URL: ${url}?${params}`);
    
    const response = await fetch(`${url}?${params}`, {
      timeout: 10000 // 10 second timeout per camera
    });
    
    if (!response.ok) {
      console.error(`❌ Camera ${cameraId || 'unknown'} HTTP error: ${response.status} ${response.statusText}`);
      return { videos: [], cameraAvailable: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    console.log(`📊 Response for ${datePath}:`, {
      success: data.success,
      has_datas: data.has_datas,
      dataCount: data.datas ? data.datas.length : 0
    });
    
    // IMPORTANT: Check for folder D rule
    // Normal folders return success=true, has_datas=false when empty
    // D folders return success=null/undefined, has_datas=true when they have data
    // BUT we also need to check if there are actual files (dataCount > 0)
    
    if (data.success === false) {
      console.log(`❌ Path ${datePath} failed (success=false)`);
      return { videos: [], cameraAvailable: true, error: 'Path not found' };
    }
    
    // Check if folder has data - either has_datas is true OR there are actual files
    const hasData = data.has_datas || (data.datas && data.datas.length > 0);
    
    if (!hasData) {
      console.log(`⚠️  Path ${datePath} has no videos (success=${data.success}, has_datas=${data.has_datas}, fileCount=${data.datas?.length || 0})`);
      return { videos: [], cameraAvailable: true, error: 'No videos in this time period' };
    }

    const videos = [];
    
    if (data.datas && Array.isArray(data.datas)) {
      console.log(`📁 Found ${data.datas.length} items in ${datePath}`);
      for (const item of data.datas) {
        if (item.filename && item.filename.endsWith('.mp4')) {
          const timestamp = extractTimestampFromFilename(item.filename);
          console.log(`🎬 Video file: ${item.filename} -> timestamp: ${timestamp}`);
          if (timestamp > 0) {
            videos.push({
              filename: item.filename,
              timestamp,
              path: `${cameraPath}/${datePath}`
            });
          }
        }
      }
    }

    console.log(`✅ Found ${videos.length} valid videos in ${datePath}`);
    return { 
      videos: videos.sort((a, b) => a.timestamp - b.timestamp), 
      cameraAvailable: true, 
      error: null 
    };
  } catch (error) {
    console.error(`💥 Camera ${cameraId || 'unknown'} failed to list videos in path ${datePath}:`, error);
    return { 
      videos: [], 
      cameraAvailable: false, 
      error: error.message || 'Camera connection failed' 
    };
  }
}

// Helper function to create cache filename
function createCacheFilename(video, cameraId) {
  const hash = Math.abs(hashString(video.filename)).toString(16);
  return `cam${cameraId}_${video.timestamp}_${hash}.mp4`;
}

// Simple hash function
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// Helper function to download and cache video
async function downloadAndCacheVideo(video, token, cacheFilename) {
  const cacheDir = path.join(__dirname, 'static', 'cache', 'videos');
  const cachePath = path.join(cacheDir, cacheFilename);
  
  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    console.log(`📁 Created cache directory: ${cacheDir}`);
  }

  // Check if already cached
  if (fs.existsSync(cachePath)) {
    console.log(`📦 Video already cached: ${cacheFilename}`);
    return true;
  }

  // Check cache size before downloading
  const currentSize = await getDirectorySize(cacheDir);
  if (currentSize > CACHE_CONFIG.cleanupThresholdBytes) {
    console.log(`🧹 Cache size (${Math.round(currentSize / (1024 * 1024))}MB) over threshold, cleaning before download`);
    await cleanupCache();
  }
  
  try {
    console.log(`⬇️  Downloading video: ${video.filename}`);
    const url = `${CCTV_CONFIG.baseUrl}/cgi-bin/filemanager/utilRequest.cgi`;
    const params = new URLSearchParams({
      func: 'get_viewer',
      sid: token,
      source_path: video.path,
      source_file: video.filename
    });
    
    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
      console.error(`❌ Failed to download video: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const buffer = await response.buffer();
    fs.writeFileSync(cachePath, buffer);
    console.log(`✅ Video cached: ${cacheFilename} (${buffer.length} bytes)`);
    return true;
  } catch (error) {
    console.error(`💥 Error downloading video ${video.filename}:`, error);
    return false;
  }
}

// Items endpoint (same as PHP /items)
app.get('/api/items', async (req, res) => {
  try {
    const connection = await getConnection();
    
    // Same SQL query as PHP version
    const sql = `
      SELECT 
        item.mac_address, 
        item.brand, 
        item.model, 
        item.serial_number, 
        item.epc, 
        item.image, 
        item.inventory_code, 
        item.category, 
        item.updated_at, 
        item.antenna, 
        item.group_id, 
        item.designation, 
        TIMESTAMPDIFF(SECOND, updated_at, NOW()) as sec, 
        DATE_FORMAT(CONVERT_TZ(Updated_at,'GMT','Europe/Paris'), '%d/%m/%Y à %Hh%imin%ss') as heure, 
        UNIX_TIMESTAMP(updated_at) as updated_atposix, 
        groupname.group_name as 'group' 
      FROM item, groupname  
      WHERE item.group_id = groupname.group_id 
        AND item.group_id <> 9 
      ORDER BY item.group_id, item.category, item.designation, item.model, item.antenna, item.updated_at ASC
    `;
    
    const [rows] = await connection.execute(sql);
    await connection.end();
    
    console.log(`📋 Found ${rows.length} items`);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Math.floor(Date.now() / 1000)
  });
});

// Test endpoint for slow response simulation
app.get('/api/cctv/videos-slow', async (req, res) => {
  const delay = parseInt(req.query.delay) || 6000;
  console.log(`🐌 Simulating ${delay}ms delay for CCTV request`);
  
  setTimeout(async () => {
    try {
      // Simulate slow response with actual data
      const response = [
        {"0":"/static/cache/videos/cam1_1752595200_slow_test.mp4"},
        0,
        -4800,
        1,
        {"0":1752595200}
      ];
      console.log(`✅ Slow response completed after ${delay}ms`);
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }, delay);
});

// Test endpoint for 404 video simulation
app.get('/api/cctv/videos-404', async (req, res) => {
  console.log(`🚫 Simulating 404 videos for testing`);
  
  try {
    // Return response with URLs that will 404
    const response = [
      {
        "0":"/static/cache/videos/non_existent_video_1.mp4",
        "1":"/static/cache/videos/non_existent_video_2.mp4"
      },
      0,
      0,
      1,
      {
        "0":1752595200,
        "1":1752595260
      }
    ];
    console.log(`✅ 404 test response sent`);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Main API endpoint to get videos - returns closest video immediately
app.get('/api/cctv/videos', async (req, res) => {
  try {
    const { target, camera } = req.query;
    
    console.log(`🎯 API Request: target=${target}, camera=${camera}`);
    
    if (!target || !camera) {
      return res.status(400).json({ error: 'Missing target timestamp or camera parameter' });
    }

    const targetTimestamp = parseInt(target);
    const cameraId = parseInt(camera);
    
    console.log(`📅 Target timestamp: ${targetTimestamp} (${new Date(targetTimestamp * 1000).toISOString()})`);
    
    if (!(cameraId in CCTV_CONFIG.cameras)) {
      return res.status(400).json({ error: 'Invalid camera ID' });
    }

    const token = await authenticate();
    console.log(`🔐 Auth token: ${token ? 'OK' : 'FAILED'}`);
    
    const cameraPath = CCTV_CONFIG.cameras[cameraId];
    console.log(`📹 Camera path: ${cameraPath}`);
    
    let allVideos = [];
    let cameraAvailable = true;
    let cameraError = null;

    // Try multiple hours around the target
    for (let hourOffset = -1; hourOffset <= 1; hourOffset++) {
      const testDate = new Date(targetTimestamp * 1000);
      testDate.setHours(testDate.getHours() + hourOffset);
      const testHour = String(testDate.getHours()).padStart(2, '0');
      const testDateStr = formatDatePath(Math.floor(testDate.getTime() / 1000)).date;

      console.log(`⏰ Testing hour offset ${hourOffset}: ${testDateStr}/${testHour}`);

      // Try normal folder first, then D folder (CRITICAL: Folder D rule)
      for (const folderSuffix of ['', 'D']) {
        const datePath = `${testDateStr}/${testHour}${folderSuffix}`;
        console.log(`📂 Trying ${folderSuffix ? 'D folder' : 'normal folder'}: ${datePath}`);
        
        const result = await listVideosInPath(cameraPath, datePath, token, cameraId);
        
        // Track camera availability
        if (!result.cameraAvailable) {
          cameraAvailable = false;
          cameraError = result.error;
          console.log(`❌ Camera ${cameraId} unavailable: ${result.error}`);
        }
        
        allVideos = allVideos.concat(result.videos);
        
        if (result.videos.length > 0) {
          console.log(`✅ Found ${result.videos.length} videos in ${datePath}, stopping search for this hour`);
          break; // Stop trying D folder if normal folder has videos
        }
      }
    }

    // Remove duplicates and sort by timestamp
    const uniqueVideos = allVideos.filter((video, index, self) => 
      index === self.findIndex(v => v.filename === video.filename)
    ).sort((a, b) => a.timestamp - b.timestamp);

    // Generate response in the required format
    const videos = {};
    const timestamps = {};

    // Handle camera unavailable case
    if (!cameraAvailable || uniqueVideos.length === 0) {
      console.log(`❌ Camera ${cameraId} unavailable or no videos found, using fallback video`);
      
      // Provide fallback video for unavailable camera
      videos['0'] = '/static/videos/videoerror.mp4';
      timestamps['0'] = targetTimestamp;
      
      const response = [
        videos,
        0, // closestIndex
        0, // offsetSeconds
        cameraId,
        timestamps,
        {
          cameraAvailable: false,
          cameraError: cameraError || 'No videos found for this time period',
          videoCount: 0
        }
      ];

      console.log(`🔄 Fallback response sent for camera ${cameraId}: ${cameraError || 'No videos found'}`);
      return res.json(response);
    }

    // Find closest video to target timestamp
    let closestIndex = 0;
    let minDiff = Math.abs(uniqueVideos[0]?.timestamp - targetTimestamp) || Infinity;

    uniqueVideos.forEach((video, index) => {
      const diff = Math.abs(video.timestamp - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });

    // Set up all video metadata immediately - NO DOWNLOADS
    for (let i = 0; i < uniqueVideos.length; i++) {
      const video = uniqueVideos[i];
      const cacheFilename = createCacheFilename(video, cameraId);
      const cacheUrl = `/static/cache/videos/${cacheFilename}`;
      
      videos[i.toString()] = cacheUrl;
      timestamps[i.toString()] = video.timestamp;
      
      // Store video metadata for on-demand downloads
      videoMetadata.set(cacheFilename, video);
    }

    // NO BACKGROUND DOWNLOADS - Everything is now on-demand streaming
    console.log(`🎯 API responding immediately with ${uniqueVideos.length} video metadata entries`);
    console.log(`📡 All videos will be streamed on-demand when requested`);

    const offsetSeconds = uniqueVideos[closestIndex] 
      ? uniqueVideos[closestIndex].timestamp - targetTimestamp 
      : 0;

    // Return immediately with closest video ready for playback
    const response = [
      videos,
      closestIndex,
      offsetSeconds,
      cameraId,
      timestamps,
      {
        cameraAvailable: cameraAvailable,
        cameraError: cameraError,
        videoCount: uniqueVideos.length
      }
    ];

    console.log(`✅ Response sent immediately with closest video ready for playback`);
    res.json(response);
  } catch (error) {
    console.error('Error in /api/cctv/videos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Store video metadata for on-demand downloads with LRU cache
// Max 1000 entries, TTL of 1 hour to prevent memory bloat
const videoMetadata = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
  updateAgeOnGet: true
});

// Cache management configuration
const CACHE_CONFIG = {
  maxSizeBytes: 1 * 1024 * 1024 * 1024, // 1GB limit
  cleanupThresholdBytes: 0.8 * 1024 * 1024 * 1024, // Start cleanup at 800MB
  checkIntervalMs: 5 * 60 * 1000, // Check every 5 minutes
};

// Get directory size in bytes
async function getDirectorySize(dirPath) {
  try {
    const files = await fs.promises.readdir(dirPath);
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.promises.stat(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  } catch (error) {
    console.warn('⚠️ Error calculating directory size:', error.message);
    return 0;
  }
}

// Clean old cache files to stay under limit
async function cleanupCache() {
  const cacheDir = path.join(__dirname, 'static', 'cache', 'videos');
  
  try {
    // Ensure cache directory exists
    await fs.promises.mkdir(cacheDir, { recursive: true });
    
    const currentSize = await getDirectorySize(cacheDir);
    const sizeMB = Math.round(currentSize / (1024 * 1024));
    
    console.log(`🗑️ Cache size check: ${sizeMB}MB / ${Math.round(CACHE_CONFIG.maxSizeBytes / (1024 * 1024))}MB`);
    
    if (currentSize <= CACHE_CONFIG.cleanupThresholdBytes) {
      return; // Under threshold, no cleanup needed
    }
    
    console.log(`🧹 Cache cleanup needed - current size: ${sizeMB}MB`);
    
    // Get all cache files with their stats
    const files = await fs.promises.readdir(cacheDir);
    const fileStats = [];
    
    for (const file of files) {
      if (file.endsWith('.mp4')) {
        const filePath = path.join(cacheDir, file);
        try {
          const stats = await fs.promises.stat(filePath);
          fileStats.push({
            name: file,
            path: filePath,
            size: stats.size,
            mtime: stats.mtime,
            age: Date.now() - stats.mtime.getTime()
          });
        } catch (error) {
          console.warn(`⚠️ Error getting stats for ${file}:`, error.message);
        }
      }
    }
    
    // Sort by age (oldest first)
    fileStats.sort((a, b) => b.age - a.age);
    
    let cleanedSize = 0;
    let filesRemoved = 0;
    const targetSize = CACHE_CONFIG.maxSizeBytes * 0.7; // Clean down to 70% of limit
    
    for (const file of fileStats) {
      if (currentSize - cleanedSize <= targetSize) {
        break; // Reached target size
      }
      
      try {
        await fs.promises.unlink(file.path);
        cleanedSize += file.size;
        filesRemoved++;
        
        const ageDays = Math.round(file.age / (1000 * 60 * 60 * 24));
        console.log(`🗑️ Removed: ${file.name} (${Math.round(file.size / (1024 * 1024))}MB, ${ageDays} days old)`);
      } catch (error) {
        console.warn(`⚠️ Error removing ${file.name}:`, error.message);
      }
    }
    
    const newSize = currentSize - cleanedSize;
    const newSizeMB = Math.round(newSize / (1024 * 1024));
    const cleanedMB = Math.round(cleanedSize / (1024 * 1024));
    
    console.log(`✅ Cache cleanup complete: removed ${filesRemoved} files (${cleanedMB}MB), new size: ${newSizeMB}MB`);
    
  } catch (error) {
    console.error('❌ Cache cleanup failed:', error);
  }
}

// Start periodic cache cleanup
setInterval(cleanupCache, CACHE_CONFIG.checkIntervalMs);

// Initial cleanup on server start
setTimeout(cleanupCache, 10000); // Wait 10s after server start

// Middleware to handle video file requests with progressive streaming
app.get('/static/cache/videos/:filename', async (req, res) => {
  const filename = req.params.filename;
  const cachePath = path.join(__dirname, 'static', 'cache', 'videos', filename);
  
  console.log(`📹 Video request: ${filename}`);
  
  // Check if file exists
  if (fs.existsSync(cachePath)) {
    console.log(`✅ Serving cached video: ${filename}`);
    res.setHeader('Content-Type', 'video/mp4');
    return res.sendFile(cachePath);
  }
  
  // Extract camera ID and timestamp from filename
  const match = filename.match(/cam(\d+)_(\d+)_([a-f0-9]+)\.mp4/);
  if (!match) {
    console.error(`❌ Invalid video filename format: ${filename}`);
    return res.status(404).send('Video not found');
  }
  
  const cameraId = parseInt(match[1]);
  const timestamp = parseInt(match[2]);
  
  try {
    // Get video metadata if available
    const metadata = videoMetadata.get(filename);
    if (!metadata) {
      console.log(`⚠️  No metadata for video: ${filename}`);
      return res.status(404).send('Video metadata not found');
    }
    
    // Get authentication token and stream video directly
    console.log(`📡 Streaming video directly: ${filename}`);
    const token = await authenticate();
    
    const url = `${CCTV_CONFIG.baseUrl}/cgi-bin/filemanager/utilRequest.cgi`;
    const params = new URLSearchParams({
      func: 'get_viewer',
      sid: token,
      source_path: metadata.path,
      source_file: metadata.filename
    });
    
    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
      console.error(`❌ Failed to stream video: ${response.status} ${response.statusText}`);
      return res.status(500).send('Failed to stream video');
    }
    
    // Set headers for video streaming - Safari needs Content-Length
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    // Safari-friendly: Download then serve instead of dual-pipe streaming
    console.log(`📥 Downloading video for Safari compatibility: ${filename}`);
    const buffer = await response.buffer();
    
    // Save to cache
    fs.writeFileSync(cachePath, buffer);
    console.log(`💾 Video cached: ${filename} (${buffer.length} bytes)`);
    
    // Serve to client
    res.send(buffer);
    
    console.log(`✅ Video served: ${filename}`);
    
  } catch (error) {
    console.error(`💥 Error handling video request:`, error);
    res.status(500).send('Internal server error');
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Erase cache endpoint
app.delete('/api/cache', (req, res) => {
  try {
    const cacheDir = path.join(__dirname, 'static', 'cache', 'videos');
    
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      let deletedCount = 0;
      let totalSize = 0;
      
      files.forEach(file => {
        const filePath = path.join(cacheDir, file);
        if (fs.statSync(filePath).isFile()) {
          totalSize += fs.statSync(filePath).size;
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      
      console.log(`🗑️  Cache erased: ${deletedCount} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB freed`);
      
      res.json({
        success: true,
        message: `Cache cleared successfully`,
        filesDeleted: deletedCount,
        sizeFreed: Math.round(totalSize / 1024 / 1024 * 100) / 100 // MB with 2 decimals
      });
    } else {
      res.json({
        success: true,
        message: 'Cache directory does not exist',
        filesDeleted: 0,
        sizeFreed: 0
      });
    }
  } catch (error) {
    console.error('❌ Error erasing cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to erase cache',
      error: error.message
    });
  }
});

// Video preload endpoint
app.post('/api/cache/preload', async (req, res) => {
  const { videoPath } = req.body;
  
  if (!videoPath) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing videoPath parameter' 
    });
  }

  try {
    // Validate that the path looks like a CCTV video path
    if (!videoPath.includes('/CCTV/') || !videoPath.includes('Regular')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid video path format' 
      });
    }

    const fullUrl = `${CCTV_CONFIG.baseUrl}${videoPath}`;
    console.log(`🔄 Preloading video: ${fullUrl}`);
    
    // Get fresh auth token if needed
    if (!authToken || Date.now() >= tokenExpiry) {
      try {
        await authenticate();
      } catch (error) {
        return res.status(500).json({ 
          success: false, 
          error: 'CCTV authentication failed',
          details: error.message
        });
      }
    }

    // Make HEAD request to check if video exists and warm up the connection
    const response = await fetch(`${fullUrl}?authSid=${authToken}`, {
      method: 'HEAD',
      timeout: 5000
    });

    if (response.ok) {
      const contentLength = response.headers.get('content-length');
      console.log(`✅ Video preloaded successfully: ${videoPath} (${contentLength} bytes)`);
      
      res.json({ 
        success: true, 
        videoPath,
        size: contentLength ? parseInt(contentLength) : null,
        cached: true,
        message: 'Video preloaded successfully'
      });
    } else {
      console.warn(`⚠️  Video not found: ${videoPath} (HTTP ${response.status})`);
      res.status(404).json({ 
        success: false, 
        error: `Video not found on CCTV server (HTTP ${response.status})`,
        videoPath 
      });
    }
  } catch (error) {
    console.error(`❌ Preload error for ${videoPath}:`, error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to preload video',
      details: error.message,
      videoPath 
    });
  }
});

// Ensure cache directory exists
const cacheDir = path.join(__dirname, 'static', 'cache', 'videos');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Serve React build files
app.use(express.static(path.join(__dirname, 'build')));

// Handle React Router (serve index.html for all non-API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`React app available at: http://localhost:${PORT}`);
});

module.exports = app;