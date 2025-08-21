const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    
  },
  isRevoked: {
    type: Boolean,
    default: false,
  },
  revokedAt: {
    type: Date,
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
refreshTokenSchema.index({ token: 1} ,{unique: true});
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, {expires: 0});// MongoDB will automatically delete expired documents

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);