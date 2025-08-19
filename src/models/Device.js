const mongoose = require('mongoose');
const { DEVICE_TYPES, DEVICE_STATUSES } = require('../utils/constants');

const deviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Device name is required'],
    trim: true,
    maxlength: [100, 'Device name cannot exceed 100 characters'],
  },
  type: {
    type: String,
    required: [true, 'Device type is required'],
    enum: Object.values(DEVICE_TYPES),
  },
  status: {
    type: String,
    enum: Object.values(DEVICE_STATUSES),
    default: DEVICE_STATUSES.ACTIVE,
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required'],
  },
  last_active_at: {
    type: Date,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
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
deviceSchema.index({ owner_id: 1 });
deviceSchema.index({ type: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ last_active_at: 1 });
deviceSchema.index({ owner_id: 1, type: 1 });
deviceSchema.index({ owner_id: 1, status: 1 });

module.exports = mongoose.model('Device', deviceSchema);