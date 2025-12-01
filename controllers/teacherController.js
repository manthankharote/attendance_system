const mongoose = require('mongoose');
const User = require('../models/User');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const Setting = require('../models/Setting');
const Session = require('../models/Session');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { Parser } = require('json2csv');
// @desc    Show the teacher dashboard
exports.exportTeacherReport = async (req, res) => {
    try {
        const { classId, studentId, startDate, endDate } = req.query;

        // --- Security: Get classes taught by this teacher ---
        const teacherClasses = await Class.find({ teacher: req.user._id }).select('_id');
        const teacherClassIds = teacherClasses.map(c => c._id);

        if (teacherClassIds.length === 0) {
            return res.status(400).send('No classes assigned.');
        }

        // --- Build the Secure Pipeline (Same as getTeacherReportsPage) ---
        const match = { class: { $in: teacherClassIds } };
        if (classId) match.class = new mongoose.Types.ObjectId(classId);
        if (startDate && endDate) match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };

        const pipeline = [
            { $match: match },
            { $unwind: '$records' }
        ];

        if (studentId) {
            pipeline.push({ $match: { 'records.student': new mongoose.Types.ObjectId(studentId) } });
        }
        
        pipeline.push(
            { $lookup: { from: 'users', localField: 'records.student', foreignField: '_id', as: 'studentDetails' } },
            { $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'classDetails' } },
            { $unwind: '$studentDetails' },
            { $unwind: '$classDetails' },
            { $sort: { date: -1, 'studentDetails.name': 1 } }
        );

        const records = await Attendance.aggregate(pipeline);

        // --- Generate CSV with 1/0 Logic ---
        const fields = [
            { label: 'Date', value: 'date' },
            { label: 'Time', value: 'time' },
            { label: 'Student Name', value: 'studentName' },
            { label: 'Roll No', value: 'rollNo' },
            { label: 'Class', value: 'className' },
            { label: 'Subject', value: 'subject' },
            { label: 'Session', value: 'session' },
            { label: 'Status (1=P, 0=A)', value: 'status' } // Clear Label
        ];

        const formattedData = records.map(record => ({
            date: new Date(record.date).toLocaleDateString(),
            time: new Date(record.updatedAt).toLocaleTimeString(),
            studentName: record.studentDetails.name,
            rollNo: record.studentDetails.schoolId,
            className: record.classDetails.name,
            subject: record.subject,
            session: record.session || 'N/A',
            // 👇 Logic for 1 and 0
            status: record.records.status === 'Present' ? 1 : 0
        }));
        
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(formattedData);

        res.header('Content-Type', 'text/csv');
        res.attachment(`teacher_report_${new Date().toISOString().slice(0,10)}.csv`);
        res.send(csv);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
exports.getTeacherDashboard = async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.user._id }).populate('students').sort({ name: 1 });
        res.render('teacher_dashboard', { title: 'Teacher Dashboard', user: req.user, classes: classes });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Show page to select class/date for attendance
exports.getAttendancePage = async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.user._id });
        const sessions = await Session.find().sort({ name: 1 });
        res.render('take_attendance', { title: 'Take Attendance', user: req.user, classes, sessions });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Get the list of students for attendance (Manual)
