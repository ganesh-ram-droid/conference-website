import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { db } from "./config/db.js";
import { registrationModel } from "./models/registrationModel.js";
import { userModel } from "./models/userModel.js";
import registrationRoutes from "./routes/registrationRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import visitorRoutes from "./routes/visitorRoutes.js";
import { seedAdmin } from "./controllers/adminController.js";
import { apiRateLimiter } from "./middleware/auth.js";
import { sanitizeMiddleware } from "./middleware/sanitize.js";

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import cookieParser from "cookie-parser";

dotenv.config();
console.log("JWT_SECRET used in server:", process.env.JWT_SECRET);

// Initialize Models
const initializeModels = async () => {
  try {
    console.log("Initializing database models...");
    await userModel(db);
    await registrationModel(db);
    console.log("All models initialized successfully.");
  } catch (error) {
    console.error("Model initialization failed:", error);
    process.exit(1);
  }
};

initializeModels().then(() => {
  // Initialize visitor counter table
  db.query('CREATE TABLE IF NOT EXISTS visitor_counter (id INT AUTO_INCREMENT PRIMARY KEY, count INT DEFAULT 0)', (err) => {
    if (err) {
      console.error('Error creating visitor_counter table:', err);
    } else {
      console.log('✅ Visitor counter table ready');
      // Ensure there's at least one row
      db.query('INSERT IGNORE INTO visitor_counter (id, count) VALUES (1, 0)', (err2) => {
        if (err2) {
          console.error('Error initializing visitor count:', err2);
        }
      });
    }
  });

  const app = express();

  // Security
  app.use(helmet());
  
app.use(cookieParser());

  // CORS
  app.use(
    cors({
      origin: ["https://www.nec.edu.in","https://nec.edu.in"],
      credentials: true,
    })
  );

  app.use(sanitizeMiddleware);
  app.use(express.json({ limit: "10mb" }));
  app.use("/uploads", express.static("uploads"));

  // Session setup
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "necadmin",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Set true if HTTPS reverse proxy
        httpOnly: true,
        sameSite: "lax",
      },
    })
  );

  // Passport initialization
  app.use(passport.initialize());
  app.use(passport.session());

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: "https://nec.edu.in/icodses/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const googleId = profile.id;
            const email = profile.emails[0].value;
            const name = profile.displayName;

            db.query(
              "SELECT * FROM users WHERE googleId = ?",
              [googleId],
              (err, results) => {
                if (err) return done(err);
                if (results.length) return done(null, results[0]);

                db.query(
                  "SELECT * FROM users WHERE email = ?",
                  [email],
                  (err, results) => {
                    if (err) return done(err);
                    if (results.length) {
                      const user = results[0];
                      db.query(
                        "UPDATE users SET googleId = ? WHERE id = ?",
                        [googleId, user.id],
                        (err2) => {
                          if (err2) return done(err2);
                          user.googleId = googleId;
                          return done(null, user);
                        }
                      );
                    } else {
                      db.query(
                        "INSERT INTO users (name, email, googleId, role) VALUES (?, ?, ?, ?)",
                        [name, email, googleId, "user"],
                        (err3, res) => {
                          if (err3) return done(err3);
                          db.query(
                            "SELECT * FROM users WHERE id = ?",
                            [res.insertId],
                            (err4, user) => done(err4, user[0])
                          );
                        }
                      );
                    }
                  }
                );
              }
            );
          } catch (error) {
            done(error);
          }
        }
      )
    );
  }

  // Passport session handling
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    db.query("SELECT * FROM users WHERE id = ?", [id], (err, results) => {
      done(err, results[0]);
    });
  });

  // Seed Admin
  seedAdmin();

  // Apply rate limiter to all APIs under /icodses
  app.use("/icodses", apiRateLimiter);

  // Routes
  app.use("/icodses/auth", authRoutes);
  app.use("/icodses/registration", registrationRoutes);
  app.use("/icodses/admin", adminRoutes);
  app.use("/icodses/visitors", visitorRoutes);

  // Google OAuth
  app.get(
    "/icodses/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  // Google OAuth Callback
  app.get(
    "/icodses/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/login",
      session: true,
    }),
    (req, res) => {
      const JWT_SECRET = process.env.JWT_SECRET || "necadmin";

      const token = jwt.sign(
        {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          track: req.user.track,
          isFirstLogin: false,
          passwordChanged: true,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Redirect to frontend with JWT token
      res.redirect(`https://nec.edu.in/ICoDSES/paper-status?token=${token}`);
    }
  );

  const PORT = process.env.PORT || 5800;
  app.listen(PORT, () =>
    console.log(`🚀 Server running on ${PORT}`)
  );
});
