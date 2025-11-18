// index.js

const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/database'); // 1. Import connectDB
const path = require('path');
const cookieParser = require('cookie-parser');
const { loadSettings } = require('./middleware/settingsMiddleware');

const http = require('http');
const { Server } = require("socket.io");

// Load environment variables (This MUST be first)
dotenv.config();

// 2. DO NOT call connectDB() here.

// Initialize express app
const app = express();
const server = http.createServer(app);
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

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/teacher', teacherRoutes);
app.use('/student', studentRoutes);

// Homepage Route
app.get('/', (req, res) => {
  res.render('welcome', { title: 'Attendance System' });
});

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('studentScan', (data) => {
        console.log('Scan received:', data.studentName);
        io.emit('newStudentScanned', data);
    });
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// --- 3. NEW: Start Server Function ---
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // 4. First, try to connect to the database
        await connectDB();
        
        // 5. If connection is successful, THEN start the server
        server.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT} 🚀`);
        });
    } catch (error) {
        console.error("Failed to connect to the database, server did not start.");
        console.error(error);
        process.exit(1);
    }
};

// --- 6. Call the function to start everything ---
startServer();