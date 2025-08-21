const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateTokenPair, refreshTokens, revokeRefreshToken } = require('../utils/jwt');
const cacheService = require('./cacheService');

// SIGNUP
const signup = async (userData) => {
  const { name, email, password, role } = userData;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = new User({
    name,
    email,
    password: hashedPassword,
    role,
  });

  await user.save();

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

// LOGIN with refresh tokens
const login = async (credentials, ipAddress = null, userAgent = null) => {
  const { email, password } = credentials;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive) {
    throw new Error('Invalid credentials');
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token pair
  const tokens = await generateTokenPair(user, ipAddress, userAgent);

  // Cache user data
  const userData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  
  await cacheService.cacheUser(user._id, userData);

  return {
    ...tokens,
    user: userData,
  };
};

// REFRESH TOKENS
const refreshUserTokens = async (refreshToken, ipAddress = null, userAgent = null) => {
  try {
    const tokens = await refreshTokens(refreshToken, ipAddress, userAgent);
    return tokens;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// LOGOUT (revoke refresh token)
const logout = async (refreshToken) => {
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  return { message: 'Logged out successfully' };
};

// GET USER with caching
const getUserById = async (userId) => {
  // Try cache first
  let user = await cacheService.getCachedUser(userId);
  
  if (!user) {
    // Cache miss - fetch from database
    const dbUser = await User.findById(userId);
    if (!dbUser || !dbUser.isActive) {
      throw new Error('User not found');
    }
    
    user = {
      id: dbUser._id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      createdAt: dbUser.createdAt,
      lastLogin: dbUser.lastLogin,
    };
    
    // Cache for next time
    await cacheService.cacheUser(userId, user);
  }
  
  return user;
};

// UPDATE USER with cache invalidation
const updateUser = async (userId, updateData) => {
  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new Error('User not found');
  }

  // Invalidate cache
  await cacheService.invalidateUser(userId);

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
};

// DEACTIVATE USER
const deactivateUser = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { isActive: false },
    { new: true }
  );

  if (!user) {
    throw new Error('User not found');
  }

  // Invalidate cache
  await cacheService.invalidateUser(userId);

  return user;
};

module.exports = {
  signup,
  login,
  refreshUserTokens,
  logout,
  getUserById,
  updateUser,
  deactivateUser,
};