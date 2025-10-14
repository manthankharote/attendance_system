const express = require('express');
const router = express.Router();
const {
    getAdminDashboard,
    getUsers, getAddUserPage, addUser, getEditUserPage, updateUser, deleteUser,
    getClasses, getAddClassPage, addClass, getEditClassPage, updateClass, deleteClass,
    getReportsPage, exportReport,
    getSettingsPage, updateSettings,
    // This is the critical part that fixes the error
    getSessionsPage, addSession, deleteSession
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('admin'));

// All Admin Routes
router.get('/dashboard', getAdminDashboard);
router.get('/users', getUsers);
router.post('/users/add', addUser);
router.get('/users/edit/:id', getEditUserPage);
router.post('/users/edit/:id', updateUser);
router.post('/users/delete/:id', deleteUser);
router.get('/classes', getClasses);
router.post('/classes/add', addClass);
router.get('/classes/edit/:id', getEditClassPage);
router.post('/classes/edit/:id', updateClass);
router.post('/classes/delete/:id', deleteClass);
router.get('/sessions', getSessionsPage);
router.post('/sessions/add', addSession);
router.post('/sessions/delete/:id', deleteSession);
router.get('/reports', getReportsPage);
router.get('/reports/export', exportReport);
router.get('/settings', getSettingsPage);
router.post('/settings', updateSettings);
router.get('/users/add', getAddUserPage); // <-- This is the missing line

module.exports = router;