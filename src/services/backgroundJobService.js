const deviceService = require('./deviceService');
const { DEVICE_STATUSES } = require('../utils/constants');

class BackgroundJobService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.thresholdHours = parseInt(process.env.DEVICE_INACTIVE_THRESHOLD_HOURS) || 24;
  }

  start() {
    if (this.isRunning) {
      console.log('Background job service is already running');
      return;
    }

    console.log('Starting background job service...');
    this.isRunning = true;

    // Run immediately
    this.processInactiveDevices();

    // Run every hour
    this.intervalId = setInterval(() => {
      this.processInactiveDevices();
    }, 60 * 60 * 1000); // 1 hour

    console.log(`Background job service started. Checking for inactive devices every hour.`);
  }

  stop() {
    if (!this.isRunning) {
      console.log('Background job service is not running');
      return;
    }

    console.log('Stopping background job service...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('Background job service stopped');
  }

  async processInactiveDevices() {
    try {
      console.log(`Checking for devices inactive for more than ${this.thresholdHours} hours...`);
      
      const inactiveDevices = await deviceService.getInactiveDevices(this.thresholdHours);
      
      if (inactiveDevices.length === 0) {
        console.log('No inactive devices found');
        return;
      }

      console.log(`Found ${inactiveDevices.length} inactive devices. Deactivating...`);

      const deactivationPromises = inactiveDevices.map(device => 
        this.deactivateDevice(device)
      );

      const results = await Promise.allSettled(deactivationPromises);
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

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
  }

  async deactivateDevice(device) {
    try {
      await deviceService.deactivateDevice(device._id);
      console.log(`Deactivated device: ${device.name} (${device._id}) - Last active: ${device.last_active_at || 'Never'}`);
    } catch (error) {
      console.error(`Failed to deactivate device ${device._id}:`, error.message);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      thresholdHours: this.thresholdHours,
      nextRun: this.intervalId ? new Date(Date.now() + 60 * 60 * 1000) : null,
    };
  }

  // Method to manually trigger the process (useful for testing)
  async triggerManualCheck() {
    console.log('Manual device inactivity check triggered');
    await this.processInactiveDevices();
  }

  // Method to update threshold hours
  updateThresholdHours(hours) {
    if (hours && hours > 0) {
      this.thresholdHours = hours;
      console.log(`Updated inactive device threshold to ${hours} hours`);
    } else {
      throw new Error('Threshold hours must be a positive number');
    }
  }
}

module.exports = new BackgroundJobService();