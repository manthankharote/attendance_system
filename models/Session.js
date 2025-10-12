const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        // Example: "09:00 - 10:00 AM" or "Period 1"
    }
}, { timestamps: true });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;