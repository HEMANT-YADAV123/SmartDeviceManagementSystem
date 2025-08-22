const Redis = require('ioredis');

let redisClient = null;
let isConnected = false;

const connectRedis = async () => {
  if (redisClient && isConnected) {
    return redisClient;
  }

  try {
    let redisConfig;

    // Option 1: Use REDIS_URL if provided (recommended for Redis Cloud)
    if (process.env.REDIS_URL) {
      // Manual URL parsing for Redis URL
      const url = new URL(process.env.REDIS_URL);
      redisConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        username: url.username !== 'default' ? url.username : undefined,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        // Enable TLS for Redis Cloud if using rediss://
        tls: url.protocol === 'rediss:' ? {} : undefined,
      };
    } 
    // Option 2: Use individual Redis config variables
    else {
      redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        // Enable TLS if REDIS_TLS is set to true
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      };
    }

    console.log('Attempting to connect to Redis with config:', {
      host: redisConfig.host,
      port: redisConfig.port,
      tls: !!redisConfig.tls,
      hasPassword: !!redisConfig.password
    });

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

    redisClient.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    // Test connection
    await redisClient.connect();
    const pongResponse = await redisClient.ping();
    console.log('Redis ping response:', pongResponse);

    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error.message);
    // Don't throw error - app should work without Redis (degraded mode)
    isConnected = false;
    redisClient = null;
    return null;
  }
};

const disconnectRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error) {
      console.error('Error disconnecting Redis:', error.message);
    } finally {
      redisClient = null;
      isConnected = false;
      console.log('Redis disconnected');
    }
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