# 🚀 Backend & Frontend Integration Guide

Complete guide to running Clinic Management System with backend API and real-time features.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [Running the Application](#running-the-application)
6. [Testing the Integration](#testing-the-integration)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

Before starting, ensure you have:

- **Node.js** v18+ installed
- **SQL Server** installed and running
- **Git** installed
- **Code editor** (VS Code recommended)

---

## 🗄️ Database Setup

### 1. Connect to SQL Server

Open SQL Server Management Studio (SSMS) or Azure Data Studio.

### 2. Create Database

```sql
CREATE DATABASE ClinicManagement;
GO

USE ClinicManagement;
GO
```

### 3. Run SQL Scripts

Execute SQL scripts in this order:

```bash
# Navigate to Data folder
cd Data

# Run in this sequence:
1. create_csdl_trigger.sql      # Create tables and triggers
2. Specialties_Data.sql          # Insert specialties
3. Doctors_Data.sql              # Insert doctors
4. Patients_Data.sql             # Insert patients
5. Schedules_Data.sql            # Insert schedules
6. Appoinments_Data.sql          # Insert appointments
7. Accounts_Data.sql             # Insert accounts
8. Employees_Data.sql            # Insert employees
9. Staff_Data.sql                # Insert staff
10. Doctor_Specialties_Data.sql  # Insert doctor specialties
```

### 4. Verify Database

```sql
-- Check if tables exist
SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE';

-- Check records
SELECT COUNT(*) as Total FROM Accounts;
SELECT COUNT(*) as Total FROM Patients;
SELECT COUNT(*) as Total FROM Doctors;
SELECT COUNT(*) as Total FROM Appointments;
```

---

## 🔙 Backend Setup

### 1. Navigate to Backend Folder

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- express (Web framework)
- mssql (SQL Server driver)
- jsonwebtoken (JWT authentication)
- bcryptjs (Password hashing)
- socket.io (WebSocket)
- cors, helmet, morgan (Middleware)
- multer (File upload)
- And more...

### 3. Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env
```

Edit `.env` file with your SQL Server credentials:

```env
PORT=5000
NODE_ENV=development

# ⚠️ UPDATE THESE WITH YOUR SQL SERVER CONFIG
DB_SERVER=localhost
DB_NAME=ClinicManagement
DB_USER=sa
DB_PASSWORD=YourActualPassword

DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

JWT_SECRET=clinic_management_secret_key_2026_change_in_production
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=clinic_management_refresh_secret_2026
JWT_REFRESH_EXPIRE=30d

CORS_ORIGIN=http://localhost:5173
MAX_FILE_SIZE=5242880
SOCKET_CORS_ORIGIN=http://localhost:5173
```

### 4. Test Database Connection

Create a test file `test-db.js`:

```javascript
import { getPool } from './src/config/database.js';

async function testConnection() {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT COUNT(*) as count FROM Accounts');
    console.log('✅ Database connected! Accounts:', result.recordset[0].count);
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
```

Run test:
```bash
node test-db.js
```

### 5. Start Backend Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Expected output:
```
✅ Connected to SQL Server database
╔════════════════════════════════════════════════╗
║   🏥 Clinic Management API Server             ║
║                                                ║
║   🚀 Server running on port 5055              ║
║   🌐 Environment: development                  ║
║   📡 API: http://localhost:5055                ║
║   🔌 WebSocket: Enabled                        ║
║                                                ║
║   Documentation: http://localhost:5055/        ║
╚════════════════════════════════════════════════╝
```

### 6. Test API Endpoints

```bash
# Health check
curl http://localhost:5055/api/health

# Should return:
# {"success":true,"message":"Server is running",...}
```

---

## 🎨 Frontend Setup

### 1. Navigate to Frontend Folder

```bash
cd clinic-management
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- react, react-dom (UI library)
- react-router-dom (Routing)
- antd (UI components)
- recharts (Charts)
- axios (HTTP client)
- socket.io-client (WebSocket client)
- And more...

### 3. Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env
```

Edit `.env`:

```env
VITE_API_URL=http://localhost:5055/api
VITE_SOCKET_URL=http://localhost:5055
VITE_ENV=development
```

### 4. Start Frontend Dev Server

```bash
npm run dev
```

Expected output:
```
  VITE v7.1.2  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

---

## 🏃 Running the Application

### Full Stack Startup (Both Frontend & Backend)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd clinic-management
npm run dev
```

### Access Application

Open browser and navigate to:
```
http://localhost:5173
```

### Login Credentials

Use an account that exists in `Accounts` table (or register a new one via API/UI):
```
Email: admin@clinic.com
Password: <your-password>
```

---

## 🧪 Testing the Integration

### 1. Test Authentication

**Login:**
```bash
curl -X POST http://localhost:5055/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinic.com","password":"<your-password>"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {...},
    "token": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

**Register:**
```bash
curl -X POST http://localhost:5055/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"newuser@clinic.com",
    "password":"123456",
    "name":"New User"
  }'
```

### 2. Test Protected Endpoints

Get all appointments (requires token):
```bash
# Replace <TOKEN> with actual JWT token from login
curl http://localhost:5055/api/appointments \
  -H "Authorization: Bearer <TOKEN>"
```

### 3. Test WebSocket Connection

Open browser console and run:
```javascript
// Connect to WebSocket
const socket = io('http://localhost:5055', {
  auth: { token: localStorage.getItem('auth_token') }
});

// Listen for events
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket');
});

socket.on('appointment:created', (data) => {
  console.log('🔔 New appointment:', data);
});

// Subscribe to appointment updates
socket.emit('subscribe:appointments');
```

### 4. Test File Upload

```bash
# Upload single file
curl -X POST http://localhost:5055/api/upload/single \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@/path/to/your/file.jpg"
```

### 5. Test Frontend Features

1. **Login** - Use credentials from database
2. **Dashboard** - Should load with real data
3. **Appointments** - Create, update, delete
4. **Real-time Updates** - Open two browser windows, create appointment in one, see update in other
5. **CSV Export** - Go to Reports page, click export
6. **Error Handling** - Try invalid login, should show error

---

## 🐛 Troubleshooting

### Backend Issues

**❌ Database connection failed**
```
Solution:
1. Check SQL Server is running
2. Verify credentials in .env file
3. Check firewall allows connection
4. Try DB_TRUST_SERVER_CERTIFICATE=true
```

**❌ Port 5055 already in use**
```bash
# Find process using port 5055
lsof -i :5055

# Kill process (macOS/Linux)
kill -9 <PID>

# Or change PORT in .env to 5056
```

**❌ Module not found errors**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Frontend Issues

**❌ API connection failed**
```
Solution:
1. Check backend is running on http://localhost:5055
2. Verify VITE_API_URL in .env
3. Check CORS settings in backend
4. Open browser console for detailed errors
```

**❌ WebSocket not connecting**
```
Solution:
1. Check JWT token in localStorage
2. Verify VITE_SOCKET_URL in .env
3. Check SOCKET_CORS_ORIGIN in backend .env
4. Look for errors in browser console
```

**❌ White screen / no content**
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Common Errors

**CORS Error:**
```
Access to XMLHttpRequest at 'http://localhost:5055/api/...' 
from origin 'http://localhost:5173' has been blocked by CORS
```
Solution: Check `CORS_ORIGIN` in backend `.env` matches frontend URL.

**JWT Token Expired:**
```
{"success":false,"message":"Token expired"}
```
Solution: Login again to get new token. Frontend auto-refresh is implemented.

**SQL Syntax Error:**
```
RequestError: Invalid column name 'X'
```
Solution: Check database schema matches expected structure. Re-run SQL scripts.

---

## 📊 Features Overview

### ✅ Implemented Backend Features

- [x] REST API with Express.js
- [x] SQL Server database connection
- [x] JWT authentication & authorization
- [x] Password hashing with bcrypt
- [x] CRUD operations (Appointments, Patients, Doctors)
- [x] File upload with Multer
- [x] Real-time WebSocket with Socket.IO
- [x] Input validation & sanitization
- [x] Error handling middleware
- [x] CORS & security headers
- [x] Request logging with Morgan
- [x] Token refresh mechanism
- [x] Protected route middleware

### ✅ Implemented Frontend Features

- [x] React Router v6 navigation
- [x] Axios HTTP client with interceptors
- [x] Socket.IO client integration
- [x] AuthContext with real API
- [x] Automatic token refresh
- [x] Error boundaries
- [x] PropTypes validation
- [x] Constants & theming
- [x] CSV export functionality
- [x] File upload utilities
- [x] Backend-authenticated route protection

---

## 🎯 Next Steps

1. **Testing:**
   - Add unit tests (Jest)
   - Add E2E tests (Playwright)
   - Test all API endpoints

2. **Production Deployment:**
   - Setup environment variables
  - Ensure required production vars are set: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `SOCKET_CORS_ORIGIN`, `DB_PASSWORD`
   - Configure SSL/TLS
   - Setup reverse proxy (nginx)
   - Enable production optimizations
   - Setup logging & monitoring

3. **Enhancements:**
   - Add role-based permissions
   - Implement email notifications
   - Add appointment reminders
   - Improve error messages
   - Add loading states

---

## 📚 Documentation

- **Backend API:** http://localhost:5055/ (when server running)
- **Backend README:** `/backend/README.md`
- **Frontend README:** `/frontend/README.md`
- **Improvements Doc:** `/IMPROVEMENTS.md`

---

## 🤝 Support

If you encounter issues:

1. Check logs in terminal
2. Check browser console (F12)
3. Verify all environment variables
4. Ensure database is populated
5. Try restarting both servers

---

**Built with ❤️ by TheHien04**

Last Updated: February 24, 2026
