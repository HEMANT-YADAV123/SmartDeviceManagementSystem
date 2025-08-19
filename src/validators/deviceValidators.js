const { z } = require('zod');
const { DEVICE_TYPES, DEVICE_STATUSES } = require('../utils/constants');

const createDeviceSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Device name is required')
    .max(100, 'Device name cannot exceed 100 characters'),
  
  type: z.enum(Object.values(DEVICE_TYPES), {
    errorMap: () => ({ message: `Type must be one of: ${Object.values(DEVICE_TYPES).join(', ')}` })
  }),
  
  status: z.enum(Object.values(DEVICE_STATUSES))
    .optional()
    .default(DEVICE_STATUSES.ACTIVE),
  
  metadata: z.record(z.any())
    .optional()
    .default({}),
});

const updateDeviceSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Device name is required')
    .max(100, 'Device name cannot exceed 100 characters')
    .optional(),
  
  type: z.enum(Object.values(DEVICE_TYPES))
    .optional(),
  
  status: z.enum(Object.values(DEVICE_STATUSES))
    .optional(),
  
  metadata: z.record(z.any())
    .optional(),
});

const heartbeatSchema = z.object({
  status: z.enum(Object.values(DEVICE_STATUSES))
    .optional()
    .default(DEVICE_STATUSES.ACTIVE),
});

const deviceQuerySchema = z.object({
  type: z.enum(Object.values(DEVICE_TYPES))
    .optional(),
  
  status: z.enum(Object.values(DEVICE_STATUSES))
    .optional(),
  
  page: z.string()
    .regex(/^\d+$/, 'Page must be a positive number')
    .transform(Number)
    .refine(val => val > 0, 'Page must be greater than 0')
    .optional()
    .default(1),
  
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a positive number')
    .transform(Number)
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default(10),
});

const deviceParamsSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid device ID format'),
});

module.exports = {
  createDeviceSchema,
  updateDeviceSchema,
  heartbeatSchema,
  deviceQuerySchema,
  deviceParamsSchema,
};