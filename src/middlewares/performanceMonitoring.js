// Performance monitoring middleware
const performanceLogger = (req, res, next) => {
  const startTime = Date.now();
  const startUsage = process.cpuUsage();

  // Capture original end function
  const originalEnd = res.end;

  res.end = function(...args) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const endUsage = process.cpuUsage(startUsage);
    
    // Log slow requests (> 1000ms)
    if (responseTime > 1000) {
      console.warn(`SLOW REQUEST: ${req.method} ${req.originalUrl} - ${responseTime}ms`, {
        method: req.method,
        url: req.originalUrl,
        responseTime,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user ? req.user._id : null,
        cpuUsage: {
          user: endUsage.user,
          system: endUsage.system,
        },
      });
    }

    // Log all requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.originalUrl} - ${responseTime}ms - ${res.statusCode}`);
    }

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
};

// Simple metrics collection
class MetricsCollector {
  constructor() {
    this.requestCount = 0;
    this.responseTimes = [];
    this.errorCount = 0;
    this.endpoints = new Map();
    this.startTime = Date.now();
  }

  recordRequest(method, url, responseTime, statusCode) {
    this.requestCount++;
    this.responseTimes.push(responseTime);
    
    if (statusCode >= 400) {
      this.errorCount++;
    }

    const endpoint = `${method} ${url}`;
    const existing = this.endpoints.get(endpoint) || { count: 0, totalTime: 0 };
    existing.count++;
    existing.totalTime += responseTime;
    this.endpoints.set(endpoint, existing);

    // Keep only last 1000 response times to prevent memory leak
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const avgResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;

    const slowestEndpoints = Array.from(this.endpoints.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.totalTime / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    return {
      uptime,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      averageResponseTime: Math.round(avgResponseTime),
      slowestEndpoints,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  }

  reset() {
    this.requestCount = 0;
    this.responseTimes = [];
    this.errorCount = 0;
    this.endpoints.clear();
    this.startTime = Date.now();
  }
}

const metrics = new MetricsCollector();

const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    metrics.recordRequest(req.method, req.route?.path || req.url, responseTime, res.statusCode);
  });

  next();
};

module.exports = {
  performanceLogger,
  metricsMiddleware,
  metrics,
};