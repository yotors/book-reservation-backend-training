const bookController = require('../controllers/bookController');
const Book = require('../models/Book');

jest.mock('../models/Book');

describe('Books Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {
        title: 'Test Book',
        author: 'Test Author',
        description: 'A test book description',
        publicationDate: new Date('2025-03-22T22:08:54.891Z')
      }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('addBook', () => {
    it('should create a new book successfully', async () => {
      const mockBook = {
        _id: '67df34f9a0442aca0a010b78',
        ...mockReq.body,
        __v: 0
      };

      const mockSave = jest.fn().mockResolvedValue({...mockBook});
      Book.mockImplementation(() => ({
        save: mockSave
      }));

      await bookController.addBook(mockReq, mockRes);

      expect(mockSave).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockBook);
    });
  });

  describe('getBooks', () => {
    it('should get all books', async () => {
      const mockBooks = [
        {
          _id: '67df34f9a0442aca0a010b7a',
          ...mockReq.body,
          __v: 0
        },
        {
          _id: '67df34f9a0442aca0a010b7c',
          title: 'Another Book',
          author: 'Another Author',
          description: 'A test book description',
          publicationDate: new Date('2025-03-22T22:08:54.891Z'),
          __v: 0
        }
      ];

      Book.find.mockResolvedValue(mockBooks);

      await bookController.getBooks(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockBooks);
    });
  });

  describe('getBook', () => {
    it('should get a book by ID', async () => {
      const bookId = '67df34f9a0442aca0a010b7f';
      const mockBook = {
        _id: bookId,
        ...mockReq.body,
        __v: 0
      };

      mockReq.params = { id: bookId };
      Book.findById.mockResolvedValue(mockBook);

      await bookController.getBook(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockBook);
    });

    it('should return 404 for non-existent book', async () => {
      const bookId = '67df34f9a0442aca0a010b7f';
      mockReq.params = { id: bookId };
      Book.findById.mockResolvedValue(null);

      await bookController.getBook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Book not found'
      });
    });
  });

  describe('updateBook', () => {
    it('should update a book successfully', async () => {
      const bookId = '67df34f9a0442aca0a010b85';
      const updatedBook = {
        _id: bookId,
        title: 'Updated Book Title',
        author: 'Test Author',
        description: 'Updated description',
        publicationDate: new Date('2025-03-22T22:08:54.891Z'),
        __v: 0
      };

      mockReq.params = { id: bookId };
      mockReq.body = {
        title: 'Updated Book Title',
        description: 'Updated description'
      };

      const mockSave = jest.fn().mockResolvedValue({...updatedBook});
      const mockBookInstance = {
        ...updatedBook,
        save: mockSave
      };
      Book.findById.mockResolvedValue(mockBookInstance);

      await bookController.updateBook(mockReq, mockRes);

      expect(mockSave).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        _id: bookId,
        title: 'Updated Book Title',
        author: 'Test Author',
        description: 'Updated description',
        publicationDate: expect.any(Date),
        __v: 0
      }));
    });

    it('should return 404 for non-existent book', async () => {
      const bookId = '67df34f9a0442aca0a010b85';
      mockReq.params = { id: bookId };
      Book.findById.mockResolvedValue(null);

      await bookController.updateBook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Book not found'
      });
    });
  });
}); 