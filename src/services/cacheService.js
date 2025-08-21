const { getRedisClient } = require('../config/redis');

class CacheService {
  constructor() {
    this.ttl = {
      devices: 30 * 60, // 30 minutes
      user: 30 * 60,    // 30 minutes
      analytics: 5 * 60, // 5 minutes
      stats: 10 * 60,   // 10 minutes
    };
  }

  generateKey(prefix, identifier, ...params) {
    const suffix = params.length > 0 ? `:${params.join(':')}` : '';
    return `${prefix}:${identifier}${suffix}`;
  }

  async get(key) {
    try {
      const redis = getRedisClient();
      if (!redis) return null;

      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Cache get error:', error.message);
      return null;
    }
  }

  async set(key, data, ttl = null) {
    try {
      const redis = getRedisClient();
      if (!redis) return false;

      const serialized = JSON.stringify(data);
      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.warn('Cache set error:', error.message);
      return false;
    }
  }

  async del(key) {
    try {
      const redis = getRedisClient();
      if (!redis) return false;

      await redis.del(key);
      return true;
    } catch (error) {
      console.warn('Cache delete error:', error.message);
      return false;
    }
  }

  async delPattern(pattern) {
    try {
      const redis = getRedisClient();
      if (!redis) return false;

      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.warn('Cache pattern delete error:', error.message);
      return false;
    }
  }

  // Device-specific cache methods
  async cacheDevices(userId, filters, data) {
    const key = this.generateKey('devices', userId, JSON.stringify(filters));
    return this.set(key, data, this.ttl.devices);
  }

  async getCachedDevices(userId, filters) {
    const key = this.generateKey('devices', userId, JSON.stringify(filters));
    return this.get(key);
  }

  async invalidateUserDevices(userId) {
    const pattern = this.generateKey('devices', userId, '*');
    return this.delPattern(pattern);
  }

  // User cache methods
  async cacheUser(userId, userData) {
    const key = this.generateKey('user', userId);
    return this.set(key, userData, this.ttl.user);
  }

  async getCachedUser(userId) {
    const key = this.generateKey('user', userId);
    return this.get(key);
  }

  async invalidateUser(userId) {
    const key = this.generateKey('user', userId);
    return this.del(key);
  }

  // Analytics cache methods
  async cacheAnalytics(userId, type, params, data) {
    const key = this.generateKey('analytics', userId, type, JSON.stringify(params));
    return this.set(key, data, this.ttl.analytics);
  }

  async getCachedAnalytics(userId, type, params) {
    const key = this.generateKey('analytics', userId, type, JSON.stringify(params));
    return this.get(key);
  }

  async invalidateUserAnalytics(userId) {
    const pattern = this.generateKey('analytics', userId, '*');
    return this.delPattern(pattern);
  }

  // Stats cache methods
  async cacheStats(userId, data) {
    const key = this.generateKey('stats', userId);
    return this.set(key, data, this.ttl.stats);
  }

  async getCachedStats(userId) {
    const key = this.generateKey('stats', userId);
    return this.get(key);
  }

  async invalidateStats(userId) {
    const key = this.generateKey('stats', userId);
    return this.del(key);
  }

  // Health check
  async healthCheck() {
    try {
      const redis = getRedisClient();
      if (!redis) return { status: 'disabled', error: 'Redis client not available' };

      const start = Date.now();
      await redis.ping();
      const responseTime = Date.now() - start;

      return {
        status: 'connected',
        responseTime: `${responseTime}ms`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }
}

module.exports = new CacheService();