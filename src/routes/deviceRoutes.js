const express = require('express');
const deviceController = require('../controllers/deviceController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validation');
const { userLimiter } = require('../middlewares/rateLimiter');
const {
  createDeviceSchema,
  updateDeviceSchema,
  heartbeatSchema,
  deviceQuerySchema,
  deviceParamsSchema,
} = require('../validators/deviceValidators');

const router = express.Router();

// All device routes require authentication
router.use(authenticate);
router.use(userLimiter);

// Device CRUD operations
router.post('/', 
  validate(createDeviceSchema), 
  deviceController.createDevice
);

router.get('/', 
  validate(deviceQuerySchema, 'query'), 
  deviceController.getDevices
);

router.get('/stats', 
  deviceController.getDeviceStats
);

router.get('/by-type', 
  deviceController.getDevicesByType
);

router.get('/:id', 
  validate(deviceParamsSchema, 'params'),
  deviceController.getDevice
);

router.patch('/:id', 
  validate(deviceParamsSchema, 'params'),
  validate(updateDeviceSchema), 
  deviceController.updateDevice
);

router.delete('/:id', 
  validate(deviceParamsSchema, 'params'),
  deviceController.deleteDevice
);

// Heartbeat endpoint
router.post('/:id/heartbeat', 
  validate(deviceParamsSchema, 'params'),
  validate(heartbeatSchema), 
  deviceController.recordHeartbeat 
);

module.exports = router;