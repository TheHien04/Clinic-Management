-- ======================================================
-- ADVANCED STORED PROCEDURES FOR CLINIC MANAGEMENT
-- Business logic với pagination, error handling, transactions
-- ======================================================
-- Chạy file này SAU KHI đã tạo tables, indexes và views
-- ======================================================

USE ClinicDB;
GO

PRINT '🚀 Bắt đầu tạo stored procedures...';
GO

-- ============================================
-- PROCEDURE 1: GET PATIENT HISTORY WITH PAGINATION
-- Lấy lịch sử khám bệnh với pagination & sorting
-- ============================================

IF OBJECT_ID('sp_GetPatientHistory', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetPatientHistory;
GO

CREATE PROCEDURE sp_GetPatientHistory
    @PatientId INT,
    @PageNumber INT = 1,
    @PageSize INT = 10,
    @SortBy NVARCHAR(50) = 'scheduled_time',
    @SortOrder NVARCHAR(4) = 'DESC',
    @TotalRecords INT OUTPUT,
    @TotalPages INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate inputs
        IF @PatientId IS NULL OR @PatientId <= 0
        BEGIN
            RAISERROR('Invalid Patient ID', 16, 1);
            RETURN;
        END;
        
        IF @PageNumber < 1
            SET @PageNumber = 1;
            
        IF @PageSize < 1 OR @PageSize > 100
            SET @PageSize = 10;
            
        IF @SortOrder NOT IN ('ASC', 'DESC')
            SET @SortOrder = 'DESC';
        
        -- Calculate total records
        SELECT @TotalRecords = COUNT(*) 
        FROM appointments a
        INNER JOIN schedules s ON a.schedule_id = s.schedule_id
        WHERE a.patient_id = @PatientId;
        
        -- Calculate total pages
        SET @TotalPages = CEILING(CAST(@TotalRecords AS FLOAT) / @PageSize);
        
        -- Calculate offset
        DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;
        
        -- Return paginated results
        SELECT 
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
            d.salary_per_appointment AS fee
        FROM appointments a
        INNER JOIN schedules sch ON a.schedule_id = sch.schedule_id
        INNER JOIN doctors d ON sch.doctor_id = d.doctor_id
        INNER JOIN employees e ON d.doctor_id = e.emp_id
        LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
        LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
        INNER JOIN clinics c ON sch.clinic_id = c.clinic_id
        WHERE a.patient_id = @PatientId
        ORDER BY 
            CASE WHEN @SortBy = 'scheduled_time' AND @SortOrder = 'DESC' THEN a.scheduled_time END DESC,
            CASE WHEN @SortBy = 'scheduled_time' AND @SortOrder = 'ASC' THEN a.scheduled_time END ASC,
            CASE WHEN @SortBy = 'status' AND @SortOrder = 'DESC' THEN a.status END DESC,
            CASE WHEN @SortBy = 'status' AND @SortOrder = 'ASC' THEN a.status END ASC
        OFFSET @Offset ROWS
        FETCH NEXT @PageSize ROWS ONLY;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO

PRINT '✅ Created sp_GetPatientHistory';
GO

-- ============================================
-- PROCEDURE 2: MONTHLY REVENUE REPORT BY DOCTOR
-- Báo cáo doanh thu theo tháng với filtering
-- ============================================

IF OBJECT_ID('sp_MonthlyRevenueReport', 'P') IS NOT NULL
    DROP PROCEDURE sp_MonthlyRevenueReport;
GO

CREATE PROCEDURE sp_MonthlyRevenueReport
    @StartDate DATE,
    @EndDate DATE,
    @DoctorId INT = NULL,
    @ClinicId INT = NULL,
    @SpecialtyId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate dates
        IF @StartDate IS NULL OR @EndDate IS NULL
        BEGIN
            RAISERROR('Start date and end date are required', 16, 1);
            RETURN;
        END;
        
        IF @StartDate > @EndDate
        BEGIN
            RAISERROR('Start date must be before end date', 16, 1);
            RETURN;
        END;
        
        -- Generate report
        WITH DoctorRevenue AS (
            SELECT 
                e.emp_id,
                e.fullname AS doctor_name,
                sp.name AS specialty_name,
                c.name AS clinic_name,
                
                -- Appointment counts
                COUNT(DISTINCT a.appointment_id) AS total_appointments,
                COUNT(DISTINCT a.patient_id) AS unique_patients,
                
                -- Status breakdown
                COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed_count,
                COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) AS cancelled_count,
                COUNT(CASE WHEN a.status = 'no-show' THEN 1 END) AS no_show_count,
                
                -- Revenue
                SUM(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment ELSE 0 END) AS total_revenue,
                AVG(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment END) AS avg_revenue_per_appointment,
                
                -- Quality
                AVG(CASE WHEN a.rating IS NOT NULL THEN CAST(a.rating AS FLOAT) END) AS avg_rating,
                COUNT(CASE WHEN a.rating IS NOT NULL THEN 1 END) AS total_ratings
            FROM employees e
            INNER JOIN doctors d ON e.emp_id = d.doctor_id
            INNER JOIN schedules s ON d.doctor_id = s.doctor_id
            LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
            LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
            INNER JOIN clinics c ON s.clinic_id = c.clinic_id
            LEFT JOIN appointments a ON s.schedule_id = a.schedule_id
                AND CAST(a.scheduled_time AS DATE) BETWEEN @StartDate AND @EndDate
            WHERE (@DoctorId IS NULL OR e.emp_id = @DoctorId)
            AND (@ClinicId IS NULL OR s.clinic_id = @ClinicId)
            AND (@SpecialtyId IS NULL OR ds.specialty_id = @SpecialtyId)
            AND e.employee_type = 'D'
            GROUP BY e.emp_id, e.fullname, sp.name, c.name
        )
        SELECT 
            *,
            -- Calculated metrics
            CASE 
                WHEN total_appointments > 0 
                THEN CAST(completed_count AS FLOAT) / total_appointments * 100 
                ELSE 0 
            END AS completion_rate_percent,
            
            CASE 
                WHEN total_appointments > 0 
                THEN CAST(no_show_count AS FLOAT) / total_appointments * 100 
                ELSE 0 
            END AS no_show_rate_percent,
            
            CASE 
                WHEN completed_count > 0 
                THEN total_revenue / completed_count 
                ELSE 0 
            END AS revenue_per_completed_appointment
        FROM DoctorRevenue
        ORDER BY total_revenue DESC;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
