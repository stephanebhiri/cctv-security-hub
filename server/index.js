require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Import configuration and validation
const { validateEnvironment, getCurrentConfig, getFeatureFlags, getMiddlewareConfig } = require('./config/environment');

// Validate environment before starting
const envValidation = validateEnvironment();
if (!envValidation.valid) {
  console.error('❌ Environment validation failed:');
  envValidation.errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}

const config = envValidation.config;
const features = getFeatureFlags();
const middlewareConfig = getMiddlewareConfig();

// Import logger with configuration
const { logger, correlationMiddleware } = require('./config/logger');

// Import middleware
const compressionMiddleware = require('./middleware/compression');
const errorHandler = require('./middleware/errorHandler');
const { handleVideoRequest } = require('./middleware/videoStreaming');
const { validators, handleValidationErrors } = require('./middleware/validation');
const { httpLogger, errorLogger } = require('./middleware/httpLogger');
const { metricsMiddleware, metricsCollector } = require('./middleware/metrics');

// Import routes
const itemsRoutes = require('./routes/items');
const cctvRoutes = require('./routes/cctv');
const cacheRoutes = require('./routes/cache');
const performanceRoutes = require('./routes/performance');
const historyRoutes = require('./routes/history');

// Import utils
const { startCacheCleanup } = require('./utils/fileTools');
const pool = require('./config/database');

const PORT = config.server.port;

// Middleware with environment-based configuration
app.use(correlationMiddleware); // Add correlation ID tracking
app.use(httpLogger({
  excludePaths: ['/api/health', '/favicon.ico', '/api/metrics'],
  slowRequestThreshold: 1000
})); // HTTP logging
app.use(metricsMiddleware); // Metrics collection
app.use(cors(middlewareConfig.cors));
app.use(compressionMiddleware);
app.use(express.json({ limit: '10mb' }));

// Add rate limiting in production
if (config.environment === 'production') {
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit(middlewareConfig.rateLimit);
  app.use('/api/', limiter);
  
  logger.info('Rate limiting enabled', {
    windowMs: middlewareConfig.rateLimit.windowMs,
    maxRequests: middlewareConfig.rateLimit.max
  });
}

// Static files - exclude videos from Express static (let custom middleware handle videos)
app.use(express.static(path.join(__dirname, '..', 'build')));

// Handle ALL video requests with custom middleware BEFORE Express static
app.use('/static/cache/videos', (req, res, next) => {
  if (req.path.endsWith('.mp4')) {
    const filename = req.path.substring(1); // Remove leading slash
    req.params = { filename: filename };
    console.log(`🎯 Video request intercepted: ${filename}`);
    return handleVideoRequest(req, res);
  }
  next();
});

// Express static for NON-VIDEO files only - custom middleware to exclude videos
app.use('/static', (req, res, next) => {
  // If it's a video file, don't serve it with Express static
  if (req.path.includes('/cache/videos/') && req.path.endsWith('.mp4')) {
    return res.status(404).send('Video files handled by custom middleware');
  }
  // Serve everything else with Express static
  express.static(path.join(__dirname, '..', 'static'))(req, res, next);
});


// API Routes
app.use('/api/items', itemsRoutes);
app.use('/api/cctv', cctvRoutes);
app.use('/api/performance', performanceRoutes);
// Simple history endpoint - direct implementation with proper formatting
app.get('/api/history', async (req, res) => {
  try {
    const query = `
      SELECT 
        item.designation,
        item.inventory_code,
        DATE_FORMAT(CONVERT_TZ(hist.dep,'GMT','Europe/Paris'),'%d/%m/%Y à %Hh %imin %ss') as dep,
        DATE_FORMAT(CONVERT_TZ(hist.ret,'GMT','Europe/Paris'),'%d/%m/%Y à %Hh %imin %ss') as ret,
        UNIX_TIMESTAMP(hist.dep) as depposix,
        UNIX_TIMESTAMP(hist.ret) as retposix,
        hist.antenna_dep,
        hist.antenna_ret,
        TIME_FORMAT(TIMEDIFF(hist.ret, hist.dep), '%Hh %imin %ss') as delai,
        TIME_TO_SEC(TIMEDIFF(NOW(), hist.ret)) as days,
        groupname.group_name as \`group\`,
        groupname.group_name as group_name,
        item.group_id
      FROM hist
      INNER JOIN item ON item.epc = hist.epchist
      INNER JOIN groupname ON item.group_id = groupname.group_id
      WHERE item.group_id <> 9 AND hist.dep IS NOT NULL AND hist.ret IS NOT NULL
      ORDER BY hist.ret DESC
      LIMIT 100
    `;
    
    const [rows] = await pool.execute(query);
    res.json({ success: true, data: { items: rows } });
  } catch (error) {
    console.error('History API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Conditional routes based on features
if (features.enableCacheEndpoints) {
  app.use('/api/cache', cacheRoutes);
  logger.info('Cache management endpoints enabled');
}

// Debug routes only in development
if (features.enableDebugEndpoints) {
  const debugRoutes = express.Router();
  
  debugRoutes.get('/config', (req, res) => {
    const safeConfig = { ...config };
    // Remove sensitive information
    delete safeConfig.database.password;
    delete safeConfig.cctv.password;
    
    return res.json({
      success: true,
      data: {
        config: safeConfig,
        features,
        environment: process.env.NODE_ENV
      }
    });
  });
  
  app.use('/api/debug', debugRoutes);
  logger.info('Debug endpoints enabled');
}

// Import response formatter
const ApiResponse = require('./utils/responseFormatter');

// Health check endpoint
app.get('/api/health', 
  validators.healthCheck,
  handleValidationErrors,
  (req, res) => {
    const healthData = {
      status: 'healthy',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: require('../package.json').version
    };
    
    return ApiResponse.success(res, healthData, {
      timestamp: Math.floor(Date.now() / 1000)
    });
  }
);

// Metrics endpoint (Prometheus format)
app.get('/api/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metricsCollector.toPrometheus());
});

// Metrics endpoint (JSON format for debugging)
app.get('/api/metrics/json', (req, res) => {
  res.json(metricsCollector.getSummary());
});


// Video requests are now handled by the middleware above, no need for this route

// Performance dashboard route
app.get('/performance-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'performance-dashboard.html'));
});

// Handle React Router (serve index.html for all non-API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

// Error handling middleware (must be last)
app.use(errorLogger); // Log errors before handling
app.use(errorHandler);

// Start cache cleanup system
startCacheCleanup();

// Start server
app.listen(PORT, config.server.host, () => {
  logger.info('Server started successfully', {
    port: PORT,
    host: config.server.host,
    environment: config.environment,
    nodeVersion: process.version,
    pid: process.pid,
    timezone: config.server.timezone,
    features: Object.keys(features).filter(key => features[key]),
    configValidation: 'passed'
  });
  
  // Keep console logs for immediate feedback
  console.log(`✅ Server running at http://${config.server.host}:${PORT}`);
  console.log(`📊 React app available at: http://${config.server.host}:${PORT}`);
  console.log(`🌍 Environment: ${config.environment}`);
  console.log(`🔧 Features: ${Object.keys(features).filter(key => features[key]).join(', ')}`);
});