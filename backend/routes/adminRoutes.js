import express from "express";
import {
  createReviewer,
  getReviewers,
  assignReviewer,
  getReviewersWithAssignments,
  updateReviewer,
  deleteReviewer,
  getAssignedPapers,
  updatePaperStatus,
  sendPaperStatusEmail,
  sendNotification,
  getPaperStatus,
  getUnassignedPapers,
  getPapersAvailableForAssignment,
  getRegistrationsWithAssignments,
  getAllAssignments,
  deleteAssignment,
  updateAssignment,
  getRegistrationAnalytics,
  deleteRegistration,
  updateRegistrationStatus,
  getTotalRegistrations,
  downloadFinalPaper,
  resetFinalSubmission
} from "../controllers/adminController.js";
import {
  getSupportTickets,
  createSupportTicketAdmin,
  assignTechnician,
  updateTicketStatus,
  getTechnicians,
  deleteSupportTicketAdmin
} from "../controllers/techSupportController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Admin routes
router.post("/create-reviewer", authenticateToken, createReviewer);
router.get("/reviewers", authenticateToken, getReviewers);
router.post("/assign-reviewer", authenticateToken, assignReviewer);
router.get("/reviewers-with-assignments", authenticateToken, getReviewersWithAssignments);
router.put("/update-reviewer/:id", authenticateToken, updateReviewer);
router.delete("/delete-reviewer/:id", authenticateToken, deleteReviewer);
router.get("/unassigned-papers", authenticateToken, getUnassignedPapers);
router.get("/papers-available-for-assignment", authenticateToken, getPapersAvailableForAssignment);
router.get("/registrations-with-assignments", authenticateToken, getRegistrationsWithAssignments);
router.delete("/registrations/:id", authenticateToken, deleteRegistration);
router.get("/registration-analytics", authenticateToken, getRegistrationAnalytics);
router.post("/send-status-email", authenticateToken, sendPaperStatusEmail);
router.post("/send-notification", authenticateToken, sendNotification);
router.put("/registrations/:id/status", authenticateToken, updateRegistrationStatus);

// Assignment management (admin)
router.get("/assignments", authenticateToken, getAllAssignments);
router.delete("/assignment/:paperId/:reviewerId", authenticateToken, deleteAssignment);
router.put("/assignment/:paperId/:reviewerId", authenticateToken, updateAssignment);

// Reviewer routes
router.get("/reviewer/assigned-papers", authenticateToken, getAssignedPapers);
router.post("/reviewer/update-status", authenticateToken, updatePaperStatus);

// User routes
router.get("/paper-status/:userId", authenticateToken, getPaperStatus);

// Total registrations route
router.get("/total-registrations", authenticateToken, getTotalRegistrations);

// Download final paper
router.get("/download-final-paper/:paperId", authenticateToken, downloadFinalPaper);

// Reset final submission
router.put("/registrations/:id/reset-final-submission", authenticateToken, resetFinalSubmission);

export default router;
