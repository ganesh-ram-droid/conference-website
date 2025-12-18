import { saveRegistration, updateFinalSubmission } from "../services/registrationService.js";
import { sendApplyConfirmationEmail, sendAdminPaperNotificationEmail } from "../services/emailServices.js";
import { db } from "../config/db.js";
import { assignReviewerDirect } from "./adminController.js";

export const registerPaper = async (req, res) => {
  const userId = req.user.id;
  const { paperTitle, authors, tracks, country, state, city, assignedReviewerId, originalPaperId } = req.body;
  const authorsArr = JSON.parse(authors);

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Abstract or final paper file required" });
  }

  // Find the file named 'abstract' in req.files
  const abstractFile = req.files.find(f => f.fieldname === 'abstract');

  if (!abstractFile) {
    return res.status(400).json({ error: "Abstract or final paper file required" });
  }

  // Validate file type is PDF, DOC, or DOCX
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (!allowedTypes.includes(abstractFile.mimetype)) {
    return res.status(400).json({ error: "Only PDF, DOC, and DOCX files are allowed" });
  }

  // Validate mobile numbers length
  for (const author of authorsArr) {
    if (!author.mobile || author.mobile.length !== 10 || !/^\d{10}$/.test(author.mobile)) {
      return res.status(400).json({ error: `Invalid mobile number for author ${author.name}. Must be exactly 10 digits.` });
    }
  }

  const fileBuffer = abstractFile.buffer;

  const isFinalSubmission = originalPaperId && originalPaperId !== 'null';

  if (isFinalSubmission) {
    // Update existing registration with final paper
    updateFinalSubmission(originalPaperId, fileBuffer, async (updateErr, updateResult) => {
      if (updateErr) {
        console.error("DB Update error:", updateErr);
        return res.status(500).json({ error: "Database error" });
      }

      // Assign the same reviewers as original paper
      try {
        const getReviewersQuery = "SELECT reviewerId FROM paper_assignments WHERE paperId = ?";
        db.query(getReviewersQuery, [originalPaperId], async (err, results) => {
          if (err) {
            console.error("DB error fetching reviewers for final submission:", err);
          } else {
            for (const row of results) {
              try {
                await assignReviewerDirect(originalPaperId, row.reviewerId);
              } catch (assignErr) {
                if (assignErr.message !== 'Reviewer already assigned to this paper') {
                  console.error("Error assigning reviewer for final submission:", assignErr);
                }
              }
            }
          }
        });
      } catch (err) {
        console.error("Error assigning reviewers for final submission:", err);
      }

      try {
        // Notify admin about this final submission
        try {
          await sendAdminPaperNotificationEmail(originalPaperId, paperTitle, authorsArr, 'Final Submission');
        } catch (adminErr) {
          console.error('Admin notification failed for final submission:', adminErr.message || adminErr);
        }

        await Promise.all(
          authorsArr.map(author =>
            sendApplyConfirmationEmail(author.email, author.name, userId, originalPaperId, paperTitle, authorsArr)
          )
        );
        res.status(200).json({
          message: "Final submission successful",
          id: originalPaperId
        });
      } catch (emailError) {
        console.error("Email error:", emailError);
        res.status(200).json({
          message: "Final submission successful but email notification failed",
          id: originalPaperId,
          emailError: emailError.message
        });
      }
    });
  } else {
    // Normal registration
    saveRegistration(
      { userId, paperTitle, authors: authorsArr, abstract: fileBuffer, tracks, country, state, city, finalSubmissionStatus: 'not_submitted' },
      async (saveErr, saveResult) => {
        if (saveErr) {
          console.error("DB Insert error:", saveErr);
          return res.status(500).json({ error: "Database error" });
        }

        const paperId = saveResult.insertId;

        if (assignedReviewerId) {
          try {
            await assignReviewerDirect(paperId, assignedReviewerId);
          } catch (assignErr) {
            console.error("Error assigning reviewer:", assignErr);
          }
        }

        // Notify admin about this new registration
        try {
          await sendAdminPaperNotificationEmail(paperId, paperTitle, authorsArr, 'Initial Submission');
        } catch (adminErr) {
          console.error('Admin notification failed for registration:', adminErr.message || adminErr);
        }

        try {
          await Promise.all(
            authorsArr.map(author =>
              sendApplyConfirmationEmail(author.email, author.name, userId, paperId, paperTitle, authorsArr)
            )
          );
          res.status(200).json({
            message: "Registration successful",
            id: paperId
          });
        } catch (emailError) {
          console.error("Email error:", emailError);
          res.status(200).json({
            message: "Registration successful but email notification failed",
            id: paperId,
            emailError: emailError.message
          });
        }
      }
    );
  }
};

export const getAllRegistrations = async (req, res) => {
  try {
    // Select latest registration per userId and paperTitle to avoid duplicates on resubmission
    const sql = `
      SELECT r1.*
      FROM registrations r1
      INNER JOIN (
        SELECT userId, paperTitle, MAX(updatedAt) as maxUpdatedAt
        FROM registrations
        GROUP BY userId, paperTitle
      ) r2 ON r1.userId = r2.userId AND r1.paperTitle = r2.paperTitle AND r1.updatedAt = r2.maxUpdatedAt
      ORDER BY r1.createdAt DESC
    `;
    db.query(sql, (err, results) => {
      if (err) {
        console.error("DB Query error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      // Log size of abstractBlob for debugging
      results.forEach(row => {
        console.log("Fetched abstractBlob size:", row.abstractBlob ? row.abstractBlob.length : 0);
      });
      // Parse authors JSON and convert abstractBlob and finalPaperBlob to base64 strings for each result
      const processedResults = results.map(row => {
        const parsedAuthors = typeof row.authors === 'string' ? JSON.parse(row.authors) : row.authors;
        return {
          ...row,
          authors: parsedAuthors,
          phone: parsedAuthors && parsedAuthors.length > 0 ? parsedAuthors[0].mobile : '',
          abstractBlob: row.abstractBlob ? row.abstractBlob.toString('base64') : null,
          finalPaperBlob: row.finalPaperBlob ? row.finalPaperBlob.toString('base64') : null
        };
      });
      res.json(processedResults);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
