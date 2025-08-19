const analyticsService = require('../services/analyticsService');
const { HTTP_STATUS } = require('../utils/constants');

const createLog = async (req, res, next) => {
  try {
    const log = await analyticsService.createLog(
      req.params.id,
      req.user._id,
      req.body
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      log,
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

const getDeviceLogs = async (req, res, next) => {
  try {
    const logs = await analyticsService.getDeviceLogs(
      req.params.id,
      req.user._id,
      req.query
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      logs,
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

const getDeviceUsage = async (req, res, next) => {
  try {
    const usage = await analyticsService.getDeviceUsage(
      req.params.id,
      req.user._id,
      req.query.range,
      req.query.event
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      ...usage,
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

const getAggregatedUsage = async (req, res, next) => {
  try {
    const usage = await analyticsService.getAggregatedUsage(
      req.user._id,
      req.query.range
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      ...usage,
    });
  } catch (error) {
    next(error);
  }
};

const getTopEvents = async (req, res, next) => {
  try {
    const events = await analyticsService.getTopEvents(
      req.user._id,
      req.query.range,
      parseInt(req.query.limit) || 10
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      events,
    });
  } catch (error) {
    next(error);
  }
};

// Export all functions at once
module.exports = {
  createLog,
  getDeviceLogs,
  getDeviceUsage,
  getAggregatedUsage,
  getTopEvents,
};
