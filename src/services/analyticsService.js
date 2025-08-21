const DeviceLog = require('../models/DeviceLog');
const Device = require('../models/Device');
const { LOG_EVENTS } = require('../utils/constants');
const mongoose = require('mongoose');
const cacheService = require('./cacheService');

/**
 * Verify device ownership helper
 */
const verifyDevice = async (deviceId, userId) => {
  const device = await Device.findOne({ _id: deviceId, owner_id: userId });
  if (!device) {
    throw new Error('Device not found');
  }
  return device;
};

/**
 * Create log entry
 */
const createLog = async (deviceId, userId, logData) => {
  await verifyDevice(deviceId, userId);

  const log = new DeviceLog({
    device_id: deviceId,
    ...logData,
  });

  await log.save();

  // Invalidate analytics cache for user
  await cacheService.invalidateUserAnalytics(userId);

  return log;
};

/**
 * Get logs for a device
 */
const getDeviceLogs = async (deviceId, userId, filters = {}) => {
  await verifyDevice(deviceId, userId);

  // Try cache first
  const cacheKey = { deviceId, filters };
  const cachedLogs = await cacheService.getCachedAnalytics(userId, 'logs', cacheKey);
  if (cachedLogs) {
    console.log('Cache HIT: Device logs');
    return cachedLogs;
  }

  console.log('Cache MISS: Device logs - fetching from DB');

  const { limit = 10, event, from, to } = filters;
  const query = { device_id: deviceId };

  if (event) query.event = event;

  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to) query.timestamp.$lte = new Date(to);
  }

  const logs = await DeviceLog.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  // Cache the result
  await cacheService.cacheAnalytics(userId, 'logs', cacheKey, logs);

  return logs;
};

/**
 * Get usage statistics for a device with caching
 */
