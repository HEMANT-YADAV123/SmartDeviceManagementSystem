const { Parser } = require('json2csv');
const DeviceLog = require('../models/DeviceLog');
const Device = require('../models/Device');
const { v4: uuidv4 } = require('uuid');

class ExportService {
  constructor() {
    this.activeJobs = new Map(); // jobId -> job details
  }

  // Generate export job ID
  generateJobId() {
    return uuidv4();
  }

  // Create export job
  async createExportJob(userId, type, params = {}) {
    const jobId = this.generateJobId();
    const job = {
      id: jobId,
      userId,
      type, // 'device_logs' or 'usage_report'
      params,
      status: 'pending',
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      error: null,
      result: null,
      progress: 0,
    };

    this.activeJobs.set(jobId, job);

    // Start processing in background
    setImmediate(() => this.processJob(jobId));

    return {
      jobId,
      status: 'pending',
      message: 'Export job created and will be processed shortly',
    };
  }

  // Process export job
  async processJob(jobId) {
  const job = this.activeJobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'processing';
    job.startedAt = new Date();
    job.progress = 10;

    console.log(`Starting export job ${jobId} for user ${job.userId}`);

    let result;
    switch (job.type) {
      case 'device_logs':
        result = await this.exportDeviceLogs(job);
        break;
      case 'usage_report':
        result = await this.exportUsageReport(job);
        break;
      default:
        throw new Error('Invalid export type');
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.result = result;
    job.progress = 100;

    console.log(`Export job ${jobId} completed successfully`);
    console.log(`Job result stored:`, !!job.result);

    // Simulate email notification
    this.simulateEmailNotification(job);

    // Clean up job after 1 hour (but log it)
    setTimeout(() => {
      console.log(`🕐 Cleaning up export job ${jobId} after 1 hour`);
      this.activeJobs.delete(jobId);
      console.log(`Cleaned up export job ${jobId}`);
    }, 60 * 60 * 1000);

  } catch (error) {
    console.error(`Export job ${jobId} failed:`, error.message);
    
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = new Date();

    // Clean up failed job after 30 minutes
    setTimeout(() => {
      console.log(`🕐 Cleaning up failed export job ${jobId} after 30 minutes`);
      this.activeJobs.delete(jobId);
    }, 30 * 60 * 1000);
  }
}

  // Export device logs
  // Add this debugging to your exportDeviceLogs method in exportService.js

async exportDeviceLogs(job) {
  const { userId, params } = job;
  const { deviceId, format = 'csv', dateFrom, dateTo, event } = params;

  job.progress = 20;

  // Build query
  const query = {};
  let deviceInfo = null;
  
  if (deviceId) {
    // Verify device ownership
    const device = await Device.findOne({ _id: deviceId, owner_id: userId });
    if (!device) {
      throw new Error('Device not found');
    }
    console.log('Device found:', device.name, device._id);
    deviceInfo = device;
    query.device_id = deviceId;
  } else {
    // Get all user devices
    const userDevices = await Device.find({ owner_id: userId }).select('_id');
    console.log('User devices found:', userDevices.length);
    query.device_id = { $in: userDevices.map(d => d._id) };
  }

  if (event) {
    query.event = event;
    console.log('Event filter:', event);
  }

  if (dateFrom || dateTo) {
    query.timestamp = {};
    if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
    if (dateTo) query.timestamp.$lte = new Date(dateTo);
    console.log('Date range:', query.timestamp);
  }

  // DEBUG: Log the final query
  console.log('MongoDB Query:', JSON.stringify(query, null, 2));

  job.progress = 40;

  // DEBUG: First check raw count
  const rawCount = await DeviceLog.countDocuments(query);
  console.log('Raw log count matching query:', rawCount);

  // Fetch logs directly (no aggregation)
  const rawLogs = await DeviceLog.find(query).sort({ timestamp: -1 });
  console.log('Raw logs found:', rawLogs.length);

  job.progress = 60;

  // If we have multiple devices, fetch all device info
  let deviceMap = new Map();
  
  if (!deviceId) {
    // For multiple devices, get all device info
    const allDevices = await Device.find({ owner_id: userId });
    allDevices.forEach(device => {
      deviceMap.set(device._id.toString(), device);
    });
    console.log('Device map created for', deviceMap.size, 'devices');
  } else {
    // For single device, we already have the info
    deviceMap.set(deviceId, deviceInfo);
  }

  // Combine the data in JavaScript
  const logs = rawLogs.map(log => {
    const device = deviceMap.get(log.device_id.toString());
    return {
      timestamp: log.timestamp,
      event: log.event,
      value: log.value,
      metadata: log.metadata || {},
      deviceId: log.device_id,
      deviceName: device?.name || 'Unknown Device',
      deviceType: device?.type || 'unknown',
      deviceStatus: device?.status || 'unknown',
    };
  });

  console.log('Final processed results:', logs.length);
  if (logs.length > 0) {
    console.log('First result sample:', {
      timestamp: logs[0].timestamp,
      event: logs[0].event,
      value: logs[0].value,
      deviceName: logs[0].deviceName
    });
  }
  
  job.progress = 70;

  // Format data
  let result;
  if (format === 'csv') {
    result = await this.formatAsCSV(logs, 'device_logs');
  } else {
    result = {
      format: 'json',
      data: logs,
      metadata: {
        totalRecords: logs.length,
        exportedAt: new Date(),
        query: params,
      },
    };
  }

  job.progress = 90;
  return result;
}

