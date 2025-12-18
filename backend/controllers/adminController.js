import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import {
  sendReviewerAssignmentEmail,
  sendReviewerCredentialsEmail,
  sendPaperStatusUpdateEmail,
  sendFinalSubmissionResetEmail
} from '../services/emailServices.js';

const JWT_SECRET = process.env.JWT_SECRET || 'necadmin';

// List all assignments (admin)
export const getAllAssignments = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { fromDate, toDate, paperTracks, reviewerTracks } = req.query;
  let query = `
    SELECT
      pa.paperId,
      r.paperTitle,
      r.tracks as paperTracks,
      r.createdAt,
      u1.name as reviewer1Name,
      CONCAT(u1.name, ' (', u1.email, ')') as reviewer1Details,
      u1.track as reviewer1Track,
      u2.name as reviewer2Name,
      CONCAT(u2.name, ' (', u2.email, ')') as reviewer2Details,
      u2.track as reviewer2Track,
      pa.reviewer1,
      pa.reviewer2
    FROM paper_assignments pa
    JOIN registrations r ON pa.paperId = r.id
    LEFT JOIN users u1 ON pa.reviewer1 = u1.id
    LEFT JOIN users u2 ON pa.reviewer2 = u2.id
  `;
  const params = [];
  const conditions = [];

  if (fromDate) {
    conditions.push('r.createdAt >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('r.createdAt < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(toDate);
  }
  if (paperTracks) {
    const tracks = Array.isArray(paperTracks) ? paperTracks : [paperTracks];
    const placeholders = tracks.map(() => '?').join(',');
    conditions.push(`r.tracks IN (${placeholders})`);
    params.push(...tracks);
  }
  if (reviewerTracks) {
    const tracks = Array.isArray(reviewerTracks) ? reviewerTracks : [reviewerTracks];
    const placeholders = tracks.map(() => '?').join(',');
    conditions.push(`(u1.track IN (${placeholders}) OR u2.track IN (${placeholders}))`);
    params.push(...tracks, ...tracks);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY r.paperTitle';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('DB error fetching assignments:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Process results to format reviewers
    const processedResults = results.map(row => {
      const reviewerNames = [];
      const reviewerDetails = [];
      const reviewerIds = [];
      if (row.reviewer1) {
        reviewerNames.push(row.reviewer1Name);
        reviewerDetails.push(row.reviewer1Details);
        reviewerIds.push(row.reviewer1);
      }
      if (row.reviewer2) {
        reviewerNames.push(row.reviewer2Name);
        reviewerDetails.push(row.reviewer2Details);
        reviewerIds.push(row.reviewer2);
      }
      return {
        paperId: row.paperId,
        paperTitle: row.paperTitle,
        track: row.paperTracks,
        reviewerNames,
        reviewerDetails,
        reviewerIds
      };
    });

    res.json(processedResults);
  });
};

// Delete assignment (unassign reviewer from paper)
export const deleteAssignment = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  const { paperId, reviewerId } = req.params;
  if (!paperId || !reviewerId) {
    return res.status(400).json({ error: 'Paper ID and reviewer ID are required' });
  }
  // Check which reviewer column to set to NULL
  const checkQuery = 'SELECT reviewer1, reviewer2 FROM paper_assignments WHERE paperId = ?';
  db.query(checkQuery, [paperId], (err, results) => {
    if (err) {
      console.error('DB error checking assignment:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    const row = results[0];
    let updateQuery;
    let params;
    if (row.reviewer1 == reviewerId) {
      updateQuery = 'UPDATE paper_assignments SET reviewer1 = NULL WHERE paperId = ?';
      params = [paperId];
    } else if (row.reviewer2 == reviewerId) {
      updateQuery = 'UPDATE paper_assignments SET reviewer2 = NULL WHERE paperId = ?';
      params = [paperId];
    } else {
      return res.status(404).json({ error: 'Reviewer not assigned to this paper' });
    }
    db.query(updateQuery, params, (err, result) => {
      if (err) {
        console.error('DB error updating assignment:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Assignment deleted successfully', paperId, reviewerId });
    });
  });
};

// Update assignment (change reviewer for a paper)
export const updateAssignment = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  const { paperId, reviewerId } = req.params;
  const { reviewerId: newReviewerId } = req.body;
  if (!paperId || !reviewerId || !newReviewerId) {
    return res.status(400).json({ error: 'Paper ID, current reviewer ID, and new reviewer ID are required' });
  }
  // First, check current assignments
  const checkQuery = 'SELECT reviewer1, reviewer2 FROM paper_assignments WHERE paperId = ?';
  db.query(checkQuery, [paperId], (err, results) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    const row = results[0];
    let updateQuery;
    let params;
    if (row.reviewer1 == reviewerId) {
      updateQuery = 'UPDATE paper_assignments SET reviewer1 = ? WHERE paperId = ?';
      params = [newReviewerId, paperId];
    } else if (row.reviewer2 == reviewerId) {
      updateQuery = 'UPDATE paper_assignments SET reviewer2 = ? WHERE paperId = ?';
      params = [newReviewerId, paperId];
    } else {
      return res.status(404).json({ error: 'Reviewer not assigned to this paper' });
    }
    db.query(updateQuery, params, (err, result) => {
      if (err) {
        console.error('DB error updating assignment:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Assignment updated successfully', paperId, oldReviewerId: reviewerId, newReviewerId });
    });
  });
};

