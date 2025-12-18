import { body } from 'express-validator';

// Middleware to sanitize input data
export const sanitizeMiddleware = [
  body('*').trim().escape(), // Trim and escape all body fields
  (req, res, next) => {
    // Additional sanitization logic if needed
    next();
  }
];