const getDeviceUsage = async (deviceId, userId, range = '24h', event = null) => {
  await verifyDevice(deviceId, userId);

  // Try cache first
  const cacheKey = { deviceId, range, event };
  const cachedUsage = await cacheService.getCachedAnalytics(userId, 'usage', cacheKey);
  if (cachedUsage) {
    console.log('Cache HIT: Device usage');
    return cachedUsage;
  }

  console.log('Cache MISS: Device usage - fetching from DB');

  const now = new Date();
  const rangeMap = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const startTime = new Date(now.getTime() - rangeMap[range]);
  const deviceObjectId = new mongoose.Types.ObjectId(deviceId);
  
  const matchQuery = { 
    device_id: deviceObjectId,
    timestamp: { $gte: startTime, $lte: now } 
  };

  if (event) matchQuery.event = event;

  let result;

  if (event === LOG_EVENTS.UNITS_CONSUMED || !event) {
    const unitsConsumed = await DeviceLog.aggregate([
      { $match: { ...matchQuery, event: LOG_EVENTS.UNITS_CONSUMED } },
      {
        $group: {
          _id: null,
          totalUnits: { $sum: '$value' },
          count: { $sum: 1 },
          avgUnits: { $avg: '$value' },
          minUnits: { $min: '$value' },
          maxUnits: { $max: '$value' },
        },
      },
    ]);

    result = {
      device_id: deviceId,
      range,
      period: { start: startTime, end: now },
    };

    if (unitsConsumed.length > 0) {
      const stats = unitsConsumed[0];
      result[`total_units_last_${range}`] = stats.totalUnits || 0;
      result.statistics = {
        totalEvents: stats.count,
        averageConsumption: Math.round((stats.avgUnits || 0) * 100) / 100,
        minConsumption: stats.minUnits || 0,
        maxConsumption: stats.maxUnits || 0,
      };
    } else {
      result[`total_units_last_${range}`] = 0;
      result.statistics = { totalEvents: 0, averageConsumption: 0, minConsumption: 0, maxConsumption: 0 };
    }
  } else {
    const eventStats = await DeviceLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$event',
          count: { $sum: 1 },
          values: { $push: '$value' },
          timestamps: { $push: '$timestamp' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    result = { 
      device_id: deviceId, 
      range, 
      period: { start: startTime, end: now }, 
      eventStatistics: eventStats 
    };
  }

  // Cache the result
  await cacheService.cacheAnalytics(userId, 'usage', cacheKey, result);

  return result;
};

/**
 * Get aggregated usage across all devices of a user with caching
 */
const getAggregatedUsage = async (userId, range = '24h') => {
  // Try cache first
  const cacheKey = { range };
  const cachedUsage = await cacheService.getCachedAnalytics(userId, 'aggregated', cacheKey);
  if (cachedUsage) {
    console.log('Cache HIT: Aggregated usage');
    return cachedUsage;
  }

  console.log('Cache MISS: Aggregated usage - fetching from DB');

  const now = new Date();
  const rangeMap = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const startTime = new Date(now.getTime() - rangeMap[range]);

  const userDevices = await Device.find({ owner_id: userId }).select('_id name type');
  const deviceIds = userDevices.map(d => d._id);

  if (deviceIds.length === 0) {
    const result = { 
      totalUnits: 0, 
      deviceBreakdown: [], 
      period: { start: startTime, end: now } 
    };
    
    // Cache empty result too
    await cacheService.cacheAnalytics(userId, 'aggregated', cacheKey, result);
    return result;
  }

  const consumption = await DeviceLog.aggregate([
    {
      $match: {
        device_id: { $in: deviceIds },
        event: LOG_EVENTS.UNITS_CONSUMED,
        timestamp: { $gte: startTime, $lte: now },
      },
    },
    { $group: { _id: '$device_id', totalUnits: { $sum: '$value' }, eventCount: { $sum: 1 } } },
  ]);

  const deviceMap = new Map(userDevices.map(d => [d._id.toString(), d]));
  const deviceBreakdown = consumption.map(item => {
    const device = deviceMap.get(item._id.toString());
    return {
      device_id: item._id,
      device_name: device?.name || 'Unknown',
      device_type: device?.type || 'unknown',
      total_units: item.totalUnits,
      event_count: item.eventCount,
    };
  });

  const totalUnits = consumption.reduce((sum, item) => sum + item.totalUnits, 0);

  const result = {
    user_id: userId,
    range,
    period: { start: startTime, end: now },
    totalUnits,
    deviceCount: userDevices.length,
    activeDevices: consumption.length,
    deviceBreakdown: deviceBreakdown.sort((a, b) => b.total_units - a.total_units),
  };

  // Cache the result
  await cacheService.cacheAnalytics(userId, 'aggregated', cacheKey, result);

  return result;
};

/**
 * Get top events across all devices of a user with caching
 */
const getTopEvents = async (userId, range = '24h', limit = 10) => {
  // Try cache first
  const cacheKey = { range, limit };
  const cachedEvents = await cacheService.getCachedAnalytics(userId, 'topEvents', cacheKey);
  if (cachedEvents) {
    console.log('Cache HIT: Top events');
    return cachedEvents;
  }

  console.log('Cache MISS: Top events - fetching from DB');

  const now = new Date();
  const rangeMap = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const startTime = new Date(now.getTime() - rangeMap[range]);

  const userDevices = await Device.find({ owner_id: userId }).select('_id');
  const deviceIds = userDevices.map(d => d._id);

  const topEvents = await DeviceLog.aggregate([
    { $match: { device_id: { $in: deviceIds }, timestamp: { $gte: startTime, $lte: now } } },
    {
      $group: {
        _id: '$event',
        count: { $sum: 1 },
        devices: { $addToSet: '$device_id' },
        latestTimestamp: { $max: '$timestamp' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  const result = topEvents.map(event => ({
    event: event._id,
    count: event.count,
    uniqueDevices: event.devices.length,
    latestTimestamp: event.latestTimestamp,
  }));

  // Cache the result
  await cacheService.cacheAnalytics(userId, 'topEvents', cacheKey, result);

  return result;
};

module.exports = {
  createLog,
  getDeviceLogs,
  getDeviceUsage,
  getAggregatedUsage,
  getTopEvents,
};