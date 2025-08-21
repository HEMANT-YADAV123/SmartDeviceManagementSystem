const { z } = require('zod');

const signupSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters'),
  email: z.string()
    .email('Invalid email format')
    .toLowerCase(),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must not exceed 100 characters'),
  role: z.enum(['user', 'admin']).optional().default('user'),
});

const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase(),
  password: z.string()
    .min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string()
    .min(1, 'Refresh token is required'),
});

module.exports = {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
};