// At the top, add these imports
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Function to generate a JWT
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '1d', // Token expires in 1 day
    });
};

// @desc    Show the register page
// @route   GET /auth/register
exports.getRegisterPage = (req, res) => {
    res.render('register', { title: 'Register' });
};

// @desc    Register a new user
// @route   POST /auth/register
exports.registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).send('User already exists'); // Or render with an error message
        }

        const user = await User.create({ name, email, password, role });

        if (user) {
            res.redirect('/auth/login');
        } else {
            res.status(400).send('Invalid user data');
        }
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

// @desc    Show the login page
// @route   GET /auth/login
exports.getLoginPage = (req, res) => {
    res.render('login', { title: 'Login' });
};

// @desc    Authenticate user & get token
// @route   POST /auth/login
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            const token = generateToken(user._id, user.role);

            // Store the token in an HTTP-Only cookie for security
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
                maxAge: 24 * 60 * 60 * 1000 // 1 day
            });

            // Redirect based on role
            switch (user.role) {
                case 'admin':
                    return res.redirect('/admin/dashboard');
                case 'teacher':
                    return res.redirect('/teacher/dashboard');
                case 'student':
                    return res.redirect('/student/dashboard');
                default:
                    return res.redirect('/');
            }
        } else {
            return res.status(401).send('Invalid email or password');
        }
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

// @desc    Logout user
// @route   GET /auth/logout
exports.logoutUser = (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0) // Expire the cookie immediately
    });
    res.redirect('/auth/login');
};
// ... (keep the other functions in the file the same)

// @desc    Register a new user
// @route   POST /auth/register
exports.registerUser = async (req, res) => {
    // Add schoolId to the destructuring
    const { name, email, password, role, schoolId } = req.body; 
    try {
        const userExists = await User.findOne({ $or: [{ email }, { schoolId }] });

        if (userExists) {
            return res.status(400).send('User with this email or School ID already exists');
        }

        // Add schoolId when creating the user
        const user = await User.create({ name, schoolId, email, password, role });

        if (user) {
            res.redirect('/auth/login');
        } else {
            res.status(400).send('Invalid user data');
        }
    } catch (error) {
        console.error(error); // Log the actual error to the console
        res.status(500).send('Server Error');
    }
};
exports.getForgotPasswordPage = (req, res) => {
    res.render('forgot_password', { title: 'Forgot Password' });
};

// @desc    Handle forgot password request
// @route   POST /auth/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        if (!user) {
            // To prevent email enumeration, we send a success message even if the user doesn't exist.
            return res.send('If an account with that email exists, a password reset link has been sent.');
        }

        // Get reset token
        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        // Create reset URL
        const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
        const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a POST request to: \n\n ${resetUrl}`;
        
        // Send the email using Nodemailer and Mailtrap credentials
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
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
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        res.status(500).send('Server Error');
    }
};

// @desc    Show the reset password page
// @route   GET /auth/reset-password/:token
exports.getResetPasswordPage = (req, res) => {
    res.render('reset_password', { title: 'Reset Password', token: req.params.token });
};

// @desc    Handle reset password
// @route   POST /auth/reset-password/:token
exports.resetPassword = async (req, res) => {
    try {
        // Get hashed token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: resetPasswordToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).send('Invalid or expired token');
        }

        // Set new password
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
// ... (rest of the file is the same)