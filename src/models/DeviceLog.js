const mongoose = require('mongoose');
const { LOG_EVENTS } = require('../utils/constants');

const deviceLogSchema = new mongoose.Schema({
  device_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: [true, 'Device ID is required'],
  },
  event: {
    type: String,
    required: [true, 'Event type is required'],
    enum: Object.values(LOG_EVENTS),
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: false,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Indexes for faster queries
deviceLogSchema.index({ device_id: 1 });
deviceLogSchema.index({ device_id: 1, timestamp: -1 });
deviceLogSchema.index({ event: 1 });
deviceLogSchema.index({ timestamp: -1 });

// TTL index to automatically delete old logs after 90 days
deviceLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('DeviceLog', deviceLogSchema);