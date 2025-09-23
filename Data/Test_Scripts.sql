USE ClinicDB
GO

-- show object quick check
SELECT name, type_desc FROM sys.objects WHERE name IN (
 'patients','employees','clinics','staff','schedules','appointments','medical_records',
 'salary_records','doctors','doctor_specialties','doctor_salary_records','staff_salary_records'
);

-- show triggers
SELECT name, object_id FROM sys.triggers;

-- show procedures
SELECT name FROM sys.procedures WHERE name = 'CalculateSalariesForMonth';


--- Test functions IsValidEmail, IsValidPhone ---
-- 1. Test functions
SELECT dbo.IsValidEmail('abc@domain.com') AS ok_email1;   -- expect 1
SELECT dbo.IsValidEmail('bad-email') AS ok_email2;        -- expect 0

SELECT dbo.IsValidPhone('0123456789') AS ok_phone1;       -- expect 1
SELECT dbo.IsValidPhone('+84123456789') AS ok_phone2;     -- expect 1
SELECT dbo.IsValidPhone('12-34') AS ok_phone3;            -- expect 0


--- Test UNIQUE / NOT NULL / CHECK (patients) ---

BEGIN TRANSACTION;
PRINT '--- TEST UNIQUE/NOT NULL/CHECK for patients ---';

-- Positive insert
INSERT INTO patients (fullname, date_of_birth, gender, phone)
VALUES ('Test A','1990-01-01','Male','0900000001');

-- Negative: duplicate phone -> expect error
BEGIN TRY
    INSERT INTO patients (fullname, date_of_birth, gender, phone)
    VALUES ('Test B','1991-01-01','Female','0900000001');
    PRINT 'ERROR: duplicate phone inserted (unexpected)';
END TRY
BEGIN CATCH
    PRINT 'Expected unique violation: ' + ERROR_MESSAGE();
END CATCH;

-- Negative: invalid gender -> expect error
BEGIN TRY
    INSERT INTO patients (fullname, date_of_birth, gender, phone)
    VALUES ('Test C','1992-01-01','InvalidGender','0900000002');
    PRINT 'ERROR: invalid gender inserted (unexpected)';
END TRY
BEGIN CATCH
    PRINT 'Expected check constraint error: ' + ERROR_MESSAGE();
END CATCH;

ROLLBACK;


--- Test FK + IDENTITY: chèn clinic + employee + staff ---
BEGIN TRANSACTION;
PRINT '--- TEST single insert with SCOPE_IDENTITY ---';

-- Insert clinic (1 row)
INSERT INTO clinics (name, address, opening_hours, status)
VALUES ('Clinic Test 1','Addr Test 1','9-17','active');

DECLARE @clinicId INT = SCOPE_IDENTITY();
PRINT 'clinicId=' + CAST(@clinicId AS VARCHAR(10));

-- Insert employee (single)
INSERT INTO employees (fullname, email, phone, address, employee_type)
VALUES ('Emp Test','emp@test.com','0910000000','AddrEmp','S');

DECLARE @empId INT = SCOPE_IDENTITY();
PRINT 'empId=' + CAST(@empId AS VARCHAR(10));

-- Insert staff referencing clinicId
INSERT INTO staff (staff_id, position, base_salary, clinic_id)
VALUES (@empId, 'Receptionist', 4000000, @clinicId);

-- Verify
SELECT s.*, e.fullname, c.name as clinic_name
FROM staff s
JOIN employees e ON s.staff_id = e.emp_id
JOIN clinics c ON s.clinic_id = c.clinic_id
WHERE s.staff_id = @empId;

ROLLBACK;


--- Test Multi-row insert và mapping IDs bằng OUTPUT ---
-- Mục đích: chèn nhiều clinics & employees, map IDENTITY với temp_id bằng bảng tạm.

BEGIN TRANSACTION;
PRINT '--- FIX: multi-row insert + OUTPUT mapping using MERGE (and add doctors test) ---';

