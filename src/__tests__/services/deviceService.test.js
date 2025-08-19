jest.mock('../../models/Device');

const deviceService = require('../../services/deviceService');
const Device = require('../../models/Device');

describe('DeviceService', () => {
  const userId = '60d5ecb74e25db001f234567';
  const deviceId = '60d5ecb74e25db001f234568';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDevice', () => {
    it('should create a device successfully', async () => {
      const deviceData = {
        name: 'Test Device',
        type: 'sensor',
        status: 'active'
      };

      const mockDevice = {
        _id: deviceId,
        name: 'Test Device',
        type: 'sensor',
        status: 'active',
        owner_id: userId,
        save: jest.fn().mockResolvedValue()
      };

      Device.mockImplementation(() => mockDevice);

      const result = await deviceService.createDevice(deviceData, userId);

      expect(mockDevice.save).toHaveBeenCalled();
      expect(result).toEqual(mockDevice);
    });
  });

  describe('getDeviceById', () => {
    it('should return device if found and owned by user', async () => {
      const mockDevice = {
        _id: deviceId,
        name: 'Test Device',
        owner_id: userId
      };

      Device.findOne.mockResolvedValue(mockDevice);

      const result = await deviceService.getDeviceById(deviceId, userId);

      expect(Device.findOne).toHaveBeenCalledWith({ _id: deviceId, owner_id: userId });
      expect(result).toEqual(mockDevice);
    });

    it('should throw error if device not found', async () => {
      Device.findOne.mockResolvedValue(null);

      await expect(deviceService.getDeviceById(deviceId, userId))
        .rejects.toThrow('Device not found');
    });
  });

  describe('getInactiveDevices', () => {
    it('should return devices inactive for more than threshold hours', async () => {
      const thresholdHours = 24;
      const mockDevices = [
        { _id: '1', name: 'Device 1', last_active_at: new Date(Date.now() - 25 * 60 * 60 * 1000) },
        { _id: '2', name: 'Device 2', last_active_at: null, createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }
      ];

      Device.find.mockResolvedValue(mockDevices);

      const result = await deviceService.getInactiveDevices(thresholdHours);

      expect(result).toEqual(mockDevices);
    });
  });

  describe('deactivateDevice', () => {
    it('should update device status to offline', async () => {
      const mockDevice = {
        _id: deviceId,
        status: 'offline'
      };

      Device.findByIdAndUpdate.mockResolvedValue(mockDevice);

      const result = await deviceService.deactivateDevice(deviceId);

      expect(result).toEqual(mockDevice);
    });
  });
});