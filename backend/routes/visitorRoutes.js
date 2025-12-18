import express from "express";
import { dbPromise } from "../config/db.js";

const router = express.Router();

// GET /icodses/visitors - Get current visitor count
router.get("/", async (req, res) => {
    try {
        // Ensure table exists
        await dbPromise.query("CREATE TABLE IF NOT EXISTS visitor_counter (id INT AUTO_INCREMENT PRIMARY KEY, count INT DEFAULT 0)");
        // Ensure row exists
        await dbPromise.query("INSERT IGNORE INTO visitor_counter (id, count) VALUES (1, 0)");
        const [results] = await dbPromise.query("SELECT count FROM visitor_counter LIMIT 1");
        const count = results.length > 0 ? results[0].count : 0;
        res.json({ count });
    } catch (error) {
        console.error("Error in GET /visitors:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /icodses/visitors - Increment visitor count (only if no cookie)
router.post("/", async (req, res) => {
    try {
        // Check if visitor cookie exists
        if (req.cookies.visited) {
            // Already visited, just return current count
            const [results] = await dbPromise.query("SELECT count FROM visitor_counter LIMIT 1");
            const count = results.length > 0 ? results[0].count : 0;
            return res.json({ count });
        }

        // Ensure the row exists before updating
        await dbPromise.query("INSERT IGNORE INTO visitor_counter (id, count) VALUES (1, 0)");

        // Increment count
        await dbPromise.query("UPDATE visitor_counter SET count = count + 1 WHERE id = 1");

        // Get updated count
        const [results] = await dbPromise.query("SELECT count FROM visitor_counter WHERE id = 1 LIMIT 1");
        const count = results.length > 0 ? results[0].count : 0;

        // Set cookie to prevent further increments (expires in 1 year)
        res.cookie("visited", "true", {
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
            httpOnly: true,
            secure: false, // Set to true in production with HTTPS
            sameSite: "lax"
        });

        res.json({ count });
    } catch (error) {
        console.error("Error in POST /visitors:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
