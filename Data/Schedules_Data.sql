
USE ClinicDB;
GO
SET NOCOUNT ON;

-- Nguyên tắc:
-- - Mỗi doctor sẽ có day_of_week 1..6 (không trùng nhau)
-- - Mỗi doctor sẽ được gán 6 clinic (nếu clinic < 6 thì sẽ vòng lặp/replicate)
-- - start_time = '08:30', end_time = '17:30'
-- - Nếu clinic có staff position='Manager' cho clinic đó => dùng manager đó
--   Nếu không có => dùng 1 Manager bất kỳ trong hệ thống (đảm bảo trigger)

BEGIN TRY
    BEGIN TRANSACTION;

    -- Kiểm tra điều kiện cần thiết
    IF NOT EXISTS (SELECT 1 FROM doctors)
    BEGIN
        RAISERROR('No doctors found. Please insert doctors first.', 16, 1);
        ROLLBACK TRANSACTION; RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM clinics)
    BEGIN
        RAISERROR('No clinics found. Please insert clinics first.', 16, 1);
        ROLLBACK TRANSACTION; RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM staff WHERE position = 'Manager')
    BEGIN
        RAISERROR('No staff with position = ''Manager'' found. Please insert at least one Manager.', 16, 1);
        ROLLBACK TRANSACTION; RETURN;
    END

    -- Chuẩn bị temp tables
    IF OBJECT_ID('tempdb..#Doctors') IS NOT NULL DROP TABLE #Doctors;
    SELECT ROW_NUMBER() OVER (ORDER BY d.doctor_id) AS rn, d.doctor_id
    INTO #Doctors
    FROM doctors d;

    IF OBJECT_ID('tempdb..#ClinicsOrdered') IS NOT NULL DROP TABLE #ClinicsOrdered;
    SELECT ROW_NUMBER() OVER (ORDER BY clinic_id) AS cidx, clinic_id
    INTO #ClinicsOrdered
    FROM clinics;

    DECLARE @ClinicCount INT = (SELECT COUNT(*) FROM #ClinicsOrdered);
    DECLARE @DoctorCount INT = (SELECT COUNT(*) FROM #Doctors);

    -- Manager mặc định (nếu 1 clinic không có Manager, dùng manager bất kỳ)
    DECLARE @AnyManager INT = (SELECT TOP 1 staff_id FROM staff WHERE position = 'Manager' ORDER BY NEWID());

    IF @AnyManager IS NULL
    BEGIN
        RAISERROR('No Manager found in staff table (unexpected).', 16, 1);
        ROLLBACK TRANSACTION; RETURN;
    END

    -- Build mapping clinic -> manager (take manager for that clinic if exists,
    -- else assign @AnyManager). If clinic có nhiều Manager, lấy 1 (theo staff_id ascend)
    IF OBJECT_ID('tempdb..#ClinicManagers') IS NOT NULL DROP TABLE #ClinicManagers;
    SELECT 
        c.clinic_id,
        ISNULL(
            (SELECT TOP 1 s.staff_id FROM staff s WHERE s.clinic_id = c.clinic_id AND s.position = 'Manager' ORDER BY s.staff_id),
            @AnyManager
        ) AS manager_id
    INTO #ClinicManagers
    FROM clinics c;

    -- (Tùy chọn) backup hiện tại của schedules cho các doctors nếu cần:
    -- SELECT * INTO schedules_backup_before_rebuild FROM schedules WHERE doctor_id IN (SELECT doctor_id FROM #Doctors);

    -- Xoá schedule cũ của các doctors (làm lại toàn bộ)
    DELETE s
    FROM schedules s
    JOIN #Doctors d ON s.doctor_id = d.doctor_id;

    -- Chuẩn bị numbers 1..6 (day_of_week)
    IF OBJECT_ID('tempdb..#Nums') IS NOT NULL DROP TABLE #Nums;
    CREATE TABLE #Nums (n INT NOT NULL);
    INSERT INTO #Nums (n) VALUES (1),(2),(3),(4),(5),(6);

    -- Insert: cho mỗi doctor tạo 6 row với day_of_week 1..6
    -- clinic selection: tính index = ((n-1) + doctor_rn - 1) % @ClinicCount + 1 => đảm bảo phân bố đa dạng
    -- nếu clinic_count < 1 sẽ fail vì đã kiểm tra ở trên
    INSERT INTO schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id)
    SELECT 
        d.doctor_id,
        cl.clinic_id,
        num.n AS day_of_week,
        CAST('08:30' AS TIME) AS start_time,
        CAST('17:30' AS TIME) AS end_time,
        -- phân bố max_patients nhẹ nhàng: base 20 + (doctor rn % 11)
        20 + (d.rn % 11) AS max_patients,
        cm.manager_id
    FROM #Doctors d
    CROSS JOIN #Nums num
    -- compute clinic index for variety:
    CROSS APPLY (
        SELECT (( (num.n - 1) + (d.rn - 1) ) % @ClinicCount) + 1 AS clinic_index
    ) as calc
    JOIN #ClinicsOrdered cl ON cl.cidx = calc.clinic_index
    LEFT JOIN #ClinicManagers cm ON cm.clinic_id = cl.clinic_id
    -- đảm bảo không chèn duplicate (phòng trường hợp)
    WHERE NOT EXISTS (
        SELECT 1 FROM schedules s 
        WHERE s.doctor_id = d.doctor_id
          AND s.clinic_id = cl.clinic_id
          AND s.day_of_week = num.n
    );

    DECLARE @Inserted INT = @@ROWCOUNT;

    -- Kiểm tra ràng buộc cơ bản: end_time > start_time (đã đảm bảo 17:30 > 08:30)
    -- Kiểm tra manager_id tồn tại trong employees (staff.staff_id là emp_id)
    IF EXISTS (
        SELECT 1 FROM schedules s
        LEFT JOIN employees e ON s.manager_id = e.emp_id
        WHERE e.emp_id IS NULL
    )
    BEGIN
        RAISERROR('Some manager_id inserted do not reference valid employees. Rolling back.', 16, 1);
        ROLLBACK TRANSACTION; RETURN;
    END

    COMMIT TRANSACTION;

    PRINT CONCAT('Rebuilt schedules: inserted ', @Inserted, ' rows.');
    SELECT COUNT(*) AS total_schedules_after FROM schedules;
    SELECT TOP (50) schedule_id, doctor_id, clinic_id, day_of_week, start_time, end_time, max_patients, manager_id
    FROM schedules
    ORDER BY schedule_id DESC;

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@Err, 16, 1);
END CATCH;
GO


--- TEST THÔNG TIN LỊCH CỦA MỘT BÁC SĨ ---
SET NOCOUNT ON;

DECLARE @DoctorId INT = 93;  -- đổi theo bác sĩ cần kiểm tra

-- Thông tin bác sĩ
SELECT d.doctor_id, e.fullname AS doctor_name, e.email, e.phone, d.salary_per_appointment
FROM doctors d
JOIN employees e ON d.doctor_id = e.emp_id
WHERE d.doctor_id = @DoctorId;

-- Tất cả schedule của bác sĩ (chi tiết, không FORMAT để thấy NULL thực)
SELECT schedule_id, doctor_id, clinic_id, 
       (SELECT name FROM clinics WHERE clinic_id = s.clinic_id) AS clinic_name,
       day_of_week, start_time, end_time, max_patients, manager_id,
       (SELECT fullname FROM employees WHERE emp_id = s.manager_id) AS manager_name,
       (SELECT position FROM staff WHERE staff_id = s.manager_id) AS manager_position
FROM schedules s
WHERE doctor_id = @DoctorId
ORDER BY day_of_week, start_time, schedule_id;
