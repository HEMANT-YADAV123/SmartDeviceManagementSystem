const { getRedisClient } = require("../config/redis");

// Define TTL constants
const TTL = {
  devices: 30 * 60, // 30 minutes
  device: 15 * 60, // 15 minutes for single device
  user: 30 * 60, // 30 minutes
  analytics: 5 * 60, // 5 minutes
  stats: 10 * 60, // 10 minutes
  devicesByType: 20 * 60, // 20 minutes for devices by type
  inactiveDevices: 5 * 60, // 5 minutes for inactive devices (time-sensitive)
};

// Cache stats tracker
const stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
};

// --- Utility: generate redis keys ---
const generateKey = (prefix, identifier, ...params) => {
  const suffix = params.length > 0 ? `:${params.join(":")}` : "";
  return `${prefix}:${identifier}${suffix}`;
};

// --- Utility: stats + logging ---
const updateStats = (type) => {
  if (stats[type] !== undefined) stats[type]++;
};

const getStats = () => {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(2) : 0;

  return {
    ...stats,
    hitRate: `${hitRate}%`,
    total,
  };
};

const resetStats = () => {
  stats.hits = 0;
  stats.misses = 0;
  stats.sets = 0;
  stats.deletes = 0;
  console.log("📊 Cache statistics reset");
};

const logStats = () => {
  console.log("📊 CACHE STATS:", JSON.stringify(getStats(), null, 2));
};

// --- Core Cache Functions ---
const getCache = async (key) => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      stats.misses++;
      console.warn("⚠️ Redis not connected - cache miss");
      return null;
    }

    const data = await redis.get(key);
    if (data) {
      stats.hits++;
      console.log(`🎯 CACHE HIT: ${key}`);
      return JSON.parse(data);
    } else {
      stats.misses++;
      console.log(`❌ CACHE MISS: ${key}`);
      return null;
    }
  } catch (error) {
    stats.misses++;
    console.warn("❌ Cache get error:", error.message);
    return null;
  }
};

const setCache = async (key, data, ttl = null) => {
  try {
    const redis = getRedisClient();
    if (!redis) return false;

    const serialized = JSON.stringify(data);
    if (ttl) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
    stats.sets++;
    console.log(`✅ CACHE SET: ${key} (TTL: ${ttl || "∞"})`);
    return true;
  } catch (error) {
    console.warn("❌ Cache set error:", error.message);
    return false;
  }
};

const deleteCache = async (key) => {
  try {
    const redis = getRedisClient();
    if (!redis) return false;

    const result = await redis.del(key);
    stats.deletes++;
    console.log(`🗑️ CACHE DELETE: ${key} (deleted: ${result === 1})`);
    return result === 1;
  } catch (error) {
    console.warn("❌ Cache delete error:", error.message);
    return false;
  }
};

const deletePatternCache = async (pattern) => {
  try {
    const redis = getRedisClient();
    if (!redis) return false;

    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      stats.deletes += keys.length;
      console.log(`🗑️ CACHE PATTERN DELETE: ${pattern} (${keys.length} keys)`);
    }
    return true;
  } catch (error) {
    console.warn("❌ Cache pattern delete error:", error.message);
    return false;
  }
};

// --- Device List cache functions (existing) ---
const cacheDevices = async (userId, filters, data) => {
  const key = generateKey("devices", userId, JSON.stringify(filters));
  return setCache(key, data, TTL.devices);
};

const getCachedDevices = async (userId, filters) => {
  const key = generateKey("devices", userId, JSON.stringify(filters));
  return getCache(key);
};

const invalidateUserDevices = async (userId) => {
  const pattern = generateKey("devices", userId, "*");
  return deletePatternCache(pattern);
};

// --- NEW: Single Device cache functions ---
const cacheDevice = async (deviceId, userId, data) => {
  const key = generateKey("device", deviceId, userId);
  return setCache(key, data, TTL.device);
};

const getCachedDevice = async (deviceId, userId) => {
  const key = generateKey("device", deviceId, userId);
  return getCache(key);
};

const invalidateDevice = async (deviceId, userId) => {
  const key = generateKey("device", deviceId, userId);
  return deleteCache(key);
};

// --- NEW: Devices by Type cache functions ---
const cacheDevicesByType = async (userId, data) => {
  const key = generateKey("devices_by_type", userId);
  return setCache(key, data, TTL.devicesByType);
};

