/**
 * WebSocket Socket.IO Handler
 * Real-time features for appointments
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { getAllowedOrigins } from '../config/env.js';

let io = null;

const normalizeSeverity = (value) => {
  const severity = String(value || '').toLowerCase();
  if (severity === 'critical' || severity === 'warning' || severity === 'info') {
    return severity;
  }
  return 'info';
};

const formatDateValue = (value) => {
  if (!value) return 'unknown-date';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10) || 'unknown-date';
};

const formatTimeValue = (value) => {
  if (!value) return 'unknown-time';
  const raw = String(value);
  const match = raw.match(/\b(\d{2}:\d{2})/);
  return match ? match[1] : raw.slice(0, 5) || 'unknown-time';
};

const buildOpsAlertPayload = ({ action, appointment }) => {
  const alertTitleByAction = {
    created: 'New appointment booked',
    updated: 'Appointment updated',
    deleted: 'Appointment deleted',
  };

  const status = String(appointment?.Status || '').toLowerCase();
  const severity =
    action === 'deleted'
      ? 'warning'
      : status === 'cancelled'
        ? 'warning'
        : status === 'booked' || status === 'pending'
          ? 'info'
          : 'info';

  const at = new Date().toISOString();
  const date = formatDateValue(appointment?.AppointmentDate);
  const time = formatTimeValue(appointment?.AppointmentTime);
  const patientName = appointment?.PatientName || `Patient #${appointment?.PatientID || '-'}`;
  const doctorName = appointment?.DoctorName || `Doctor #${appointment?.DoctorID || '-'}`;
  const statusText = status === 'unknown' ? 'status unavailable' : `status ${status}`;

  return {
    total: 1,
    critical: 0,
    page: 'appointments',
    at,
    alerts: [
      {
        id: `appointment-${action}-${appointment?.AppointmentID || Date.now()}`,
        severity: normalizeSeverity(severity),
        acknowledged: false,
        title: alertTitleByAction[action] || 'Appointment signal',
        detail: `#${appointment?.AppointmentID || '-'} ${patientName} with ${doctorName} at ${time} on ${date} (${statusText}).`,
        at,
      },
    ],
  };
};

/**
 * Initialize Socket.IO
 * @param {Object} server - HTTP server instance
 */
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: getAllowedOrigins('SOCKET_CORS_ORIGIN', process.env.CORS_ORIGIN || 'http://localhost:5173'),
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
    io.emit('ops-alerts:update', buildOpsAlertPayload({ action: 'created', appointment }));
    
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
    io.emit('ops-alerts:update', buildOpsAlertPayload({ action: 'updated', appointment }));
    
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
 * @param {Object} appointment - Deleted appointment snapshot
 */
export const emitAppointmentDeleted = (appointment) => {
  if (io) {
    io.to('appointments').emit('appointment:deleted', {
      appointmentId: appointment?.AppointmentID,
      appointment,
    });
    io.emit('ops-alerts:update', buildOpsAlertPayload({
      action: 'deleted',
      appointment: {
        ...appointment,
        Status: appointment?.Status || 'deleted',
      },
    }));
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
 * Emit innovation emergency escalation event
 * @param {Object} event - Escalation context
 */
export const emitInnovationEmergency = (event) => {
  if (!io) return;

  const at = new Date().toISOString();
  const payload = {
    type: 'innovation-emergency-triage',
    packageId: event?.packageId,
    riskScore: Number(event?.riskScore || 0),
    requestedBy: event?.requestedBy || 'unknown',
    recommendation: event?.recommendation || 'Immediate clinical review required',
    at,
  };

  io.emit('innovation:emergency', payload);
  io.emit('ops-alerts:update', {
    total: 1,
    critical: 1,
    page: 'innovation-lab',
    at,
    alerts: [
      {
        id: `innovation-emergency-${payload.packageId || Date.now()}`,
        severity: 'critical',
        acknowledged: false,
        title: 'Emergency AI Triage Escalation',
        detail: `Package ${payload.packageId || 'unknown'} scored ${payload.riskScore}. ${payload.recommendation}`,
        at,
      },
    ],
  });
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
  emitInnovationEmergency,
  getConnectedUsersCount
};
