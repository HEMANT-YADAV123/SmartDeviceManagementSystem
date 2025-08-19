const deviceService = require('../services/deviceService');
const { HTTP_STATUS } = require('../utils/constants');

const createDevice = async (req, res, next) => {
  try {
    const device = await deviceService.createDevice(req.body, req.user._id);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      device,
    });
  } catch (error) {
    next(error);
  }
};

const getDevices = async (req, res, next) => {
  try {
    const result = await deviceService.getDevices(req.user._id, req.query);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getDevice = async (req, res, next) => {
  try {
    const device = await deviceService.getDeviceById(req.params.id, req.user._id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      device,
    });
  } catch (error) {
    if (error.message === 'Device not found') {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: error.message,
      });
    }
     next(error);
  }
};

const getDeviceStats = async (req, res, next) => {
  try {
    const stats = await deviceService.getDeviceStats(req.user._id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

const getDevicesByType = async (req, res, next) => {
  try {
    const devicesByType = await deviceService.getDevicesByType(req.user._id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      devicesByType,
    });
  } catch (error) {
    next(error);
  }
};

const updateDevice = async (req, res, next) => {
  try {
    const device = await deviceService.updateDevice(
      req.params.id,
      req.user._id,
      req.body
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Device updated successfully',
      device,
    });
  } catch (error) {
    if (error.message === 'Device not found') {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

const deleteDevice = async (req, res, next) => {
  try {
    await deviceService.deleteDevice(req.params.id, req.user._id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Device deleted successfully',
    });
  } catch (error) {
    if (error.message === 'Device not found') {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

const recordHeartbeat = async (req, res, next) => {
  try {
    const device = await deviceService.recordHeartbeat(
      req.params.id,
      req.user._id,
      req.body.status
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Device heartbeat recorded',
      last_active_at: device.last_active_at,
    });
  } catch (error) {
    if (error.message === 'Device not found') {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

module.exports = {
  createDevice,
  getDevices,
  getDevice,
  updateDevice,
  deleteDevice,
  recordHeartbeat,
  getDeviceStats,
  getDevicesByType,
};