const getCachedDevicesByType = async (userId) => {
  const key = generateKey("devices_by_type", userId);
  return getCache(key);
};

const invalidateDevicesByType = async (userId) => {
  const key = generateKey("devices_by_type", userId);
  return deleteCache(key);
};

// --- NEW: Inactive Devices cache functions ---
const cacheInactiveDevices = async (thresholdHours, data) => {
  const key = generateKey("inactive_devices hrs", thresholdHours);
  return setCache(key, data, TTL.inactiveDevices);
};

const getCachedInactiveDevices = async (thresholdHours) => {
  const key = generateKey("inactive_devices", thresholdHours);
  return getCache(key);
};

const invalidateInactiveDevices = async (thresholdHours = null) => {
  if (thresholdHours) {
    const key = generateKey("inactive_devices", thresholdHours);
    return deleteCache(key);
  } else {
    // Invalidate all inactive device caches
    const pattern = generateKey("inactive_devices", "*");
    return deletePatternCache(pattern);
  }
};

// --- User cache functions (existing) ---
const cacheUser = async (userId, userData) => {
  const key = generateKey("user", userId);
  return setCache(key, userData, TTL.user);
};

const getCachedUser = async (userId) => {
  const key = generateKey("user", userId);
  return getCache(key);
};

const invalidateUser = async (userId) => {
  const key = generateKey("user", userId);
  return deleteCache(key);
};

// --- Analytics cache functions (existing) ---
const cacheAnalytics = async (userId, type, params, data) => {
  const key = generateKey("analytics", userId, type, JSON.stringify(params));
  return setCache(key, data, TTL.analytics);
};

const getCachedAnalytics = async (userId, type, params) => {
  const key = generateKey("analytics", userId, type, JSON.stringify(params));
  return getCache(key);
};

const invalidateUserAnalytics = async (userId) => {
  const pattern = generateKey("analytics", userId, "*");
  return deletePatternCache(pattern);
};

// --- Stats cache functions (existing) ---
const cacheStats = async (userId, data) => {
  const key = generateKey("stats", userId);
  return setCache(key, data, TTL.stats);
};

const getCachedStats = async (userId) => {
  const key = generateKey("stats", userId);
  return getCache(key);
};

const invalidateStats = async (userId) => {
  const key = generateKey("stats", userId);
  return deleteCache(key);
};

// --- Health check ---
const cacheHealthCheck = async () => {
  try {
    const redis = getRedisClient();
    if (!redis)
      return { status: "disabled", error: "Redis client not available" };

    const start = Date.now();
    await redis.ping();
    const responseTime = Date.now() - start;

    return {
      status: "connected",
      responseTime: `${responseTime}ms`,
      stats: getStats(),
    };
  } catch (error) {
    return {
      status: "error",
      error: error.message,
    };
  }
};

// --- NEW: Batch invalidation helper ---
const invalidateAllUserCaches = async (userId) => {
  console.log(`🧹 BATCH INVALIDATION: All caches for user ${userId}`);
  
  return Promise.all([
    invalidateUserDevices(userId),
    invalidateStats(userId),
    invalidateUserAnalytics(userId),
    invalidateDevicesByType(userId),
    invalidateUser(userId),
  ]);
};

// --- Export ---
module.exports = {
  // Core
  generateKey,
  getCache,
  setCache,
  deleteCache,
  deletePatternCache,

  // Device Lists
  cacheDevices,
  getCachedDevices,
  invalidateUserDevices,

  // Single Device (NEW)
  cacheDevice,
  getCachedDevice,
  invalidateDevice,

  // Devices by Type (NEW)
  cacheDevicesByType,
  getCachedDevicesByType,
  invalidateDevicesByType,

  // Inactive Devices (NEW)
  cacheInactiveDevices,
  getCachedInactiveDevices,
  invalidateInactiveDevices,

  // User
  cacheUser,
  getCachedUser,
  invalidateUser,

  // Analytics
  cacheAnalytics,
  getCachedAnalytics,
  invalidateUserAnalytics,

  // Stats
  cacheStats,
  getCachedStats,
  invalidateStats,

  // Batch operations (NEW)
  invalidateAllUserCaches,

  // Health & stats
  cacheHealthCheck,
  getStats,
  resetStats,
  logStats,

  // TTL
  TTL,
};