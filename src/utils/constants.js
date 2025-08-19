const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

const DEVICE_TYPES = {
  LIGHT: 'light',
  THERMOSTAT: 'thermostat',
  SECURITY_CAMERA: 'security_camera',
  SMART_METER: 'smart_meter',
  DOOR_LOCK: 'door_lock',
  SMOKE_DETECTOR: 'smoke_detector',
};

const DEVICE_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
  OFFLINE: 'offline',
};

const LOG_EVENTS = {
  UNITS_CONSUMED: 'units_consumed',
  TEMPERATURE_CHANGED: 'temperature_changed',
  MOTION_DETECTED: 'motion_detected',
  DOOR_OPENED: 'door_opened',
  DOOR_CLOSED: 'door_closed',
  LIGHT_ON: 'light_on',
  LIGHT_OFF: 'light_off',
  SMOKE_DETECTED: 'smoke_detected',
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

module.exports = {
  USER_ROLES,
  DEVICE_TYPES,
  DEVICE_STATUSES,
  LOG_EVENTS,
  HTTP_STATUS,
};