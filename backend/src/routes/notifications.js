/**
 * Notification Center routes
 */

import express from 'express';
import { authMiddleware, authorize } from '../middleware/auth.js';
import {
  getNotificationInbox,
  postNotification,
  patchNotificationRead,
  getNotificationDeliveryQueue,
  postNotificationDeliveryProcess,
  getNotificationDeadLetter,
} from '../controllers/notificationController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/inbox', getNotificationInbox);
router.patch('/:id/read', patchNotificationRead);

router.post('/', authorize('admin', 'manager', 'supervisor'), postNotification);
router.get('/delivery/queue', authorize('admin', 'manager', 'supervisor'), getNotificationDeliveryQueue);
router.post('/delivery/process', authorize('admin', 'manager', 'supervisor'), postNotificationDeliveryProcess);
router.get('/delivery/dead-letter', authorize('admin', 'manager', 'supervisor'), getNotificationDeadLetter);

export default router;
