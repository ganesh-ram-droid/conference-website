import express from "express";
import multer from "multer";
import { registerPaper, getAllRegistrations } from "../controllers/registrationController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();
router.get('/all', authenticateToken, getAllRegistrations);

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", authenticateToken, upload.any(), registerPaper);

export default router;