------------------------------------------------------------------
-- 1) Clinics: dùng MERGE để lấy map (tmp -> clinic_id)
------------------------------------------------------------------
DECLARE @ClinicsInput TABLE (
  tmp INT IDENTITY(1,1),
  name NVARCHAR(255),
  address NVARCHAR(255)
);
INSERT INTO @ClinicsInput (name,address)
VALUES (N'Clinic Bulk A', N'Addr A'),
       (N'Clinic Bulk B', N'Addr B'),
       (N'Clinic Bulk C', N'Addr C');

DECLARE @ClinicMap TABLE (tmp INT, clinic_id INT);

MERGE clinics AS T
USING ( SELECT tmp, name, address FROM @ClinicsInput ) AS S
   ON 1 = 0 -- luôn NOT MATCHED để thực hiện INSERT
WHEN NOT MATCHED THEN
  INSERT (name, address, opening_hours, status)
  VALUES (S.name, S.address, N'9-17', N'active')
OUTPUT S.tmp, inserted.clinic_id
INTO @ClinicMap(tmp, clinic_id);

PRINT 'Clinic Map:';
SELECT * FROM @ClinicMap;

------------------------------------------------------------------
-- 2) Employees: MERGE + OUTPUT (chú ý email/phone phải hợp lệ)
------------------------------------------------------------------
DECLARE @EmpInput TABLE (
  tmp INT IDENTITY(1,1),
  fullname NVARCHAR(255),
  email NVARCHAR(255),
  phone NVARCHAR(20),
  employee_type CHAR(1)
);
-- Email phải dạng a@b.cc ; Phone >= 9 ký tự (chỉ số và/hoặc +)
INSERT INTO @EmpInput (fullname,email,phone,employee_type)
VALUES (N'Staff A', N'staff.a@ex.com', N'0900000001', 'S'),
       (N'Staff B', N'staff.b@ex.com', N'0900000002', 'S'),
       (N'Dr C'   , N'dr.c@ex.com'   , N'0900000003', 'D');

DECLARE @EmpMap TABLE (tmp INT, emp_id INT);

MERGE employees AS T
USING ( SELECT tmp, fullname, email, phone, employee_type FROM @EmpInput ) AS S
   ON 1 = 0
WHEN NOT MATCHED THEN
  INSERT (fullname, email, phone, address, employee_type)
  VALUES (S.fullname, S.email, S.phone, N'ADDR', S.employee_type)
OUTPUT S.tmp, inserted.emp_id
INTO @EmpMap(tmp, emp_id);

PRINT 'Employee Map:';
SELECT * FROM @EmpMap;

------------------------------------------------------------------
-- 3) Staff: join theo mapping (emp_tmp -> emp_id ; clinic_tmp -> clinic_id)
------------------------------------------------------------------
DECLARE @StaffInput TABLE (
  emp_tmp INT,
  clinic_tmp INT,
  position NVARCHAR(100),
  base_salary DECIMAL(12,2)
);
INSERT INTO @StaffInput (emp_tmp, clinic_tmp, position, base_salary)
VALUES (1,1,N'Receptionist', 4000000.00),
       (2,2,N'Accountant'  , 5000000.00);

INSERT INTO staff (staff_id, position, base_salary, clinic_id)
SELECT E.emp_id, S.position, S.base_salary, C.clinic_id
FROM @StaffInput AS S
JOIN @EmpMap     AS E ON S.emp_tmp    = E.tmp
JOIN @ClinicMap  AS C ON S.clinic_tmp = C.tmp;

PRINT 'Verify staff:';
SELECT st.*, e.fullname, c.name AS clinic_name
FROM staff st
JOIN employees e ON st.staff_id = e.emp_id
JOIN clinics   c ON st.clinic_id = c.clinic_id
WHERE st.staff_id IN (SELECT emp_id FROM @EmpMap WHERE tmp IN (1,2));

