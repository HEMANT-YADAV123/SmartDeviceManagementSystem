const express = require('express');
const mongoose = require('mongoose');
const cacheService = require('../services/cacheService');
const websocketService = require('../services/websocketService');
const { metrics } = require('../middlewares/performanceMonitoring');

const router = express.Router();

// Basic health check
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Device Management API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
  });
});

// Detailed health check with dependencies
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();

  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {},
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
    performance: {},
  };

  // Check MongoDB connection
  try {
    const mongoState = mongoose.connection.readyState;
    const mongoStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    healthData.services.mongodb = {
      status: mongoState === 1 ? 'healthy' : 'unhealthy',
      state: mongoStates[mongoState],
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      database: mongoose.connection.name,
    };

    if (mongoState === 1) {
      const pingStart = Date.now();
      await mongoose.connection.db.admin().ping();
      healthData.services.mongodb.responseTime = `${Date.now() - pingStart}ms`;
    }
  } catch (error) {
    healthData.services.mongodb = {
      status: 'unhealthy',
      error: error.message,
    };
    healthData.status = 'degraded';
  }

  // Check Redis/Cache service
  try {
    const cacheHealth = await cacheService.healthCheck();
    healthData.services.redis = cacheHealth;
    
    if (cacheHealth.status !== 'connected' && cacheHealth.status !== 'disabled') {
      healthData.status = 'degraded';
    }
  } catch (error) {
    healthData.services.redis = {
      status: 'unhealthy',
      error: error.message,
    };
    healthData.status = 'degraded';
  }

  // Check WebSocket service
  try {
    const wsStats = websocketService.getStats();
    healthData.services.websocket = {
      status: 'healthy',
      totalConnections: wsStats.totalConnections,
      uniqueUsers: wsStats.uniqueUsers,
      userConnections: wsStats.userConnections.slice(0, 5), // Limit to 5 for brevity
    };
  } catch (error) {
    healthData.services.websocket = {
      status: 'unhealthy',
      error: error.message,
    };
    healthData.status = 'degraded';
  }

  // Add performance metrics
  try {
    healthData.performance = metrics.getMetrics();
  } catch (error) {
    healthData.performance = {
      status: 'unavailable',
      error: error.message,
    };
  }

  // Calculate total response time
  healthData.responseTime = `${Date.now() - startTime}ms`;

  // Set appropriate status code
  const statusCode = healthData.status === 'healthy' ? 200 : 
                    healthData.status === 'degraded' ? 207 : 503;

  res.status(statusCode).json(healthData);
});

// Database-specific health check
router.get('/database', async (req, res) => {
  try {
    const startTime = Date.now();
    const mongoState = mongoose.connection.readyState;
    
    if (mongoState !== 1) {
      return res.status(503).json({
        status: 'unhealthy',
        service: 'mongodb',
        message: 'Database not connected',
        connectionState: mongoState,
        timestamp: new Date().toISOString(),
      });
    }

    // Perform database ping
    await mongoose.connection.db.admin().ping();
    
    // Get database stats
    const dbStats = await mongoose.connection.db.stats();
    
    res.json({
      status: 'healthy',
      service: 'mongodb',
      responseTime: `${Date.now() - startTime}ms`,
      connection: {
        state: 'connected',
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        database: mongoose.connection.name,
      },
      stats: {
        collections: dbStats.collections,
        dataSize: `${Math.round(dbStats.dataSize / 1024 / 1024)}MB`,
        storageSize: `${Math.round(dbStats.storageSize / 1024 / 1024)}MB`,
        indexes: dbStats.indexes,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'mongodb',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Cache-specific health check
router.get('/cache', async (req, res) => {
  try {
    const cacheHealth = await cacheService.healthCheck();
    
    const statusCode = cacheHealth.status === 'connected' ? 200 :
                      cacheHealth.status === 'disabled' ? 200 : 503;
    
    res.status(statusCode).json({
      ...cacheHealth,
      service: 'redis',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'redis',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// WebSocket-specific health check
router.get('/websocket', (req, res) => {
  try {
    const wsStats = websocketService.getStats();
    
    res.json({
      status: 'healthy',
      service: 'websocket',
      ...wsStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'websocket',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Performance metrics endpoint
router.get('/metrics', (req, res) => {
  try {
    const performanceMetrics = metrics.getMetrics();
    
    res.json({
      status: 'healthy',
      service: 'performance',
      ...performanceMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'performance',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Reset metrics endpoint (useful for monitoring)
router.post('/metrics/reset', (req, res) => {
  try {
    metrics.reset();
    res.json({
      success: true,
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Readiness probe (Kubernetes-style)
router.get('/ready', async (req, res) => {
  try {
    // Check critical dependencies
    const mongoState = mongoose.connection.readyState;
    
    if (mongoState !== 1) {
      return res.status(503).json({
        ready: false,
        reason: 'Database not connected',
        timestamp: new Date().toISOString(),
      });
    }

    // Perform quick database ping
    await mongoose.connection.db.admin().ping();
    
    res.json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Liveness probe (Kubernetes-style)
router.get('/live', (req, res) => {
  res.json({
    alive: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;