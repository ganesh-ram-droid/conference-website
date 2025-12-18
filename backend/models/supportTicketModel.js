import { db } from '../config/db.js';

export const createSupportTicket = (ticketData, callback) => {
  const { title, description, priority, status, userId, assignedTo } = ticketData;
  const query = `
    INSERT INTO support_tickets (title, description, priority, status, userId, assignedTo, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;
  db.query(query, [title, description, priority, status, userId, assignedTo], callback);
};

export const getAllSupportTickets = (callback) => {
  const query = `
    SELECT st.*, u.name as userName, t.name as technicianName
    FROM support_tickets st
    LEFT JOIN users u ON st.userId = u.id
    LEFT JOIN users t ON st.assignedTo = t.id
    ORDER BY st.createdAt DESC
  `;
  db.query(query, callback);
};

export const getSupportTicketById = (id, callback) => {
  const query = `
    SELECT st.*, u.name as userName, t.name as technicianName
    FROM support_tickets st
    LEFT JOIN users u ON st.userId = u.id
    LEFT JOIN users t ON st.assignedTo = t.id
    WHERE st.id = ?
  `;
  db.query(query, [id], callback);
};

export const updateSupportTicket = (id, ticketData, callback) => {
  const { title, description, priority, status, assignedTo } = ticketData;
  const query = `
    UPDATE support_tickets
    SET title = ?, description = ?, priority = ?, status = ?, assignedTo = ?, updatedAt = NOW()
    WHERE id = ?
  `;
  db.query(query, [title, description, priority, status, assignedTo, id], callback);
};

export const deleteSupportTicket = (id, callback) => {
  const query = 'DELETE FROM support_tickets WHERE id = ?';
  db.query(query, [id], callback);
};
