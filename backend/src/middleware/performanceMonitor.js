/**
 * Performance Monitoring Middleware
 * Tracks request duration, memory usage, and slow queries
 */

const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Store original end function
  const originalEnd = res.end;

  // Override end function
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    
    // Calculate metrics
    const metrics = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      memoryDelta: {
        heapUsed: `${((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
        rss: `${((endMemory.rss - startMemory.rss) / 1024 / 1024).toFixed(2)} MB`
      }
    };

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn('⚠️  Slow Request Detected:', metrics);
    }

    // Log to performance log file (in production, use Winston)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with Winston or external monitoring service
      logPerformanceMetric(metrics);
    }

    // Restore original end function and call it
    originalEnd.apply(res, args);
  };

  next();
};

// Performance metrics storage (in-memory for demo, use Redis in production)
const performanceMetrics = {
  requests: [],
  slowQueries: [],
  errorRates: {}
};

const logPerformanceMetric = (metric) => {
  performanceMetrics.requests.push(metric);
  
  // Keep only last 1000 requests
  if (performanceMetrics.requests.length > 1000) {
    performanceMetrics.requests.shift();
  }
};

// Get performance summary
const getPerformanceSummary = () => {
  const totalRequests = performanceMetrics.requests.length;
  const avgDuration = performanceMetrics.requests.reduce((sum, req) => {
    return sum + parseInt(req.duration);
  }, 0) / totalRequests;

  const statusCodes = performanceMetrics.requests.reduce((acc, req) => {
    acc[req.statusCode] = (acc[req.statusCode] || 0) + 1;
    return acc;
  }, {});

  return {
    totalRequests,
    avgDuration: `${avgDuration.toFixed(2)}ms`,
    statusCodes,
    slowRequests: performanceMetrics.requests.filter(r => parseInt(r.duration) > 1000).length
  };
};

// Database query performance tracker
const trackQueryPerformance = async (queryName, queryFn) => {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    // Log slow queries (> 500ms)
    if (duration > 500) {
      console.warn(`⚠️  Slow Query: ${queryName} took ${duration}ms`);
      performanceMetrics.slowQueries.push({
        queryName,
        duration,
        timestamp: new Date().toISOString()
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Query Error: ${queryName} failed after ${duration}ms`, error);
    throw error;
  }
};

export { performanceMonitor, getPerformanceSummary, trackQueryPerformance };
