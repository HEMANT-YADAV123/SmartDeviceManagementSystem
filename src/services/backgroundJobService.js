const deviceService = require('./deviceService');
const { DEVICE_STATUSES } = require('../utils/constants');

let isRunning = false;
let intervalId = null;
let thresholdHours = parseInt(process.env.DEVICE_INACTIVE_THRESHOLD_HOURS) || 24;

// Start the background job
const start = () => {
  if (isRunning) {
    console.log('Background job service is already running');
    return;
  }

  console.log('Starting background job service...');
  isRunning = true;

  // Run immediately
  processInactiveDevices();

  // Run every hour
  intervalId = setInterval(() => {
    processInactiveDevices();
  }, 60 * 60 * 1000);

  console.log(`Background job service started. Checking for inactive devices every hour.`);
};

// Stop the background job
const stop = () => {
  if (!isRunning) {
    console.log('Background job service is not running');
    return;
  }

  console.log('Stopping background job service...');
  isRunning = false;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  console.log('Background job service stopped');
};

// Process inactive devices
const processInactiveDevices = async () => {
  try {
    console.log(`Checking for devices inactive for more than ${thresholdHours} hours...`);

    const inactiveDevices = await deviceService.getInactiveDevices(thresholdHours);

    if (inactiveDevices.length === 0) {
      console.log('No inactive devices found');
      return;
    }

    console.log(`Found ${inactiveDevices.length} inactive devices. Deactivating...`);

    const results = await Promise.allSettled(
      inactiveDevices.map(device => deactivateDevice(device))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Device deactivation completed. Success: ${successful}, Failed: ${failed}`);

    if (failed > 0) {
      console.error('Some devices failed to deactivate:');
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Device ${inactiveDevices[index]._id}: ${result.reason.message}`);
        }
      });
    }
  } catch (error) {
    console.error('Error processing inactive devices:', error.message);
  }
};

// Deactivate a single device
const deactivateDevice = async (device) => {
  try {
    await deviceService.deactivateDevice(device._id);
    console.log(`Deactivated device: ${device.name} (${device._id}) - Last active: ${device.last_active_at || 'Never'}`);
  } catch (error) {
    console.error(`Failed to deactivate device ${device._id}:`, error.message);
    throw error;
  }
};

// Get status of the background job
const getStatus = () => ({
  isRunning,
  thresholdHours,
  nextRun: intervalId ? new Date(Date.now() + 60 * 60 * 1000) : null,
});

// Manually trigger check
const triggerManualCheck = async () => {
  console.log('Manual device inactivity check triggered');
  await processInactiveDevices();
};

// Update threshold hours
const updateThresholdHours = (hours) => {
  if (hours && hours > 0) {
    thresholdHours = hours;
    console.log(`Updated inactive device threshold to ${hours} hours`);
  } else {
    throw new Error('Threshold hours must be a positive number');
  }
};

module.exports = {
  start,
  stop,
  processInactiveDevices,
  getStatus,
  triggerManualCheck,
  updateThresholdHours,
};
