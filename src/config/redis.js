const Redis = require('ioredis');

let redisClient = null;
let isConnected = false;

const connectRedis = async () => {
  if (redisClient && isConnected) {
    return redisClient;
  }

  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
      isConnected = true;
    });

    redisClient.on('error', (error) => {
      console.error('Redis connection error:', error.message);
      isConnected = false;
    });

    redisClient.on('close', () => {
      console.log('Redis connection closed');
      isConnected = false;
    });

    // Test connection
    await redisClient.connect();
    await redisClient.ping();
    
    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error.message);
    // Don't throw error - app should work without Redis (degraded mode)
    isConnected = false;
    return null;
  }
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    console.log('Redis disconnected');
  }
};

const getRedisClient = () => redisClient;

const isRedisConnected = () => isConnected;

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  isRedisConnected,
};