import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import emailAuthRoutes from './routes/emailAuth.js';
import registrationAuthRoutes from './routes/registrationAuth.js';
import adminUserCreationRoutes from './routes/adminUserCreation.js';
import pendingRegistrationsRoutes from './routes/pendingRegistrations.js';
import applicationsRoutes from './routes/applications.js';
import serviceRoutes from './routes/services.js';
import purposesRoutes from './routes/purposes.js';
import registrationsRoutes from './routes/registrations.js';
import usersRoutes from './routes/users.js';
import notificationsRoutes from './routes/notifications.js';
import profileRoutes from './routes/profile.js';
import documentsRoutes from './routes/documents.js';
import genealogyRoutes from './routes/genealogy.js';
import pdfRoutes from './routes/pdf.js';
import uploadsRoutes from './routes/uploads.js';
import adminReviewRoutes from './routes/adminReview.js';
import adminProfileRoutes from './routes/adminProfile.js';
// import certificatesRoutes from './routes/certificates.js'; // Temporarily disabled
import initializeScheduler from './jobs/scheduler.js';
import { autoCancelOverdueApplications, sendDeadlineWarnings } from './jobs/autoCancelApplications.js';

dotenv.config({ path: './.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Allow network access
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173',
    'https://ncip-frontend-3w3ofutw5-cheycss-projects.vercel.app', // Old Vercel URL
    'https://ncip-frontend.vercel.app', // New Production Vercel URL
    /^https:\/\/ncip-frontend.*\.vercel\.app$/, // Allow any Vercel deployment
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/, // Allow any 192.168.x.x:3000
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/, // Allow any 192.168.x.x:5173
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$/, // Allow any 10.x.x.x:3000
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/, // Allow any 10.x.x.x:5173
    /^http:\/\/172\.16\.\d{1,3}\.\d{1,3}:3000$/, // Allow any 172.16.x.x:3000
    /^http:\/\/172\.16\.\d{1,3}\.\d{1,3}:5173$/ // Allow any 172.16.x.x:5173
  ],
  credentials: true
}));
// Increase payload limit for file uploads (birth certificates, avatars, etc.)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/email-auth', emailAuthRoutes);
app.use('/api/registration-auth', registrationAuthRoutes);
app.use('/api/admin-users', adminUserCreationRoutes);
app.use('/api/pending-registrations', pendingRegistrationsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/purposes', purposesRoutes);
app.use('/api/registrations', registrationsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/genealogy', genealogyRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/admin', adminReviewRoutes);
app.use('/api/admin', adminProfileRoutes);
// app.use('/api/applications', certificatesRoutes); // Temporarily disabled

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'NCIP Backend Server is running',
    timestamp: new Date().toISOString()
  });
});

// Test endpoints for cron jobs (can remove in production)
app.get('/api/test/auto-cancel', async (req, res) => {
  try {
    console.log('🧪 Manual test: Auto-cancel overdue applications');
    const result = await autoCancelOverdueApplications();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/test/deadline-warnings', async (req, res) => {
  try {
    console.log('🧪 Manual test: Send deadline warnings');
    const result = await sendDeadlineWarnings();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: err.message
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;