GO

PRINT '✅ Created sp_MonthlyRevenueReport';
GO

-- ============================================
-- PROCEDURE 3: FIND AVAILABLE TIME SLOTS
-- Tìm slot trống cho đặt lịch hẹn
-- ============================================

IF OBJECT_ID('sp_FindAvailableTimeSlots', 'P') IS NOT NULL
    DROP PROCEDURE sp_FindAvailableTimeSlots;
GO

CREATE PROCEDURE sp_FindAvailableTimeSlots
    @DoctorId INT = NULL,
    @SpecialtyId INT = NULL,
    @ClinicId INT = NULL,
    @Date DATE,
    @DurationMinutes INT = 30
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate inputs
        IF @Date IS NULL
        BEGIN
            RAISERROR('Date is required', 16, 1);
            RETURN;
        END;
        
        IF @Date < CAST(GETDATE() AS DATE)
        BEGIN
            RAISERROR('Cannot book appointments in the past', 16, 1);
            RETURN;
        END;
        
        IF @DurationMinutes <= 0 OR @DurationMinutes > 240
            SET @DurationMinutes = 30;
        
        -- Get day of week (1=Monday, 7=Sunday)
        DECLARE @DayOfWeek INT = DATEPART(WEEKDAY, @Date);
        -- Adjust for Monday=1 convention
        SET @DayOfWeek = CASE 
            WHEN @DayOfWeek = 1 THEN 7  -- Sunday
            ELSE @DayOfWeek - 1 
        END;
        
        -- Generate time slots
        WITH Numbers AS (
            SELECT TOP 100 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n
            FROM sys.objects
        ),
        TimeSlots AS (
            SELECT 
                s.schedule_id,
                s.doctor_id,
                e.fullname AS doctor_name,
                sp.name AS specialty_name,
                c.name AS clinic_name,
                c.address AS clinic_address,
                s.start_time,
                s.end_time,
                s.max_patients,
                -- Generate slot times
                DATEADD(MINUTE, n.n * @DurationMinutes, 
                    CAST(@Date AS DATETIME) + CAST(s.start_time AS DATETIME)) AS slot_time
            FROM schedules s
            INNER JOIN doctors d ON s.doctor_id = d.doctor_id
            INNER JOIN employees e ON d.doctor_id = e.emp_id
            LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
            LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
            INNER JOIN clinics c ON s.clinic_id = c.clinic_id
            CROSS JOIN Numbers n
            WHERE s.day_of_week = @DayOfWeek
            AND n.n * @DurationMinutes < DATEDIFF(MINUTE, s.start_time, s.end_time)
            AND (@DoctorId IS NULL OR s.doctor_id = @DoctorId)
            AND (@SpecialtyId IS NULL OR ds.specialty_id = @SpecialtyId)
            AND (@ClinicId IS NULL OR s.clinic_id = @ClinicId)
        ),
        BookedSlots AS (
            SELECT 
                ts.slot_time,
                ts.schedule_id,
                COUNT(a.appointment_id) AS booked_count
            FROM TimeSlots ts
            LEFT JOIN appointments a ON ts.schedule_id = a.schedule_id
                AND a.scheduled_time = ts.slot_time
                AND a.status NOT IN ('cancelled', 'no-show')
            GROUP BY ts.slot_time, ts.schedule_id
        )
        SELECT 
            ts.schedule_id,
            ts.doctor_id,
            ts.doctor_name,
            ts.specialty_name,
            ts.clinic_name,
            ts.clinic_address,
            ts.slot_time,
            ts.max_patients,
            ISNULL(bs.booked_count, 0) AS booked_count,
            ts.max_patients - ISNULL(bs.booked_count, 0) AS available_slots,
            CASE 
                WHEN ts.max_patients - ISNULL(bs.booked_count, 0) > 0 THEN 'Available'
                ELSE 'Full'
            END AS status
        FROM TimeSlots ts
        LEFT JOIN BookedSlots bs ON ts.slot_time = bs.slot_time 
            AND ts.schedule_id = bs.schedule_id
        WHERE ts.max_patients - ISNULL(bs.booked_count, 0) > 0
        AND ts.slot_time > GETDATE() -- Only future slots
        ORDER BY ts.slot_time;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
