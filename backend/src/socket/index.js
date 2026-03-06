/**
 * WebSocket Socket.IO Handler
 * Real-time features for appointments
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';

let io = null;

/**
 * Initialize Socket.IO
 * @param {Object} server - HTTP server instance
 */
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userEmail} (${socket.id})`);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // Join role-specific room
    socket.join(`role:${socket.userRole}`);

    /**
     * Subscribe to appointment updates
     */
    socket.on('subscribe:appointments', () => {
      socket.join('appointments');
      console.log(`User ${socket.userEmail} subscribed to appointments`);
    });

    /**
     * Unsubscribe from appointment updates
     */
    socket.on('unsubscribe:appointments', () => {
      socket.leave('appointments');
      console.log(`User ${socket.userEmail} unsubscribed from appointments`);
    });

    /**
     * Send typing indicator
     */
    socket.on('typing', (data) => {
      socket.broadcast.emit('user:typing', {
        userId: socket.userId,
        email: socket.userEmail,
        ...data
      });
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userEmail} (${socket.id})`);
    });
  });

  console.log('🔌 Socket.IO initialized');
  return io;
};

/**
 * Emit appointment created event
 * @param {Object} appointment - Appointment data
 */
export const emitAppointmentCreated = (appointment) => {
  if (io) {
    io.to('appointments').emit('appointment:created', appointment);
    
    // Notify specific patient
    if (appointment.PatientID) {
      io.to(`user:${appointment.PatientID}`).emit('appointment:created', appointment);
    }
    
    // Notify specific doctor
    if (appointment.DoctorID) {
      io.to(`user:${appointment.DoctorID}`).emit('appointment:created', appointment);
    }
  }
};

/**
 * Emit appointment updated event
 * @param {Object} appointment - Updated appointment data
 */
export const emitAppointmentUpdated = (appointment) => {
  if (io) {
    io.to('appointments').emit('appointment:updated', appointment);
    
    // Notify specific users
    if (appointment.PatientID) {
      io.to(`user:${appointment.PatientID}`).emit('appointment:updated', appointment);
    }
    
    if (appointment.DoctorID) {
      io.to(`user:${appointment.DoctorID}`).emit('appointment:updated', appointment);
    }
  }
};

/**
 * Emit appointment deleted event
 * @param {number} appointmentId - Deleted appointment ID
 */
export const emitAppointmentDeleted = (appointmentId) => {
  if (io) {
    io.to('appointments').emit('appointment:deleted', { appointmentId });
  }
};

/**
 * Emit notification to specific user
 * @param {number} userId - User ID to notify
 * @param {Object} notification - Notification data
 */
export const emitNotification = (userId, notification) => {
  if (io) {
    io.to(`user:${userId}`).emit('notification', notification);
  }
};

/**
 * Emit broadcast message to all users
 * @param {Object} message - Broadcast message
 */
export const emitBroadcast = (message) => {
  if (io) {
    io.emit('broadcast', message);
  }
};

/**
 * Get connected users count
 * @returns {number} Number of connected users
 */
export const getConnectedUsersCount = () => {
  return io ? io.sockets.sockets.size : 0;
};

export default {
  initSocket,
  emitAppointmentCreated,
  emitAppointmentUpdated,
  emitAppointmentDeleted,
  emitNotification,
  emitBroadcast,
  getConnectedUsersCount
};
