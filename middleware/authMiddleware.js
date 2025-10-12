const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to protect routes (check if user is logged in)
exports.protect = async (req, res, next) => {
    let token;

    if (req.cookies.token) {
        try {
            // Get token from cookie
            token = req.cookies.token;

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from the token (and exclude the password)
            req.user = await User.findById(decoded.id).select('-password');

            next(); // Proceed to the next middleware or route handler
        } catch (error) {
            console.error(error);
            return res.status(401).redirect('/auth/login');
        }
    }

    if (!token) {
        return res.status(401).redirect('/auth/login');
    }
};

// Middleware to authorize based on role
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            // This can be improved to show a proper 'Forbidden' page
            return res.status(403).send('<h1>Forbidden</h1><p>You do not have permission to access this page.</p>');
        }
        next();
    };
};