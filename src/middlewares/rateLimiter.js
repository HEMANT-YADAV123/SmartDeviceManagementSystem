const rateLimit = require('express-rate-limit');
const { HTTP_STATUS } = require('../utils/constants');

// General rate limiter for all requests
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per minute
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Per-user rate limiter (requires authentication)
const createUserLimiter = () => {
  const userLimiters = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    
    if (!userLimiters.has(userId)) {
      userLimiters.set(userId, rateLimit({
        windowMs: 60000, // 1 minute
        max: 100, // 100 requests per minute per user
        message: {
          success: false,
          message: 'Rate limit exceeded for your account.',
        },
        statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: () => userId,
      }));
    }

    const limiter = userLimiters.get(userId);
    limiter(req, res, next);
  };
};

module.exports = {
  generalLimiter,
  authLimiter,
  userLimiter: createUserLimiter(),
};