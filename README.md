# 🏥 Clinic Management System  

A **database-driven application** developed as part of the *Advanced Database* course.  
This project demonstrates how advanced database concepts can be applied in a real-world clinic scenario, focusing on:  

- Normalization and structured schema design  
- Indexing and query optimization for performance  
- Stored procedures and triggers for automation  
- Secure authentication and patient data management  

The system manages core clinic operations including **patients, doctors, appointments, treatments, and billing**.  

---

## 🚀 Features  

- **Authentication & Security**  
  - User registration, login, and OTP verification  
  - Role-based access (Admin, Doctor, Staff)  

- **Dashboard**  
  - Centralized overview of patients, doctors, and appointments  

- **Patient Management**  
  - Add, edit, and search patient records  
  - Track medical history  

- **Doctor Management**  
  - Maintain doctor profiles & schedules  
  - Review & feedback system  

- **Appointment Management**  
  - Book and manage appointments  
  - Appointment status tracking (pending, confirmed, completed)  

- **Reports & Analytics**  
  - Generate activity and financial reports  
  - Extendable for data export  

- **User Experience (React + Vite)**  
  - Modular components (`Appointments`, `Doctors`, `Patients`, `Reports`, `Dashboard`)  
  - Context API for state management  
  - Styled with modular CSS for a clean, modern UI  

---

## 📦 Tech Stack  

- **Frontend:** React, Vite, Context API, CSS Modules  
- **Backend:** API/Database integration (configurable)  
- **Other Tools:** Node.js, npm  

---

## 📸 Demo Flow  

Below is the **end-user flow**, showing how a clinic staff member interacts with the system.  
All screenshots are centered for clarity.  

### 1. Authentication & Access  

<p align="center">
  <img src="Image/Login.png" alt="Login" width="600"/>
</p>

<p align="center">
  <img src="Image/OTP.png" alt="OTP Verification" width="600"/>
</p>

<p align="center">
  <img src="Image/Register.png" alt="Register" width="600"/>
</p>

---

### 2. Dashboard & Navigation  

<p align="center">
  <img src="Image/Dashboard.png" alt="Dashboard" width="700"/>
</p>

<p align="center">
  <img src="Image/Help.png" alt="Help" width="400"/>  
  <img src="Image/Settings.png" alt="Settings" width="400"/>
</p>

---

### 3. Patient Management  

<p align="center">
  <img src="Image/Add%20patient.png" alt="Add Patient" width="500"/>
</p>

<p align="center">
  <img src="Image/Edit%20Patient.png" alt="Edit Patient" width="500"/>
</p>

<p align="center">
  <img src="Image/View%20patients.png" alt="View Patients" width="600"/>
</p>

<p align="center">
  <img src="Image/Patients.png" alt="Patients List" width="600"/>
</p>

---

### 4. Doctor Management  

<p align="center">
  <img src="Image/Add%20Doctor.png" alt="Add Doctor" width="500"/>
</p>

<p align="center">
  <img src="Image/Edit%20Doctor.png" alt="Edit Doctor" width="500"/>
</p>

<p align="center">
  <img src="Image/Doctors.png" alt="Doctors" width="600"/>
</p>

<p align="center">
  <img src="Image/Schedule%20for%20Dr.Anna.png" alt="Doctor Schedule" width="600"/>
</p>

<p align="center">
  <img src="Image/Reviews%20doctor.png" alt="Doctor Review" width="600"/>
</p>

---

### 5. Appointment Management  

<p align="center">
  <img src="Image/Appointments.png" alt="Appointments Overview" width="600"/>
</p>

<p align="center">
  <img src="Image/Appointments%20Details.png" alt="Appointment Details" width="600"/>
</p>

<p align="center">
  <img src="Image/Book%20new%20appointment.png" alt="Book Appointment" width="600"/>
</p>

---

### 6. Reports & Feedback  

<p align="center">
  <img src="Image/Reports.png" alt="Reports" width="600"/>
</p>

<p align="center">
  <img src="Image/Feedback.png" alt="Feedback" width="600"/>
</p>

---

## ⚙️ How to Run  

1. **Clone the repository**  
   ```bash
   git clone https://github.com/your-username/Clinic-Management.git
   cd Clinic-Management
2. **Install dependencies**
  npm install
3. **Start development server**
  npm run dev
4. **Build for production**
  npm run build
