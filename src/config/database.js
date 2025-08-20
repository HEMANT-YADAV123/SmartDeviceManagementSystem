const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("MONGODB_URI:", process.env.MONGODB_URI);
    console.log("MONGODB_URI_TEST:", process.env.MONGODB_URI_TEST);

    const mongoURI = process.env.NODE_ENV === 'test' 
      ? process.env.MONGODB_URI_TEST 
      : process.env.MONGODB_URI;

    const conn = await mongoose.connect(mongoURI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error disconnecting from database:', error.message);
  }
};

module.exports = {
  connectDB,
  disconnectDB
};