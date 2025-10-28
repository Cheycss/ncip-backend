import express from 'express';
import pool from '../database.js';
import authMiddleware from '../authMiddleware.js';

const router = express.Router();

// GET /api/notifications - Get all notifications for logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [notifications] = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [result] = await pool.query(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    res.json({ success: true, count: result[0].count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const notificationId = req.params.id;

    const [result] = await pool.query(
      `UPDATE notifications SET is_read = TRUE 
       WHERE notification_id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});

// PUT /api/notifications/mark-all-read - Mark all notifications as read
router.put('/mark-all-read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;

    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = ?`,
      [userId]
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read' });
  }
});

// POST /api/notifications - Create a notification (internal use)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { user_id, title, message, type, related_application_id } = req.body;

    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, related_application_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, title, message, type || 'info', related_application_id || null]
    );

    res.status(201).json({ 
      success: true, 
      notification_id: result.insertId,
      message: 'Notification created successfully' 
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ success: false, message: 'Failed to create notification' });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const notificationId = req.params.id;

    const [result] = await pool.query(
      `DELETE FROM notifications WHERE notification_id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
});

export default router;
