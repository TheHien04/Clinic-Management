-- ======================================================
-- REPORTING VIEWS FOR CLINIC MANAGEMENT SYSTEM
-- Pre-computed views cho complex queries & reports
-- ======================================================
-- Chạy file này SAU KHI đã tạo tables, indexes và insert data
-- ======================================================

USE ClinicDB;
GO

PRINT '🚀 Bắt đầu tạo views...';
GO

-- ============================================
-- VIEW 1: DOCTOR KPI DASHBOARD
-- Hiển thị performance metrics của từng bác sĩ
-- ============================================

IF OBJECT_ID('vw_DoctorKPI', 'V') IS NOT NULL
    DROP VIEW vw_DoctorKPI;
GO

CREATE VIEW vw_DoctorKPI AS
SELECT 
    e.emp_id AS doctor_id,
    e.fullname AS doctor_name,
    e.email,
    e.phone,
    sp.name AS specialty_name,
    c.name AS clinic_name,
    
    -- Appointment metrics (all time)
    COUNT(DISTINCT a.appointment_id) AS total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.appointment_id END) AS completed_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'cancelled' THEN a.appointment_id END) AS cancelled_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'no-show' THEN a.appointment_id END) AS no_show_appointments,
    COUNT(DISTINCT a.patient_id) AS unique_patients,
    
    -- Financial metrics
    SUM(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment ELSE 0 END) AS total_revenue,
    AVG(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment END) AS avg_revenue_per_appointment,
    
    -- Quality metrics
    AVG(CASE WHEN a.rating IS NOT NULL THEN CAST(a.rating AS FLOAT) END) AS avg_rating,
    COUNT(CASE WHEN a.rating IS NOT NULL THEN 1 END) AS total_ratings,
    
    -- Efficiency metrics (completion rate)
    CASE 
        WHEN COUNT(a.appointment_id) > 0 
        THEN CAST(COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS FLOAT) / COUNT(a.appointment_id) * 100 
        ELSE 0 
    END AS completion_rate_percent,
    
    -- No-show rate
    CASE 
        WHEN COUNT(a.appointment_id) > 0 
        THEN CAST(COUNT(CASE WHEN a.status = 'no-show' THEN 1 END) AS FLOAT) / COUNT(a.appointment_id) * 100 
        ELSE 0 
    END AS no_show_rate_percent
    
FROM employees e
INNER JOIN doctors d ON e.emp_id = d.doctor_id
LEFT JOIN schedules s ON d.doctor_id = s.doctor_id
LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
LEFT JOIN clinics c ON s.clinic_id = c.clinic_id
LEFT JOIN appointments a ON s.schedule_id = a.schedule_id
WHERE e.employee_type = 'D'
GROUP BY e.emp_id, e.fullname, e.email, e.phone, sp.name, c.name, d.salary_per_appointment;
GO

PRINT '✅ Created vw_DoctorKPI';
GO

-- ============================================
-- VIEW 2: PATIENT DETAIL VIEW
-- Thông tin chi tiết bệnh nhân kèm appointment history
-- ============================================

IF OBJECT_ID('vw_PatientDetails', 'V') IS NOT NULL
    DROP VIEW vw_PatientDetails;
GO

CREATE VIEW vw_PatientDetails AS
SELECT 
    p.patient_id,
    p.fullname,
    p.date_of_birth,
    DATEDIFF(YEAR, p.date_of_birth, GETDATE()) AS age,
    p.gender,
    p.phone,
    p.email,
    p.address,
    p.bhyt_info,
    
    -- Account info
    acc.username,
    acc.last_login,
    
    -- Appointment statistics
    COUNT(DISTINCT a.appointment_id) AS total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.appointment_id END) AS completed_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'scheduled' THEN a.appointment_id END) AS upcoming_appointments,
    MAX(a.scheduled_time) AS last_visit_date,
    MIN(a.scheduled_time) AS first_visit_date,
    
    -- Registration info
    p.created_at AS registration_date,
    DATEDIFF(DAY, p.created_at, GETDATE()) AS days_since_registration
    
FROM patients p
LEFT JOIN accounts acc ON p.patient_id = acc.patient_id
LEFT JOIN appointments a ON p.patient_id = a.patient_id
GROUP BY 
    p.patient_id, p.fullname, p.date_of_birth, p.gender, 
    p.phone, p.email, p.address, p.bhyt_info,
    acc.username, acc.last_login, p.created_at;
GO

PRINT '✅ Created vw_PatientDetails';
GO

-- ============================================
-- VIEW 3: APPOINTMENT FULL DETAILS
-- Kết hợp tất cả thông tin appointment
-- ============================================

IF OBJECT_ID('vw_AppointmentDetails', 'V') IS NOT NULL
    DROP VIEW vw_AppointmentDetails;
GO

