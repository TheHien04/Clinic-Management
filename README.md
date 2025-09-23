# 🏥 Clinic Management System  

A **database-driven application** developed as part of the *Advanced Database* course.  
This project demonstrates how advanced database concepts can be applied in a real-world clinic scenario, focusing on:  

- **Normalization** and structured schema design  
- **Indexing & query optimization** for performance  
- **Stored procedures & triggers** for automation  
- **Secure authentication** and patient data management  

The system manages clinic operations including **patients, doctors, appointments, treatments, and billing**.  

---

## 🚀 Features  

- **Authentication & Security**  
  - User registration, login, and OTP verification  
  - Role-based access (Admin, Doctor, Staff)  
  - Secure password hashing  

- **Dashboard**  
  - Centralized overview of patients, doctors, and appointments  

- **Patient Management**  
  - Add, edit, search patient records  
  - Track medical history  

- **Doctor Management**  
  - Maintain doctor profiles & schedules  
  - Review & feedback system  

- **Appointment Management**  
  - Book and manage appointments  
  - Track status (pending, confirmed, completed)  

- **Reports & Analytics**  
  - Activity and financial reports  
  - Extendable for export  

- **User Experience (React + Vite)**  
  - Modular components (Appointments, Doctors, Patients, Reports, Dashboard)  
  - Context API for state management  
  - Styled with modular CSS for a clean, modern UI  

---

## 📦 Tech Stack  

- **Frontend:** React, Vite, Context API, CSS Modules  
- **Backend:** API/Database integration (configurable)  
- **Database:** Microsoft SQL Server
- **Other Tools:** Node.js, npm  

---

## 📸 Demo Flow  

Below is the **end-user flow**, showing how a clinic staff member interacts with the system.  
All screenshots are centered for clarity.  

### 1. Authentication & Access  

<p align="center">
  <img src="Image/Login.png" alt="Login" width="600"/>
</p>
<p align="center"><em>Login screen with secure authentication</em></p>

<p align="center">
  <img src="Image/OTP.png" alt="OTP Verification" width="600"/>
</p>
<p align="center"><em>OTP verification for two-factor security</em></p>

<p align="center">
  <img src="Image/Register.png" alt="Register" width="600"/>
</p>
<p align="center"><em>User registration form with role-based setup</em></p>

---

### 2. Dashboard & Navigation  

<p align="center">
  <img src="Image/Dashboard.png" alt="Dashboard" width="700"/>
</p>
<p align="center"><em>Centralized dashboard overview with quick access</em></p>

<p align="center">
  <img src="Image/Help.png" alt="Help" width="400"/>  
  <img src="Image/Settings.png" alt="Settings" width="400"/>
</p>
<p align="center"><em>Help and Settings modules for system customization</em></p>

---

### 3. Patient Management  

<p align="center">
  <img src="Image/Add%20patient.png" alt="Add Patient" width="500"/>
</p>
<p align="center"><em>Form to add new patients</em></p>

<p align="center">
  <img src="Image/Edit%20Patient.png" alt="Edit Patient" width="500"/>
</p>
<p align="center"><em>Edit patient information</em></p>

<p align="center">
  <img src="Image/View%20patients.png" alt="View Patients" width="600"/>
</p>
<p align="center"><em>View detailed patient records</em></p>

<p align="center">
  <img src="Image/Patients.png" alt="Patients List" width="600"/>
</p>
<p align="center"><em>List of all registered patients</em></p>

---

### 4. Doctor Management  

<p align="center">
  <img src="Image/Add%20Doctor.png" alt="Add Doctor" width="500"/>
</p>
<p align="center"><em>Form to add a new doctor</em></p>

<p align="center">
  <img src="Image/Edit%20Doctor.png" alt="Edit Doctor" width="500"/>
</p>
<p align="center"><em>Edit doctor details</em></p>

<p align="center">
  <img src="Image/Doctors.png" alt="Doctors" width="600"/>
</p>
<p align="center"><em>Doctors list view</em></p>

<p align="center">
  <img src="Image/Schedule%20for%20Dr.Anna.png" alt="Doctor Schedule" width="600"/>
</p>
<p align="center"><em>Schedule management for doctors</em></p>

<p align="center">
  <img src="Image/Reviews%20doctor.png" alt="Doctor Review" width="600"/>
</p>
<p align="center"><em>Doctor review and rating system</em></p>

---

### 5. Appointment Management  

<p align="center">
  <img src="Image/Appointments.png" alt="Appointments Overview" width="600"/>
</p>
<p align="center"><em>Overview of all appointments</em></p>

<p align="center">
  <img src="Image/Appointments%20Details.png" alt="Appointment Details" width="600"/>
</p>
<p align="center"><em>Detailed view of a specific appointment</em></p>

<p align="center">
  <img src="Image/Book%20new%20appointment.png" alt="Book Appointment" width="600"/>
</p>
<p align="center"><em>Form to book a new appointment</em></p>

---

### 6. Reports & Feedback  

<p align="center">
  <img src="Image/Reports.png" alt="Reports" width="600"/>
</p>
<p align="center"><em>Generate and view reports</em></p>

<p align="center">
  <img src="Image/Feedback.png" alt="Feedback" width="600"/>
</p>
<p align="center"><em>User feedback collection</em></p>

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

## 🚀 Future Improvements

📌 Multi-language support

📌 Audit logs for all DB operations

📌 Integration with cloud database (AWS RDS / Azure SQL)

📌 Role-based dashboards with analytics (BI integration)

📌 ETL pipeline to support Data Warehouse for reporting
