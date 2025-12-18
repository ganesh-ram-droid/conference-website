import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'necadmin';

export const signup = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const userRole = role || 'user'; // Default to 'user' if not specified

  try {
    // Check if user already exists
    const checkUserQuery = 'SELECT id FROM users WHERE email = ?';
    db.query(checkUserQuery, [email], async (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length > 0) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user
      const insertQuery = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
      db.query(insertQuery, [name, email, hashedPassword, userRole], (err, result) => {
        if (err) {
          console.error('DB insert error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Generate JWT
        const token = jwt.sign({ id: result.insertId, name, email, role: userRole }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
          message: 'User created successfully',
          token,
          user: { id: result.insertId, name, email, role: userRole }
        });
      });
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const query = 'SELECT id, name, email, password, role, track, isFirstLogin FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const user = results[0];

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, track: user.track, isFirstLogin: user.isFirstLogin }, JWT_SECRET, { expiresIn: '24h' });

      const responseUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };

      // Include isFirstLogin if reviewer and first login
      if (user.role === 'reviewer' && user.isFirstLogin) {
        responseUser.isFirstLogin = true;
      }

      res.json({
        message: 'Login successful',
        token,
        user: responseUser
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const changePassword = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
    // Get current user details from database
    const query = 'SELECT password, isFirstLogin FROM users WHERE id = ?';
    db.query(query, [req.user.id], async (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = results[0];

      // If isFirstLogin, skip current password verification (but in practice, user enters default)
      let isValidPassword = true;
      if (!user.isFirstLogin) {
        isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password and set isFirstLogin to 0
      const updateQuery = 'UPDATE users SET password = ?, isFirstLogin = 0 WHERE id = ?';
      db.query(updateQuery, [hashedNewPassword, req.user.id], (err, result) => {
        if (err) {
          console.error('DB update error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Generate new token with updated isFirstLogin
        const newToken = jwt.sign({
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          isFirstLogin: false
        }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ 
          message: 'Password changed successfully',
          token: newToken 
        });
      });
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