GO

PRINT '✅ Created sp_FindAvailableTimeSlots';
GO

-- ============================================
-- PROCEDURE 4: DOCTOR PERFORMANCE METRICS
-- Tính toán performance metrics detail
-- ============================================

IF OBJECT_ID('sp_CalculateDoctorPerformance', 'P') IS NOT NULL
    DROP PROCEDURE sp_CalculateDoctorPerformance;
GO

CREATE PROCEDURE sp_CalculateDoctorPerformance
    @DoctorId INT,
    @StartDate DATE,
    @EndDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate inputs
        IF @DoctorId IS NULL OR @DoctorId <= 0
        BEGIN
            RAISERROR('Invalid Doctor ID', 16, 1);
            RETURN;
        END;
        
        IF NOT EXISTS (SELECT 1 FROM doctors WHERE doctor_id = @DoctorId)
        BEGIN
            RAISERROR('Doctor not found', 16, 1);
            RETURN;
        END;
        
        -- Generate performance report
        SELECT 
            @DoctorId AS doctor_id,
            e.fullname AS doctor_name,
            e.email,
            e.phone,
            
            -- Appointment metrics
            COUNT(a.appointment_id) AS total_appointments,
            COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed_appointments,
            COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) AS cancelled_appointments,
            COUNT(CASE WHEN a.status = 'no-show' THEN 1 END) AS no_show_appointments,
            COUNT(CASE WHEN a.status = 'scheduled' THEN 1 END) AS upcoming_appointments,
            
            -- Patient metrics
            COUNT(DISTINCT a.patient_id) AS unique_patients,
            COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.patient_id END) AS completed_unique_patients,
            
            -- Financial metrics
            SUM(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment ELSE 0 END) AS total_revenue,
            AVG(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment END) AS avg_revenue_per_appointment,
            d.salary_per_appointment AS current_fee_per_appointment,
            
            -- Quality metrics
            AVG(CASE WHEN a.rating IS NOT NULL THEN CAST(a.rating AS FLOAT) END) AS avg_rating,
            COUNT(CASE WHEN a.rating IS NOT NULL THEN 1 END) AS total_ratings,
            COUNT(CASE WHEN a.rating >= 4 THEN 1 END) AS positive_ratings,
            
            -- Efficiency metrics
            CASE 
                WHEN COUNT(a.appointment_id) > 0 
                THEN CAST(COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS FLOAT) 
                     / COUNT(a.appointment_id) * 100 
                ELSE 0 
            END AS completion_rate_percent,
            
            CASE 
                WHEN COUNT(a.appointment_id) > 0 
                THEN CAST(COUNT(CASE WHEN a.status = 'no-show' THEN 1 END) AS FLOAT) 
                     / COUNT(a.appointment_id) * 100 
                ELSE 0 
            END AS no_show_rate_percent,
            
            CASE 
                WHEN COUNT(CASE WHEN a.rating IS NOT NULL THEN 1 END) > 0 
                THEN CAST(COUNT(CASE WHEN a.rating >= 4 THEN 1 END) AS FLOAT) 
                     / COUNT(CASE WHEN a.rating IS NOT NULL THEN 1 END) * 100 
                ELSE 0 
            END AS satisfaction_rate_percent,
            
            -- Time period
            @StartDate AS period_start,
            @EndDate AS period_end,
            DATEDIFF(DAY, @StartDate, @EndDate) + 1 AS period_days,
            
            -- Performance ranking (compared to other doctors)
            (SELECT COUNT(*) + 1 
             FROM doctors d2 
             INNER JOIN schedules s2 ON d2.doctor_id = s2.doctor_id
             LEFT JOIN appointments a2 ON s2.schedule_id = a2.schedule_id
                AND CAST(a2.scheduled_time AS DATE) BETWEEN @StartDate AND @EndDate
                AND a2.status = 'completed'
             GROUP BY d2.doctor_id
             HAVING SUM(d2.salary_per_appointment) > 
                    SUM(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment ELSE 0 END)
            ) AS revenue_rank
            
        FROM employees e
        INNER JOIN doctors d ON e.emp_id = d.doctor_id
        LEFT JOIN schedules s ON d.doctor_id = s.doctor_id
        LEFT JOIN appointments a ON s.schedule_id = a.schedule_id
            AND CAST(a.scheduled_time AS DATE) BETWEEN @StartDate AND @EndDate
        WHERE e.emp_id = @DoctorId
        GROUP BY e.emp_id, e.fullname, e.email, e.phone, d.salary_per_appointment;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
