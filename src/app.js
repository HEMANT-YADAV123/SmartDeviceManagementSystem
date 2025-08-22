const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Routes
const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

// Middleware
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { generalLimiter } = require('./middlewares/rateLimiter');

// Services
const backgroundJobService = require('./services/backgroundJobService');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Rate limiting
app.use(generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Device Management API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/analytics', analyticsRoutes);

// Admin/Debug endpoints (only in development)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/admin/background-jobs/status', (req, res) => {
    res.json({
      success: true,
      status: backgroundJobService.getStatus(),
    });
  });

  app.post('/api/admin/background-jobs/trigger', async (req, res) => {
    try {
      await backgroundJobService.triggerManualCheck();
      res.json({
        success: true,
        message: 'Background job triggered successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // NEW REDIS MONITORING ENDPOINTS
  
  // Get Redis cache statistics
  app.get('/api/admin/cache/stats', async (req, res) => {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        return res.json({
          success: false,
          message: 'Redis not connected',
        });
      }

      const info = await redisClient.info('keyspace');
      const memory = await redisClient.info('memory');
      
      res.json({
        success: true,
        keyspace: info,
        memory: memory,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // Get all Redis keys (be careful in production!)
  app.get('/api/admin/cache/keys', async (req, res) => {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        return res.json({
          success: false,
          message: 'Redis not connected',
        });
      }

      const pattern = req.query.pattern || '*';
      const keys = await redisClient.keys(pattern);
      
      res.json({
        success: true,
        keys: keys,
        count: keys.length,
        pattern: pattern,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // Get specific key value
  app.get('/api/admin/cache/get/:key', async (req, res) => {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        return res.json({
          success: false,
          message: 'Redis not connected',
        });
      }

      const { key } = req.params;
      const value = await redisClient.get(key);
      const ttl = await redisClient.ttl(key);
      
      res.json({
        success: true,
        key: key,
        value: value ? JSON.parse(value) : null,
        ttl: ttl,
        exists: !!value,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
        key: req.params.key,
      });
    }
  });

  // Clear specific cache key
  app.delete('/api/admin/cache/clear/:key', async (req, res) => {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        return res.json({
          success: false,
          message: 'Redis not connected',
        });
      }

      const { key } = req.params;
      const result = await redisClient.del(key);
      
      res.json({
        success: true,
        key: key,
        deleted: result === 1,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // Flush all cache (use with caution!)
  app.delete('/api/admin/cache/flush', async (req, res) => {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        return res.json({
          success: false,
          message: 'Redis not connected',
        });
      }

      await redisClient.flushdb();
      
      res.json({
        success: true,
        message: 'All cache cleared',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });
}

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;