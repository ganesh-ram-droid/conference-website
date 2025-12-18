import { db } from '../config/db.js';
import { createSupportTicket, getAllSupportTickets, getSupportTicketById, updateSupportTicket, deleteSupportTicket } from '../models/supportTicketModel.js';

export const getSupportTickets = (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'support_admin') {
    return res.status(403).json({ error: 'Access denied. Admin or Support Admin only.' });
  }

  getAllSupportTickets((err, results) => {
    if (err) {
      console.error('DB error fetching support tickets:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
};

export const createSupportTicketAdmin = (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'support_admin') {
    return res.status(403).json({ error: 'Access denied. Admin or Support Admin only.' });
  }

  const { title, description, priority, status, userId, assignedTo } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  const ticketData = {
    title,
    description,
    priority: priority || 'medium',
    status: status || 'open',
    userId: userId || null,
    assignedTo: assignedTo || null
  };

  createSupportTicket(ticketData, (err, result) => {
    if (err) {
      console.error('DB error creating support ticket:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({ message: 'Support ticket created successfully', ticketId: result.insertId });
  });
};

export const assignTechnician = (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'support_admin') {
    return res.status(403).json({ error: 'Access denied. Admin or Support Admin only.' });
  }

  const { ticketId, technicianId } = req.body;

  if (!ticketId || !technicianId) {
    return res.status(400).json({ error: 'Ticket ID and Technician ID are required' });
  }

  // Check if technician exists and has role 'technician'
  const checkTechnicianQuery = 'SELECT id FROM users WHERE id = ? AND role = ?';
  db.query(checkTechnicianQuery, [technicianId, 'technician'], (err, results) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Technician not found' });
    }

    // Update ticket
    updateSupportTicket(ticketId, { assignedTo: technicianId }, (err, result) => {
      if (err) {
        console.error('DB error updating ticket:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Technician assigned successfully' });
    });
  });
};

export const updateTicketStatus = (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'support_admin' && req.user.role !== 'technician') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const { ticketId, status } = req.body;

  if (!ticketId || !status) {
    return res.status(400).json({ error: 'Ticket ID and status are required' });
  }

  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  updateSupportTicket(ticketId, { status }, (err, result) => {
    if (err) {
      console.error('DB error updating ticket status:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Ticket status updated successfully' });
  });
};

export const getTechnicians = (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'support_admin') {
    return res.status(403).json({ error: 'Access denied. Admin or Support Admin only.' });
  }

  const query = 'SELECT id, name, email FROM users WHERE role = ?';
  db.query(query, ['technician'], (err, results) => {
    if (err) {
      console.error('DB error fetching technicians:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
};

export const deleteSupportTicketAdmin = (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'support_admin') {
    return res.status(403).json({ error: 'Access denied. Admin or Support Admin only.' });
  }

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Ticket ID is required' });
  }

  deleteSupportTicket(id, (err, result) => {
    if (err) {
      console.error('DB error deleting ticket:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Support ticket deleted successfully' });
  });
};
