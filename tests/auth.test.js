const authController = require('../controllers/authController');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../models/User');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../config/database', () => ({
  secret: 'test-secret'
}));
jest.mock('../utils/notificationUtils', () => ({
  notifyAdmins: jest.fn().mockResolvedValue(true)
}));

describe('Auth Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {
        name: 'Test User',
        email: 'test@test.com',
        phoneNumber: '1234567890',
        password: 'password123'
      }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };
    // Reset jwt.sign mock before each test
    jwt.sign.mockImplementation((payload, secret, options, callback) => {
      callback(null, 'testtoken123');
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'testid123',
        name: mockReq.body.name,
        email: mockReq.body.email,
        phoneNumber: mockReq.body.phoneNumber,
        save: jest.fn().mockResolvedValue({
          id: 'testid123',
          name: mockReq.body.name,
          email: mockReq.body.email,
          phoneNumber: mockReq.body.phoneNumber
        })
      };

      User.findOne.mockResolvedValue(null);
      User.mockImplementation(() => mockUser);

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        token: 'testtoken123',
        userId: 'testid123'
      });
    });

    it('should not register user with existing email', async () => {
      const mockUser = {
        id: 'testid123',
        email: mockReq.body.email
      };

      User.findOne.mockResolvedValue(mockUser);

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User already exists'
        })
      );
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const mockUser = {
        id: 'testid123',
        email: mockReq.body.email,
        password: 'hashedpassword',
        isApproved: true,
        isAdmin: false
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      mockReq.body = {
        email: 'test@test.com',
        password: 'password123'
      };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        token: 'testtoken123',
        isAdmin: false
      });
    });

    it('should not login with incorrect credentials', async () => {
      const mockUser = {
        id: 'testid123',
        email: mockReq.body.email,
        password: 'hashedpassword',
        isApproved: true
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false); // Password doesn't match

      mockReq.body = {
        email: 'test@test.com',
        password: 'wrongpassword'
      };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid credentials'
      });
    });
  });
}); 