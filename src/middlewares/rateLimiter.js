const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require("express-rate-limit");
const { getRedisClient } = require('../config/redis');

// Redis store for rate limiting (optional)
const createRedisStore = () => {
  const redis = getRedisClient();
  if (!redis) return null;

  return {
    async increment(key) {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, this.windowMs / 1000);
      }
      return current;
    },
    
    async decrement(key) {
      return await redis.decr(key);
    },
    
    async resetKey(key) {
      return await redis.del(key);
    },
  };
};

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // store: createRedisStore(), // Use Redis if available
});

// Auth endpoints rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs(15 min)
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Refresh token rate limiter
const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Allow more refresh requests
  message: {
    success: false,
    message: 'Too many token refresh attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// User API endpoints rate limiter
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes for authenticated users
  message: {
    success: false,
    message: 'API rate limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID for rate limiting if authenticated, otherwise IP
    return req.user ? `user:${req.user._id}` : ipKeyGenerator(req);
  },
});

// Analytics endpoints rate limiter (most permissive for heavy usage)
const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes for analytics
  message: {
    success: false,
    message: 'Analytics API rate limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? `analytics:${req.user._id}` : ipKeyGenerator(req);
  },
});

// Device operations rate limiter
const deviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 device operations per 15 minutes
  message: {
    success: false,
    message: 'Device API rate limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? `device:${req.user._id}` : ipKeyGenerator(req);
  },
});

// Heartbeat specific limiter (very permissive)
const heartbeatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 heartbeats per minute per device
  message: {
    success: false,
    message: 'Heartbeat rate limit exceeded.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const deviceId = req.params.id;
    const userId = req.user ? req.user._id : ipKeyGenerator(req);
    return `heartbeat:${userId}:${deviceId}`;
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  refreshLimiter,
  userLimiter,
  analyticsLimiter,
  deviceLimiter,
  heartbeatLimiter,
};