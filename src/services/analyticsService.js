const DeviceLog = require('../models/DeviceLog');
const Device = require('../models/Device');
const { LOG_EVENTS } = require('../utils/constants');

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
  return log;
};

/**
 * Get logs for a device
 */
const getDeviceLogs = async (deviceId, userId, filters = {}) => {
  await verifyDevice(deviceId, userId);

  const { limit = 10, event, from, to } = filters;
  const query = { device_id: deviceId };

  if (event) query.event = event;

  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to) query.timestamp.$lte = new Date(to);
  }

  return await DeviceLog.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get usage statistics for a device
 */
const getDeviceUsage = async (deviceId, userId, range = '24h', event = null) => {
  await verifyDevice(deviceId, userId);

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
  const matchQuery = { device_id: deviceId, timestamp: { $gte: startTime, $lte: now } };

  if (event) matchQuery.event = event;

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

    const result = {
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

    return result;
  }

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

  return { device_id: deviceId, range, period: { start: startTime, end: now }, eventStatistics: eventStats };
};

/**
 * Get aggregated usage across all devices of a user
 */
const getAggregatedUsage = async (userId, range = '24h') => {
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
    return { totalUnits: 0, deviceBreakdown: [], period: { start: startTime, end: now } };
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

  return {
    user_id: userId,
    range,
    period: { start: startTime, end: now },
    totalUnits,
    deviceCount: userDevices.length,
    activeDevices: consumption.length,
    deviceBreakdown: deviceBreakdown.sort((a, b) => b.total_units - a.total_units),
  };
};

/**
 * Get top events across all devices of a user
 */
const getTopEvents = async (userId, range = '24h', limit = 10) => {
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

  return topEvents.map(event => ({
    event: event._id,
    count: event.count,
    uniqueDevices: event.devices.length,
    latestTimestamp: event.latestTimestamp,
  }));
};

module.exports = {
  createLog,
  getDeviceLogs,
  getDeviceUsage,
  getAggregatedUsage,
  getTopEvents,
};
