const { z } = require('zod');
const mongoose = require('mongoose');

const exportLogsSchema = z.object({
  deviceId: z.string()
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid device ID format',
    })
    .optional(),
  format: z.enum(['csv', 'json']).default('csv'),
  dateFrom: z.string()
    .datetime({ offset: true })
    .optional()
    .transform((val) => val ? new Date(val) : undefined),
  dateTo: z.string()
    .datetime({ offset: true })
    .optional()
    .transform((val) => val ? new Date(val) : undefined),
  event: z.string().min(1).max(50).optional(),
}).refine((data) => {
  if (data.dateFrom && data.dateTo) {
    return data.dateFrom <= data.dateTo;
  }
  return true;
}, {
  message: 'dateFrom must be before or equal to dateTo',
  path: ['dateFrom'],
});

const exportUsageSchema = z.object({
  format: z.enum(['csv', 'json']).default('json'),
  dateFrom: z.string()
    .datetime({ offset: true })
    .optional()
    .transform((val) => val ? new Date(val) : undefined),
  dateTo: z.string()
    .datetime({ offset: true })
    .optional()
    .transform((val) => val ? new Date(val) : undefined),
  groupBy: z.enum(['device', 'day']).default('device'),
}).refine((data) => {
  if (data.dateFrom && data.dateTo) {
    return data.dateFrom <= data.dateTo;
  }
  return true;
}, {
  message: 'dateFrom must be before or equal to dateTo',
  path: ['dateFrom'],
});

const jobParamsSchema = z.object({
  jobId: z.string()
    .uuid('Invalid job ID format'),
});

module.exports = {
  exportLogsSchema,
  exportUsageSchema,
  jobParamsSchema,
};