const Device = require('../models/Device');
const { DEVICE_STATUSES } = require('../utils/constants');
const cacheService = require('./cacheService');

const createDevice = async (deviceData, userId) => {
  const device = new Device({
    ...deviceData,
    owner_id: userId,
  });
  await device.save();

  // Invalidate user's device cache
  await cacheService.invalidateUserDevices(userId);
  await cacheService.invalidateStats(userId);

  return device;
};

const getDevices = async (userId, filters = {}) => {
  const { type, status, page = 1, limit = 10 } = filters;

  // Try cache first
  const cachedResult = await cacheService.getCachedDevices(userId, filters);
  if (cachedResult) {
    console.log('Cache HIT: Device list');
    return cachedResult;
  }

  console.log('Cache MISS: Device list - fetching from DB');

  const query = { owner_id: userId };
  if (type) query.type = type;
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [devices, totalCount] = await Promise.all([
    Device.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Device.countDocuments(query),
  ]);

  const result = {
    devices,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1,
    },
  };

  // Cache the result
  await cacheService.cacheDevices(userId, filters, result);

  return result;
};

const getDeviceById = async (deviceId, userId) => {
  const device = await Device.findOne({ _id: deviceId, owner_id: userId });
  if (!device) throw new Error('Device not found');

  return device;
};

const getDeviceStats = async (userId) => {
  // Try cache first
  const cachedStats = await cacheService.getCachedStats(userId);
  if (cachedStats) {
    console.log('Cache HIT: Device stats');
    return cachedStats;
  }

  console.log('Cache MISS: Device stats - fetching from DB');

  const stats = await Device.aggregate([
    { $match: { owner_id: userId } },
    {
      $group: {
        _id: null,
        totalDevices: { $sum: 1 },
        activeDevices: {
          $sum: { $cond: [{ $eq: ['$status', DEVICE_STATUSES.ACTIVE] }, 1, 0] },
        },
        inactiveDevices: {
          $sum: { $cond: [{ $eq: ['$status', DEVICE_STATUSES.INACTIVE] }, 1, 0] },
        },
        offlineDevices: {
          $sum: { $cond: [{ $eq: ['$status', DEVICE_STATUSES.OFFLINE] }, 1, 0] },
        },
        maintenanceDevices: {
          $sum: { $cond: [{ $eq: ['$status', DEVICE_STATUSES.MAINTENANCE] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalDevices: 1,
        activeDevices: 1,
        inactiveDevices: 1,
        offlineDevices: 1,
        maintenanceDevices: 1,
      },
    },
  ]);

  const result = stats[0] || {
    totalDevices: 0,
    activeDevices: 0,
    inactiveDevices: 0,
    offlineDevices: 0,
    maintenanceDevices: 0,
  };

  // Cache the stats
  await cacheService.cacheStats(userId, result);

  return result;
};

const getDevicesByType = async (userId) => {
  return await Device.aggregate([
    { $match: { owner_id: userId } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        devices: { $push: '$$ROOT' },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

const updateDevice = async (deviceId, userId, updateData) => {
  const device = await Device.findOneAndUpdate(
    { _id: deviceId, owner_id: userId },
    updateData,
    { new: true, runValidators: true }
  );
  
  if (!device) throw new Error('Device not found');

  // Invalidate related caches
  await Promise.all([
    cacheService.invalidateUserDevices(userId),
    cacheService.invalidateStats(userId),
    cacheService.invalidateUserAnalytics(userId),
  ]);

  return device;
};

const deleteDevice = async (deviceId, userId) => {
  const device = await Device.findOneAndDelete({ _id: deviceId, owner_id: userId });
  if (!device) throw new Error('Device not found');

  // Invalidate related caches
  await Promise.all([
    cacheService.invalidateUserDevices(userId),
    cacheService.invalidateStats(userId),
    cacheService.invalidateUserAnalytics(userId),
  ]);

  return device;
};

const recordHeartbeat = async (deviceId, userId, status) => {
  const device = await Device.findOneAndUpdate(
    { _id: deviceId, owner_id: userId },
    {
      last_active_at: new Date(),
      ...(status && { status }),
    },
    { new: true }
  );
  
  if (!device) throw new Error('Device not found');

  // Invalidate stats cache if status changed
  if (status) {
    await cacheService.invalidateStats(userId);
  }

  return device;
};
 
const getInactiveDevices = async (thresholdHours = 24) => {
  const thresholdDate = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

  return await Device.find({
    status: { $ne: DEVICE_STATUSES.OFFLINE },
    $or: [
      { last_active_at: { $lt: thresholdDate } },
      { last_active_at: null, createdAt: { $lt: thresholdDate } },
    ],
  });
};

const deactivateDevice = async (deviceId) => {
  return await Device.findByIdAndUpdate(
    deviceId,
    { status: DEVICE_STATUSES.OFFLINE },
    { new: true }
  );
};

module.exports = {
  createDevice,
  getDevices,
  getDeviceById,
  updateDevice,
  deleteDevice,
  recordHeartbeat,
  getInactiveDevices,
  deactivateDevice,
  getDeviceStats,
  getDevicesByType,
};