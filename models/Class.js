const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const classSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    // A class has one main teacher
    teacher: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // A class has multiple students
    students: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    subjects: [{
        type: String,
        trim: true
    }]
}, { timestamps: true });

const Class = mongoose.model('Class', classSchema);

module.exports = Class;