------------------------------------------------------------------
-- 4) Doctors: chèn bản ghi cho những employee_type = 'D' và kiểm tra
--    (Trigger trg_doctors_check_type sẽ bảo vệ type-consistency)
------------------------------------------------------------------
INSERT INTO doctors (doctor_id, salary_per_appointment)
SELECT E.emp_id, CAST(200000.00 AS DECIMAL(12,2))
FROM @EmpMap E
JOIN @EmpInput I ON I.tmp = E.tmp
WHERE I.employee_type = 'D';

PRINT 'Verify doctors:';
SELECT d.*, e.fullname, e.employee_type
FROM doctors d
JOIN employees e ON d.doctor_id = e.emp_id
WHERE d.doctor_id IN (
  SELECT emp_id FROM @EmpMap WHERE tmp IN (
    SELECT tmp FROM @EmpInput WHERE employee_type = 'D'
  )
);

------------------------------------------------------------------
-- 5) (Tùy chọn) Kiểm tra trigger staff/manager nếu muốn thêm nhanh:
--    Ở đây chỉ demo map; nếu muốn test schedule/manager thì chạy các test khác.
------------------------------------------------------------------

-- An toàn mặc định:
ROLLBACK;
-- Nếu muốn lưu dữ liệu test: thay ROLLBACK bằng COMMIT;

--- Test trigger trg_employees_validate_email_phone (positive & negative) ---
BEGIN TRANSACTION;
PRINT '--- TEST trg_employees_validate_email_phone ---';

-- positive
INSERT INTO employees (fullname,email,phone,address,employee_type)
VALUES ('Emp OK','ok@x.com','0987654321','addr','S');

-- negative email
BEGIN TRY
    INSERT INTO employees (fullname,email,phone,address,employee_type)
    VALUES ('Emp Bad','bademail','0987654322','addr','S');
END TRY
BEGIN CATCH
    PRINT 'Expected invalid email: ' + ERROR_MESSAGE();
END CATCH;

-- negative phone
BEGIN TRY
    INSERT INTO employees (fullname,email,phone,address,employee_type)
    VALUES ('Emp BadPhone','ok2@x.com','badphone','addr','S');
END TRY
BEGIN CATCH
    PRINT 'Expected invalid phone: ' + ERROR_MESSAGE();
END CATCH;

ROLLBACK;


--- Test trg_schedules_check_manager (manager must be staff with position='Manager') ---
-- Mục đích: trigger chặn schedules có manager không phải Manager.
BEGIN TRANSACTION;
PRINT '--- TEST trg_schedules_check_manager ---';

-- Prepare: create clinic, doctor, employee non-manager, and staff manager
INSERT INTO clinics (name,address,opening_hours,status) VALUES ('Clinic MG','AddrMG','9-17','active');
DECLARE @cid INT = SCOPE_IDENTITY();

-- create doctor employee
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('DocTest','doc@test.com','0911000000','addr','D');
DECLARE @docEmp INT = SCOPE_IDENTITY();
INSERT INTO doctors (doctor_id, salary_per_appointment) VALUES (@docEmp, 200000);

-- create staff not manager
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('StaffNotMgr','snm@test.com','0912000000','addr','S');
DECLARE @staffNotMgr INT = SCOPE_IDENTITY();
INSERT INTO staff (staff_id, position, base_salary, clinic_id) VALUES (@staffNotMgr, 'Receptionist', 4000000, @cid);

-- create staff manager
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('StaffMgr','mgr@test.com','0913000000','addr','S');
DECLARE @staffMgr INT = SCOPE_IDENTITY();
INSERT INTO staff (staff_id, position, base_salary, clinic_id) VALUES (@staffMgr, 'Manager', 8000000, @cid);

-- Try schedule with non-manager -> should fail
BEGIN TRY
    INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id)
    VALUES (@docEmp, @cid, 2, '09:00', '12:00', 10, @staffNotMgr);
    PRINT 'ERROR: schedule inserted with non-manager (unexpected)';
END TRY
BEGIN CATCH
    PRINT 'Expected manager-check fail: ' + ERROR_MESSAGE();
END CATCH;

-- Try schedule with manager -> should pass
INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id)
VALUES (@docEmp, @cid, 2, '09:00', '12:00', 10, @staffMgr);

