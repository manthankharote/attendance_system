const express = require('express');
const router = express.Router();

const {
    getRegisterPage,
    registerUser,
    getLoginPage,
    loginUser,
    logoutUser,
    getForgotPasswordPage,
    forgotPassword,
    getResetPasswordPage,
    resetPassword
} = require('../controllers/authController');

router.get('/register', getRegisterPage);
router.post('/register', registerUser);
router.get('/login', getLoginPage);
router.post('/login', loginUser);
router.get('/logout', logoutUser);

// Forgot Password Routes
router.get('/forgot-password', getForgotPasswordPage);
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', getResetPasswordPage);
router.post('/reset-password/:token', resetPassword);

module.exports = router;