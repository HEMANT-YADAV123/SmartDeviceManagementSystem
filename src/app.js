const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const exportRoutes = require("./routes/exportRoutes");
require("dotenv").config();


// Routes
const authRoutes = require("./routes/authRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

// Middleware
const { errorHandler, notFound } = require("./middlewares/errorHandler");
const { generalLimiter } = require("./middlewares/rateLimiter");

// Services
const backgroundJobService = require("./services/backgroundJobService");
const websocketService = require("./services/websocketService");

const app = express();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

// Request logging
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// Rate limiting
app.use(generalLimiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Smart Device Management API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/exports", exportRoutes);

// Admin/Debug endpoints (only in development)
if (process.env.NODE_ENV === "development") {
  app.get("/api/admin/background-jobs/status", (req, res) => {
    res.json({
      success: true,
      status: backgroundJobService.getStatus(),
    });
  });

  app.post("/api/admin/background-jobs/trigger", async (req, res) => {
    try {
      await backgroundJobService.triggerManualCheck();
      res.json({
        success: true,
        message: "Background job triggered successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  //websockets.
  app.get("/api/admin/websocket/stats", (req, res) => {
    const stats = websocketService.getStats();
    res.json({
      success: true,
      websocket: stats,
      timestamp: new Date().toISOString(),
    });
  });
}

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
