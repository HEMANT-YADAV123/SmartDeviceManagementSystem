const { z } = require('zod');
const { LOG_EVENTS } = require('../utils/constants');

const createLogSchema = z.object({
  event: z.enum(Object.values(LOG_EVENTS), {
    errorMap: () => ({
      message: `Event must be one of: ${Object.values(LOG_EVENTS).join(', ')}`
    })
  }),

  value: z.union([
    z.number(),
    z.string(),
    z.boolean(),
    z.looseObject(),
  ]).refine(val => val !== null && val !== undefined, {
    message: 'Value is required and cannot be null or undefined'
  }),

  metadata: z.record(z.any())
    .optional()
    .default({}),
});

const logQuerySchema = z.object({
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a positive number')
    .transform(Number)
    .refine(val => val > 0 && val <= 1000, 'Limit must be between 1 and 1000')
    .optional()
    .default(10),

  event: z.enum(Object.values(LOG_EVENTS))
    .optional(),

  from: z.string()
    .pipe(z.iso.datetime({ message: 'From date must be in ISO format' })) 
    .optional(),

  to: z.string()
    .pipe(z.iso.datetime({ message: 'To date must be in ISO format' }))
    .optional(),
});

const usageQuerySchema = z.object({
  range: z.enum(['1h', '6h', '12h', '24h', '7d', '30d'], {
    errorMap: () => ({ message: 'Range must be one of: 1h, 6h, 12h, 24h, 7d, 30d' })
  }).optional().default('24h'),

  event: z.enum(Object.values(LOG_EVENTS))
    .optional(),
});

const deviceParamsSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid device ID format'),
});

module.exports = {
  createLogSchema,
  logQuerySchema,
  usageQuerySchema,
  deviceParamsSchema,
};