CREATE VIEW vw_AppointmentDetails AS
SELECT 
    a.appointment_id,
    a.scheduled_time,
    a.status,
    a.service_type,
    a.notes,
    a.rating,
    
    -- Patient info
    p.patient_id,
    p.fullname AS patient_name,
    p.phone AS patient_phone,
    p.email AS patient_email,
    p.date_of_birth AS patient_dob,
    DATEDIFF(YEAR, p.date_of_birth, GETDATE()) AS patient_age,
    p.gender AS patient_gender,
    
    -- Doctor info
    e.emp_id AS doctor_id,
    e.fullname AS doctor_name,
    e.email AS doctor_email,
    e.phone AS doctor_phone,
    sp.name AS specialty_name,
    
    -- Clinic info
    c.clinic_id,
    c.name AS clinic_name,
    c.address AS clinic_address,
    
    -- Schedule info
    s.day_of_week,
    s.start_time,
    s.end_time,
    s.max_patients,
    
    -- Financial
    d.salary_per_appointment AS appointment_fee,
    
    -- Timestamps
    a.created_at,
    a.updated_at
    
FROM appointments a
INNER JOIN patients p ON a.patient_id = p.patient_id
INNER JOIN schedules s ON a.schedule_id = s.schedule_id
INNER JOIN doctors d ON s.doctor_id = d.doctor_id
INNER JOIN employees e ON d.doctor_id = e.emp_id
LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
INNER JOIN clinics c ON s.clinic_id = c.clinic_id;
GO

PRINT '✅ Created vw_AppointmentDetails';
GO

-- ============================================
-- VIEW 4: MONTHLY REVENUE SUMMARY
-- Doanh thu theo tháng/phòng khám/chuyên khoa
-- ============================================

IF OBJECT_ID('vw_MonthlyRevenueSummary', 'V') IS NOT NULL
    DROP VIEW vw_MonthlyRevenueSummary;
GO

CREATE VIEW vw_MonthlyRevenueSummary AS
SELECT 
    YEAR(a.scheduled_time) AS year,
    MONTH(a.scheduled_time) AS month,
    CONVERT(CHAR(7), a.scheduled_time, 126) AS month_str, -- Format: YYYY-MM
    c.name AS clinic_name,
    sp.name AS specialty_name,
    
    -- Appointment counts
    COUNT(DISTINCT a.appointment_id) AS total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.appointment_id END) AS completed_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'cancelled' THEN a.appointment_id END) AS cancelled_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'no-show' THEN a.appointment_id END) AS no_show_appointments,
    
    -- Patient metrics
    COUNT(DISTINCT a.patient_id) AS unique_patients,
    
    -- Revenue metrics
    SUM(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment ELSE 0 END) AS total_revenue,
    AVG(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment END) AS avg_revenue_per_appointment,
    
    -- Doctor metrics
    COUNT(DISTINCT s.doctor_id) AS active_doctors
    
FROM appointments a
INNER JOIN schedules s ON a.schedule_id = s.schedule_id
INNER JOIN doctors d ON s.doctor_id = d.doctor_id
LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
INNER JOIN clinics c ON s.clinic_id = c.clinic_id
GROUP BY YEAR(a.scheduled_time), MONTH(a.scheduled_time), CONVERT(CHAR(7), a.scheduled_time, 126), c.name, sp.name;
GO

PRINT '✅ Created vw_MonthlyRevenueSummary';
GO

-- ============================================
-- VIEW 5: DOCTOR SCHEDULE DETAILS
-- Chi tiết lịch làm việc của bác sĩ
-- ============================================

IF OBJECT_ID('vw_DoctorScheduleDetails', 'V') IS NOT NULL
    DROP VIEW vw_DoctorScheduleDetails;
GO

CREATE VIEW vw_DoctorScheduleDetails AS
SELECT 
    s.schedule_id,
    s.doctor_id,
    e.fullname AS doctor_name,
    sp.name AS specialty_name,
    c.name AS clinic_name,
    c.address AS clinic_address,
    
    s.day_of_week,
    CASE s.day_of_week
        WHEN 1 THEN N'Thứ 2'
        WHEN 2 THEN N'Thứ 3'
        WHEN 3 THEN N'Thứ 4'
        WHEN 4 THEN N'Thứ 5'
        WHEN 5 THEN N'Thứ 6'
        WHEN 6 THEN N'Thứ 7'
        WHEN 7 THEN N'Chủ nhật'
    END AS day_name,
    
    s.start_time,
    s.end_time,
    DATEDIFF(HOUR, s.start_time, s.end_time) AS working_hours,
    s.max_patients,
    
    -- Manager info (if exists)
    mgr.fullname AS manager_name,
    
    s.created_at
    