SELECT * FROM schedules WHERE manager_id = @staffMgr;

ROLLBACK;





--- Test appointments triggers — ngày/giờ, max_patients, patient conflict ---
-- Check DATEFIRST and weekday for a known date
SELECT @@DATEFIRST AS DATEFIRST, DATEPART(WEEKDAY, '2025-09-08') AS wk_20250908;

BEGIN TRANSACTION;
PRINT '--- TEST appointments time & max & patient conflict (with bhyt_info) ---';

-- create clinic
INSERT INTO clinics (name,address,opening_hours,status) 
VALUES ('Clinic App','AddrApp','9-17','active');
DECLARE @cid2 INT = SCOPE_IDENTITY();

-- create doctor employee
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('DocApp','docapp@example.com','0931000000','addr','D');
DECLARE @doc2 INT = SCOPE_IDENTITY();
INSERT INTO doctors (doctor_id, salary_per_appointment) 
VALUES (@doc2, 150000);

-- create manager staff
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('MgrApp','mgrapp@example.com','0932000000','addr','S');
DECLARE @mgr2 INT = SCOPE_IDENTITY();
INSERT INTO staff (staff_id, position, base_salary, clinic_id) 
VALUES (@mgr2, 'Manager', 7000000, @cid2);

-- create schedule: day_of_week = 3 (Wednesday)
INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id)
VALUES (@doc2, @cid2, 3, '09:00', '11:00', 2, @mgr2);
DECLARE @sched2 INT = SCOPE_IDENTITY();

-- create patients with bhyt_info
INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P1','1990-01-01','Male','0991000001','p1@example.com','BHYT001');
DECLARE @p1 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P2','1990-01-02','Female','0991000002','p2@example.com','BHYT002');
DECLARE @p2 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P3','1990-01-03','Male','0991000003','p3@example.com','BHYT003');
DECLARE @p3 INT = SCOPE_IDENTITY();

-- 1) Test time/day out of range: NOT Wednesday -> expect fail
BEGIN TRY
    INSERT INTO appointments (patient_id, schedule_id, scheduled_time)
    VALUES (@p1, @sched2, '2025-09-08 10:00'); -- Monday
END TRY
BEGIN CATCH
    PRINT 'Expected weekday/time error: ' + ERROR_MESSAGE();
END CATCH;

-- 2) Insert two appointments same Wednesday -> should pass
INSERT INTO appointments (patient_id, schedule_id, scheduled_time, status) 
VALUES (@p1, @sched2, '2025-09-10 09:15', 'booked'),
       (@p2, @sched2, '2025-09-10 09:45', 'booked');

-- 3) Insert third appointment same day -> expect overbook error
BEGIN TRY
    INSERT INTO appointments (patient_id, schedule_id, scheduled_time, status)
    VALUES (@p3, @sched2, '2025-09-10 10:15', 'booked');
END TRY
BEGIN CATCH
    PRINT 'Expected overbook error: ' + ERROR_MESSAGE();
END CATCH;

-- 4) Patient conflict: same patient, same schedule -> expect fail
BEGIN TRY
    INSERT INTO appointments (patient_id, schedule_id, scheduled_time, status)
    VALUES (@p1, @sched2, '2025-09-17 09:00', 'booked'); 
END TRY
BEGIN CATCH
    PRINT 'Expected patient conflict error: ' + ERROR_MESSAGE();
END CATCH;

ROLLBACK;






PRINT '--- TEST 1: Weekday/time out of range ---';
BEGIN TRANSACTION;
PRINT '--- TEST appointments time & max & patient conflict (with bhyt_info) ---';

-- create clinic
INSERT INTO clinics (name,address,opening_hours,status) 
VALUES ('Clinic App','AddrApp','9-17','active');
DECLARE @cid2 INT = SCOPE_IDENTITY();

-- create doctor employee
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('DocApp','docapp@example.com','0931000000','addr','D');
DECLARE @doc2 INT = SCOPE_IDENTITY();
INSERT INTO doctors (doctor_id, salary_per_appointment) 
VALUES (@doc2, 150000);

