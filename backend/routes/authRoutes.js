import express from "express";
import { signup, login, changePassword } from "../controllers/authController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/change-password", authenticateToken, changePassword);

export default router;
