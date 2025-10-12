const express = require('express');
const router = express.Router();
const {
    getAdminDashboard,
    getUsers,
    getAddUserPage,
    addUser,
    getEditUserPage,
    updateUser,
    deleteUser,
    getClasses,
    getAddClassPage,
    addClass,
    getEditClassPage,
    updateClass,
    deleteClass,
    getReportsPage,
    exportReport,
    getSettingsPage,
    updateSettings,
    // 👇 Make sure these new functions are included in the import list
    getSessionsPage,
    addSession,
    deleteSession
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('admin'));

// Dashboard Route
router.get('/dashboard', getAdminDashboard);

// User Management Routes
router.get('/users', getUsers);
router.get('/users/add', getAddUserPage);
router.post('/users/add', addUser);
router.get('/users/edit/:id', getEditUserPage);
router.post('/users/edit/:id', updateUser);
router.post('/users/delete/:id', deleteUser);

// Class Management Routes
router.get('/classes', getClasses);
router.get('/classes/add', getAddClassPage);
router.post('/classes/add', addClass);
router.get('/classes/edit/:id', getEditClassPage);
router.post('/classes/edit/:id', updateClass);
router.post('/classes/delete/:id', deleteClass);

// Session Management Routes
router.get('/sessions', getSessionsPage);
router.post('/sessions/add', addSession);
router.post('/sessions/delete/:id', deleteSession);

// Reports Routes
router.get('/reports', getReportsPage);
router.get('/reports/export', exportReport);

// Settings Routes
router.get('/settings', getSettingsPage);
router.post('/settings', updateSettings);

module.exports = router;