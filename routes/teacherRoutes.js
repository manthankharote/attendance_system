const express = require('express');
const router = express.Router();
const {
    getTeacherDashboard,
    getAttendancePage,
    getAttendanceSheet,
    submitAttendance,
    getQrScannerPage,
    submitQrAttendance,
    getTeacherReportsPage,
    getLowAttendancePage
} = require('../controllers/teacherController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('teacher'));

// Dashboard Route
router.get('/dashboard', getTeacherDashboard);

// Attendance Routes
router.get('/attendance', getAttendancePage);
router.post('/attendance/sheet', getAttendanceSheet);
router.post('/attendance/submit', submitAttendance);
router.post('/attendance/qr-scanner', getQrScannerPage);
router.post('/attendance/qr-submit', submitQrAttendance);
router.get('/low-attendance', getLowAttendancePage);

// Reports Route
router.get('/reports', getTeacherReportsPage); // Make sure this route exists

module.exports = router;