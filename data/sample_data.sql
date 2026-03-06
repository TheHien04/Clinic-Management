USE ClinicDB;

-- Insert clinics
INSERT INTO clinics (clinic_name, address, phone) VALUES
(N'Phòng khám Đa khoa Tân Bình', N'123 Tân Bình,TP.HCM', '0283456789'),
(N'Phòng khám Bệnh viện Quận 1', N'456 Nguyễn Huệ, TP.HCM', '0287654321'),
(N'Phòng khám Y tế Thủ Đức', N'789 Võ Văn Ngân, TP.HCM', '0283338888');

-- Insert specialties
INSERT INTO specialties (specialty_name) VALUES
(N'Nội khoa'),
(N'Ngoại khoa'),
(N'Nhi khoa'),
(N'Da liễu'),
(N'Tim mạch'),
(N'Tiêu hóa');

-- Insert sample employees (doctors)
INSERT INTO employees (fullname, date_of_birth, gender, email, phone, address, type, status) VALUES
(N'BS. Nguyễn Văn A', '1980-05-15', 'Male', 'nguyenvana@clinic.com', '0901234567', N'123 ABC Street', 'D', 'active'),
(N'BS. Trần Thị B', '1985-08-20', 'Female', 'tranthib@clinic.com', '0912345678', N'456 DEF Street', 'D', 'active'),
(N'BS. Lê Văn C', '1982-03-10', 'Male', 'levanc@clinic.com', '0923456789', N'789 GHI Street', 'D', 'active');

-- Insert doctors
INSERT INTO doctors (doctor_id, status)
SELECT emp_id, 'active' FROM employees WHERE type = 'D';

-- Insert doctor specialties
INSERT INTO doctor_specialties (doctor_id, specialty_id)
SELECT d.doctor_id, 1 FROM doctors d WHERE d.doctor_id IN (SELECT emp_id FROM employees WHERE phone = '0901234567');

INSERT INTO doctor_specialties (doctor_id, specialty_id)
SELECT d.doctor_id, 3 FROM doctors d WHERE d.doctor_id IN (SELECT emp_id FROM employees WHERE phone = '0912345678');

INSERT INTO doctor_specialties (doctor_id, specialty_id)
SELECT d.doctor_id, 5 FROM doctors d WHERE d.doctor_id IN (SELECT emp_id FROM employees WHERE phone = '0923456789');

-- Insert sample staff
INSERT INTO employees (fullname, date_of_birth, gender, email, phone, address, type, status) VALUES
(N'Lễ tân Nguyễn Thị D', '1995-01-10', 'Female', 'nguyenthid@clinic.com', '0934567890', N'321 JKL Street', 'S', 'active'),
(N'Kế toán Phạm Văn E', '1990-07-25', 'Male', 'phamvane@clinic.com', '0945678901', N'654 MNO Street', 'S', 'active');

-- Insert staff records
DECLARE @staff1 INT, @staff2 INT;
SELECT @staff1 = emp_id FROM employees WHERE phone = '0934567890';
SELECT @staff2 = emp_id FROM employees WHERE phone = '0945678901';

INSERT INTO staff (staff_id, position, clinic_id) VALUES
(@staff1, 'Receptionist', 1),
(@staff2, 'Accountant', 1);

-- Insert schedules
DECLARE @doctor1 INT, @doctor2 INT, @doctor3 INT;
SELECT @doctor1 = emp_id FROM employees WHERE phone = '0901234567';
SELECT @doctor2 = emp_id FROM employees WHERE phone = '0912345678';
SELECT @doctor3 = emp_id FROM employees WHERE phone = '0923456789';

INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients) VALUES
(@doctor1, 1, 1, '08:00', '12:00', 20), -- Monday morning
(@doctor1, 1, 3, '14:00', '18:00', 15), -- Wednesday afternoon
(@doctor2, 2, 2, '08:00', '12:00', 25), -- Tuesday morning
(@doctor2, 2, 4, '14:00', '18:00', 20), -- Thursday afternoon
(@doctor3, 3, 0, '08:00', '17:00', 30), -- Sunday
(@doctor3, 3, 5, '08:00', '12:00', 15); -- Friday morning

-- Done
SELECT 'Sample data inserted successfully!' AS Result;
SELECT COUNT(*) AS TotalClinics FROM clinics;
SELECT COUNT(*) AS TotalSpecialties FROM specialties;
SELECT COUNT(*) AS TotalDoctors FROM doctors;
SELECT COUNT(*) AS TotalStaff FROM staff;
SELECT COUNT(*) AS TotalSchedules FROM schedules;