exports.getAttendanceSheet = async (req, res) => {
    try {
        const { classId, date, subject, session } = req.body;
        const selectedClass = await Class.findById(classId).populate('students');
        if (!selectedClass) return res.status(404).send('Class not found');
        const attendanceRecord = await Attendance.findOne({ class: classId, date, subject, session });
        res.render('attendance_sheet', {
            title: 'Attendance Sheet', user: req.user, selectedClass,
            students: selectedClass.students, date, subject, session,
            records: attendanceRecord ? attendanceRecord.records : []
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Submit the manual attendance
exports.submitAttendance = async (req, res) => {
    const { classId, date, subject, session, attendance } = req.body;
    try {
        const records = Object.keys(attendance).map(studentId => ({ student: studentId, status: attendance[studentId] }));
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

// @desc    Show the QR Code scanner page (Student Scan Mode)
exports.getQrScannerPage = async (req, res) => {
    try {
        const { classId, date, subject, session } = req.body;
        const selectedClass = await Class.findById(classId).populate('students', 'name schoolId');
        if (!selectedClass) return res.status(404).send('Class not found');
        res.render('qr_scanner', {
            title: 'QR Code Scanner', user: req.user, selectedClass, date, subject, session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Submit attendance from the QR scanner
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

// @desc    Generate a unique QR code for a specific session (Teacher Display Mode)
exports.generateSessionQr = async (req, res) => {
    try {
        const { classId, date, subject, session } = req.body;
        const uniqueSessionToken = crypto.randomBytes(8).toString('hex');
        const sessionIdentifier = `${classId}_${date}_${subject}_${session}_${uniqueSessionToken}`;
        const qrCodeDataURL = await qrcode.toDataURL(sessionIdentifier);
        const selectedClass = await Class.findById(classId).select('name');

        res.render('display_session_qr', {
            title: 'Session QR Code',
            user: req.user,
            qrCodeUrl: qrCodeDataURL,
            classId, date, subject, session,
            sessionIdentifier,
            selectedClass
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Show the teacher's reports page
exports.getTeacherReportsPage = async (req, res) => {
    try {
        const { classId, studentId, startDate, endDate } = req.query;
        const teacherClasses = await Class.find({ teacher: req.user._id }).select('_id students');
        const teacherClassIds = teacherClasses.map(c => c._id);
        
        if (teacherClassIds.length === 0) {
            return res.render('teacher_reports', {
                title: 'My Reports', user: req.user, records: [],
                students: [], classes: [], filters: req.query
            });
        }
        
        const match = { class: { $in: teacherClassIds } };
        if (classId) match.class = new mongoose.Types.ObjectId(classId);
        if (startDate && endDate) match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        
        const pipeline = [{ $match: match }, { $unwind: '$records' }];
        if (studentId) { pipeline.push({ $match: { 'records.student': new mongoose.Types.ObjectId(studentId) } }); }
        
        pipeline.push(
            { $lookup: { from: 'users', localField: 'records.student', foreignField: '_id', as: 'studentDetails' } },
            { $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'classDetails' } },
            { $unwind: '$studentDetails' }, { $unwind: '$classDetails' },
            { $sort: { date: -1, 'studentDetails.name': 1 } }
        );
        
        const records = await Attendance.aggregate(pipeline);
        const teacherStudentIds = teacherClasses.flatMap(c => c.students);
        const teacherStudents = await User.find({ _id: { $in: teacherStudentIds } }).sort({ name: 1 });
        const teacherClassesForFilter = await Class.find({ _id: { $in: teacherClassIds } }).sort({ name: 1 });
        
        res.render('teacher_reports', {
            title: 'My Reports', user: req.user, records,
            students: teacherStudents, classes: teacherClassesForFilter, filters: req.query
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Show low attendance report
exports.getLowAttendancePage = async (req, res) => {
    try {
        const teacherClasses = await Class.find({ teacher: req.user._id }).select('students');
        const teacherStudentIds = teacherClasses.flatMap(c => c.students);
        const lowAttendanceThreshold = parseInt(res.locals.settings.lowAttendanceThreshold) || 75;
        
        const studentAttendanceStats = await Attendance.aggregate([
            { $unwind: '$records' },
            { $match: { 'records.student': { $in: teacherStudentIds } } },
            { $group: { _id: '$records.student', totalClasses: { $sum: 1 }, presentClasses: { $sum: { $cond: [{ $eq: ['$records.status', 'Present'] }, 1, 0] } } } },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'studentDetails' } },
            { $unwind: '$studentDetails' },
            { $project: { name: '$studentDetails.name', schoolId: '$studentDetails.schoolId', percentage: { $multiply: [{ $divide: ['$presentClasses', '$totalClasses'] }, 100] } } },
            { $match: { percentage: { $lt: lowAttendanceThreshold } } },
            { $sort: { percentage: 1 } }
        ]);
        
        res.render('teacher_low_attendance', {
            title: 'Low Attendance Students', user: req.user,
            lowAttendanceStudents: studentAttendanceStats, threshold: lowAttendanceThreshold
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Show the page to edit a specific student's attendance
exports.getEditAttendancePage = async (req, res) => {
    try {
        const { attendanceId, recordId } = req.params;
        const attendance = await Attendance.findById(attendanceId).populate({ path: 'records.student', select: 'name schoolId' });
        const recordToEdit = attendance.records.find(r => r._id.equals(recordId));
        const isEditable = (Date.now() - new Date(attendance.updatedAt).getTime()) < 24 * 60 * 60 * 1000;
        
        if (!isEditable) {
            return res.status(403).send('This record is older than 24 hours and can no longer be edited.');
        }
        
        res.render('edit_attendance', { title: 'Edit Attendance', user: req.user, attendance, recordToEdit });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Update a specific student's attendance record
exports.updateAttendance = async (req, res) => {
    try {
        const { attendanceId, recordId } = req.params;
        const { status } = req.body;
        const attendance = await Attendance.findById(attendanceId);
        const isEditable = (Date.now() - new Date(attendance.updatedAt).getTime()) < 24 * 60 * 60 * 1000;
        
        if (!isEditable) {
            return res.status(403).send('This record is older than 24 hours and can no longer be edited.');
        }
        
        const recordIndex = attendance.records.findIndex(r => r._id.equals(recordId));
        if (recordIndex > -1) {
            attendance.records[recordIndex].status = status;
            await attendance.save();
        }
        
        res.redirect('/teacher/reports');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
// @desc    Submit attendance from the session QR (Teacher Display Mode)
// @route   POST /teacher/attendance/submit-session
exports.submitSessionAttendance = async (req, res) => {
    try {
        const { classId, date, subject, session, presentStudents } = req.body;

        // Get all students in the class
        const fullClass = await Class.findById(classId).select('students');
        if (!fullClass) {
            return res.status(404).send('Class not found');
        }

        // Standardize the presentStudents array (in case only one student is scanned)
        const presentStudentIds = Array.isArray(presentStudents) ? presentStudents : [presentStudents].filter(Boolean);

        // Create the full attendance record
        // Mark scanned students as 'Present', all others as 'Absent'
        const records = fullClass.students.map(studentId => {
            const status = presentStudentIds.includes(studentId.toString()) ? 'Present' : 'Absent';
            return { student: studentId, status: status };
        });

        // Use findOneAndUpdate to create or update the record
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