-- create manager staff
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('MgrApp','mgrapp@example.com','0932000000','addr','S');
DECLARE @mgr2 INT = SCOPE_IDENTITY();
INSERT INTO staff (staff_id, position, base_salary, clinic_id) 
VALUES (@mgr2, 'Manager', 7000000, @cid2);

-- create schedule: day_of_week = 3 (Wednesday)
INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id)
VALUES (@doc2, @cid2, 3, '09:00', '11:00', 2, @mgr2);
DECLARE @sched2 INT = SCOPE_IDENTITY();

-- create patients with bhyt_info
INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P1','1990-01-01','Male','0991000001','p1@example.com','BHYT001');
DECLARE @p1 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P2','1990-01-02','Female','0991000002','p2@example.com','BHYT002');
DECLARE @p2 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P3','1990-01-03','Male','0991000003','p3@example.com','BHYT003');
DECLARE @p3 INT = SCOPE_IDENTITY();
BEGIN TRY
    INSERT INTO appointments (patient_id, schedule_id, scheduled_time)
    VALUES (@p1, @sched2, '2025-09-08 10:00'); -- Monday
END TRY
BEGIN CATCH
    PRINT 'Expected weekday/time error: ' + ERROR_MESSAGE();
END CATCH;
ROLLBACK;





PRINT '--- TEST 2: Two appointments valid ---';
BEGIN TRANSACTION;
-- create clinic
INSERT INTO clinics (name,address,opening_hours,status) 
VALUES ('Clinic App','AddrApp','9-17','active');
DECLARE @cid2 INT = SCOPE_IDENTITY();

-- create doctor employee
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('DocApp','docapp@example.com','0931000000','addr','D');
DECLARE @doc2 INT = SCOPE_IDENTITY();
INSERT INTO doctors (doctor_id, salary_per_appointment) 
VALUES (@doc2, 150000);

-- create manager staff
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('MgrApp','mgrapp@example.com','0932000000','addr','S');
DECLARE @mgr2 INT = SCOPE_IDENTITY();
INSERT INTO staff (staff_id, position, base_salary, clinic_id) 
VALUES (@mgr2, 'Manager', 7000000, @cid2);

-- create schedule: day_of_week = 3 (Wednesday)
INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id)
VALUES (@doc2, @cid2, 3, '09:00', '11:00', 2, @mgr2);
DECLARE @sched2 INT = SCOPE_IDENTITY();

-- create patients with bhyt_info
INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P1','1990-01-01','Male','0991000001','p1@example.com','BHYT001');
DECLARE @p1 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P2','1990-01-02','Female','0991000002','p2@example.com','BHYT002');
DECLARE @p2 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P3','1990-01-03','Male','0991000003','p3@example.com','BHYT003');
DECLARE @p3 INT = SCOPE_IDENTITY();
INSERT INTO appointments (patient_id, schedule_id, scheduled_time, status) 
VALUES (@p1, @sched2, '2025-09-10 09:15', 'booked'),
       (@p2, @sched2, '2025-09-10 09:45', 'booked');
ROLLBACK;




PRINT '--- TEST 3: Overbook ---';
BEGIN TRANSACTION;
PRINT '--- TEST appointments time & max & patient conflict (with bhyt_info) ---';

-- create clinic
INSERT INTO clinics (name,address,opening_hours,status) 
VALUES ('Clinic App','AddrApp','9-17','active');
DECLARE @cid2 INT = SCOPE_IDENTITY();

-- create doctor employee
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('DocApp','docapp@example.com','0931000000','addr','D');
DECLARE @doc2 INT = SCOPE_IDENTITY();
INSERT INTO doctors (doctor_id, salary_per_appointment) 
VALUES (@doc2, 150000);

-- create manager staff
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('MgrApp','mgrapp@example.com','0932000000','addr','S');
DECLARE @mgr2 INT = SCOPE_IDENTITY();
INSERT INTO staff (staff_id, position, base_salary, clinic_id) 
VALUES (@mgr2, 'Manager', 7000000, @cid2);

