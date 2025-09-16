# Clinic Management System  

A **database-driven application** developed for the *Advanced Database* course.  
This project demonstrates how advanced database concepts can be applied in a real-world clinic scenario, focusing on:  
- Normalization and structured schema design  
- Indexing and query optimization for performance  
- Stored procedures and triggers for automation  
- Secure authentication and patient data management  

The result is a prototype system that manages core clinic operations such as patients, doctors, appointments, treatments, and billing.  

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
  - Clinic activity reports & financial overview  
  - Extendable for future data exports  

- **User Experience (React + Vite)**  
  - Modular components (`Appointments`, `Doctors`, `Patients`, `Reports`, `Dashboard`)  
  - Context API for state management  
  - Styled with modular CSS for a clean, modern UI  

---

## 📦 Tech Stack  

- **Frontend:** React, Vite, Context API, CSS Modules  
- **Backend:** (API/Database integration – configurable)  
- **Other Tools:** Node.js, npm  

---

## 📸 Demo Flow  

Below is the system demo from the **end-user perspective**, illustrating how a clinic staff member interacts with the system step by step.  

### 1. Authentication & Access  
- **Login**  
  ![Login](Image/Login.png)  
- **OTP Verification**  
  ![OTP](Image/OTP.png)  
- **Register a New Account**  
  ![Register](Image/Register.png)  

---

### 2. Dashboard & Navigation  
- **Main Dashboard** – Centralized overview of patients, doctors, and appointments.  
  ![Dashboard](Image/Dashboard.png)  
- **Help & Settings** – Access user support and customize settings.  
  ![Help](Image/Help.png)  
  ![Settings](Image/Settings.png)  

---

### 3. Patient Management  
- **Add a New Patient**  
  ![Add Patient](Image/Add%20patient.png)  
- **Edit Patient Information**  
  ![Edit Patient](Image/Edit%20Patient.png)  
- **View Patient Records**  
  ![View Patients](Image/View%20patients.png)  
- **Patients List**  
  ![Patients](Image/Patients.png)  

---

### 4. Doctor Management  
- **Add a New Doctor**  
  ![Add Doctor](Image/Add%20Doctor.png)  
- **Edit Doctor Profile**  
  ![Edit Doctor](Image/Edit%20Doctor.png)  
- **View Doctors**  
  ![Doctors](Image/Doctors.png)  
- **Doctor Schedule Example (Dr. Anna)**  
  ![Schedule](Image/Schedule%20for%20Dr.Anna.png)  
- **Doctor Review**  
  ![Review Doctor](Image/Reviews%20doctor.png)  

---

### 5. Appointment Management  
- **Appointments Overview**  
  ![Appointments](Image/Appointments.png)  
- **Appointment Details**  
  ![Appointment Details](Image/Appointments%20Details.png)  
- **Book a New Appointment**  
  ![Book Appointment](Image/Book%20new%20appointment.png)  

---

### 6. Reports & Feedback  
- **Reports** – Generate clinic activity reports.  
  ![Reports](Image/Reports.png)  
- **Feedback** – Collect patient and doctor feedback for improvements.  
  ![Feedback](Image/Feedback.png)  

---

## ⚙️ How to Run  

1. Clone the repository:  
   ```bash
   git clone https://github.com/your-username/Clinic-Management.git
   cd Clinic-Management
2. Start development server:
npm run dev
3. npm run build
npm run build
