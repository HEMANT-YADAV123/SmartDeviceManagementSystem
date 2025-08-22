const express = require('express');
const exportController = require('../controllers/exportController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validation');
const { userLimiter } = require('../middlewares/rateLimiter');
const {
  exportLogsSchema,
  exportUsageSchema,
  jobParamsSchema,
} = require('../validators/exportValidators');

const router = express.Router();

// All export routes require authentication
router.use(authenticate);
router.use(userLimiter);

// Create export jobs
router.post('/device-logs', 
  validate(exportLogsSchema), 
  exportController.exportDeviceLogs
);

router.post('/usage-report', 
  validate(exportUsageSchema), 
  exportController.exportUsageReport
);

// Check job status
router.get('/jobs/:jobId/status', 
  validate(jobParamsSchema, 'params'),
  exportController.getJobStatus
);

// Download export result
router.get('/jobs/:jobId/download', 
  validate(jobParamsSchema, 'params'),
  exportController.downloadExport
);

module.exports = router;