-- create schedule: day_of_week = 3 (Wednesday)
INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id)
VALUES (@doc2, @cid2, 3, '09:00', '11:00', 2, @mgr2);
DECLARE @sched2 INT = SCOPE_IDENTITY();

-- create patients with bhyt_info
INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P1','1990-01-01','Male','0991000001','p1@example.com','BHYT001');
DECLARE @p1 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P2','1990-01-02','Female','0991000002','p2@example.com','BHYT002');
DECLARE @p2 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P3','1990-01-03','Male','0991000003','p3@example.com','BHYT003');
DECLARE @p3 INT = SCOPE_IDENTITY();
BEGIN TRY
	INSERT INTO appointments (patient_id, schedule_id, scheduled_time, status) 
	VALUES (@p1, @sched2, '2025-09-10 09:15', 'booked'),
		   (@p2, @sched2, '2025-09-10 09:45', 'booked');
    INSERT INTO appointments (patient_id, schedule_id, scheduled_time, status)
    VALUES (@p3, @sched2, '2025-09-10 10:15', 'booked');
END TRY
BEGIN CATCH
    PRINT 'Expected overbook error: ' + ERROR_MESSAGE();
END CATCH;
ROLLBACK;






PRINT '--- TEST 4: Patient conflict ---';
BEGIN TRANSACTION;
PRINT '--- TEST appointments time & max & patient conflict (with bhyt_info) ---';

-- create clinic
INSERT INTO clinics (name,address,opening_hours,status) 
VALUES ('Clinic App','AddrApp','9-17','active');
DECLARE @cid2 INT = SCOPE_IDENTITY();

-- create doctor employee
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('DocApp','docapp@example.com','0931000000','addr','D');
DECLARE @doc2 INT = SCOPE_IDENTITY();
INSERT INTO doctors (doctor_id, salary_per_appointment) 
VALUES (@doc2, 150000);

-- create manager staff
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('MgrApp','mgrapp@example.com','0932000000','addr','S');
DECLARE @mgr2 INT = SCOPE_IDENTITY();
INSERT INTO staff (staff_id, position, base_salary, clinic_id) 
VALUES (@mgr2, 'Manager', 7000000, @cid2);

-- create schedule: day_of_week = 3 (Wednesday)
INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id)
VALUES (@doc2, @cid2, 3, '09:00', '11:00', 2, @mgr2);
DECLARE @sched2 INT = SCOPE_IDENTITY();

-- create patients with bhyt_info
INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P1','1990-01-01','Male','0991000001','p1@example.com','BHYT001');
DECLARE @p1 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P2','1990-01-02','Female','0991000002','p2@example.com','BHYT002');
DECLARE @p2 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname, date_of_birth, gender, phone, email, bhyt_info) 
VALUES ('P3','1990-01-03','Male','0991000003','p3@example.com','BHYT003');
DECLARE @p3 INT = SCOPE_IDENTITY();
BEGIN TRY
	INSERT INTO appointments (patient_id, schedule_id, scheduled_time, status) 
	VALUES (@p1, @sched2, '2025-09-10 09:15', 'booked')
    INSERT INTO appointments (patient_id, schedule_id, scheduled_time, status)
    VALUES (@p1, @sched2, '2025-09-17 09:00', 'booked');
END TRY
BEGIN CATCH
    PRINT 'Expected patient conflict error: ' + ERROR_MESSAGE();
END CATCH;
ROLLBACK;




--- Test trigger tự tạo medical_records khi appointment cập nhật thành completed ---

BEGIN TRANSACTION;
PRINT '--- TEST automatic creation of medical_records on appointment completed ---';

-- Prepare appointment in booked state
INSERT INTO patients (fullname,date_of_birth,gender,phone) VALUES('PT MR','1985-05-05','Male','0940000001');
DECLARE @ptmr INT = SCOPE_IDENTITY();

