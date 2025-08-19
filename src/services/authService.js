const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

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

// LOGIN
const login = async (credentials) => {
  const { email, password } = credentials;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive) {
    throw new Error('Invalid credentials');
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken({
    id: user._id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

// GET USER
const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new Error('User not found');
  }
  return user;
};

// UPDATE USER
const updateUser = async (userId, updateData) => {
  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new Error('User not found');
  }

  return user;
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

  return user;
};

module.exports = {
  signup,
  login,
  getUserById,
  updateUser,
  deactivateUser,
};