  // Export usage report
  async exportUsageReport(job) {
    const { userId, params } = job;
    const { format = 'json', dateFrom, dateTo, groupBy = 'device' } = params;

    job.progress = 20;

    // Default to last 30 days if no dates provided
    const endDate = dateTo ? new Date(dateTo) : new Date();
    const startDate = dateFrom ? new Date(dateFrom) : new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Get user devices
    const userDevices = await Device.find({ owner_id: userId }).select('_id name type');
    const deviceIds = userDevices.map(d => d._id);

    job.progress = 40;

    // Aggregate usage data
    const pipeline = [
      {
        $match: {
          device_id: { $in: deviceIds },
          timestamp: { $gte: startDate, $lte: endDate },
          event: 'units_consumed',
        },
      },
    ];

    if (groupBy === 'device') {
      pipeline.push(
        {
          $group: {
            _id: '$device_id',
            totalUnits: { $sum: '$value' },
            eventCount: { $sum: 1 },
            averageUnits: { $avg: '$value' },
            minUnits: { $min: '$value' },
            maxUnits: { $max: '$value' },
            firstEvent: { $min: '$timestamp' },
            lastEvent: { $max: '$timestamp' },
          },
        },
        {
          $lookup: {
            from: 'devices',
            localField: '_id',
            foreignField: '_id',
            as: 'device',
          },
        },
        { $unwind: '$device' },
        {
          $project: {
            deviceId: '$_id',
            deviceName: '$device.name',
            deviceType: '$device.type',
            totalUnits: 1,
            eventCount: 1,
            averageUnits: { $round: ['$averageUnits', 2] },
            minUnits: 1,
            maxUnits: 1,
            firstEvent: 1,
            lastEvent: 1,
          },
        }
      );
    } else if (groupBy === 'day') {
      pipeline.push(
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' },
            },
            totalUnits: { $sum: '$value' },
            eventCount: { $sum: 1 },
            uniqueDevices: { $addToSet: '$device_id' },
          },
        },
        {
          $project: {
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: '$_id.day',
              },
            },
            totalUnits: 1,
            eventCount: 1,
            uniqueDevices: { $size: '$uniqueDevices' },
          },
        },
        { $sort: { date: 1 } }
      );
    }

    job.progress = 70;

    const usageData = await DeviceLog.aggregate(pipeline);

    // Calculate summary statistics
    const summary = {
      totalDevices: userDevices.length,
      reportPeriod: {
        from: startDate,
        to: endDate,
        days: Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000)),
      },
      totalUnits: usageData.reduce((sum, item) => sum + item.totalUnits, 0),
      totalEvents: usageData.reduce((sum, item) => sum + item.eventCount, 0),
    };

    job.progress = 90;

    // Format result
    let result;
    if (format === 'csv') {
      result = await this.formatAsCSV(usageData, 'usage_report');
    } else {
      result = {
        format: 'json',
        summary,
        data: usageData,
        metadata: {
          exportedAt: new Date(),
          groupBy,
          query: params,
        },
      };
    }

    return result;
  }

  // Format data as CSV
  async formatAsCSV(data, type) {
    if (data.length === 0) {
      return {
        format: 'csv',
        content: 'No data available for the specified criteria',
        filename: `${type}_${Date.now()}.csv`,
      };
    }

    let fields;
    if (type === 'device_logs') {
      fields = [
        'timestamp',
        'deviceName',
        'deviceType',
        'event',
        'value',
        'deviceStatus',
      ];
    } else if (type === 'usage_report') {
      fields = Object.keys(data[0]);
    }

    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    return {
      format: 'csv',
      content: csv,
      filename: `${type}_${Date.now()}.csv`,
      size: Buffer.byteLength(csv, 'utf8'),
    };
  }

  // Get job status
  getJobStatus(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      type: job.type,
      params: job.params,
    };
  }

  getAllActiveJobs() {
  console.log('🔍 All active jobs:');
  console.log('Total jobs:', this.activeJobs.size);
  
  for (const [jobId, job] of this.activeJobs.entries()) {
    console.log(`Job ${jobId}:`, {
      status: job.status,
      userId: job.userId,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      hasResult: !!job.result
    });
  }
  
  return Array.from(this.activeJobs.entries());
}

  // Get job result
  // Get job result
getJobResult(jobId, userId) {
  console.log('🔍 getJobResult called with:', { 
    jobId, 
    userId: userId.toString(),
    totalActiveJobs: this.activeJobs.size 
  });
  
  const job = this.activeJobs.get(jobId);
  console.log('📋 Found job:', job ? 'YES' : 'NO');
  
  if (!job) {
    console.log('❌ Job not found. Available jobs:', Array.from(this.activeJobs.keys()));
    return null;
  }

  // Convert both to strings for comparison
  const jobUserId = job.userId.toString();
  const requestUserId = userId.toString();
  
  if (jobUserId !== requestUserId) {
    console.log('❌ User ID mismatch:', { jobUserId, requestUserId });
    return null;
  }

  if (job.status !== 'completed') {
    console.log('❌ Job not completed:', job.status);
    return null;
  }

  console.log('✅ Job result exists:', !!job.result);
  console.log('✅ Result format:', job.result?.format);
  return job.result;
}

  // Simulate email notification
  simulateEmailNotification(job) {
    console.log(`📧 EMAIL NOTIFICATION SENT:`);
    console.log(`To: User ${job.userId}`);
    console.log(`Subject: Export Job Complete - ${job.type}`);
    console.log(`Message: Your ${job.type} export has been completed successfully.`);
    console.log(`Job ID: ${job.id}`);
    console.log(`Completed at: ${job.completedAt}`);
    console.log(`You can download your export using the job ID.`);
    console.log('─'.repeat(50));
  }

  // Get all active jobs for admin
  getAllJobs() {
    return Array.from(this.activeJobs.values()).map(job => ({
      id: job.id,
      userId: job.userId,
      type: job.type,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    }));
  }
}

module.exports = new ExportService();