jest.mock('../../models/User');
jest.mock('../../utils/password');
jest.mock('../../utils/jwt');

const authService = require('../../services/authService');
const User = require('../../models/User');
const { hashPassword, comparePassword } = require('../../utils/password');
const { generateToken } = require('../../utils/jwt');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'user'
      };

      const mockUser = {
        _id: 'userId123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        save: jest.fn().mockResolvedValue()
      };

      User.findOne.mockResolvedValue(null);
      User.mockImplementation(() => mockUser);
      hashPassword.mockResolvedValue('hashedPassword123');

      const result = await authService.signup(userData);

      expect(User.findOne).toHaveBeenCalledWith({ email: userData.email });
      expect(hashPassword).toHaveBeenCalledWith(userData.password);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'userId123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user'
      });
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      User.findOne.mockResolvedValue({ email: userData.email });

      await expect(authService.signup(userData)).rejects.toThrow('User with this email already exists');
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockUser = {
        _id: 'userId123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        password: 'hashedPassword123',
        isActive: true,
        save: jest.fn().mockResolvedValue()
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });
      comparePassword.mockResolvedValue(true);
      generateToken.mockReturnValue('token123');

      const result = await authService.login(credentials);

      expect(result.token).toBe('token123');
      expect(result.user.id).toBe('userId123');
    });

    it('should throw error for invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');
    });
  });
});