export const registrationModel = (db) => {
  return new Promise((resolve, reject) => {
    const createQuery = `
      CREATE TABLE IF NOT EXISTS registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(50) NOT NULL,
        paperTitle VARCHAR(255) NOT NULL,
        authors JSON NOT NULL,
        abstractBlob LONGBLOB,
        email VARCHAR(255) NOT NULL,
        tracks VARCHAR(255),
        country VARCHAR(255),
        state VARCHAR(255),
        city VARCHAR(255),
        finalSubmissionStatus ENUM('not_submitted', 'submitted', 'approved', 'rejected') DEFAULT 'not_submitted',
        status ENUM('submitted', 'under_review', 'accepted', 'accepted_with_minor_revision', 'accepted_with_major_revision', 'rejected', 'published') DEFAULT 'submitted',
        assignedReviewerName VARCHAR(255),
        reviewStatus ENUM('under_review', 'accepted', 'accepted_with_minor_revision', 'accepted_with_major_revision', 'rejected', 'published'),
        comments TEXT,
        reviewedAt TIMESTAMP NULL,
        finalPaperBlob LONGBLOB,
        notificationSent BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    db.query(createQuery, (err) => {
      if (err) {
        console.error("Table creation error:", err);
        return reject(err);
      }

      // Create paper_assignments table
      const assignmentQuery = `
        CREATE TABLE IF NOT EXISTS paper_assignments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          paperId INT NOT NULL UNIQUE,
          reviewer1 INT NULL,
          reviewer2 INT NULL,
          assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (paperId) REFERENCES registrations(id) ON DELETE CASCADE,
          FOREIGN KEY (reviewer1) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (reviewer2) REFERENCES users(id) ON DELETE SET NULL
        )
      `;
      db.query(assignmentQuery, (err) => {
        if (err) {
          console.error("Paper assignments table creation error:", err);
          return reject(err);
        }

        // Create paper_reviews table
        const reviewQuery = `
          CREATE TABLE IF NOT EXISTS paper_reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            paperId INT NOT NULL,
            reviewerId INT NOT NULL,
            status ENUM('under_review', 'accepted', 'accepted_with_minor_revision', 'accepted_with_major_revision', 'rejected', 'published') NOT NULL,
            comments TEXT,
            reviewedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (paperId) REFERENCES registrations(id) ON DELETE CASCADE,
            FOREIGN KEY (reviewerId) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_review (paperId, reviewerId)
          )
        `;
        db.query(reviewQuery, (err) => {
          if (err) {
            console.error("Paper reviews table creation error:", err);
            return reject(err);
          }
          resolve();
        });
      });
    });
  });
};