-- assume we have @sched2 from previous steps or create a new one similarly
-- create minimal schedule for test (reuse @sched2 creation pattern)
INSERT INTO clinics (name,address,opening_hours,status) VALUES ('Clinic MR','AddrMR','9-17','active');
DECLARE @cidmr INT = SCOPE_IDENTITY();
INSERT INTO employees (fullname,email,phone,address,employee_type) VALUES ('DocMR','docmr@example.com','0951000000','addr','D');
DECLARE @docmr INT = SCOPE_IDENTITY();
INSERT INTO doctors (doctor_id, salary_per_appointment) VALUES (@docmr, 100000);
INSERT INTO employees (fullname,email,phone,address,employee_type) VALUES ('MgrMR','mgm@example.com','0952000000','addr','S');
DECLARE @mgrmr INT = SCOPE_IDENTITY();
INSERT INTO staff (staff_id, position, base_salary, clinic_id) VALUES (@mgrmr,'Manager',6000000,@cidmr);
INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id)
VALUES (@docmr, @cidmr, 2, '09:00','11:00',10,@mgrmr);
DECLARE @schedmr INT = SCOPE_IDENTITY();

-- insert appointment
INSERT INTO appointments (patient_id, schedule_id, scheduled_time, status)
VALUES (@ptmr, @schedmr, '2025-09-09 09:30', 'booked');
DECLARE @appmr INT = SCOPE_IDENTITY();

-- update to completed -> trigger should insert medical_records
UPDATE appointments SET status = 'completed' WHERE app_id = @appmr;
UPDATE appointments SET status = 'completed' WHERE app_id = @appmr;
UPDATE appointments SET status = 'completed' WHERE app_id = @appmr;

-- check medical_records

SELECT COUNT(*) AS record_count 
FROM medical_records 
WHERE app_id = @appmr;
SELECT * FROM medical_records WHERE app_id = @appmr;

ROLLBACK;


--- Test triggers type-consistency for doctors/staff (trg_doctors_check_type, trg_staff_check_type) ---
BEGIN TRANSACTION;
PRINT '--- TEST doctor/staff type consistency triggers ---';

-- create employee type S then try insert into doctors -> should fail
INSERT INTO employees (fullname,email,phone,address,employee_type) VALUES ('WrongType','wt@example.com','0961000000','addr','S');
DECLARE @wt INT = SCOPE_IDENTITY();

BEGIN TRY
    INSERT INTO doctors (doctor_id, salary_per_appointment) VALUES (@wt, 120000);
END TRY
BEGIN CATCH
    PRINT 'Expected doctor-type mismatch: ' + ERROR_MESSAGE();
END CATCH;

ROLLBACK;


BEGIN TRANSACTION;
PRINT '--- TEST doctor/staff type consistency triggers ---';

-- ensure at least one clinic exists

INSERT INTO clinics (name,address,opening_hours,status) VALUES ('Clinic MR','AddrMR','9-17','active');
DECLARE @cidmr INT = SCOPE_IDENTITY();

-- create employee type Doctor (D) then try insert into staff -> should fail
INSERT INTO employees (fullname,email,phone,address,employee_type)
VALUES ('WrongType','wt@example.com','0961000000','addr','D');
DECLARE @wt INT = SCOPE_IDENTITY();

BEGIN TRY
   INSERT INTO staff (staff_id, position, base_salary, clinic_id)
   VALUES (@wt, 'Receptionist', 3000000, @cidmr);
END TRY
BEGIN CATCH
    PRINT 'Expected doctor/staff type mismatch: ' + ERROR_MESSAGE();
END CATCH;


ROLLBACK;




--- Test stored procedure CalculateSalariesForMonth ---
-- Mục tiêu: chạy proc, kiểm tra các bảng salary_records / doctor_salary_records / staff_salary_records. --

BEGIN TRANSACTION;
PRINT '--- TEST CalculateSalariesForMonth ---';

-- Prepare accountant
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('ACCT Test','acc@example.com','0971000000','addr','S');
DECLARE @accid INT = SCOPE_IDENTITY();

-- need a clinic id for staff; create if none
INSERT INTO clinics (name,address,opening_hours,status) 
VALUES ('Clinic Sal','AddrSal','9-17','active');
DECLARE @cidsal INT = SCOPE_IDENTITY();

