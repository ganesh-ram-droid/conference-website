export const userModel = (db) => {
  return new Promise((resolve, reject) => {
    const createQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NULL,
        googleId VARCHAR(255) NULL,
        role ENUM('user', 'reviewer', 'admin') DEFAULT 'user',
        track VARCHAR(255),
        isFirstLogin TINYINT(1) DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    db.query(createQuery, (err) => {
      if (err) {
        console.error("User table creation error:", err);
        return reject(err);
      }
      resolve();
    });
  });
};
