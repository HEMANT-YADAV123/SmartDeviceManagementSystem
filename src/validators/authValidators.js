const { z } = require('zod');
const { USER_ROLES } = require('../utils/constants');

const signupSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  
  email: z.string()
    .email('Invalid email format')
    .transform((val) => val.trim().toLowerCase()),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  role: z.enum(Object.values(USER_ROLES))
    .optional()
    .default(USER_ROLES.USER),
});

const loginSchema = z.object({
  email: z.string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Invalid email format' })),//.pipe(z.email()) → validates it as an email after transformations.
  
  password: z.string()
    .min(1, 'Password is required'),
});

module.exports = {
  signupSchema,
  loginSchema,
};