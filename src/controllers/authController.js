const authService = require('../services/authService');
const { HTTP_STATUS } = require('../utils/constants');

const getClientInfo = (req) => ({
  ipAddress: req.ip || req.connection.remoteAddress,
  userAgent: req.get('User-Agent'),
});

const signup = async (req, res, next) => {
  try {
    const user = await authService.signup(req.body);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    if (error.message === 'User with this email already exists') {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { ipAddress, userAgent } = getClientInfo(req);
    const result = await authService.login(req.body, ipAddress, userAgent);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Login successful',
      ...result,
    });
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

const refreshTokens = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const { ipAddress, userAgent } = getClientInfo(req);
    
    const tokens = await authService.refreshUserTokens(refreshToken, ipAddress, userAgent);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Tokens refreshed successfully',
      ...tokens,
    });
  } catch (error) {
    if (error.message === 'Invalid refresh token') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.user._id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      user,
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const allowedUpdates = ['name'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    const user = await authService.updateUser(req.user._id, updates);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

module.exports = {
  signup,
  login,
  refreshTokens,
  logout,
  getProfile,
  updateProfile,
};