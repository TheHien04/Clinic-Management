# 🏥 Clinic Management System - Frontend

Modern React-based frontend application for managing clinic operations including appointments, patients, doctors, and reports.

## 🚀 Tech Stack

- **React 19.1.1** - UI library
- **Vite 7.1.2** - Build tool & dev server
- **Recharts 3.1.2** - Data visualization
- **Ant Design 5.27.3** - UI component library
- **React Icons 5.5.0** - Icon library

## 📦 Installation

```bash
npm install
```

## 🏃 Development

```bash
npm run dev
```

Visit `http://localhost:5173/` to view the application.

## 🔨 Build

```bash
npm run build
```

## 🎨 Features

- **Dashboard**: Overview with KPI stats and charts
- **Appointments**: Schedule management with calendar view
- **Patients**: Patient records with medical history
- **Doctors**: Doctor management with KPI tracking
- **Reports**: Data export and analytics

## 🔐 Demo Login

- Username: `admin@clinic.com`
- Password: `123456`
- OTP: `123456`

## 📝 Project Structure

```
src/
├── components/     # Reusable components
├── contexts/       # React Context providers
├── pages/          # Page components
│   ├── Common.css  # Shared styles
│   ├── Dashboard.jsx
│   ├── Appointments.jsx
│   ├── Patients.jsx
│   ├── Doctors.jsx
│   └── Reports.jsx
└── assets/         # Static assets
```

## ⚙️ Configuration

The app uses custom state-based routing. For production, consider migrating to React Router.

## 🐛 Known Issues

- Using mock data (no backend API connected)
- Custom routing instead of React Router
- localStorage for authentication (not secure for production)

## 📄 License

Part of Advanced Database course project.
