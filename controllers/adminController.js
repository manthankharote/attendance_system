const mongoose = require('mongoose');
const User = require('../models/User');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const Setting = require('../models/Setting');
const Session = require('../models/Session');
const { clearSettingsCache } = require('../middleware/settingsMiddleware');
const { Parser } = require('json2csv');

// --- Dashboard ---

// @desc    Show the admin dashboard with analytics (Optimized Version)
// @route   GET /admin/dashboard
exports.getAdminDashboard = async (req, res) => {
    try {
        const lowAttendanceThreshold = parseInt(res.locals.settings.lowAttendanceThreshold) || 75;

        // Perform all database queries in parallel for maximum speed
        const [
            studentCount,
            teacherCount,
            classCount,
            todaysAttendance,
            lowAttendanceStudents
        ] = await Promise.all([
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'teacher' }),
            Class.countDocuments(),
            Attendance.find({ date: { $gte: new Date().setHours(0, 0, 0, 0) } }),
            Attendance.aggregate([
                { $unwind: '$records' },
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
                    $project: {
                        percentage: {
                            $cond: {
                                if: { $eq: ['$totalClasses', 0] },
                                then: 0,
                                else: { $multiply: [{ $divide: ['$presentClasses', '$totalClasses'] }, 100] }
                            }
                        }
                    }
                },
                { $match: { percentage: { $lt: lowAttendanceThreshold } } },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'studentDetails'
                    }
                },
                { $unwind: '$studentDetails' },
                { $sort: { percentage: 1 } },
                {
                    $project: {
                        name: '$studentDetails.name',
                        schoolId: '$studentDetails.schoolId',
                        percentage: 1
                    }
                }
            ])
        ]);

        // Process the results
        let presentToday = 0;
        let absentToday = 0;
        todaysAttendance.forEach(record => {
            record.records.forEach(studentStatus => {
                if (studentStatus.status === 'Present') presentToday++;
                if (studentStatus.status === 'Absent') absentToday++;
            });
        });

        res.render('admin_dashboard', {
            title: 'Admin Dashboard',
            user: req.user,
            studentCount,
            teacherCount,
            classCount,
            presentToday,
            absentToday,
            lowAttendanceStudents
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// --- User Management ---

// @desc    Show user management page with search and pagination
// @route   GET /admin/users
exports.getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const searchQuery = req.query.search || '';

        let query = { role: { $ne: 'admin' } };
        if (searchQuery) {
            query.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { email: { $regex: searchQuery, $options: 'i' } },
                { schoolId: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);

        const users = await User.find(query)
            .sort({ role: 1, name: 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('manage_users', {
            title: 'Manage Users',
            user: req.user,
            managedUsers: users,
            currentPage: page,
            totalPages: totalPages,
            searchQuery: searchQuery
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Show page to add a new user
exports.getAddUserPage = (req, res) => {
    res.render('add_user', { title: 'Add New User', user: req.user });
};

// @desc    Process the add user form
// @desc    Process the add user form
exports.addUser = async (req, res) => {
    // 👇 This line gets the data from the form's input names
    const { name, schoolId, email, password, role } = req.body;
    try {
        await User.create({ name, schoolId, email, password, role });
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.status(400).send('Could not add user. The School ID or Email may already exist.');
    }
};

// @desc    Show page to edit a user
exports.getEditUserPage = async (req, res) => {
    try {
        const userToEdit = await User.findById(req.params.id);
        if (!userToEdit) return res.status(404).send('User not found');
        res.render('edit_user', { title: 'Edit User', user: req.user, userToEdit });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users');
    }
};

// @desc    Process the edit user form
exports.updateUser = async (req, res) => {
    try {
        const { name, schoolId, email, role } = req.body;
        await User.findByIdAndUpdate(req.params.id, { name, schoolId, email, role });
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Delete a user
exports.deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// --- Class Management ---

// @desc    Show class management page
exports.getClasses = async (req, res) => {
    try {
        const classes = await Class.find().populate('teacher', 'name').populate('students', 'name');
        res.render('manage_classes', { title: 'Manage Classes', user: req.user, classes });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Show page to add a new class
exports.getAddClassPage = async (req, res) => {
    try {
        const teachers = await User.find({ role: 'teacher' });
        const students = await User.find({ role: 'student' });
        res.render('add_class', { title: 'Add New Class', user: req.user, teachers, students });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Process the add class form
// @desc    Process the add class form
exports.addClass = async (req, res) => {
    try {
        const { name, teacher, students, subjects } = req.body;

        // 1. Handle Subjects (Prevent crash if empty)
        let subjectsArray = [];
        if (subjects) {
            subjectsArray = subjects.split(',').map(s => s.trim());
        }

        // 2. Handle Students (Prevent crash if none selected)
        // If 'students' is undefined, default to an empty array
        const assignedStudents = students || [];

        await Class.create({
            name,
            teacher,
            students: assignedStudents,
            subjects: subjectsArray
        });

        res.redirect('/admin/classes');
    } catch (err) {
        console.error(err);
        // Send a clear error message
        res.status(400).send('Could not add class. Please ensure the Class Name is unique and all fields are filled correctly.');
    }
};

// @desc    Show page to edit a class
exports.getEditClassPage = async (req, res) => {
    try {
        const classToEdit = await Class.findById(req.params.id);
        if (!classToEdit) return res.status(404).send('Class not found');
        const teachers = await User.find({ role: 'teacher' });
        const students = await User.find({ role: 'student' });
        res.render('edit_class', { title: 'Edit Class', user: req.user, classToEdit, teachers, students });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/classes');
    }
};

// @desc    Process the edit class form
exports.updateClass = async (req, res) => {
    try {
        const { name, teacher, students, subjects } = req.body;
        const subjectsArray = subjects.split(',').map(s => s.trim());
        await Class.findByIdAndUpdate(req.params.id, { name, teacher, students: students || [], subjects: subjectsArray });
        res.redirect('/admin/classes');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Delete a class
exports.deleteClass = async (req, res) => {
    try {
        await Class.findByIdAndDelete(req.params.id);
        await Attendance.deleteMany({ class: req.params.id });
        res.redirect('/admin/classes');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// --- Session Management ---

// @desc    Show session management page
exports.getSessionsPage = async (req, res) => {
    try {
        const sessions = await Session.find().sort({ name: 1 });
        res.render('manage_sessions', { title: 'Manage Sessions', user: req.user, sessions });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Add a new session
exports.addSession = async (req, res) => {
    try {
        const { name } = req.body;
        await Session.create({ name });
        res.redirect('/admin/sessions');
    } catch (err) {
        console.error(err);
        res.status(400).send('Could not add session. Session name may already exist.');
    }
};

// @desc    Delete a session
exports.deleteSession = async (req, res) => {
    try {
        await Session.findByIdAndDelete(req.params.id);
        res.redirect('/admin/sessions');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// --- Reporting ---

// @desc    Show the main reports page
exports.getReportsPage = async (req, res) => {
    try {
        const { classId, studentId, startDate, endDate } = req.query;
        const pipeline = [];
        pipeline.push({ $unwind: '$records' });
        const matchStage = {};
        if (classId) matchStage.class = new mongoose.Types.ObjectId(classId);
        if (studentId) matchStage['records.student'] = new mongoose.Types.ObjectId(studentId);
        if (startDate && endDate) matchStage.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        else if (startDate) matchStage.date = { $gte: new Date(startDate) };
        else if (endDate) matchStage.date = { $lte: new Date(endDate) };
        if (Object.keys(matchStage).length > 0) pipeline.push({ $match: matchStage });
        pipeline.push({ $lookup: { from: 'users', localField: 'records.student', foreignField: '_id', as: 'studentDetails' } });
        pipeline.push({ $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'classDetails' } });
        pipeline.push({ $unwind: '$studentDetails' });
        pipeline.push({ $unwind: '$classDetails' });
        pipeline.push({ $sort: { date: -1, 'studentDetails.name': 1 } });
        const records = await Attendance.aggregate(pipeline);
        const students = await User.find({ role: 'student' }).sort({ name: 1 });
        const classes = await Class.find().sort({ name: 1 });
        res.render('reports', { title: 'Attendance Reports', user: req.user, records, students, classes, filters: req.query });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Export the filtered report as a CSV file
exports.exportReport = async (req, res) => {
    try {
        const { classId, studentId, startDate, endDate } = req.query;
        const pipeline = [];
        pipeline.push({ $unwind: '$records' });
        const matchStage = {};
        if (classId) matchStage.class = new mongoose.Types.ObjectId(classId);
        if (studentId) matchStage['records.student'] = new mongoose.Types.ObjectId(studentId);
        if (startDate && endDate) matchStage.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        else if (startDate) matchStage.date = { $gte: new Date(startDate) };
        else if (endDate) matchStage.date = { $lte: new Date(endDate) };
        if (Object.keys(matchStage).length > 0) pipeline.push({ $match: matchStage });
        pipeline.push({ $lookup: { from: 'users', localField: 'records.student', foreignField: '_id', as: 'studentDetails' } });
        pipeline.push({ $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'classDetails' } });
        pipeline.push({ $unwind: '$studentDetails' });
        pipeline.push({ $unwind: '$classDetails' });
        pipeline.push({ $sort: { date: -1, 'studentDetails.name': 1 } });
        const records = await Attendance.aggregate(pipeline);
        const fields = [
            { label: 'Date', value: 'date' },
            { label: 'Student Name', value: 'studentName' },
            { label: 'Student ID', value: 'studentId' },
            { label: 'Class', value: 'className' },
            { label: 'Subject', value: 'subject' },
            { label: 'Status', value: 'status' }
        ];
        const formattedData = records.map(record => ({
            date: new Date(record.date).toLocaleDateString(),
            studentName: record.studentDetails.name,
            studentId: record.studentDetails.schoolId,
            className: record.classDetails.name,
            subject: record.subject,
            status: record.records.status
        }));
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(formattedData);
        res.header('Content-Type', 'text/csv');
        res.attachment(`attendance_report_${new Date().toISOString().slice(0,10)}.csv`);
        res.send(csv);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// --- Settings ---

// @desc    Show system settings page
exports.getSettingsPage = async (req, res) => {
    res.render('settings', { title: 'System Settings', user: req.user });
};

// @desc    Update system settings
// @desc    Update system settings
exports.updateSettings = async (req, res) => {
    try {
        const { lowAttendanceThreshold } = req.body;
        
        await Setting.findOneAndUpdate(
            { key: 'lowAttendanceThreshold' },
            { value: lowAttendanceThreshold },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // 👇 This line is CRITICAL. It clears the old settings from memory.
        clearSettingsCache();
        
        res.redirect('/admin/settings');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};