GO

PRINT '✅ Created sp_CalculateDoctorPerformance';
GO

-- ============================================
-- PROCEDURE 5: GET UPCOMING APPOINTMENTS (FOR REMINDERS)
-- Lấy appointments sắp tới để gửi thông báo
-- ============================================

IF OBJECT_ID('sp_GetUpcomingAppointments', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetUpcomingAppointments;
GO

CREATE PROCEDURE sp_GetUpcomingAppointments
    @ReminderHours INT = 24 -- Send reminder 24 hours before
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        DECLARE @ReminderTime DATETIME2 = DATEADD(HOUR, @ReminderHours, GETDATE());
        
        SELECT 
            a.appointment_id,
            p.patient_id,
            p.fullname AS patient_name,
            p.email AS patient_email,
            p.phone AS patient_phone,
            a.scheduled_time,
            DATEDIFF(HOUR, GETDATE(), a.scheduled_time) AS hours_until_appointment,
            e.fullname AS doctor_name,
            sp.name AS specialty_name,
            c.name AS clinic_name,
            c.address AS clinic_address,
            a.service_type,
            a.notes
        FROM appointments a
        INNER JOIN patients p ON a.patient_id = p.patient_id
        INNER JOIN schedules sch ON a.schedule_id = sch.schedule_id
        INNER JOIN doctors d ON sch.doctor_id = d.doctor_id
        INNER JOIN employees e ON d.doctor_id = e.emp_id
        LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
        LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
        INNER JOIN clinics c ON sch.clinic_id = c.clinic_id
        WHERE a.status = 'scheduled'
        AND a.scheduled_time BETWEEN GETDATE() AND @ReminderTime
        ORDER BY a.scheduled_time;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
GO

PRINT '✅ Created sp_GetUpcomingAppointments';
GO

-- ============================================
-- PROCEDURE 6: BULK CANCEL APPOINTMENTS (WITH TRANSACTION)
-- Cancel nhiều appointments với transaction safety
-- ============================================

IF OBJECT_ID('sp_BulkCancelAppointments', 'P') IS NOT NULL
    DROP PROCEDURE sp_BulkCancelAppointments;
GO

CREATE PROCEDURE sp_BulkCancelAppointments
    @DoctorId INT,
    @StartDate DATETIME2,
    @EndDate DATETIME2,
    @Reason NVARCHAR(MAX),
    @CancelledBy INT,
    @CancelledCount INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRANSACTION;
    
    BEGIN TRY
        -- Validate inputs
        IF @DoctorId IS NULL OR @StartDate IS NULL OR @EndDate IS NULL
        BEGIN
            RAISERROR('Doctor ID, start date and end date are required', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END;
        
        IF NOT EXISTS (SELECT 1 FROM doctors WHERE doctor_id = @DoctorId)
        BEGIN
            RAISERROR('Doctor not found', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END;
        
        -- Update appointments to cancelled
        UPDATE a
        SET 
            status = 'cancelled',
            notes = CONCAT(ISNULL(notes, ''), ' | ', FORMAT(GETDATE(), 'yyyy-MM-dd HH:mm'), ': Cancelled - ', @Reason),
            updated_at = GETDATE()
        FROM appointments a
        INNER JOIN schedules s ON a.schedule_id = s.schedule_id
        WHERE s.doctor_id = @DoctorId
        AND a.scheduled_time BETWEEN @StartDate AND @EndDate
        AND a.status = 'scheduled';
        
        SET @CancelledCount = @@ROWCOUNT;
        
        COMMIT TRANSACTION;
        
        -- Return cancelled appointments
        SELECT 
            a.appointment_id,
            p.fullname AS patient_name,
            p.email AS patient_email,
            p.phone AS patient_phone,
            a.scheduled_time,
            a.service_type,
            a.notes
        FROM appointments a
        INNER JOIN schedules s ON a.schedule_id = s.schedule_id
        INNER JOIN patients p ON a.patient_id = p.patient_id
        WHERE s.doctor_id = @DoctorId
        AND a.scheduled_time BETWEEN @StartDate AND @EndDate
        AND a.status = 'cancelled'
        AND a.notes LIKE '%' + @Reason + '%'
        ORDER BY a.scheduled_time;
        
        PRINT CONCAT('Successfully cancelled ', @CancelledCount, ' appointments');
        
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
            
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
GO

PRINT '✅ Created sp_BulkCancelAppointments';
GO

-- ============================================
-- SAMPLE PROCEDURE CALLS (để test)
-- ============================================

PRINT '';
PRINT '📝 Sample procedure calls:';
PRINT '';
PRINT '-- 1. Get patient history with pagination:
DECLARE @TotalRecords INT, @TotalPages INT;
EXEC sp_GetPatientHistory 
    @PatientId = 1, 
    @PageNumber = 1, 
    @PageSize = 10,
    @SortBy = ''scheduled_time'',
    @SortOrder = ''DESC'',
    @TotalRecords = @TotalRecords OUTPUT,
    @TotalPages = @TotalPages OUTPUT;
SELECT @TotalRecords AS TotalRecords, @TotalPages AS TotalPages;';
PRINT '';
PRINT '-- 2. Monthly revenue report:
EXEC sp_MonthlyRevenueReport 
    @StartDate = ''2024-01-01'', 
    @EndDate = ''2024-12-31'',
    @DoctorId = NULL,
    @ClinicId = NULL;';
PRINT '';
PRINT '-- 3. Find available time slots:
EXEC sp_FindAvailableTimeSlots 
    @DoctorId = NULL, 
    @SpecialtyId = 1,
    @ClinicId = NULL,
    @Date = ''2024-03-01'',
    @DurationMinutes = 30;';
PRINT '';
PRINT '-- 4. Doctor performance:
EXEC sp_CalculateDoctorPerformance 
    @DoctorId = 1, 
    @StartDate = ''2024-01-01'', 
    @EndDate = ''2024-12-31'';';
PRINT '';
PRINT '-- 5. Upcoming appointments (for reminders):
EXEC sp_GetUpcomingAppointments @ReminderHours = 24;';
PRINT '';
PRINT '-- 6. Bulk cancel appointments:
DECLARE @CancelledCount INT;
EXEC sp_BulkCancelAppointments 
    @DoctorId = 1,
    @StartDate = ''2024-03-01'',
    @EndDate = ''2024-03-07'',
    @Reason = ''Doctor on leave'',
    @CancelledBy = 1,
    @CancelledCount = @CancelledCount OUTPUT;
SELECT @CancelledCount AS CancelledCount;';
GO

PRINT '✨ ============================================';
PRINT '✅ All stored procedures created successfully!';
PRINT '🎯 6 advanced procedures with pagination & error handling';
PRINT '💡 Tip: Use these procedures in your backend API';
PRINT '============================================';
GO
