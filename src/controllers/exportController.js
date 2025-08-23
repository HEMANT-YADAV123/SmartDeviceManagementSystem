const exportService = require('../services/exportService');
const { HTTP_STATUS } = require('../utils/constants');

const exportDeviceLogs = async (req, res, next) => {
  try {
    const result = await exportService.createExportJob(
      req.user._id,
      'device_logs',
      req.body
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Export job created successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const exportUsageReport = async (req, res, next) => {
  try {
    const result = await exportService.createExportJob(
      req.user._id,
      'usage_report',
      req.body
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Export job created successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const jobStatus = exportService.getJobStatus(jobId);

    if (!jobStatus) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Export job not found',
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      job: jobStatus,
    });
  } catch (error) {
    next(error);
  }
};

const downloadExport = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const result = exportService.getJobResult(jobId, req.user._id);

    if (!result) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Export not found or not ready',
      });
    }

    if (result.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.content);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="export_${jobId}.json"`);
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportDeviceLogs,
  exportUsageReport,
  getJobStatus,
  downloadExport,
};