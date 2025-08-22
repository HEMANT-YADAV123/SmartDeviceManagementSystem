const WebSocket = require("ws");
const url = require("url");
const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> Set of WebSocket connections
    this.connections = new Map(); // WebSocket -> user info
  }

  initialize(server) {
  this.wss = new WebSocket.Server({
    server,
    path: '/ws',
    verifyClient: (info) => {  // Remove async here
      try {
        const query = url.parse(info.req.url, true).query;
        const token = query.token;

        if (!token) {
          console.log('WebSocket connection rejected: No token provided');
          return false;
        }

        // Only verify JWT token (synchronous operation)
        const decoded = verifyToken(token);
        
        if (!decoded || !decoded.id) {
          console.log('WebSocket connection rejected: Invalid token');
          return false;
        }

        // Store decoded token data for use in handleConnection
        info.req.tokenData = decoded;
        console.log('JWT verified for user:', decoded.id);
        return true;
        
      } catch (error) {
        console.log('WebSocket connection rejected:', error.message);
        return false;
      }
    },
  });

  // Rest remains the same
  this.wss.on('connection', (ws, req) => {
    this.handleConnection(ws, req);
  });

  this.wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  console.log('WebSocket server initialized');
}

  async handleConnection(ws, req) {
  const tokenData = req.tokenData;
  
  if (!tokenData) {
    console.log('WebSocket connection closed: No token data found');
    ws.close(1008, 'Authentication required');
    return;
  }

  try {
    // Do database lookup here (async operation)
    const user = await User.findById(tokenData.id);
    
    if (!user || !user.isActive) {
      console.log('WebSocket connection closed: Invalid user or inactive');
      ws.close(1008, 'User not found or inactive');
      return;
    }

    const userId = user._id.toString();

    // Add to client tracking
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(ws);
    
    this.connections.set(ws, {
      userId,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      connectedAt: new Date(),
      ipAddress: req.connection?.remoteAddress || req.socket?.remoteAddress,
    });

    console.log(`WebSocket connected: User ${user.name} (${userId})`);
    console.log(`Total connections: ${this.wss.clients.size}`);

    // Send welcome message
    this.sendToClient(ws, {
      type: 'connected',
      message: 'Successfully connected to device management system',
      timestamp: new Date(),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });

    // Handle messages from client
    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });

    // Handle connection close
    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    // Handle connection errors
    ws.on('error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleDisconnection(ws);
    });

    // Send ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(pingInterval);
    });

  } catch (error) {
    console.error('Error during WebSocket connection setup:', error);
    ws.close(1008, 'Connection setup failed');
  }
}

  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      const connection = this.connections.get(ws);

      console.log(`Message from ${connection.user.name}:`, message);

      // Handle different message types
      switch (message.type) {
        case "ping":
          this.sendToClient(ws, {
            type: "pong",
            timestamp: new Date(),
          });
          break;

        case "subscribe_device":
          // Future: Subscribe to specific device updates
          this.sendToClient(ws, {
            type: "subscribed",
            deviceId: message.deviceId,
            timestamp: new Date(),
          });
          break;

        default:
          this.sendToClient(ws, {
            type: "error",
            message: "Unknown message type",
            timestamp: new Date(),
          });
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      this.sendToClient(ws, {
        type: "error",
        message: "Invalid message format",
        timestamp: new Date(),
      });
    }
  }

  handleDisconnection(ws) {
    const connection = this.connections.get(ws);
    if (connection) {
      const { userId, user } = connection;

      // Remove from client tracking
      if (this.clients.has(userId)) {
        this.clients.get(userId).delete(ws);
        if (this.clients.get(userId).size === 0) {
          this.clients.delete(userId);
        }
      }

      this.connections.delete(ws);

      console.log(`WebSocket disconnected: User ${user.name} (${userId})`);
      console.log(`Total connections: ${this.wss.clients.size}`);
    }
  }

  // Send message to specific client
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Broadcast to all clients of a specific user
  broadcastToUser(userId, message) {
  console.log(`🔍 Broadcasting to userId: "${userId}" (type: ${typeof userId})`);
  console.log(`🔍 Available userIds:`, Array.from(this.clients.keys()));
  
  const userClients = this.clients.get(userId);
  console.log(`🔔 Attempting WebSocket broadcast to user ${userId}`);
  console.log(`👥 User has ${userClients ? userClients.size : 0} active connections`);
  
  if (userClients) {
    const messageStr = JSON.stringify(message);
    userClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
        console.log(`📤 Message sent to user ${userId}:`, message.type);
      }
    });
  } else {
    console.log(`⚠️ No WebSocket connections found for user ${userId}`);
  }
}

  // Broadcast to all connected clients
  broadcastToAll(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);
    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const connection = this.connections.get(ws);
        if (!excludeUserId || connection.userId !== excludeUserId) {
          ws.send(messageStr);
        }
      }
    });
  }

  // Send device status update to user
  notifyDeviceUpdate(userId, deviceData) {
    this.broadcastToUser(userId, {
      type: "device_update",
      device: deviceData,
      timestamp: new Date(),
    });
  }

  // Send device heartbeat to user
  notifyDeviceHeartbeat(userId, deviceId, status, lastActiveAt) {
    this.broadcastToUser(userId, {
      type: "device_heartbeat",
      deviceId,
      status,
      lastActiveAt,
      timestamp: new Date(),
    });
  }

  // Send analytics update to user
  notifyAnalyticsUpdate(userId, analyticsData) {
    this.broadcastToUser(userId, {
      type: "analytics_update",
      data: analyticsData,
      timestamp: new Date(),
    });
  }

  // Get connection stats
  getStats() {
    return {
      totalConnections: this.wss ? this.wss.clients.size : 0,
      uniqueUsers: this.clients.size,
      userConnections: Array.from(this.clients.entries()).map(
        ([userId, connections]) => ({
          userId,
          connectionCount: connections.size,
        })
      ),
    };
  }

  // Close all connections (for graceful shutdown)
  closeAll() {
    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.close(1000, "Server shutting down");
      });
      this.wss.close();
      console.log("All WebSocket connections closed");
    }
  }
}

module.exports = new WebSocketService();
