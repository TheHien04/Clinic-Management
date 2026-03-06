/**
 * Socket.IO Client Service
 * Real-time WebSocket connection
 */

import { io } from 'socket.io-client';
import { STORAGE_KEYS } from '../constants';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;
let isConnected = false;

/**
 * Initialize Socket.IO connection
 * @returns {Object} Socket instance
 */
export const initSocket = () => {
  if (socket) {
    return socket;
  }

  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  if (!token || token.startsWith('fake_token_')) {
    console.log('⚠️ No valid token, skipping socket connection');
    return null;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  // Connection event handlers
  socket.on('connect', () => {
    isConnected = true;
    console.log('✅ Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    isConnected = false;
    console.log('❌ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔴 Socket connection error:', error.message);
  });

  socket.on('error', (error) => {
    console.error('🔴 Socket error:', error);
  });

  return socket;
};

/**
 * Get current socket instance
 * @returns {Object|null} Socket instance
 */
export const getSocket = () => {
  return socket;
};

/**
 * Check if socket is connected
 * @returns {boolean}
 */
export const isSocketConnected = () => {
  return isConnected && socket?.connected;
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    isConnected = false;
    console.log('🔌 Socket disconnected');
  }
};

/**
 * Subscribe to appointment updates
 */
export const subscribeToAppointments = () => {
  if (socket && isConnected) {
    socket.emit('subscribe:appointments');
    console.log('📡 Subscribed to appointments');
  }
};

/**
 * Unsubscribe from appointment updates
 */
export const unsubscribeFromAppointments = () => {
  if (socket && isConnected) {
    socket.emit('unsubscribe:appointments');
    console.log('📡 Unsubscribed from appointments');
  }
};

/**
 * Listen to appointment created event
 * @param {Function} callback - Callback function
 */
export const onAppointmentCreated = (callback) => {
  if (socket) {
    socket.on('appointment:created', callback);
  }
};

/**
 * Listen to appointment updated event
 * @param {Function} callback - Callback function
 */
export const onAppointmentUpdated = (callback) => {
  if (socket) {
    socket.on('appointment:updated', callback);
  }
};

/**
 * Listen to appointment deleted event
 * @param {Function} callback - Callback function
 */
export const onAppointmentDeleted = (callback) => {
  if (socket) {
    socket.on('appointment:deleted', callback);
  }
};

/**
 * Listen to notifications
 * @param {Function} callback - Callback function
 */
export const onNotification = (callback) => {
  if (socket) {
    socket.on('notification', callback);
  }
};

/**
 * Listen to broadcast messages
 * @param {Function} callback - Callback function
 */
export const onBroadcast = (callback) => {
  if (socket) {
    socket.on('broadcast', callback);
  }
};

/**
 * Remove event listener
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 */
export const offEvent = (event, callback) => {
  if (socket) {
    socket.off(event, callback);
  }
};

export default {
  initSocket,
  getSocket,
  isSocketConnected,
  disconnectSocket,
  subscribeToAppointments,
  unsubscribeFromAppointments,
  onAppointmentCreated,
  onAppointmentUpdated,
  onAppointmentDeleted,
  onNotification,
  onBroadcast,
  offEvent,
};
