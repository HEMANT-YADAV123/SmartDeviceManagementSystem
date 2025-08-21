const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validation');
const { authLimiter, refreshLimiter } = require('../middlewares/rateLimiter');
const { 
  signupSchema, 
  loginSchema, 
  refreshTokenSchema 
} = require('../validators/authValidators');

const router = express.Router();

// Public routes with rate limiting
router.post('/signup', 
  authLimiter, 
  validate(signupSchema), 
  authController.signup
);

router.post('/login', 
  authLimiter, 
  validate(loginSchema), 
  authController.login
);

router.post('/refresh', 
  refreshLimiter,
  validate(refreshTokenSchema), 
  authController.refreshTokens
);

router.post('/logout',
  authLimiter,
  authController.logout
);

// Protected routes
router.get('/profile', 
  authenticate, 
  authController.getProfile
);

router.patch('/profile', 
  authenticate, 
  authController.updateProfile
);

module.exports = router;