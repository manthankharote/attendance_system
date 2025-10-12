// controllers/adminController.js
const { Parser } = require('json2csv');
const mongoose = require('mongoose');
const User = require('../models/User');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const Session = require('../models/Session');

const Setting = require('../models/Setting');
const { clearSettingsCache } = require('../middleware/settingsMiddleware');

// --- Dashboard ---

// @desc    Show the admin dashboard
// @route   GET /admin/dashboard
exports.getAdminDashboard = (req, res) => {
    res.render('admin_dashboard', {
        title: 'Admin Dashboard',
        user: req.user
    });
};
exports.getSettingsPage = async (req, res) => {
    // The settings are already loaded by the middleware and available in res.locals.settings
    res.render('settings', {
        title: 'System Settings',
        user: req.user
    });
};

// --- User Management ---

// @desc    Show user management page with search and pagination
// @route   GET /admin/users
exports.getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Show 10 users per page
        const searchQuery = req.query.search || '';

        // Build the search query
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
// @route   GET /admin/users/add
exports.getAddUserPage = (req, res) => {
    res.render('add_user', {
        title: 'Add New User',
        user: req.user
    });
};

// @desc    Process the add user form
// @route   POST /admin/users/add
exports.addUser = async (req, res) => {
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
// @route   GET /admin/users/edit/:id
exports.getEditUserPage = async (req, res) => {
    try {
        const userToEdit = await User.findById(req.params.id);
        if (!userToEdit) {
            return res.status(404).send('User not found');
        }
        res.render('edit_user', {
            title: 'Edit User',
            user: req.user,
            userToEdit: userToEdit
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users');
    }
};

// @desc    Process the edit user form
// @route   POST /admin/users/edit/:id
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
// @route   POST /admin/users/delete/:id
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
// @route   GET /admin/classes
exports.getClasses = async (req, res) => {
    try {
        const classes = await Class.find().populate('teacher', 'name').populate('students', 'name');
        res.render('manage_classes', {
            title: 'Manage Classes',
            user: req.user,
            classes
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Show page to add a new class
// @route   GET /admin/classes/add
exports.getAddClassPage = async (req, res) => {
    try {
        const teachers = await User.find({ role: 'teacher' });
        const students = await User.find({ role: 'student' });
        res.render('add_class', {
            title: 'Add New Class',
            user: req.user,
            teachers,
            students
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Process the add class form
// @route   POST /admin/classes/add
exports.addClass = async (req, res) => {
    try {
        const { name, teacher, students, subjects } = req.body;
        const subjectsArray = subjects.split(',').map(s => s.trim());
        
        await Class.create({
            name,
            teacher,
            students,
            subjects: subjectsArray
        });
        res.redirect('/admin/classes');
    } catch (err) {
        console.error(err);
        res.status(400).send('Could not add class. The class name may already exist.');
    }
};

// --- Reporting ---

// @desc    Show the main reports page
// @route   GET /admin/reports
exports.getReportsPage = async (req, res) => {
    try {
        const { classId, studentId, startDate, endDate } = req.query;
        const pipeline = [];

        pipeline.push({ $unwind: '$records' });

        const matchStage = {};
        if (classId) {
            matchStage.class = new mongoose.Types.ObjectId(classId);
        }
        if (studentId) {
            matchStage['records.student'] = new mongoose.Types.ObjectId(studentId);
        }
        if (startDate && endDate) {
            matchStage.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        } else if (startDate) {
            matchStage.date = { $gte: new Date(startDate) };
        } else if (endDate) {
            matchStage.date = { $lte: new Date(endDate) };
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        pipeline.push({
            $lookup: {
                from: 'users',
                localField: 'records.student',
                foreignField: '_id',
                as: 'studentDetails'
            }
        });

        pipeline.push({
            $lookup: {
                from: 'classes',
                localField: 'class',
                foreignField: '_id',
                as: 'classDetails'
            }
        });

        pipeline.push({ $unwind: '$studentDetails' });
        pipeline.push({ $unwind: '$classDetails' });
        
        pipeline.push({ $sort: { date: -1, 'studentDetails.name': 1 } });

        const records = await Attendance.aggregate(pipeline);

        const students = await User.find({ role: 'student' }).sort({ name: 1 });
        const classes = await Class.find().sort({ name: 1 });

        res.render('reports', {
            title: 'Attendance Reports',
            user: req.user,
            records,
            students,
            classes,
            filters: req.query
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
exports.exportReport = async (req, res) => {
    try {
        const { classId, studentId, startDate, endDate } = req.query;
        
        // This aggregation pipeline is IDENTICAL to the one in getReportsPage
        // to ensure the exported data matches what the user sees.
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

        // --- CSV Generation ---
        
        // 1. Define the columns for our CSV file
        const fields = [
            { label: 'Date', value: 'date' },
            { label: 'Student Name', value: 'studentName' },
            { label: 'Student ID', value: 'studentId' },
            { label: 'Class', value: 'className' },
            { label: 'Subject', value: 'subject' },
            { label: 'Status', value: 'status' }
        ];

        // 2. Format the data to match our columns
        const formattedData = records.map(record => ({
            date: new Date(record.date).toLocaleDateString(),
            studentName: record.studentDetails.name,
            studentId: record.studentDetails.schoolId,
            className: record.classDetails.name,
            subject: record.subject,
            status: record.records.status
        }));
        
        // 3. Create the CSV parser and convert the data
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(formattedData);

        // 4. Set the headers to tell the browser to download the file
        res.header('Content-Type', 'text/csv');
        res.attachment(`attendance_report_${new Date().toISOString().slice(0,10)}.csv`);
        res.send(csv);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
// ... keep all your other functions ...

// @desc    Show page to edit a class
// @route   GET /admin/classes/edit/:id
exports.getEditClassPage = async (req, res) => {
    try {
        const classToEdit = await Class.findById(req.params.id);
        if (!classToEdit) {
            return res.status(404).send('Class not found');
        }
        
        const teachers = await User.find({ role: 'teacher' });
        const students = await User.find({ role: 'student' });

        res.render('edit_class', {
            title: 'Edit Class',
            user: req.user,
            classToEdit,
            teachers,
            students
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/classes');
    }
};

// @desc    Process the edit class form
// @route   POST /admin/classes/edit/:id
exports.updateClass = async (req, res) => {
    try {
        const { name, teacher, students, subjects } = req.body;
        const subjectsArray = subjects.split(',').map(s => s.trim());
        
        await Class.findByIdAndUpdate(req.params.id, {
            name,
            teacher,
            students: students || [], // Handle case where no students are selected
            subjects: subjectsArray
        });
        res.redirect('/admin/classes');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Delete a class
// @route   POST /admin/classes/delete/:id
exports.deleteClass = async (req, res) => {
    try {
        await Class.findByIdAndDelete(req.params.id);
        // Optional: Also delete attendance records associated with this class
        await Attendance.deleteMany({ class: req.params.id });
        res.redirect('/admin/classes');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
// @desc    Show the admin dashboard with analytics
// @route   GET /admin/dashboard
exports.getAdminDashboard = async (req, res) => {
    try {
        // --- 1. Get User Counts ---
        const studentCount = await User.countDocuments({ role: 'student' });
        const teacherCount = await User.countDocuments({ role: 'teacher' });
        const classCount = await Class.countDocuments();

        // --- 2. Get Today's Attendance Summary ---
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1); // Set to start of tomorrow

        const todaysAttendance = await Attendance.find({ date: { $gte: today, $lt: tomorrow } });
        
        let presentToday = 0;
        let absentToday = 0;
        todaysAttendance.forEach(record => {
            record.records.forEach(studentStatus => {
                if (studentStatus.status === 'Present') presentToday++;
                if (studentStatus.status === 'Absent') absentToday++;
            });
        });
        
        // --- 3. Find Students with Low Attendance (e.g., below 75%) ---
        const lowAttendanceThreshold = 75;
        const studentAttendanceStats = await Attendance.aggregate([
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
                    _id: 1,
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

        res.render('admin_dashboard', {
            title: 'Admin Dashboard',
            user: req.user,
            studentCount,
            teacherCount,
            classCount,
            presentToday,
            absentToday,
            lowAttendanceStudents: studentAttendanceStats
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
exports.updateSettings = async (req, res) => {
    try {
        const { lowAttendanceThreshold } = req.body;
        
        // Use findOneAndUpdate with upsert to create the setting if it doesn't exist
        await Setting.findOneAndUpdate(
            { key: 'lowAttendanceThreshold' },
            { value: lowAttendanceThreshold },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Clear the cache so the new setting is loaded on the next request
        clearSettingsCache();
        
        res.redirect('/admin/settings');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
exports.getSessionsPage = async (req, res) => {
    try {
        const sessions = await Session.find().sort({ name: 1 });
        res.render('manage_sessions', {
            title: 'Manage Sessions',
            user: req.user,
            sessions
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// @desc    Add a new session
// @route   POST /admin/sessions/add
exports.addSession = async (req, res) => {
    try {
        const { name } = req.body;
        await Session.create({ name });
        res.redirect('/admin/sessions');
    } catch (err) {
        console.error(err);
        res.status(400).send('Could not add session. The name may already exist.');
    }
};

// @desc    Delete a session
// @route   POST /admin/sessions/delete/:id
exports.deleteSession = async (req, res) => {
    try {
        await Session.findByIdAndDelete(req.params.id);
        res.redirect('/admin/sessions');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};