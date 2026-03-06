# Clinic Management Backend API

Backend API server for Clinic Management System built with Express.js, SQL Server, and Socket.IO.

## 🚀 Features

- ✅ RESTful API with Express.js
- ✅ SQL Server database integration
- ✅ JWT authentication & authorization
- ✅ File upload with Multer
- ✅ Real-time updates with Socket.IO
- ✅ Input validation & sanitization
- ✅ Error handling & logging
- ✅ CORS enabled
- ✅ Security headers with Helmet

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Database & JWT configuration
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Custom middleware
│   ├── routes/          # API routes
│   ├── socket/          # WebSocket handlers
│   ├── utils/           # Utility functions
│   └── server.js        # Main entry point
├── uploads/             # File upload directory
├── .env.example         # Environment variables template
├── .gitignore
└── package.json
```

## 🛠️ Installation

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
PORT=5000
DB_SERVER=localhost
DB_NAME=ClinicManagement
DB_USER=sa
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
```

3. **Start the server:**
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user profile

### Appointments
- `GET /api/appointments` - Get all appointments
- `GET /api/appointments/:id` - Get appointment by ID
- `POST /api/appointments` - Create new appointment
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment

### Patients
- `GET /api/patients` - Get all patients
- `GET /api/patients/:id` - Get patient by ID
- `GET /api/patients/:id/history` - Get patient appointment history
- `POST /api/patients` - Create new patient
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

### Doctors
- `GET /api/doctors` - Get all doctors
- `GET /api/doctors/:id` - Get doctor by ID
- `GET /api/doctors/:id/schedule` - Get doctor schedule
- `POST /api/doctors` - Create new doctor
- `PUT /api/doctors/:id` - Update doctor
- `DELETE /api/doctors/:id` - Delete doctor

### File Upload
- `POST /api/upload/single` - Upload single file
- `POST /api/upload/multiple` - Upload multiple files

## 🔌 WebSocket Events

Connect to Socket.IO with JWT token:
```javascript
const socket = io('http://localhost:5000', {
  auth: { token: 'your_jwt_token' }
});
```

### Events to Subscribe:
- `subscribe:appointments` - Subscribe to appointment updates
- `unsubscribe:appointments` - Unsubscribe from appointments

### Events to Listen:
- `appointment:created` - New appointment created
- `appointment:updated` - Appointment updated
- `appointment:deleted` - Appointment deleted
- `notification` - User-specific notification
- `broadcast` - Global broadcast message

## 🔐 Authentication

All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## 📝 Example Requests

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "123456",
    "name": "John Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "123456"
  }'
```

### Create Appointment
```bash
curl -X POST http://localhost:5000/api/appointments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": 1,
    "doctorId": 1,
    "appointmentDate": "2026-03-01",
    "appointmentTime": "10:00:00",
    "notes": "Regular checkup"
  }'
```

## 🛡️ Security Features

- Password hashing with bcryptjs
- JWT token authentication
- Input validation & sanitization
- SQL injection prevention
- CORS configuration
- Helmet security headers
- File upload restrictions

## 📊 Database Schema

The API expects SQL Server database with these tables:
- `Accounts` - User accounts
- `Patients` - Patient records
- `Doctors` - Doctor profiles
- `Specialties` - Medical specialties
- `Appointments` - Appointment bookings
- `Schedules` - Doctor schedules

See `/Data` folder for SQL scripts.

## 🐛 Error Handling

All errors return JSON format:
```json
{
  "success": false,
  "message": "Error description",
  "stack": "Stack trace (development only)"
}
```

## 🧪 Testing

Health check endpoint:
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-02-24T...",
  "uptime": 123.45
}
```

## 📄 License

MIT License - See LICENSE file for details

## 👨‍💻 Author

TheHien04
