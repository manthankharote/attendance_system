const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// --- Helper Function ---
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

// --- Registration ---
exports.getRegisterPage = (req, res) => {
    res.render('register', { title: 'Register' });
};

exports.registerUser = async (req, res) => {
    const { name, schoolId, email, password, role } = req.body;
    try {
        const userExists = await User.findOne({ $or: [{ email }, { schoolId }] });
        if (userExists) {
            return res.status(400).send('User with this email or School ID already exists');
        }
        await User.create({ name, schoolId, email, password, role });
        res.redirect('/auth/login'); // Redirect to the new selection page
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// --- NEW SEPARATE LOGIN LOGIC ---
exports.getLoginSelectionPage = (req, res) => {
    res.render('login_selection', { title: 'Select Login' });
};

exports.getAdminLoginPage = (req, res) => res.render('admin_login', { title: 'Admin Login' });
exports.getTeacherLoginPage = (req, res) => res.render('teacher_login', { title: 'Teacher Login' });
exports.getStudentLoginPage = (req, res) => res.render('student_login', { title: 'Student Login' });

exports.loginHandler = (role) => async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });

        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).send('Invalid email or password');
        }

        if (user.role !== role) {
            return res.status(403).send(`Access Denied. Please use the correct login page for your role.`);
        }

        const token = generateToken(user._id, user.role);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000
        });

        switch (user.role) {
            case 'admin': return res.redirect('/admin/dashboard');
            case 'teacher': return res.redirect('/teacher/dashboard');
            case 'student': return res.redirect('/student/dashboard');
            default: return res.redirect('/');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// --- Logout ---
exports.logoutUser = (req, res) => {
    res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
    res.redirect('/auth/login');
};

// --- Password Reset ---
exports.getForgotPasswordPage = (req, res) => {
    res.render('forgot_password', { title: 'Forgot Password' });
};

exports.forgotPassword = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.send('If an account with that email exists, a password reset link has been sent.');
        }

        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
        const message = `You requested a password reset. Please go to this link to reset your password: \n\n ${resetUrl}`;
        
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        
        await transporter.sendMail({
            from: '"Attendance System" <noreply@attendance.com>',
            to: user.email,
            subject: 'Password Reset Token',
            text: message
        });

        res.send('If an account with that email exists, a password reset link has been sent.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.getResetPasswordPage = (req, res) => {
    res.render('reset_password', { title: 'Reset Password', token: req.params.token });
};

exports.resetPassword = async (req, res) => {
    try {
        const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({
            passwordResetToken: resetPasswordToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).send('Invalid or expired token');
        }

        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};