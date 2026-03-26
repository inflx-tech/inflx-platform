'use strict';

const db           = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /notifications
 * List notifications for the authenticated user (any role).
 * Returns most recent 50, sorted newest first.
 */
const listNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.sub;

  const { rows } = await db.query(
    `SELECT id, type, title, body, data_json, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );

  const unread_count = rows.filter(r => !r.is_read).length;

  res.json({
    success: true,
    data: {
      notifications: rows,
      unread_count,
    },
  });
});

/**
 * POST /notifications/read-all
 * Mark all notifications as read for the authenticated user.
 */
const markAllRead = asyncHandler(async (req, res) => {
  const userId = req.user.sub;

  await db.query(
    `UPDATE notifications SET is_read = true
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );

  res.json({ success: true, data: { marked_read: true } });
});

module.exports = { listNotifications, markAllRead };