export const createReviewer = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { name, email, password, track } = req.body;

  if (!name || !email || !password || !track) {
    return res.status(400).json({ error: 'Name, email, password, and track are required' });
  }

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

      // Insert reviewer
      const insertQuery = 'INSERT INTO users (name, email, password, role, track, isFirstLogin) VALUES (?, ?, ?, ?, ?, 1)';
      db.query(insertQuery, [name, email, hashedPassword, 'reviewer', track], async (err, result) => {
        if (err) {
          console.error('DB insert error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Send email with credentials to the new reviewer
        let emailLog = '';
        try {
          await sendReviewerCredentialsEmail(email, name, password);
          emailLog = `Reviewer credentials email sent successfully to ${email}`;
          console.log(emailLog);
        } catch (emailError) {
          emailLog = `Failed to send reviewer credentials email to ${email}: ${emailError.message}`;
          console.error(emailLog);
          // Don't fail the creation if email fails
        }

        res.status(201).json({
          message: 'Reviewer created successfully',
          user: { id: result.insertId, name, email, role: 'reviewer', track },
          emailSent: true,
          emailLog: emailLog
        });
      });
    });
  } catch (error) {
    console.error('Create reviewer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getReviewers = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const query = "SELECT id, name, email, track FROM users WHERE role = 'reviewer'";

  db.query(query, (err, results) => {
    if (err) {
      console.error('DB error fetching reviewers:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(results);
  });
};

// Helper function to assign reviewer without req/res
export const assignReviewerDirect = async (paperId, reviewerId) => {
  return new Promise((resolve, reject) => {
    if (!paperId || !reviewerId) {
      return reject(new Error('paperId and reviewerId are required'));
    }

    try {
      // Check current assignments for the paper
      const checkQuery = 'SELECT reviewer1, reviewer2 FROM paper_assignments WHERE paperId = ?';
      db.query(checkQuery, [paperId], async (err, results) => {
        if (err) {
          console.error('DB error:', err);
          return reject(err);
        }

        let reviewer1 = null;
        let reviewer2 = null;
        let hasRow = false;
        let slot;

        if (results.length > 0) {
          hasRow = true;
          reviewer1 = results[0].reviewer1;
          reviewer2 = results[0].reviewer2;
        }

        // Check if reviewer is already assigned to this paper
        if (reviewer1 == reviewerId || reviewer2 == reviewerId) {
          return reject(new Error('Reviewer already assigned to this paper'));
        }

        // Determine available slot
        if (reviewer1 === null) {
          slot = 1;
        } else if (reviewer2 === null) {
          slot = 2;
        } else {
          return reject(new Error('No available slot'));
        }

        // Get reviewer and paper details for email
        const getDetailsQuery = `
          SELECT u.name as reviewerName, u.email as reviewerEmail, r.paperTitle
          FROM users u
          JOIN registrations r ON r.id = ?
          WHERE u.id = ?
        `;

        db.query(getDetailsQuery, [paperId, reviewerId], async (err, details) => {
          if (err) {
            console.error('DB error fetching details:', err);
            return reject(err);
          }

          if (details.length === 0) {
            return reject(new Error('Reviewer or paper not found'));
          }

          const { reviewerName, reviewerEmail, paperTitle } = details[0];

          let query;
          let params;

          if (!hasRow) {
            // Insert new assignment row
            if (slot === 1) {
              query = 'INSERT INTO paper_assignments (paperId, reviewer1) VALUES (?, ?)';
              params = [paperId, reviewerId];
            } else {
              query = 'INSERT INTO paper_assignments (paperId, reviewer2) VALUES (?, ?)';
              params = [paperId, reviewerId];
            }
          } else {
            // Update existing row
            if (slot === 1) {
              query = 'UPDATE paper_assignments SET reviewer1 = ? WHERE paperId = ?';
              params = [reviewerId, paperId];
            } else {
              query = 'UPDATE paper_assignments SET reviewer2 = ? WHERE paperId = ?';
              params = [reviewerId, paperId];
            }
          }

          db.query(query, params, async (err, result) => {
            if (err) {
              console.error('DB insert/update error:', err);
              return reject(err);
            }

            // Update paper status to under_review
            const updateStatusQuery = 'UPDATE registrations SET status = ? WHERE id = ?';
            db.query(updateStatusQuery, ['under_review', paperId], async (err, updateResult) => {
              if (err) {
                console.error('DB error updating paper status:', err);
                return reject(err);
              }

              // Send email notification to reviewer (don't fail assignment if email fails)
              try {
                await sendReviewerAssignmentEmail(reviewerEmail, reviewerName, paperTitle, paperId);
                console.log(`Assignment notification sent to reviewer: ${reviewerEmail}`);
              } catch (emailError) {
                console.error('Failed to send assignment notification email:', emailError.message);
                // Continue without failing
              }

              resolve({
                message: 'Reviewer assigned successfully',
                assignmentId: result.insertId || result.affectedRows,
                emailSent: true
              });
            });
          });
        });
      });
    } catch (error) {
      console.error('Assign reviewer error:', error);
      reject(error);
    }
  });
};

export const assignReviewer = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { paperId, reviewerId } = req.body;

  try {
    const result = await assignReviewerDirect(paperId, reviewerId);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Assign reviewer error:', error);
    if (error.message === 'Reviewer already assigned to this paper') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'No available slot') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Reviewer or paper not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

export const getReviewersWithAssignments = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const query = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.track,
      COUNT(DISTINCT pa.paperId) as assignedPapers,
      GROUP_CONCAT(DISTINCT r.paperTitle SEPARATOR '; ') as paperTitles
    FROM users u
    LEFT JOIN (
      SELECT paperId, reviewer1 as reviewerId FROM paper_assignments WHERE reviewer1 IS NOT NULL
      UNION ALL
      SELECT paperId, reviewer2 as reviewerId FROM paper_assignments WHERE reviewer2 IS NOT NULL
    ) pa ON u.id = pa.reviewerId
    LEFT JOIN registrations r ON pa.paperId = r.id
    WHERE u.role = 'reviewer'
    GROUP BY u.id, u.name, u.email, u.track
    ORDER BY u.name
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('DB error fetching reviewers with assignments:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Process the results to format paper titles
    const processedResults = results.map(reviewer => ({
      id: reviewer.id,
      name: reviewer.name,
      email: reviewer.email,
      track: reviewer.track,
      assignedPapers: reviewer.assignedPapers || 0,
      paperTitles: reviewer.paperTitles ? reviewer.paperTitles.split('; ') : []
    }));

    res.json(processedResults);
  });
};

export const updateReviewer = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { id } = req.params;
  const { name, email, track } = req.body;

  if (!id || !name || !email || !track) {
    return res.status(400).json({ error: 'ID, name, email, and track are required' });
  }

  try {
    // Check if reviewer exists
    const checkQuery = 'SELECT id, email FROM users WHERE id = ? AND role = ?';
    db.query(checkQuery, [id, 'reviewer'], (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Reviewer not found' });
      }

      const existingEmail = results[0].email;

      // Check if email is being changed and if new email already exists
      if (email !== existingEmail) {
        const emailCheckQuery = 'SELECT id FROM users WHERE email = ? AND id != ?';
        db.query(emailCheckQuery, [email, id], (err, emailResults) => {
          if (err) {
            console.error('DB error checking email:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          if (emailResults.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
          }

          // Update reviewer
          const updateQuery = 'UPDATE users SET name = ?, email = ?, track = ? WHERE id = ? AND role = ?';
          db.query(updateQuery, [name, email, track, id, 'reviewer'], (err, result) => {
            if (err) {
              console.error('DB error updating reviewer:', err);
              return res.status(500).json({ error: 'Database error' });
            }

            if (result.affectedRows === 0) {
              return res.status(404).json({ error: 'Reviewer not found' });
            }

            res.json({
              message: 'Reviewer updated successfully',
              reviewer: { id, name, email, track }
            });
          });
        });
      } else {
        // Email not changed, proceed with update
        const updateQuery = 'UPDATE users SET name = ?, email = ?, track = ? WHERE id = ? AND role = ?';
        db.query(updateQuery, [name, email, track, id, 'reviewer'], (err, result) => {
          if (err) {
            console.error('DB error updating reviewer:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Reviewer not found' });
          }

          res.json({
            message: 'Reviewer updated successfully',
            reviewer: { id, name, email, track }
          });
        });
      }
    });
  } catch (error) {
    console.error('Update reviewer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const deleteReviewer = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Reviewer ID is required' });
  }

  try {
    // Check if reviewer exists
    const checkQuery = 'SELECT id, name FROM users WHERE id = ? AND role = ?';
    db.query(checkQuery, [id, 'reviewer'], (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Reviewer not found' });
      }

      const reviewerName = results[0].name;

      // Delete assignments first (foreign key constraint)
      const deleteAssignmentsQuery = 'DELETE FROM paper_assignments WHERE reviewer1 = ? OR reviewer2 = ?';
      db.query(deleteAssignmentsQuery, [id, id], (err, result) => {
        if (err) {
          console.error('DB error deleting assignments:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Delete reviewer
        const deleteQuery = 'DELETE FROM users WHERE id = ? AND role = ?';
        db.query(deleteQuery, [id, 'reviewer'], (err, result) => {
          if (err) {
            console.error('DB error deleting reviewer:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Reviewer not found' });
          }

          res.json({
            message: `Reviewer "${reviewerName}" deleted successfully`,
            deletedReviewer: { id, name: reviewerName }
          });
        });
      });
    });
  } catch (error) {
    console.error('Delete reviewer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get assigned papers for a reviewer
export const getAssignedPapers = (req, res) => {
  if (req.user.role !== 'reviewer') {
    return res.status(403).json({ error: 'Access denied. Reviewer only.' });
  }

  const reviewerId = req.user.id;

  // Show all papers assigned to this reviewer, including resubmissions
  const query = `
    SELECT
      r.id,
      r.paperTitle,
      r.authors,
      r.email,
      r.status,
      r.createdAt,
      r.updatedAt,
      r.abstractBlob,
      r.finalPaperBlob,
      pa.assignedAt,
      pr.status as reviewStatus,
      pr.comments,
      pr.reviewedAt
    FROM (
      SELECT paperId, reviewer1 as reviewerId, assignedAt FROM paper_assignments WHERE reviewer1 IS NOT NULL
      UNION ALL
      SELECT paperId, reviewer2 as reviewerId, assignedAt FROM paper_assignments WHERE reviewer2 IS NOT NULL
    ) pa
    JOIN registrations r ON pa.paperId = r.id
    LEFT JOIN paper_reviews pr ON r.id = pr.paperId AND pr.reviewerId = pa.reviewerId
    WHERE pa.reviewerId = ?
    ORDER BY r.createdAt DESC
  `;

  // **Fixed**: only one "?" placeholder, so pass a single value
  db.query(query, [reviewerId], (err, results) => {
    if (err) {
      console.error('DB error fetching assigned papers:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Convert BLOB data to base64 string for JSON response
    const processedResults = results.map(paper => ({
      id: paper.id,
      paperTitle: paper.paperTitle,
      authors: typeof paper.authors === 'string' ? JSON.parse(paper.authors) : paper.authors,
      email: paper.email,
      status: paper.status,
      createdAt: paper.createdAt,
      updatedAt: paper.updatedAt,
      abstractBlob: paper.abstractBlob ? Buffer.from(paper.abstractBlob).toString('base64') : null,
      finalPaperBlob: paper.finalPaperBlob ? Buffer.from(paper.finalPaperBlob).toString('base64') : null,
      assignedAt: paper.assignedAt,
      reviewStatus: paper.reviewStatus,
      comments: paper.comments,
      reviewedAt: paper.reviewedAt
    }));

    res.json(processedResults);
  });
};

// Update paper status by reviewer
export const updatePaperStatus = (req, res) => {
  if (req.user.role !== 'reviewer') {
    return res.status(403).json({ error: 'Access denied. Reviewer only.' });
  }

  const { paperId, status, comments } = req.body;
  const reviewerId = req.user.id;

  if (!paperId || !status) {
    return res.status(400).json({ error: 'Paper ID and status are required' });
  }

  if (!['under_review', 'accepted', 'rejected', 'accepted_with_minor_revision', 'accepted_with_major_revision', 'published'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Check if assignment exists
    const checkAssignmentQuery = 'SELECT id FROM paper_assignments WHERE paperId = ? AND (reviewer1 = ? OR reviewer2 = ?)';
    db.query(checkAssignmentQuery, [paperId, reviewerId, reviewerId], (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(403).json({ error: 'Paper not assigned to this reviewer' });
      }

      // Update or insert review
      const upsertQuery = `
        INSERT INTO paper_reviews (paperId, reviewerId, status, comments)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        comments = VALUES(comments),
        reviewedAt = CURRENT_TIMESTAMP
      `;

      db.query(upsertQuery, [paperId, reviewerId, status, comments], async (err, result) => {
        if (err) {
          console.error('DB error updating review:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({
          message: 'Paper status updated successfully',
          paperId,
          status,
          comments
        });
      });
    });
  } catch (error) {
    console.error('Update paper status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Send paper status update email to authors (admin only)
export const sendPaperStatusEmail = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { paperId } = req.body;

  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required' });
  }

  try {
    // Get paper details and admin status
    const paperQuery = `
      SELECT r.paperTitle, r.authors, r.status, r.comments
      FROM registrations r
      WHERE r.id = ?
    `;

    db.query(paperQuery, [paperId], async (err, paperResults) => {
      if (err) {
        console.error('DB error fetching paper details:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (paperResults.length === 0) {
        return res.status(404).json({ error: 'Paper not found' });
      }

      const { paperTitle, authors, status, comments } = paperResults[0];

      if (!status || status === 'submitted' || status === 'under_review') {
        return res.status(400).json({ error: 'No admin decision status found for this paper' });
      }

      let authorsArr;
      try {
        authorsArr = typeof authors === 'string' ? JSON.parse(authors) : authors;
      } catch (parseErr) {
        console.error('Error parsing authors JSON:', parseErr);
        return res.status(500).json({ error: 'Error parsing author data' });
      }

      // Send emails to all authors
      const emailPromises = authorsArr.map(async (author) => {
        if (author.email) {
          try {
            await sendPaperStatusUpdateEmail(
              author.email,
              author.name,
              paperTitle,
              paperId,
              status,
              comments || 'No comments provided',
              'Admin Decision'
            );
            console.log(`Status update email sent to ${author.email} for paper ${paperId}`);
          } catch (emailErr) {
            console.error(`Failed to send email to ${author.email}: ${emailErr.message}`);
          }
        }
      });

      await Promise.all(emailPromises);

      // Mark notification as sent
      const updateQuery = 'UPDATE registrations SET notificationSent = TRUE WHERE id = ?';
      db.query(updateQuery, [paperId], (err, result) => {
        if (err) {
          console.error('DB error updating notificationSent:', err);
        }
      });

      res.json({
        message: 'Status update emails sent successfully',
        paperId,
        emailsSent: authorsArr.filter(author => author.email).length
      });
    });
  } catch (error) {
    console.error('Send paper status email error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Send notification to authors with all reviewer comments (admin only)
export const sendNotification = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { paperId } = req.body;

  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required' });
  }

  try {
    // Get paper details and all reviews
    const paperQuery = `
      SELECT r.paperTitle, r.authors, r.notificationSent
      FROM registrations r
      WHERE r.id = ?
    `;

    db.query(paperQuery, [paperId], async (err, paperResults) => {
      if (err) {
        console.error('DB error fetching paper details:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (paperResults.length === 0) {
        return res.status(404).json({ error: 'Paper not found' });
      }

      const { paperTitle, authors, notificationSent } = paperResults[0];

      if (notificationSent) {
        return res.status(400).json({ error: 'Notification already sent' });
      }

      // Get all reviews
      const reviewsQuery = `
        SELECT pr.comments, u.name as reviewerName
        FROM paper_reviews pr
        JOIN users u ON pr.reviewerId = u.id
        WHERE pr.paperId = ?
        ORDER BY pr.reviewedAt
      `;

      db.query(reviewsQuery, [paperId], async (err, reviewResults) => {
        if (err) {
          console.error('DB error fetching reviews:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        let authorsArr;
        try {
          authorsArr = typeof authors === 'string' ? JSON.parse(authors) : authors;
        } catch (parseErr) {
          console.error('Error parsing authors JSON:', parseErr);
          return res.status(500).json({ error: 'Error parsing author data' });
        }

        // Prepare comments text
        const commentsText = reviewResults
          .map(review => `Reviewer ${review.reviewerName}: ${review.comments || 'No comments'}`)
          .join('\n\n');

        // Send emails to all authors
        const emailPromises = authorsArr.map(async (author) => {
          if (author.email) {
            try {
              await sendPaperStatusUpdateEmail(
                author.email,
                author.name,
                paperTitle,
                paperId,
                'reviewed',
                commentsText,
                'Reviewers'
              );
              console.log(`Notification email sent to ${author.email} for paper ${paperId}`);
            } catch (emailErr) {
              console.error(`Failed to send email to ${author.email}: ${emailErr.message}`);
            }
          }
        });

        await Promise.all(emailPromises);

        // Update notificationSent
        const updateQuery = 'UPDATE registrations SET notificationSent = TRUE WHERE id = ?';
        db.query(updateQuery, [paperId], (err, result) => {
          if (err) {
            console.error('DB error updating notificationSent:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          res.json({
            message: 'Notification sent successfully',
            paperId,
            emailsSent: authorsArr.filter(author => author.email).length
          });
        });
      });
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get paper status for users
export const getPaperStatus = (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const query = `
    SELECT
      r.id,
      r.paperTitle,
      r.authors,
      r.tracks,
      r.country,
      r.state,
      r.city,
      r.status,
      r.finalSubmissionStatus,
      r.notificationSent,
      r.createdAt,
      r.updatedAt,
      r.abstractBlob,
      r.finalPaperBlob,
      pr.status as reviewStatus,
      pr.comments,
      pr.reviewedAt,
      u.name as reviewerName
    FROM registrations r
    LEFT JOIN paper_reviews pr ON r.id = pr.paperId
    LEFT JOIN users u ON pr.reviewerId = u.id
    WHERE r.userId = ?
    ORDER BY r.createdAt DESC, pr.reviewedAt ASC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('DB error fetching paper status:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Group results by paper
    const paperMap = {};
    results.forEach(row => {
      if (!paperMap[row.id]) {
        paperMap[row.id] = {
          id: row.id,
          paperTitle: row.paperTitle,
          authors: typeof row.authors === 'string'
            ? JSON.parse(row.authors)
            : row.authors,
          tracks: row.tracks,
          country: row.country,
          state: row.state,
          city: row.city,
          status: row.status,
          finalSubmissionStatus: row.finalSubmissionStatus,
          notificationSent: row.notificationSent,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          abstractBlob: row.abstractBlob ? Buffer.from(row.abstractBlob).toString('base64') : null,
          finalPaperBlob: row.finalPaperBlob ? Buffer.from(row.finalPaperBlob).toString('base64') : null,
          reviews: []
        };
      }
      if (row.reviewStatus) {
        paperMap[row.id].reviews.push({
          status: row.reviewStatus,
          comments: row.comments,
          reviewedAt: row.reviewedAt,
          reviewerName: row.reviewerName
        });
      }
    });

    const processedResults = Object.values(paperMap);
    res.json(processedResults);
  });
};

// Get papers available for assignment (papers with 0 or 1 reviewer assigned)
export const getPapersAvailableForAssignment = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { fromDate, toDate, paperTracks } = req.query;
  let query = `
    SELECT
      r.id,
      r.userId,
      r.paperTitle,
      r.authors,
      r.email,
      r.createdAt,
      r.abstractBlob,
      r.tracks as paperTracks,
      CASE WHEN pa.reviewer1 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN pa.reviewer2 IS NOT NULL THEN 1 ELSE 0 END as assignedReviewers,
      CONCAT_WS('; ', u1.name, u2.name) as currentReviewers
    FROM registrations r
    LEFT JOIN paper_assignments pa ON r.id = pa.paperId
    LEFT JOIN users u1 ON pa.reviewer1 = u1.id
    LEFT JOIN users u2 ON pa.reviewer2 = u2.id
    WHERE CASE WHEN pa.reviewer1 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN pa.reviewer2 IS NOT NULL THEN 1 ELSE 0 END < 2
  `;
  const params = [];
  const conditions = [];

  if (fromDate) {
    conditions.push('r.createdAt >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('r.createdAt < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(toDate);
  }
  if (paperTracks) {
    const tracks = Array.isArray(paperTracks) ? paperTracks : [paperTracks];
    const placeholders = tracks.map(() => '?').join(',');
    conditions.push(`r.tracks IN (${placeholders})`);
    params.push(...tracks);
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }

  query += ' ORDER BY r.createdAt DESC';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('DB error fetching papers available for assignment:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Convert BLOB data to base64 string for JSON response
    const processedResults = results.map(paper => ({
      id: paper.id,
      userId: paper.userId,
      paperTitle: paper.paperTitle,
      authors: typeof paper.authors === 'string' ? JSON.parse(paper.authors) : paper.authors,
      email: paper.email,
      createdAt: paper.createdAt,
      abstractBlob: paper.abstractBlob ? Buffer.from(paper.abstractBlob).toString('base64') : null,
      track: paper.paperTracks,
      assignedReviewers: paper.assignedReviewers,
      currentReviewers: paper.currentReviewers ? paper.currentReviewers.split('; ').filter(name => name) : []
    }));

    res.json(processedResults);
  });
};

// Get unassigned papers (papers not in paper_assignments table)
export const getUnassignedPapers = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { fromDate, toDate, paperTracks } = req.query;
  let query = `
    SELECT
      r.id,
      r.userId,
      r.paperTitle,
      r.authors,
      r.email,
      r.createdAt,
      r.abstractBlob,
      r.tracks as paperTracks
    FROM registrations r
    WHERE r.id NOT IN (
      SELECT DISTINCT paperId
      FROM paper_assignments
    )
  `;
  const params = [];
  const conditions = [];

  if (fromDate) {
    conditions.push('r.createdAt >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('r.createdAt < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(toDate);
  }
  if (paperTracks) {
    const tracks = Array.isArray(paperTracks) ? paperTracks : [paperTracks];
    const placeholders = tracks.map(() => '?').join(',');
    conditions.push(`r.tracks IN (${placeholders})`);
    params.push(...tracks);
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }

  query += ' ORDER BY r.createdAt DESC';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('DB error fetching unassigned papers:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Convert BLOB data to base64 string for JSON response
    const processedResults = results.map(paper => ({
      id: paper.id,
      userId: paper.userId,
      paperTitle: paper.paperTitle,
      authors: typeof paper.authors === 'string' ? JSON.parse(paper.authors) : paper.authors,
      email: paper.email,
      createdAt: paper.createdAt,
      abstractBlob: paper.abstractBlob ? Buffer.from(paper.abstractBlob).toString('base64') : null,
      track: paper.paperTracks
    }));

    res.json(processedResults);
  });
};

// Get all registrations with assigned reviewers
export const getRegistrationsWithAssignments = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  // First get all registrations
  const registrationsQuery = `
    SELECT
      id,
      userId,
      paperTitle,
      authors,
      email,
      createdAt,
      abstractBlob,
      finalPaperBlob,
      tracks,
      status,
      finalSubmissionStatus,
      notificationSent
    FROM registrations
    ORDER BY createdAt DESC
  `;

  db.query(registrationsQuery, (err, registrationResults) => {
    if (err) {
      console.error('DB error fetching registrations:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (registrationResults.length === 0) {
      return res.json([]);
    }

    // Get assignments and reviews for all registrations in one query
    const registrationIds = registrationResults.map(r => r.id);
    const placeholders = registrationIds.map(() => '?').join(',');

    const assignmentsQuery = `
      SELECT
        pa.paperId,
        u1.id as reviewerId1,
        u1.name as reviewerName1,
        u2.id as reviewerId2,
        u2.name as reviewerName2,
        pa.assignedAt,
        pr1.status as reviewStatus1,
        pr1.comments as comments1,
        pr1.reviewedAt as reviewedAt1,
        pr2.status as reviewStatus2,
        pr2.comments as comments2,
        pr2.reviewedAt as reviewedAt2
      FROM paper_assignments pa
      LEFT JOIN users u1 ON pa.reviewer1 = u1.id
      LEFT JOIN users u2 ON pa.reviewer2 = u2.id
      LEFT JOIN paper_reviews pr1 ON pa.paperId = pr1.paperId AND pa.reviewer1 = pr1.reviewerId
      LEFT JOIN paper_reviews pr2 ON pa.paperId = pr2.paperId AND pa.reviewer2 = pr2.reviewerId
      WHERE pa.paperId IN (${placeholders})
      ORDER BY pa.paperId, pa.assignedAt
    `;

    db.query(assignmentsQuery, registrationIds, (err, assignmentResults) => {
      if (err) {
        console.error('DB error fetching assignments:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Group assignments by paperId
      const assignmentsByPaper = {};
      assignmentResults.forEach(assignment => {
        if (!assignmentsByPaper[assignment.paperId]) {
          assignmentsByPaper[assignment.paperId] = [];
        }
        if (assignment.reviewerId1) {
          assignmentsByPaper[assignment.paperId].push({
            id: assignment.reviewerId1,
            name: assignment.reviewerName1,
            assignedAt: assignment.assignedAt,
            reviewStatus: assignment.reviewStatus1,
            comments: assignment.comments1,
            reviewedAt: assignment.reviewedAt1
          });
        }
        if (assignment.reviewerId2) {
          assignmentsByPaper[assignment.paperId].push({
            id: assignment.reviewerId2,
            name: assignment.reviewerName2,
            assignedAt: assignment.assignedAt,
            reviewStatus: assignment.reviewStatus2,
            comments: assignment.comments2,
            reviewedAt: assignment.reviewedAt2
          });
        }
      });

      // Combine registrations with their assignments
      const processedResults = registrationResults.map(registration => ({
        id: registration.id,
        userId: registration.userId,
        paperTitle: registration.paperTitle,
        authors:
          typeof registration.authors === 'string'
            ? (() => {
                try {
                  return JSON.parse(registration.authors);
                } catch {
                  return registration.authors
                    .split(',')
                    .map(name => ({ name: name.trim() }));
                }
              })()
            : registration.authors,
        email: registration.email,
        createdAt: registration.createdAt,
        abstractBlob: registration.abstractBlob
          ? Buffer.from(registration.abstractBlob).toString('base64')
          : null,
        tracks: registration.tracks,
        status: registration.status,
        finalSubmissionStatus: registration.finalSubmissionStatus,
        notificationSent: registration.notificationSent,
        reviewers: assignmentsByPaper[registration.id] || []
      }));

      res.json(processedResults);
    });
  });
};

// Get registration analytics (counts by country and state)
export const getRegistrationAnalytics = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  // Query for country counts
  const countryQuery = `
    SELECT country, COUNT(*) as count
    FROM registrations
    WHERE country IS NOT NULL AND country != ''
    GROUP BY country
    ORDER BY count DESC
  `;

  // Query for state counts
  const stateQuery = `
    SELECT state, COUNT(*) as count
    FROM registrations
    WHERE state IS NOT NULL AND state != ''
    GROUP BY state
    ORDER BY count DESC
  `;

  db.query(countryQuery, (err, countryResults) => {
    if (err) {
      console.error('DB error fetching country analytics:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    db.query(stateQuery, (err, stateResults) => {
      if (err) {
        console.error('DB error fetching state analytics:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        countries: countryResults,
        states: stateResults
      });
    });
  });
};

// Delete registration by ID (admin only)
export const deleteRegistration = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Registration ID is required' });
  }

  try {
    // Delete related assignments first (foreign key constraints)
    const deleteAssignmentsQuery = 'DELETE FROM paper_assignments WHERE paperId = ?';
    db.query(deleteAssignmentsQuery, [id], (err) => {
      if (err) {
        console.error('DB error deleting assignments:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Delete related reviews
      const deleteReviewsQuery = 'DELETE FROM paper_reviews WHERE paperId = ?';
      db.query(deleteReviewsQuery, [id], (err) => {
        if (err) {
          console.error('DB error deleting reviews:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Delete the registration
        const deleteRegistrationQuery = 'DELETE FROM registrations WHERE id = ?';
        db.query(deleteRegistrationQuery, [id], (err, result) => {
          if (err) {
            console.error('DB error deleting registration:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registration not found' });
          }

          res.json({ message: 'Registration deleted successfully', id });
        });
      });
    });
  } catch (error) {
    console.error('Delete registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateRegistrationStatus = (req, res) => {
  console.log(`Request received: ${req.method} ${req.path}`);
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { id } = req.params;
  const { status } = req.body;

  console.log(`Update registration status request: id=${id}, status=${status}`);

  if (!id || !status) {
    console.error('Missing required parameters: id or status');
    return res.status(400).json({ error: 'Registration ID and status are required' });
  }

  if (!['under_review', 'accepted', 'rejected', 'accepted_with_minor_revision', 'accepted_with_major_revision', 'published'].includes(status)) {
    console.error(`Invalid status value: ${status}`);
    return res.status(400).json({ error: 'Invalid status' });
  }

  // First, check if the registration exists
  const checkQuery = 'SELECT id FROM registrations WHERE id = ?';
  db.query(checkQuery, [id], (checkErr, checkResults) => {
    if (checkErr) {
      console.error('DB error checking registration existence:', checkErr);
      return res.status(500).json({ error: 'Database error' });
    }

    if (checkResults.length === 0) {
      console.error(`Registration not found: id=${id}`);
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Now update the status
    const updateQuery = 'UPDATE registrations SET status = ? WHERE id = ?';
    db.query(updateQuery, [status, id], (err, result) => {
      if (err) {
        console.error('DB error updating registration status:', err);
        console.error('Error details:', {
          code: err.code,
          errno: err.errno,
          sqlState: err.sqlState,
          sqlMessage: err.sqlMessage
        });
        return res.status(500).json({ error: 'Database error' });
      }

      if (result.affectedRows === 0) {
        console.error(`No rows affected for update: id=${id}, status=${status}`);
        return res.status(404).json({ error: 'Registration not found' });
      }

      console.log(`Registration status updated successfully: id=${id}, status=${status}`);
      res.json({ message: 'Registration status updated successfully', id, status });
    });
  });
};

// Get total registrations count
export const getTotalRegistrations = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const query = 'SELECT COUNT(*) as total FROM registrations';

  db.query(query, (err, results) => {
    if (err) {
      console.error('DB error fetching total registrations:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ total: results[0].total });
  });
};

export const seedAdmin = async () => {
  const adminEmail = 'admin@nec.com';
  const adminPassword = 'admin123';
  const adminName = 'NEC Admin';

  try {
    // Check if admin already exists
    const checkQuery = 'SELECT id FROM users WHERE email = ?';
    db.query(checkQuery, [adminEmail], async (err, results) => {
      if (err) {
        console.error('DB error checking admin:', err);
        return;
      }

      if (results.length > 0) {
        console.log('Admin user already exists');
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      // Insert admin
      const insertQuery = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
      db.query(insertQuery, [adminName, adminEmail, hashedPassword, 'admin'], (err, result) => {
        if (err) {
          console.error('DB insert admin error:', err);
        } else {
          console.log('Default admin user created: admin@nec.com / admin123');
        }
      });
    });
  } catch (error) {
    console.error('Seed admin error:', error);
  }
};

// Reset final submission (admin only)
export const resetFinalSubmission = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Registration ID is required' });
  }

  try {
    // First get paper details for email
    const paperQuery = 'SELECT paperTitle, authors FROM registrations WHERE id = ?';
    db.query(paperQuery, [id], async (err, paperResults) => {
      if (err) {
        console.error('DB error fetching paper details:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (paperResults.length === 0) {
        return res.status(404).json({ error: 'Registration not found' });
      }

      const { paperTitle, authors } = paperResults[0];

      // Update the registration to reset final submission
      const updateQuery = 'UPDATE registrations SET finalSubmissionStatus = ?, finalPaperBlob = NULL WHERE id = ?';
      db.query(updateQuery, ['not_submitted', id], async (err, result) => {
        if (err) {
          console.error('DB error resetting final submission:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Registration not found' });
        }

        // Send email notifications to authors
        try {
          let authorsArr;
          try {
            authorsArr = typeof authors === 'string' ? JSON.parse(authors) : authors;
          } catch (parseErr) {
            console.error('Error parsing authors JSON:', parseErr);
            // Continue without sending emails if parsing fails
            return res.json({ message: 'Final submission reset successfully', id });
          }

          // Send emails to all authors
          const emailPromises = authorsArr.map(async (author) => {
            if (author.email) {
              try {
                await sendFinalSubmissionResetEmail(author.email, author.name, paperTitle, id);
                console.log(`Final submission reset email sent to ${author.email} for paper ${id}`);
              } catch (emailErr) {
                console.error(`Failed to send email to ${author.email}: ${emailErr.message}`);
              }
            }
          });

          await Promise.all(emailPromises);
        } catch (emailError) {
          console.error('Error sending final submission reset emails:', emailError.message);
          // Don't fail the reset if email sending fails
        }

        res.json({ message: 'Final submission reset successfully', id });
      });
    });
  } catch (error) {
    console.error('Reset final submission error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Download final paper (admin or owner)
export const downloadFinalPaper = (req, res) => {
  const paperId = req.params.paperId;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required' });
  }

  // Only allow admin or the paper owner to download
  const requester = req.user;
  if (!requester) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const query = 'SELECT userId, paperTitle, finalPaperBlob FROM registrations WHERE id = ?';
  db.query(query, [paperId], (err, results) => {
    if (err) {
      console.error('DB error fetching final paper:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const row = results[0];

    // Authorization: admin can download any; owner (userId) can download their own final paper
    if (requester.role !== 'admin' && String(requester.id) !== String(row.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const blob = row.finalPaperBlob;
    if (!blob) {
      return res.status(404).json({ error: 'Final paper not available' });
    }

    // Determine MIME type and extension from file signature (basic heuristics)
    let mimeType = 'application/octet-stream';
    let extension = 'bin';
    const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);

    if (buffer.length >= 4) {
      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        mimeType = 'application/pdf';
        extension = 'pdf';
      } else if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
        mimeType = 'application/msword';
        extension = 'doc';
      } else if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        extension = 'docx';
      }
    }

    const safeTitle = (row.paperTitle || 'paper')
      .replace(/[^\w\-. ]/g, '')
      .replace(/\s+/g, '');
    const filename = `${safeTitle}_final.${extension}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  });
};
