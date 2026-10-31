# Clinic Management System — Frontend

Modern React-based frontend application for managing clinic operations including appointments, patients, doctors, and reports.

## 🚀 Tech Stack

- React 19 and React Router 7
- Vite 7
- Token-based CSS design system and Ant Design
- Recharts for supporting analytics only
- Vitest, Testing Library, and Playwright

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

## Features

- Care operations dashboard and handover workflows
- Appointment, patient, physician, and medical-record management
- Patient portal, notification centre, and hospital portal
- Bioinformatics research workspace and governed analytics
- Role-based routes, API-backed workflows, and real-time events

## Demo access

Credentials are created by the backend seed process. See `../backend/README.md`;
do not commit real credentials to this package.

## 📝 Project Structure

```
src/
├── components/     # Shared UI and interaction components
├── constants/      # Routes, storage keys, and UI constants
├── contexts/       # Authentication and appointment state
├── features/       # Feature-owned reusable modules
├── pages/          # Route-level screens
├── services/       # Backend API and Socket.IO adapters
├── test/           # Test environment setup
└── utils/          # Pure shared utilities
```

## ⚙️ Configuration

Routing uses React Router. Access tokens are tab-scoped in `sessionStorage`; refresh
credentials are issued by the backend as HttpOnly cookies. Preview data is explicitly
labelled and is used only when a screen supports a governed demo fallback.

## Quality checks

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## 📄 License

Part of Advanced Database course project.
