/**
 * Express Server
 * Main entry point for Clinic Management API
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
// import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import configurations
import { getPool, closePool, executeQuery } from './config/database.js';
import { connectMongo, closeMongoClient, getMongoStatus } from './config/nosql.js';
import { getAllowedOrigins, validateProductionEnv } from './config/env.js';
import { getInnovationPersistenceStatus } from './controllers/innovationController.js';

// Import routes
import authRoutes from './routes/auth.js';
import appointmentRoutes from './routes/appointments.js';
import patientRoutes from './routes/patients.js';
import doctorRoutes from './routes/doctors.js';
import uploadRoutes from './routes/upload.js';
import medicalRecordRoutes from './routes/medicalRecords.js';
import staffRoutes from './routes/staff.js';
import clinicRoutes from './routes/clinics.js';
import specialtyRoutes from './routes/specialties.js';
import salaryRoutes from './routes/salaries.js';
import reportRoutes from './routes/reports.js';
import innovationRoutes from './routes/innovation.js';
import notificationRoutes from './routes/notifications.js';

// Import middleware
import { notFound, errorHandler } from './middleware/errorHandler.js';
import securityHeaders from './middleware/securityHeaders.js';
import inputSanitization from './middleware/inputSanitization.js';
import { performanceMonitor } from './middleware/performanceMonitor.js';
import { generalLimiter, authLimiter, uploadLimiter, appointmentLimiter } from './middleware/rateLimiter.js';
import { cache } from './middleware/cacheMiddleware.js';
import { stateChangeOriginGuard } from './middleware/requestGuard.js';
import { csrfProtection } from './middleware/csrf.js';
import { startSecurityAuditRetentionJob, stopSecurityAuditRetentionJob } from './utils/securityAudit.js';

// Import socket
import { initSocket } from './socket/index.js';

// Load environment variables
dotenv.config();
validateProductionEnv();

// Optional: Connect Redis if available (for caching/rate limiting)
import { connectRedis } from './config/redis.js';
if (process.env.REDIS_URL) {
  connectRedis();
}

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const START_PORT = parseInt(process.env.PORT || '5000', 10);
const PORT_FALLBACK_ATTEMPTS = parseInt(process.env.PORT_FALLBACK_ATTEMPTS || '10', 10);

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initSocket(httpServer);

// Middleware
app.disable('x-powered-by');
app.use(securityHeaders); // OWASP Helmet config
app.use(cors({
  origin: getAllowedOrigins('CORS_ORIGIN'),
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(inputSanitization); // Sanitize all input
app.use(performanceMonitor); // Track request performance
app.use(stateChangeOriginGuard);
app.use(csrfProtection);

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting (Redis-backed if available)
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/upload', uploadLimiter);
app.use('/api/appointments', appointmentLimiter);

// API Routes with caching for GET endpoints (example: cache doctor/patient list)
app.use('/api/doctors', cache(300));
app.use('/api/patients', cache(300));

app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/specialties', specialtyRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/innovation', innovationRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let sqlServer = 'disconnected';

  try {
    await executeQuery('SELECT 1 AS healthCheck;', {});
    sqlServer = 'connected';
  } catch {
    sqlServer = 'degraded';
  }

  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    databases: {
      sqlServer,
      mongo: getMongoStatus(),
    },
    innovationPersistence: getInnovationPersistenceStatus(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Clinic Management API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      appointments: '/api/appointments',
      patients: '/api/patients',
      doctors: '/api/doctors',
      upload: '/api/upload',
      notifications: '/api/notifications'
    }
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Database connection and server start
const listenOnPort = (port) => new Promise((resolve, reject) => {
  const onError = (error) => {
    httpServer.off('listening', onListening);
    reject(error);
  };

  const onListening = () => {
    httpServer.off('error', onError);
    resolve(port);
  };

  httpServer.once('error', onError);
  httpServer.once('listening', onListening);
  httpServer.listen(port);
});

const listenWithFallback = async () => {
  let port = START_PORT;

  for (let attempt = 0; attempt < PORT_FALLBACK_ATTEMPTS; attempt += 1) {
    try {
      return await listenOnPort(port);
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || attempt === PORT_FALLBACK_ATTEMPTS - 1) {
        throw error;
      }

      console.warn(`Port ${port} is in use, retrying on port ${port + 1}...`);
      port += 1;
    }
  }

  throw new Error('Could not find an available port to start backend server.');
};

const startServer = async () => {
  try {
    // Connect to database
    await getPool();
    console.log('✅ Database connected successfully');

    // Optional NoSQL connection for advanced DB workflows.
    await connectMongo();

    // Start background cleanup for auth security audit retention.
    startSecurityAuditRetentionJob();

    // Start server with automatic fallback when a port is occupied.
    const activePort = await listenWithFallback();

    console.log(`
╔════════════════════════════════════════════════╗
║   🏥 Clinic Management API Server             ║
║                                                ║
║   🚀 Server running on port ${activePort}              ║
║   🌐 Environment: ${process.env.NODE_ENV || 'development'}               ║
║   📡 API: http://localhost:${activePort}              ║
║   🔌 WebSocket: Enabled                        ║
║                                                ║
║   Documentation: http://localhost:${activePort}/     ║
╚════════════════════════════════════════════════╝
      `);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  // Close HTTP server
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Close database connection
  stopSecurityAuditRetentionJob();
  await closePool();
  await closeMongoClient();
  
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// Start the server
startServer();

export default app;
