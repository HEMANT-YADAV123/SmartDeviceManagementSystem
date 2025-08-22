const Device = require('../models/Device');
const { DEVICE_STATUSES } = require('../utils/constants');
const cacheService = require('./cacheService');
const websocketService = require('./websocketService'); // ADD THIS

const createDevice = async (deviceData, userId) => {
  const device = new Device({
    ...deviceData,
    owner_id: userId,
  });
  await device.save();

  // Invalidate user's device cache
  await Promise.all([
    cacheService.invalidateUserDevices(userId),
    cacheService.invalidateStats(userId),
    cacheService.invalidateDevicesByType(userId),
  ]);

  // Notify via WebSocket
  websocketService.notifyDeviceUpdate(userId.toString(), {
    action: 'created',
    device: device.toObject(),
  });

  console.log(`🔔 WebSocket notification attempted for user: ${userId}`);
  const wsStats = websocketService.getStats();
  console.log(`📊 Current WebSocket stats:`, wsStats);

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
  // Try cache first for individual device
  const cachedDevice = await cacheService.getCachedDevice(deviceId, userId);
  if (cachedDevice) {
    console.log('Cache HIT: Single device');
    return cachedDevice;
  }

  console.log('Cache MISS: Single device - fetching from DB');

  const device = await Device.findOne({ _id: deviceId, owner_id: userId }).lean();
  if (!device) throw new Error('Device not found');

  // Cache the device
  await cacheService.cacheDevice(deviceId, userId, device);

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
  // Try cache first
  const cachedDevicesByType = await cacheService.getCachedDevicesByType(userId);
  if (cachedDevicesByType) {
    console.log('Cache HIT: Devices by type');
    return cachedDevicesByType;
  }

  console.log('Cache MISS: Devices by type - fetching from DB');

  const result = await Device.aggregate([
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

  // Cache the result
  await cacheService.cacheDevicesByType(userId, result);

  return result;
};

const updateDevice = async (deviceId, userId, updateData) => {
  const oldDevice = await Device.findOne({ _id: deviceId, owner_id: userId }).lean();
  if (!oldDevice) throw new Error('Device not found');

  const device = await Device.findOneAndUpdate(
    { _id: deviceId, owner_id: userId },
    updateData,
    { new: true, runValidators: true }
  );

  // Invalidate related caches
  await Promise.all([
    cacheService.invalidateUserDevices(userId),
    cacheService.invalidateStats(userId),
    cacheService.invalidateUserAnalytics(userId),
    cacheService.invalidateDevice(deviceId, userId),
    cacheService.invalidateDevicesByType(userId),
  ]);

  // Notify via WebSocket
  websocketService.notifyDeviceUpdate(userId.toString(), {
    action: 'updated',
    device: device.toObject(),
    changes: updateData,
    previousStatus: oldDevice.status,
  });

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
    cacheService.invalidateDevice(deviceId, userId),
    cacheService.invalidateDevicesByType(userId),
  ]);

  // Notify via WebSocket
  websocketService.notifyDeviceUpdate(userId.toString(), {
    action: 'deleted',
    device: device.toObject(),
  });

  return device;
};

const recordHeartbeat = async (deviceId, userId, status) => {
  const oldDevice = await Device.findOne({ _id: deviceId, owner_id: userId }).lean();
  if (!oldDevice) throw new Error('Device not found');

  const device = await Device.findOneAndUpdate(
    { _id: deviceId, owner_id: userId },
    {
      last_active_at: new Date(),
      ...(status && { status }),
    },
    { new: true }
  );

  // Enhanced cache invalidation for heartbeat
  const invalidationPromises = [
    cacheService.invalidateDevice(deviceId, userId),
  ];

  // If status changed, invalidate stats and devices by type
  if (status && status !== oldDevice.status) {
    invalidationPromises.push(
      cacheService.invalidateStats(userId),
      cacheService.invalidateDevicesByType(userId)
    );
  }

  await Promise.all(invalidationPromises);

  // Notify via WebSocket - CRITICAL for real-time updates
  websocketService.notifyDeviceHeartbeat(
    userId.toString(), 
    deviceId, 
    device.status, 
    device.last_active_at
  );

  // If status changed significantly, send full device update
  if (status && status !== oldDevice.status) {
    websocketService.notifyDeviceUpdate(userId.toString(), {
      action: 'status_changed',
      device: device.toObject(),
      previousStatus: oldDevice.status,
      newStatus: device.status,
    });
  }

  return device;
};

const getInactiveDevices = async (thresholdHours = 24) => {
  // Try cache first
  const cachedInactiveDevices = await cacheService.getCachedInactiveDevices(thresholdHours);
  if (cachedInactiveDevices) {
    console.log('Cache HIT: Inactive devices');
    return cachedInactiveDevices;
  }

  console.log('Cache MISS: Inactive devices - fetching from DB');

  const thresholdDate = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

  const result = await Device.find({
    status: { $ne: DEVICE_STATUSES.OFFLINE },
    $or: [
      { last_active_at: { $lt: thresholdDate } },
      { last_active_at: null, createdAt: { $lt: thresholdDate } },
    ],
  }).lean();

  // Cache for shorter duration since this is time-sensitive
  await cacheService.cacheInactiveDevices(thresholdHours, result);

  return result;
};

const deactivateDevice = async (deviceId) => {
  const device = await Device.findByIdAndUpdate(
    deviceId,
    { status: DEVICE_STATUSES.OFFLINE },
    { new: true }
  );

  if (device) {
    // Invalidate relevant caches when deactivating
    await Promise.all([
      cacheService.invalidateDevice(deviceId, device.owner_id),
      cacheService.invalidateStats(device.owner_id),
      cacheService.invalidateUserDevices(device.owner_id),
      cacheService.invalidateDevicesByType(device.owner_id),
    ]);

    // Notify via WebSocket
    websocketService.notifyDeviceUpdate(device.owner_id, {
      action: 'deactivated',
      device: device.toObject(),
      previousStatus: 'active',
      newStatus: DEVICE_STATUSES.OFFLINE,
    });
  }

  return device;
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