FROM schedules s
INNER JOIN doctors d ON s.doctor_id = d.doctor_id
INNER JOIN employees e ON d.doctor_id = e.emp_id
LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
INNER JOIN clinics c ON s.clinic_id = c.clinic_id
LEFT JOIN employees mgr ON s.manager_id = mgr.emp_id;
GO

PRINT '✅ Created vw_DoctorScheduleDetails';
GO

-- ============================================
-- VIEW 6: PATIENT APPOINTMENT HISTORY
-- Lịch sử khám bệnh của bệnh nhân
-- ============================================

IF OBJECT_ID('vw_PatientAppointmentHistory', 'V') IS NOT NULL
    DROP VIEW vw_PatientAppointmentHistory;
GO

CREATE VIEW vw_PatientAppointmentHistory AS
SELECT 
    p.patient_id,
    p.fullname AS patient_name,
    
    a.appointment_id,
    a.scheduled_time,
    a.status,
    a.service_type,
    a.notes,
    a.rating,
    
    e.fullname AS doctor_name,
    sp.name AS specialty_name,
    c.name AS clinic_name,
    c.address AS clinic_address,
    
    d.salary_per_appointment AS fee_paid,
    
    -- Days since last visit
    DATEDIFF(DAY, a.scheduled_time, GETDATE()) AS days_since_visit,
    
    a.created_at AS appointment_created_at
    
FROM patients p
INNER JOIN appointments a ON p.patient_id = a.patient_id
INNER JOIN schedules s ON a.schedule_id = s.schedule_id
INNER JOIN doctors d ON s.doctor_id = d.doctor_id
INNER JOIN employees e ON d.doctor_id = e.emp_id
LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
INNER JOIN clinics c ON s.clinic_id = c.clinic_id;
GO

PRINT '✅ Created vw_PatientAppointmentHistory';
GO

-- ============================================
-- VIEW 7: CLINIC STATISTICS
-- Thống kê theo từng phòng khám
-- ============================================

IF OBJECT_ID('vw_ClinicStatistics', 'V') IS NOT NULL
    DROP VIEW vw_ClinicStatistics;
GO

CREATE VIEW vw_ClinicStatistics AS
SELECT 
    c.clinic_id,
    c.name AS clinic_name,
    c.address,
    c.opening_hours,
    c.status,
    
    -- Doctor count
    COUNT(DISTINCT s.doctor_id) AS total_doctors,
    
    -- Schedule count
    COUNT(DISTINCT s.schedule_id) AS total_schedules,
    
    -- Appointment metrics
    COUNT(DISTINCT a.appointment_id) AS total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.appointment_id END) AS completed_appointments,
    
    -- Patient metrics
    COUNT(DISTINCT a.patient_id) AS unique_patients,
    
    -- Revenue
    SUM(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment ELSE 0 END) AS total_revenue,
    
    -- Staff count
    COUNT(DISTINCT st.staff_id) AS total_staff
    
FROM clinics c
LEFT JOIN schedules s ON c.clinic_id = s.clinic_id
LEFT JOIN doctors d ON s.doctor_id = d.doctor_id
LEFT JOIN appointments a ON s.schedule_id = a.schedule_id
LEFT JOIN staff st ON c.clinic_id = st.clinic_id
GROUP BY c.clinic_id, c.name, c.address, c.opening_hours, c.status;
GO

PRINT '✅ Created vw_ClinicStatistics';
GO

-- ============================================
-- SAMPLE QUERIES (để test views)
-- ============================================

PRINT '';
PRINT '📝 Sample queries to test views:';
PRINT '';
PRINT '-- Top 10 doctors by revenue:
SELECT TOP 10 doctor_name, specialty_name, total_revenue, completion_rate_percent 
FROM vw_DoctorKPI 
ORDER BY total_revenue DESC;';
PRINT '';
PRINT '-- Recent appointments:
SELECT TOP 20 patient_name, doctor_name, scheduled_time, status, clinic_name 
FROM vw_AppointmentDetails 
ORDER BY scheduled_time DESC;';
PRINT '';
PRINT '-- Monthly revenue trend:
SELECT month_str, clinic_name, total_revenue, completed_appointments 
FROM vw_MonthlyRevenueSummary 
ORDER BY month_str DESC, total_revenue DESC;';
PRINT '';
PRINT '-- Patients with most appointments:
SELECT TOP 10 fullname, total_appointments, completed_appointments, last_visit_date 
FROM vw_PatientDetails 
ORDER BY total_appointments DESC;';
PRINT '';
PRINT '-- Clinic performance comparison:
SELECT clinic_name, total_doctors, total_appointments, total_revenue 
FROM vw_ClinicStatistics 
ORDER BY total_revenue DESC;';
GO

PRINT '✨ ============================================';
PRINT '✅ All views created successfully!';
PRINT '📊 7 reporting views ready for queries';
PRINT '💡 Tip: Use these views in your frontend for dashboards';
PRINT '============================================';
GO
