const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attendanceRecordSchema = new Schema({
    student: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['Present', 'Absent'],
        required: true
    }
});

const attendanceSchema = new Schema({
    class: {
        type: Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    subject: {
        type: String,
        required: true
    },
     session: {
        type: String,
        required: true
    },
    records: [attendanceRecordSchema]
}, { timestamps: true });

// Ensure that attendance is unique for a class, date, and subject
attendanceSchema.index({ class: 1, date: 1, subject: 1,session: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;