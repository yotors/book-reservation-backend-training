const reservationsController = require('../controllers/reservationController');
const Reservation = require('../models/Reservation');
const Book = require('../models/Book');
const User = require('../models/User');
const { createNotification, notifyAdmins } = require('../utils/notificationUtils');

// Mock notification utilities
jest.mock('../utils/notificationUtils', () => ({
  createNotification: jest.fn(),
  notifyAdmins: jest.fn()
}));

describe('Reservations Controller', () => {
  let userId;
  let bookId;
  const mockReq = {
    body: {
      bookId: '',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: 'pending'
    },
    params: {},
    user: {
      id: '',
      name: 'Test User',
      isAdmin: false
    }
  };
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create test user
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      phoneNumber: '1234567890'
    });
    userId = user._id;
    mockReq.user.id = userId;

    // Create test book
    const book = await Book.create({
      title: 'Test Book',
      author: 'Test Author',
      publicationDate: new Date(),
      description: 'Test description'
    });
    bookId = book._id;
    mockReq.body.bookId = bookId;

    // Mock Mongoose populate
    const mockPopulate = jest.fn().mockReturnThis();
    Reservation.find = jest.fn().mockReturnValue({ populate: mockPopulate });
    Reservation.findById = jest.fn().mockReturnValue({ populate: mockPopulate });
    Reservation.findOne = jest.fn().mockImplementation(() => ({
      status: 'pending'
    }));
    Reservation.prototype.save = jest.fn().mockImplementation(function() {
      return Promise.resolve(this);
    });
  });

  describe('createReservation', () => {
    it('should create a new reservation successfully', async () => {
      const mockReservation = {
        _id: 'mockId',
        user: userId,
        book: bookId,
        startDate: mockReq.body.startDate,
        endDate: mockReq.body.endDate,
        status: 'pending',
        __v: 0,
        toJSON: function() {
          return {
            _id: this._id,
            user: this.user,
            book: this.book,
            startDate: this.startDate,
            endDate: this.endDate,
            status: this.status,
            __v: this.__v
          };
        }
      };
      Reservation.prototype.save.mockResolvedValueOnce(mockReservation);
      await reservationsController.createReservation(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockReservation);

      // Verify reservation was created in database
      const reservation = await Reservation.findOne({ user: userId, book: bookId });
      expect(reservation).toBeTruthy();
      expect(reservation.status).toBe('pending');

      // Verify admin notification was sent with correct message
      expect(notifyAdmins).toHaveBeenCalledWith(
        `New reservation request from Test User for "Test Book"`,
        'new_reservation'
      );
    });

    it('should return 404 for non-existent book', async () => {
      mockReq.body.bookId = '507f1f77bcf86cd799439011';
      await reservationsController.createReservation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Book not found'
        })
      );
    });

  });

  describe('updateReservationStatus', () => {
    let reservationId;

    beforeEach(async () => {
      const reservation = await Reservation.create({
        user: userId,
        book: bookId,
        startDate: mockReq.body.startDate,
        endDate: mockReq.body.endDate,
        status: 'pending'
      });
      reservationId = reservation._id;
      mockReq.params.id = reservationId;
      mockReq.body.status = 'approved';
      mockReq.user.isAdmin = true; // Admin required for this route

      // Mock populated reservation
      const mockReservation = {
        _id: reservationId,
        user: { _id: userId, name: 'Test User' },
        book: { _id: bookId, title: 'Test Book' },
        startDate: mockReq.body.startDate,
        endDate: mockReq.body.endDate,
        status: 'approved',
        __v: 0,
        save: jest.fn().mockResolvedValueOnce({
          _id: reservationId,
          user: { _id: userId, name: 'Test User' },
          book: { _id: bookId, title: 'Test Book' },
          startDate: mockReq.body.startDate,
          endDate: mockReq.body.endDate,
          status: 'approved',
          __v: 0
        })
      };
      Reservation.findById.mockImplementationOnce(() => ({
        populate: jest.fn().mockResolvedValue(mockReservation)
      }));
    });

    it('should update reservation status successfully', async () => {
      const mockReservation = {
        _id: reservationId,
        user: userId,
        book: { _id: bookId, title: 'Test Book' },
        startDate: mockReq.body.startDate,
        endDate: mockReq.body.endDate,
        status: 'pending',
        save: jest.fn().mockResolvedValueOnce({
          _id: reservationId,
          user: userId,
          book: { _id: bookId, title: 'Test Book' },
          startDate: mockReq.body.startDate,
          endDate: mockReq.body.endDate,
          status: 'approved',
          toJSON: function() {
            return {
              _id: this._id,
              user: this.user,
              book: this.book,
              startDate: this.startDate,
              endDate: this.endDate,
              status: this.status
            };
          }
        })
      };
      Reservation.findById.mockImplementationOnce(() => ({
        populate: jest.fn().mockResolvedValue(mockReservation)
      }));

      await reservationsController.updateReservationStatus(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: reservationId,
          status: 'approved',
          book: expect.objectContaining({
            title: 'Test Book'
          })
        })
      );

      // Verify user notification was sent with correct message
      expect(createNotification).toHaveBeenCalledWith(
        expect.any(Object),
        `Your reservation for "Test Book" has been approved`,
        'reservation_status'
      );
    });

    it('should return 404 for non-existent reservation', async () => {
      mockReq.params.id = '507f1f77bcf86cd799439011';
      Reservation.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await reservationsController.updateReservationStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Reservation not found'
      });
    });

  });

  describe('getReservations', () => {
    beforeEach(async () => {
      mockReq.user.isAdmin = true; // Admin required for this route
      // Create some test reservations
      await Reservation.create({
        user: userId,
        book: bookId,
        startDate: mockReq.body.startDate,
        endDate: mockReq.body.endDate,
        status: 'pending'
      });

      // Mock populated reservations
      Reservation.find.mockImplementationOnce(() => ({
        populate: jest.fn().mockImplementationOnce(() => ({
          populate: jest.fn().mockResolvedValue([{
            _id: expect.any(String),
            user: { _id: userId, name: 'Test User' },
            book: { _id: bookId, title: 'Test Book' },
            startDate: mockReq.body.startDate,
            endDate: mockReq.body.endDate,
            status: 'pending',
            __v: 0
          }])
        }))
      }));
    });

    it('should get all reservations with populated fields', async () => {
      await reservationsController.getReservations(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user: expect.objectContaining({
              name: 'Test User'
            }),
            book: expect.objectContaining({
              title: 'Test Book'
            }),
            status: 'pending'
          })
        ])
      );
    });

  });

  describe('getReservation', () => {
    let reservationId;

    beforeEach(async () => {
      const reservation = await Reservation.create({
        user: userId,
        book: bookId,
        startDate: mockReq.body.startDate,
        endDate: mockReq.body.endDate,
        status: 'pending'
      });
      reservationId = reservation._id;
      mockReq.params.id = reservationId;

      // Mock populated reservation
      const mockReservation = {
        _id: reservationId,
        user: { _id: userId, name: 'Test User' },
        book: { _id: bookId, title: 'Test Book' },
        startDate: mockReq.body.startDate,
        endDate: mockReq.body.endDate,
        status: 'pending',
        __v: 0
      };
      Reservation.findById.mockImplementationOnce(() => ({
        populate: jest.fn().mockImplementationOnce(() => ({
          populate: jest.fn().mockResolvedValue(mockReservation)
        }))
      }));
    });

    it('should get a reservation by ID for the owner with populated fields', async () => {
      const mockReservation = {
        _id: reservationId,
        user: { _id: userId, name: 'Test User' },
        book: { _id: bookId, title: 'Test Book' },
        startDate: mockReq.body.startDate,
        endDate: mockReq.body.endDate,
        status: 'pending',
        toJSON: function() {
          return {
            _id: this._id,
            user: this.user,
            book: this.book,
            startDate: this.startDate,
            endDate: this.endDate,
            status: this.status
          };
        }
      };
      Reservation.findById.mockImplementationOnce(() => ({
        populate: jest.fn().mockImplementationOnce(() => ({
          populate: jest.fn().mockResolvedValue(mockReservation)
        }))
      }));

      await reservationsController.getReservation(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: reservationId,
          user: expect.objectContaining({
            name: 'Test User'
          }),
          book: expect.objectContaining({
            title: 'Test Book'
          }),
          status: 'pending'
        })
      );
    });

    it('should get a reservation by ID for an admin', async () => {
      mockReq.user.isAdmin = true;
      const mockReservation = {
        _id: reservationId,
        user: { _id: userId, name: 'Test User' },
        book: { _id: bookId, title: 'Test Book' },
        startDate: mockReq.body.startDate,
        endDate: mockReq.body.endDate,
        status: 'pending',
        toJSON: function() {
          return {
            _id: this._id,
            user: this.user,
            book: this.book,
            startDate: this.startDate,
            endDate: this.endDate,
            status: this.status
          };
        }
      };
      Reservation.findById.mockImplementationOnce(() => ({
        populate: jest.fn().mockImplementationOnce(() => ({
          populate: jest.fn().mockResolvedValue(mockReservation)
        }))
      }));

      await reservationsController.getReservation(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: reservationId,
          user: expect.objectContaining({
            name: 'Test User'
          }),
          book: expect.objectContaining({
            title: 'Test Book'
          }),
          status: 'pending'
        })
      );
    });

    it('should return 403 for unauthorized access', async () => {
      mockReq.user.id = '507f1f77bcf86cd799439011'; // Different user
      mockReq.user.isAdmin = false;
      const mockReservation = {
        _id: reservationId,
        user: { 
          _id: {
            toString: () => '507f1f77bcf86cd799439012' // Different user ID
          },
          name: 'Test User'
        },
        book: { _id: bookId, title: 'Test Book' },
        startDate: mockReq.body.startDate,
        endDate: mockReq.body.endDate,
        status: 'pending',
        toJSON: function() {
          return {
            _id: this._id,
            user: { _id: this.user._id, name: this.user.name },
            book: this.book,
            startDate: this.startDate,
            endDate: this.endDate,
            status: this.status
          };
        }
      };
      Reservation.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockReservation)
        })
      });

      await reservationsController.getReservation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Not authorized to view this reservation'
      });
    });

    it('should return 404 for non-existent reservation', async () => {
      mockReq.params.id = '507f1f77bcf86cd799439011';
      Reservation.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      await reservationsController.getReservation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Reservation not found'
      });
    });

  });
}); 