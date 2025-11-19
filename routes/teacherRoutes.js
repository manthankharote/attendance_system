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
    getLowAttendancePage,
    getEditAttendancePage,
    updateAttendance,
    generateSessionQr,
    submitSessionAttendance,
    exportTeacherReport
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
router.post('/attendance/generate-qr', generateSessionQr);

// Reports Routes
router.get('/reports', getTeacherReportsPage);
router.get('/reports/export', exportTeacherReport);
router.get('/low-attendance', getLowAttendancePage);

// Edit Attendance Routes
router.get('/attendance/edit/:attendanceId/:recordId', getEditAttendancePage);
router.post('/attendance/edit/:attendanceId/:recordId', updateAttendance);
router.post('/attendance/submit-session', submitSessionAttendance);



module.exports = router;