INSERT INTO staff (staff_id, position, base_salary, clinic_id) 
VALUES (@accid, 'Accountant', 7000000, @cidsal);

-- Prepare 1 doctor with completed appointments in month 2025-09
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('Doc Sal','docsal@example.com','0972000000','addr','D');
DECLARE @docsal INT = SCOPE_IDENTITY();

INSERT INTO doctors (doctor_id, salary_per_appointment) 
VALUES (@docsal, 200000);

-- Manager để tạo schedule
INSERT INTO employees (fullname,email,phone,address,employee_type) 
VALUES ('Mgr Sal','mgrsal@example.com','0973000000','addr','S');
DECLARE @mgrsal INT = SCOPE_IDENTITY();

INSERT INTO staff (staff_id, position, base_salary, clinic_id) 
VALUES (@mgrsal, 'Manager', 6000000, @cidsal);

-- Schedule
INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id)
VALUES (@docsal, @cidsal, 3, '09:00','12:00',10,@mgrsal);
DECLARE @schedsal INT = SCOPE_IDENTITY();

-- Patients + appointments
INSERT INTO patients (fullname,date_of_birth,gender,phone, email, bhyt_info) 
VALUES ('Pat S1','1990-01-01','Male','0987000001','P1@example.com', 'BHYT001');
DECLARE @ps1 INT = SCOPE_IDENTITY();

INSERT INTO patients (fullname,date_of_birth,gender,phone, email, bhyt_info) 
VALUES ('Pat S2','1990-02-02','Male','0987000002','P2@example.com', 'BHYT002');
DECLARE @ps2 INT = SCOPE_IDENTITY();

INSERT INTO appointments (patient_id, schedule_id, scheduled_time, status)
VALUES (@ps1, @schedsal, '2025-09-10 09:15', 'completed'),
       (@ps2, @schedsal, '2025-09-10 10:30', 'completed');

-- Run procedure
EXEC dbo.CalculateSalariesForMonth @Month = '2025-09', @AccountantId = @accid;

---------------- CHECK RESULTS ----------------

-- 1. Danh sách nhân viên test
PRINT '--- Employees created in this test ---';
SELECT e.emp_id, e.fullname, e.employee_type, 
       s.position, s.base_salary, 
       d.salary_per_appointment
FROM employees e
LEFT JOIN staff s ON e.emp_id = s.staff_id
LEFT JOIN doctors d ON e.emp_id = d.doctor_id
WHERE e.emp_id IN (@accid, @docsal, @mgrsal);

-- 2. Appointments completed cho bác sĩ
PRINT '--- Completed appointments count for doctor ---';
SELECT e.fullname AS DoctorName, COUNT(*) AS CompletedAppointments
FROM appointments a
JOIN schedules sch ON a.schedule_id = sch.schedule_id
JOIN doctors d ON sch.doctor_id = d.doctor_id
JOIN employees e ON d.doctor_id = e.emp_id
WHERE a.status = 'completed'
  AND a.scheduled_time >= '2025-09-01' AND a.scheduled_time < '2025-10-01'
GROUP BY e.fullname;

-- 3. Salary records với tên nhân viên
PRINT '--- Salary Records (with employee names) ---';
SELECT sr.*, e.fullname, e.employee_type
FROM salary_records sr
JOIN employees e ON sr.emp_id = e.emp_id
WHERE sr.month='2025-09';

PRINT '--- Doctor Salary Records ---';
SELECT dsr.*, e.fullname
FROM doctor_salary_records dsr
JOIN employees e ON dsr.emp_id = e.emp_id
WHERE dsr.month='2025-09';

PRINT '--- Staff Salary Records ---';
SELECT ssr.*, e.fullname, s.position
FROM staff_salary_records ssr
JOIN employees e ON ssr.emp_id = e.emp_id
JOIN staff s ON ssr.emp_id = s.staff_id
WHERE ssr.month='2025-09';

ROLLBACK;


