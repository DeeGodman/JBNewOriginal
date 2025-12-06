import express from "express";
import cookieParser from "cookie-parser";
import { PORT } from "./config/env.js";
import cors from "cors";
import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/auth.routes.js";
import paymentRouter from "./routes/payment.route.js";
import bundleRouter from "./routes/bundle.route.js";
import orderRouter from "./routes/order.route.js";

import connectToDatabase from "./database/mongodb.js";
import errorMiddleware from "./middlewares/error.middleware.js";
// import arcjetMiddleware from './middlewares/arcjet.middleware.js';

const app = express();

// ==========================================
// CORS CONFIGURATION
// ==========================================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:5500", // Just in case you switch ports locally
  "https://joy-bundle.vercel.app", // Main production domain
  "https://joy-bundle-frontend.vercel.app", // Project domain
  "https://joy-bundle-frontend-git-main-deegodman.vercel.app", // (Optional) Git branch preview URL
  // Add any ngrok URLs here if testing with them
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ CORS Blocked Origin:", origin);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200,
  }),
);

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use(arcjetMiddleware);

// ==========================================
// ROUTES
// ==========================================
//const apiPrefix = "/api/v1";

app.use(`/api/v1/auth`, authRouter);
app.use(`/api/v1/users`, userRouter);
app.use(`/api/v1/payments`, paymentRouter);
app.use(`/api/v1/orders`, orderRouter);
app.use(`/api/v1/bundles`, bundleRouter);

// Base Routes
app.get("/", (req, res) => {
  res.send("Welcome to the JoyBundle API!");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is healthy" });
});

// ==========================================
// ERROR HANDLING
// ==========================================
app.use(errorMiddleware);

// ==========================================
// SERVER START
// ==========================================
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await connectToDatabase();
});
