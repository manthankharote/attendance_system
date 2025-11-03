const express = require('express');
const router = express.Router();

// Corrected import list - no duplicates
const {
    getStudentDashboard,
    getQrCode,
    getProfilePage,
    updateProfile,
    updatePassword,
    getScanPage
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('student'));

// --- Main Routes ---
router.get('/dashboard', getStudentDashboard);
router.get('/qrcode', getQrCode);
router.get('/scan',getScanPage);

// --- Profile Management Routes ---
router.get('/profile', getProfilePage);
router.post('/profile/update', updateProfile);
router.post('/profile/password', updatePassword);

module.exports = router;