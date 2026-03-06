-- Sử dụng database ClinicDB
USE ClinicDB;

-- Bảng 1: patients (Bệnh nhân)
CREATE TABLE patients (
    patient_id INT IDENTITY(1,1) PRIMARY KEY,
    fullname NVARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender NVARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    address NVARCHAR(MAX),
    phone NVARCHAR(20) UNIQUE NOT NULL,
    email NVARCHAR(255) UNIQUE,
    bhyt_info NVARCHAR(20) UNIQUE,
    created_at DATETIME2 DEFAULT GETDATE()
);

-- Bảng 2: accounts (Tài khoản bệnh nhân)
CREATE TABLE accounts (
    account_id INT IDENTITY(1,1) PRIMARY KEY,
    patient_id INT UNIQUE NOT NULL,
    username NVARCHAR(255) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    last_login DATETIME2,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_account_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(patient_id)
        ON DELETE CASCADE
);

-- Bảng 3: specialties (Chuyên khoa)
CREATE TABLE specialties (
    specialty_id INT IDENTITY(1,1) PRIMARY KEY,
    specialty_name NVARCHAR(100) UNIQUE NOT NULL
);

-- Bảng 4: employees (Nhân viên - Supertype)
CREATE TABLE employees (
    emp_id INT IDENTITY(1,1) PRIMARY KEY,
    fullname NVARCHAR(255) NOT NULL,
    date_of_birth DATE,
    gender NVARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other')),
    email NVARCHAR(255) UNIQUE,
    phone NVARCHAR(20) NOT NULL,
    address NVARCHAR(MAX),
    type CHAR(1) NOT NULL CHECK (type IN ('D', 'S')),
    status NVARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);

-- Bảng 5: clinics (Phòng khám)
CREATE TABLE clinics (
    clinic_id INT IDENTITY(1,1) PRIMARY KEY,
    clinic_name NVARCHAR(255) UNIQUE NOT NULL,
    address NVARCHAR(255) NOT NULL,
    phone NVARCHAR(20)
);

-- Bảng 6: doctors (Bác sĩ - Subtype)
CREATE TABLE doctors (
    doctor_id INT PRIMARY KEY,
    status NVARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')) NOT NULL,
    CONSTRAINT fk_doctor_employee
        FOREIGN KEY (doctor_id)
        REFERENCES employees(emp_id)
        ON DELETE CASCADE
);

-- Bảng 7: doctor_specialties (Quan hệ Bác sĩ - Chuyên khoa)
CREATE TABLE doctor_specialties (
    doctor_id INT NOT NULL,
    specialty_id INT NOT NULL,
    PRIMARY KEY (doctor_id, specialty_id),
    CONSTRAINT fk_doctorspec_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_doctorspec_specialty
        FOREIGN KEY (specialty_id)
        REFERENCES specialties(specialty_id)
        ON DELETE CASCADE
);

-- Bảng 8: staff (Nhân viên hành chính - Subtype)
CREATE TABLE staff (
    staff_id INT PRIMARY KEY,
    position NVARCHAR(100) NOT NULL CHECK (position IN ('Receptionist', 'Accountant', 'Manager', 'Other')),
    clinic_id INT,
    CONSTRAINT fk_staff_employee
        FOREIGN KEY (staff_id)
        REFERENCES employees(emp_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_staff_clinic
        FOREIGN KEY (clinic_id)
        REFERENCES clinics(clinic_id)
);

-- Bảng 9: schedules (Lịch làm việc)
CREATE TABLE schedules (
    sche_id INT IDENTITY(1,1) PRIMARY KEY,
    doctor_id INT NOT NULL,
    clinic_id INT NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_patients INT NOT NULL CHECK (max_patients > 0),
    CONSTRAINT fk_schedule_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id),
    CONSTRAINT fk_schedule_clinic
        FOREIGN KEY (clinic_id)
        REFERENCES clinics(clinic_id),
    CONSTRAINT chk_end_time_after_start 
        CHECK (end_time > start_time)
);

-- Bảng 10: appointments (Lịch hẹn)
CREATE TABLE appointments (
    app_id INT IDENTITY(1,1) PRIMARY KEY,
    patient_id INT NOT NULL,
    sche_id INT NOT NULL,
    app_date DATE NOT NULL,
    app_time TIME NOT NULL,
    status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'booked', 'confirmed', 'cancelled', 'completed', 'checked-in')) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_appointment_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(patient_id),
    CONSTRAINT fk_appointment_schedule
        FOREIGN KEY (sche_id)
        REFERENCES schedules(sche_id)
);

-- Bảng 11: medical_records (Hồ sơ bệnh án)
CREATE TABLE medical_records (
    record_id INT IDENTITY(1,1) PRIMARY KEY,
    app_id INT UNIQUE NOT NULL,
    diagnosis_code NVARCHAR(50) NOT NULL,
    prescription NVARCHAR(MAX),
    notes NVARCHAR(MAX),
    follow_up_date DATE,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_medicalrecord_appointment
        FOREIGN KEY (app_id)
        REFERENCES appointments(app_id)
        ON DELETE CASCADE
);

-- Bảng 12: salary_records (Bảng lương tổng)
CREATE TABLE salary_records (
    salary_record_id INT IDENTITY(1,1) PRIMARY KEY,
    emp_id INT NOT NULL,
    month DATE NOT NULL,
    total_salary DECIMAL(15, 2) NOT NULL CHECK (total_salary >= 0),
    calculated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_salaryrecord_employee
        FOREIGN KEY (emp_id)
        REFERENCES employees(emp_id)
        ON DELETE CASCADE
);

-- Bảng 13: doctor_salary_records (Chi tiết lương bác sĩ)
CREATE TABLE doctor_salary_records (
    salary_record_id INT PRIMARY KEY,
    appointment_count INT NOT NULL CHECK (appointment_count >= 0),
    base_salary DECIMAL(15, 2) NOT NULL,
    bonus DECIMAL(15, 2) DEFAULT 0,
    CONSTRAINT fk_doctorsalary_salaryrecord
        FOREIGN KEY (salary_record_id)
        REFERENCES salary_records(salary_record_id)
        ON DELETE CASCADE
);

-- Bảng 14: staff_salary_records (Chi tiết lương nhân viên)
CREATE TABLE staff_salary_records (
    salary_record_id INT PRIMARY KEY,
    base_salary DECIMAL(15, 2) NOT NULL,
    kpi_allowance DECIMAL(15, 2) DEFAULT 0,
    CONSTRAINT fk_staffsalary_salaryrecord
        FOREIGN KEY (salary_record_id)
        REFERENCES salary_records(salary_record_id)
        ON DELETE CASCADE
);
