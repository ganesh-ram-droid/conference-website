import { db } from "../config/db.js";

export const saveRegistration = (formData, callback) => {
  const { userId, paperTitle, authors, abstract, tracks, country, state, city, assignedReviewerName, finalSubmissionStatus } = formData;
  const email = authors.length > 0 ? authors[0].email : '';

  console.log("Abstract buffer size:", abstract ? abstract.length : 0);

  const sql = `INSERT INTO registrations (userId, paperTitle, authors, abstractBlob, email, tracks, country, state, city, assignedReviewerName, finalSubmissionStatus)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [userId, paperTitle, JSON.stringify(authors), abstract, email, tracks, country, state, city, assignedReviewerName, finalSubmissionStatus], (err, result) => {
    if (err) {
      callback(err);
    } else {
      // Return the inserted ID in the result
      callback(null, result);
    }
  });
};

export const updateFinalSubmission = (paperId, finalPaper, callback) => {
  const sql = `UPDATE registrations SET finalPaperBlob = ?, finalSubmissionStatus = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
  const statusValue = 'submitted';

  db.query(sql, [finalPaper, statusValue, paperId], (err, result) => {
    if (err) {
      console.error('Error updating final submission:', err);
      callback(err);
    } else {
      callback(null, result);
    }
  });
};
