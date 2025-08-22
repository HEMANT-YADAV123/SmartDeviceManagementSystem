const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const RefreshToken = require('../models/RefreshToken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generate access token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

/**
 * Verify access token
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Generate refresh token
 */
const generateRefreshToken = async (userId, ipAddress = null, userAgent = null) => {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  const refreshToken = new RefreshToken({
    userId,
    token,
    expiresAt,
    ipAddress,
    userAgent,
  });

  await refreshToken.save();
  return token;
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = async (token) => {
  const refreshToken = await RefreshToken.findOne({
    token,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).populate('userId');

  if (!refreshToken) {
    throw new Error('Invalid or expired refresh token');
  }

  return refreshToken;
};

/**
 * Revoke refresh token
 */
const revokeRefreshToken = async (token, revokedBy = null) => {
  const refreshToken = await RefreshToken.findOne({ token });
  
  if (refreshToken) {
    refreshToken.isRevoked = true;
    refreshToken.revokedAt = new Date();
    refreshToken.revokedBy = revokedBy;
    await refreshToken.save();
  }

  return refreshToken;
};

/**
 * Revoke all refresh tokens for a user
 */
const revokeAllUserTokens = async (userId) => {
  await RefreshToken.updateMany(
    { userId, isRevoked: false },
    {
      isRevoked: true,
      revokedAt: new Date(),
    }
  );
};

/**
 * Clean up expired tokens (for maintenance)
 */
const cleanupExpiredTokens = async () => {
  const result = await RefreshToken.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  
  console.log(`Cleaned up ${result.deletedCount} expired refresh tokens`);
  return result.deletedCount;
};

/**
 * Generate token pair (access + refresh)
 */
const generateTokenPair = async (user, ipAddress = null, userAgent = null) => {
  const payload = {
    id: user._id || user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateToken(payload);//using JWT , expire after 15 min
  const refreshToken = await generateRefreshToken(user._id || user.id, ipAddress, userAgent);//using uuid stores in db

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRY,
  };
};

/**
 * Refresh tokens
 */
const refreshTokens = async (refreshToken, ipAddress = null, userAgent = null) => {
  // Verify the refresh token
  const tokenDoc = await verifyRefreshToken(refreshToken);
  
  // Revoke the old refresh token
  await revokeRefreshToken(refreshToken);
  
  // Generate new token pair
  const tokens = await generateTokenPair(tokenDoc.userId, ipAddress, userAgent);
  
  return tokens;
};

module.exports = {
  generateToken,
  verifyToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  generateTokenPair,
  refreshTokens,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
};