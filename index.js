const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const path = require('path');
const cookieParser = require('cookie-parser');
const { loadSettings } = require('./middleware/settingsMiddleware');

// --- New Imports for Socket.IO ---
const http = require('http'); // 1. Import http
const { Server } = require("socket.io"); // 2. Import Server from socket.io

// Load environment variables
dotenv.config();

// Connect to the database
connectDB();

// Initialize express app
const app = express();
// --- 3. Create an HTTP server from the Express app ---
const server = http.createServer(app); 
// --- 4. Initialize Socket.IO with the server ---
const io = new Server(server); 

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(loadSettings);

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

// --- 5. Socket.IO Connection Logic ---
io.on('connection', (socket) => {
    console.log('A user connected');

    // When a student scans, they will send this event
    socket.on('studentScan', (data) => {
        // data contains { sessionIdentifier: '...', studentName: '...', studentId: '...' }
        console.log('Scan received:', data.studentName);
        
        // Broadcast the scan event to the teacher's screen
        // The teacher's page will be listening for 'newStudentScanned'
        io.emit('newStudentScanned', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// --- 6. Start the server using server.listen instead of app.listen ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT} 🚀`);
});