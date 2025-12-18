
import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'necadmin';

console.log('JWT_SECRET used in auth middleware:', JWT_SECRET);

// Simple in-memory rate limiter
const rateLimitStore = new Map();

export const apiRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 5000;

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }

  const requests = rateLimitStore.get(ip);
  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < windowMs);
  rateLimitStore.set(ip, validRequests);

  if (validRequests.length >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests from this IP, please try again later.' });
  }

  validRequests.push(now);
  next();
};

export const authenticateToken = (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader?.split(' ')[1];

  console.log('Authorization header:', authHeader);
  console.log('Token extracted:', token);

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification error:', err);
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.log('Decoded user from token:', user);
    req.user = user;
    next();
  });
};
