const app = require('./app');
const { connectDB } = require('./config/database');
const backgroundJobService = require('./services/backgroundJobService');

const PORT = process.env.PORT || 3000;

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  // Stop background jobs
  backgroundJobService.stop();
  
  // Close server
  server.close((err) => {
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('Server closed successfully');
    
    // Close database connection
    require('./config/database').disconnectDB().then(() => {
      console.log('Database connection closed');
      process.exit(0);
    }).catch((err) => {
      console.error('Error closing database connection:', err);
      process.exit(1);
    });
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Database connected successfully');
    
    // Start the server
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });

    // Start background jobs (only in production)
    if (process.env.NODE_ENV === 'production') {
      backgroundJobService.start();
    } else {
      console.log('Background jobs disabled in development mode');
      console.log('Use /api/admin/background-jobs/trigger to manually trigger jobs');
    }

    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Export server for testing
    global.server = server;
    return server;
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server only if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = startServer;