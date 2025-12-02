const express = require("express");
const path = require("path");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();

// Initialize Firebase Admin SDK
try {
    const serviceAccount = require("./serviceAccountKey.json");
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://parkqueue-216c7.firebaseio.com"
    });
    
    console.log("✅ Firebase Admin SDK initialized successfully");
} catch (error) {
    console.error("❌ Firebase Admin initialization failed:", error.message);
    process.exit(1);
}

// Email transporter setup
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'kenightgallaza@gmail.com',
            pass: 'rnbq ytju tjoc apnv'
        },
        pool: true,
        maxConnections: 1,
        maxMessages: 5
    });
};

let transporter = createTransporter();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.options('*', cors());

// ✅ SERVING STATIC FILES FOR DIFFERENT PROJECTS

// Serve Admin static files (no framework)
app.use("/admin", express.static(path.join(__dirname, "../frontend")));
app.use("/admin/dashboard", express.static(path.join(__dirname, "../frontend/Dashboard")));
app.use("/admin/login", express.static(path.join(__dirname, "../frontend/login")));
app.use("/admin/pending", express.static(path.join(__dirname, "../frontend/pendingApproval")));

// Serve User static files (with framework)
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/user-verification", express.static(path.join(__dirname, "../frontend/userVerification")));

// ✅ ADMIN ROUTES (No Framework)
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login/admin-login.html"));
});

app.get("/admin/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/Dashboard/dashboard.html"));
});

app.get("/admin/pending", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pendingApproval/approvals.html"));
});

app.get("/admin/login", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login/admin-login.html"));
});

// ✅ USER ROUTES (With Framework)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/Login&Register.html"));
});

app.get("/verification", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/verification.html"));
});

app.get("/user-verification", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/userVerification/user-verification.html"));
});

// ✅ API ROUTES (Keep your existing API routes)
app.post("/send-verification-email", async (req, res) => {
    // Your existing email code...
});

app.get("/test-email", async (req, res) => {
    // Your existing test email code...
});

app.get("/test-firebase", async (req, res) => {
    // Your existing Firebase test code...
});

app.get("/health", (req, res) => {
    res.json({
        status: "Server is running",
        firebase: "Admin SDK initialized",
        email: "Transporter configured",
        timestamp: new Date().toISOString()
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('🚨 Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
    });
});

// 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`\n🏢 ADMIN ROUTES (No Framework):`);
    console.log(`✅ Admin Login: http://localhost:${PORT}/admin`);
    console.log(`✅ Admin Dashboard: http://localhost:${PORT}/admin/dashboard`);
    console.log(`✅ Pending Approvals: http://localhost:${PORT}/admin/pending`);
    
    console.log(`\n👥 USER ROUTES (With Framework):`);
    console.log(`✅ User Login/Register: http://localhost:${PORT}/`);
    console.log(`✅ Email Verification: http://localhost:${PORT}/verification`);
    console.log(`✅ User Verification: http://localhost:${PORT}/user-verification`);
    
    console.log(`\n🔧 API ENDPOINTS:`);
    console.log(`✅ Health check: http://localhost:${PORT}/health`);
    console.log(`✅ Firebase test: http://localhost:${PORT}/test-firebase`);
    console.log(`✅ Email test: http://localhost:${PORT}/test-email`);
});