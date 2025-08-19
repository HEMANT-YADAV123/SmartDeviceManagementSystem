const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const { HTTP_STATUS, USER_ROLES } = require('../utils/constants');

const authenticate = async (req, res, next) => {//verify the user is authenticated(token is present) and valid.
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const decoded = verifyToken(token);
    
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid token or user not found',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

const authorize = (...roles) => {//it runs after authetication and check is the authenticated user have required roles like "admin" or "user", if not then blocks the user.
  //we can use conditions here like only admin can delete users etc.
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};