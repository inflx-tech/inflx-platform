'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notification.controller');

const router = Router();

// Any authenticated user can list their own notifications
router.get('/',          authenticate, ctrl.listNotifications);
router.post('/read-all', authenticate, ctrl.markAllRead);

module.exports = router;
