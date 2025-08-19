const mongoose = require('mongoose');
const { USER_ROLES } = require('../utils/constants');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please provide a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
  },
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.USER,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
  },
}, {
  timestamps: true,
  //This controls how documents are converted when you call .toJSON() or send them as API responses.(taki API response mei password or any sensitive thing na aaye.)
  toJSON: {
//doc → the original Mongoose document (with all fields).
//ret → the plain JavaScript object after conversion.
    transform: function(doc, ret) {
      delete ret.password;//it is used to remove sensitive fields like password before sending to client
      delete ret.__v;//Removes Mongoose’s internal version key __v.
      return ret;// Returns the “cleaned” object.
    },
  },
});

// Index for faster queries
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);