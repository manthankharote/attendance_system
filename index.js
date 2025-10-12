// index.js (Replace Entire File With This)

const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const path = require('path');
const cookieParser = require('cookie-parser');
const { loadSettings } = require('./middleware/settingsMiddleware');

// Load environment variables
dotenv.config();

// Connect to the database
connectDB();

// Initialize express app (ONCE)
const app = express();

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(loadSettings); // Makes settings available to all routes and views

// --- Routes ---
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');

// Use routes
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/teacher', teacherRoutes);
app.use('/student', studentRoutes);

// Homepage Route
app.get('/', (req, res) => {
  res.render('welcome', { title: 'Attendance System' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT} 🚀`);
});