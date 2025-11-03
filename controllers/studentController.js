// @desc    Show the student dashboard
// @route   GET /student/dashboard
const bcrypt = require('bcryptjs');
const User = require('../models/User');

exports.getStudentDashboard = (req, res) => {
    res.render('student_dashboard', {
        title: 'Student Dashboard',
        user: req.user
    });
};
const Attendance = require('../models/Attendance');
const qrcode = require('qrcode');

exports.getStudentDashboard = async (req, res) => {
    try {
        const attendanceRecords = await Attendance.find({ 'records.student': req.user._id })
            .populate('class', 'name');

        let totalClasses = 0;
        let presentClasses = 0;
        const subjectStats = {};

        attendanceRecords.forEach(record => {
            const studentRecord = record.records.find(r => r.student.equals(req.user._id));
            if (studentRecord) {
                totalClasses++;
                if (studentRecord.status === 'Present') presentClasses++;
                
                if (!subjectStats[record.subject]) {
                    subjectStats[record.subject] = { total: 0, present: 0 };
                }
                
                subjectStats[record.subject].total++;
                if (studentRecord.status === 'Present') {
                    subjectStats[record.subject].present++;
                }
            }
        });

        const overallPercentage = totalClasses > 0 ? (presentClasses / totalClasses) * 100 : 0;
        
        // --- Prepare Data for Chart.js ---
        const chartLabels = [];
        const chartData = [];
        const chartColors = [];

        for (const subject in subjectStats) {
            const stats = subjectStats[subject];
            const percentage = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
            subjectStats[subject].percentage = percentage;

            chartLabels.push(subject);
            chartData.push(percentage.toFixed(2));
            // Set bar color to green if >= 75%, otherwise red
            chartColors.push(percentage >= 75 ? 'rgba(40, 167, 69, 0.7)' : 'rgba(220, 53, 69, 0.7)');
        }

        res.render('student_dashboard', {
            title: 'Student Dashboard',
            user: req.user,
            overallPercentage,
            subjectStats,
            recentRecords: attendanceRecords.slice(-5).reverse(),
            // 👇 Pass chart data to the view
            chartLabels: JSON.stringify(chartLabels), 
            chartData: JSON.stringify(chartData),
            chartColors: JSON.stringify(chartColors)
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};


// ... keep all your other functions like getStudentDashboard ...

// @desc    Show the student's profile page
// @route   GET /student/profile
exports.getProfilePage = (req, res) => {
    res.render('student_profile', {
        title: 'My Profile',
        user: req.user
    });
};

// @desc    Update student's personal information
// @route   POST /student/profile/update
exports.updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const userId = req.user._id;

        await User.findByIdAndUpdate(userId, { name, email });
        
        // We can add a success message later using connect-flash
        res.redirect('/student/profile');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Update student's password
// @route   POST /student/profile/password
exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);

        // Check if the current password is correct
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            // We should show an error message here
            return res.status(400).send('Incorrect current password.');
        }

        // Set the new password (the pre-save hook in the model will hash it)
        user.password = newPassword;
        await user.save();

        res.redirect('/student/profile');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Generate and send QR code for the student
// @route   GET /student/qrcode
exports.getQrCode = async (req, res) => {
    try {
        const studentIdentifier = req.user.schoolId; // Using schoolId for the QR code
        if (!studentIdentifier) {
            return res.status(400).json({ error: 'Student ID not found' });
        }

        const qrCodeDataURL = await qrcode.toDataURL(studentIdentifier);
        res.json({ qrCodeUrl: qrCodeDataURL });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
};
// @desc    Show the student's scanning page
// @route   GET /student/scan
exports.getScanPage = (req, res) => {
    res.render('student_scan', {
        title: 'Scan Session QR',
        user: req.user // Pass the logged-in user's info
    });
};