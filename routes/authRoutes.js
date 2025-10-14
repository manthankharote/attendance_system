const express = require('express');
const router = express.Router();
const {
    getRegisterPage,
    registerUser,
    getLoginSelectionPage,
    getAdminLoginPage,
    getTeacherLoginPage,
    getStudentLoginPage,
    loginHandler,
    logoutUser,
    getForgotPasswordPage,
    forgotPassword,
    getResetPasswordPage,
    resetPassword
} = require('../controllers/authController');

// Registration
router.get('/register', getRegisterPage);
router.post('/register', registerUser);

// NEW Login Flow
router.get('/login', getLoginSelectionPage);

router.get('/admin-login', getAdminLoginPage);
router.post('/admin-login', loginHandler('admin'));

router.get('/teacher-login', getTeacherLoginPage);
router.post('/teacher-login', loginHandler('teacher'));

router.get('/student-login', getStudentLoginPage);
router.post('/student-login', loginHandler('student'));

// Logout
router.get('/logout', logoutUser);

// Password Reset
router.get('/forgot-password', getForgotPasswordPage);
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', getResetPasswordPage);
router.post('/reset-password/:token', resetPassword);

module.exports = router;