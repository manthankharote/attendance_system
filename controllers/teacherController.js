const mongoose = require('mongoose');
const User = require('../models/User');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const Session = require('../models/Session');

// @desc    Show the teacher dashboard with assigned classes
// @route   GET /teacher/dashboard
exports.getTeacherDashboard = async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.user._id })
            .populate('students')
            .sort({ name: 1 });

        res.render('teacher_dashboard', {
            title: 'Teacher Dashboard',
            user: req.user,
            classes: classes
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Show page to select class and date for attendance
// @route   GET /teacher/attendance
exports.getAttendancePage = async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.user._id });
        res.render('take_attendance', {
            title: 'Take Attendance',
            user: req.user,
            classes
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Get the list of students for attendance (Manual)
// @route   POST /teacher/attendance/sheet
exports.getAttendanceSheet = async (req, res) => {
    try {
        const { classId, date, subject, session } = req.body;
        const selectedClass = await Class.findById(classId).populate('students');
        if (!selectedClass) return res.status(404).send('Class not found');
        
        const attendanceRecord = await Attendance.findOne({ class: classId, date, subject, session });
        
        res.render('attendance_sheet', {
            title: 'Attendance Sheet',
            user: req.user,
            selectedClass,
            students: selectedClass.students,
            date,
            subject,
            session,
            records: attendanceRecord ? attendanceRecord.records : []
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Submit the manual attendance
// @route   POST /teacher/attendance/submit
exports.submitAttendance = async (req, res) => {
    const { classId, date, subject, session, attendance } = req.body;
    try {
        const records = Object.keys(attendance).map(studentId => ({
            student: studentId,
            status: attendance[studentId]
        }));
        await Attendance.findOneAndUpdate(
            { class: classId, date, subject, session },
            { $set: { records: records } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.redirect('/teacher/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Show the QR Code scanner page
// @route   POST /teacher/attendance/qr-scanner
exports.getQrScannerPage = async (req, res) => {
    try {
        const { classId, date, subject, session } = req.body;
        const selectedClass = await Class.findById(classId).populate('students', 'name schoolId');
        if (!selectedClass) return res.status(404).send('Class not found');
        
        res.render('qr_scanner', {
            title: 'QR Code Scanner',
            user: req.user,
            selectedClass,
            date,
            subject,
            session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Submit attendance from the QR scanner
// @route   POST /teacher/attendance/qr-submit
exports.submitQrAttendance = async (req, res) => {
    const { classId, date, subject, session, presentStudents } = req.body;
    try {
        const fullClass = await Class.findById(classId).select('students');
        if (!fullClass) return res.status(404).send('Class not found');
        
        const presentStudentIds = Array.isArray(presentStudents) ? presentStudents : [presentStudents].filter(Boolean);
        const records = fullClass.students.map(studentId => ({
            student: studentId,
            status: presentStudentIds.includes(studentId.toString()) ? 'Present' : 'Absent'
        }));
        
        await Attendance.findOneAndUpdate(
            { class: classId, date, subject, session },
            { $set: { records: records } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.redirect('/teacher/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Show the teacher's reports page
// @route   GET /teacher/reports
// controllers/teacherController.js (Replace the function with this)

// @desc    Show the teacher's reports page (SECURE VERSION)
// @route   GET /teacher/reports
exports.getTeacherReportsPage = async (req, res) => {
    try {
        const { classId, studentId, startDate, endDate } = req.query;

        // --- 1. Security Filter: Get an array of class IDs taught by this teacher ---
        const teacherClasses = await Class.find({ teacher: req.user._id }).select('_id students');
        const teacherClassIds = teacherClasses.map(c => c._id);

        // If the teacher has no classes, there's nothing to show.
        if (teacherClassIds.length === 0) {
            return res.render('teacher_reports', {
                title: 'My Reports',
                user: req.user,
                records: [],
                students: [],
                classes: [],
                filters: req.query
            });
        }

        // --- 2. Build a reliable match object for our query ---
        const match = {
            // The most important line: only search for attendance within the teacher's classes.
            class: { $in: teacherClassIds } 
        };

        // Add user's filters to the same match object
        if (classId) {
            match.class = new mongoose.Types.ObjectId(classId);
        }
        if (startDate && endDate) {
            match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        // --- 3. Build the Aggregation Pipeline ---
        const pipeline = [
            { $match: match }, // Apply all class and date filters first
            { $unwind: '$records' }
        ];

        // If a specific student is filtered, add a second match stage.
        if (studentId) {
            pipeline.push({ $match: { 'records.student': new mongoose.Types.ObjectId(studentId) } });
        }
        
        // --- 4. Join with other collections to get names ---
        pipeline.push(
            { $lookup: { from: 'users', localField: 'records.student', foreignField: '_id', as: 'studentDetails' } },
            { $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'classDetails' } },
            { $unwind: '$studentDetails' },
            { $unwind: '$classDetails' },
            { $sort: { date: -1, 'studentDetails.name': 1 } }
        );

        const records = await Attendance.aggregate(pipeline);

        // --- 5. Prepare data for the filter dropdowns ---
        const teacherStudentIds = teacherClasses.flatMap(c => c.students);
        const teacherStudents = await User.find({ _id: { $in: teacherStudentIds } }).sort({ name: 1 });
        const teacherClassesForFilter = await Class.find({ _id: { $in: teacherClassIds } }).sort({ name: 1 });

        res.render('teacher_reports', {
            title: 'My Reports',
            user: req.user,
            records,
            students: teacherStudents,
            classes: teacherClassesForFilter,
            filters: req.query
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};


// @desc    Show low attendance report for the teacher's students
// @route   GET /teacher/low-attendance
exports.getLowAttendancePage = async (req, res) => {
    try {
        // --- 1. Security: Get an array of student IDs taught by this teacher ---
        const teacherClasses = await Class.find({ teacher: req.user._id }).select('students');
        const teacherStudentIds = teacherClasses.flatMap(c => c.students);

        // --- 2. Aggregation Pipeline to calculate percentages ---
        const lowAttendanceThreshold = 75;
        const studentAttendanceStats = await Attendance.aggregate([
            // Start by only looking at records for this teacher's students
            { $unwind: '$records' },
            { $match: { 'records.student': { $in: teacherStudentIds } } },
            {
                $group: {
                    _id: '$records.student',
                    totalClasses: { $sum: 1 },
                    presentClasses: {
                        $sum: { $cond: [{ $eq: ['$records.status', 'Present'] }, 1, 0] }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'studentDetails'
                }
            },
            { $unwind: '$studentDetails' },
            {
                $project: {
                    name: '$studentDetails.name',
                    schoolId: '$studentDetails.schoolId',
                    percentage: {
                        $multiply: [{ $divide: ['$presentClasses', '$totalClasses'] }, 100]
                    }
                }
            },
            { $match: { percentage: { $lt: lowAttendanceThreshold } } },
            { $sort: { percentage: 1 } }
        ]);

        res.render('teacher_low_attendance', {
            title: 'Low Attendance Students',
            user: req.user,
            lowAttendanceStudents: studentAttendanceStats,
            threshold: lowAttendanceThreshold
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
exports.getAttendancePage = async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.user._id });
        const sessions = await Session.find().sort({ name: 1 }); // Fetch sessions from DB

        res.render('take_attendance', {
            title: 'Take Attendance',
            user: req.user,
            classes,
            sessions // Pass sessions to the view
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};