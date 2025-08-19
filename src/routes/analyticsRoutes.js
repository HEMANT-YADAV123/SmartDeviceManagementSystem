const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validation');
const { userLimiter } = require('../middlewares/rateLimiter');
const {
  createLogSchema,
  logQuerySchema,
  usageQuerySchema,
  deviceParamsSchema,
} = require('../validators/analyticsValidators');

const router = express.Router();

// All analytics routes require authentication
router.use(authenticate);
router.use(userLimiter);

// Aggregated analytics (not device-specific)
router.get('/usage', 
  validate(usageQuerySchema, 'query'),
  analyticsController.getAggregatedUsage
);

router.get('/events/top', 
  analyticsController.getTopEvents
);

// Device-specific analytics
router.post('/devices/:id/logs', 
  validate(deviceParamsSchema, 'params'),
  validate(createLogSchema), 
  analyticsController.createLog
);

router.get('/devices/:id/logs', 
  validate(deviceParamsSchema, 'params'),
  validate(logQuerySchema, 'query'), 
  analyticsController.getDeviceLogs
);

router.get('/devices/:id/usage', 
  validate(deviceParamsSchema, 'params'),
  validate(usageQuerySchema, 'query'), 
  analyticsController.getDeviceUsage
);

module.exports = router;