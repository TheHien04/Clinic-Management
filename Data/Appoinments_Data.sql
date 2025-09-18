USE ClinicDB
GO

DECLARE @i INT = 1;

WHILE @i <= 90000
BEGIN
    DECLARE @schedule_id INT, @patient_id INT, 
            @day_of_week INT, @start_time TIME, @end_time TIME,
            @random_time TIME, @status NVARCHAR(20);

    -- Chọn ngẫu nhiên một lịch khám
    SELECT TOP 1 
        @schedule_id = schedule_id,
        @day_of_week = day_of_week,
        @start_time = start_time,
        @end_time = end_time
    FROM schedules
    ORDER BY NEWID();

    -- Random bệnh nhân nhưng chỉ chọn từ nhóm có account
    SELECT TOP 1 @patient_id = p.patient_id
    FROM patients p
    JOIN accounts a ON p.patient_id = a.patient_id
    ORDER BY NEWID();

    -- Random thời gian hẹn trong khung giờ
    SELECT @random_time = DATEADD(MINUTE, (ABS(CHECKSUM(NEWID())) % 480), @start_time);

    -- Random trạng thái
    SELECT @status = CASE ABS(CHECKSUM(NEWID())) % 3
                        WHEN 0 THEN 'Booked'
                        WHEN 1 THEN 'Completed'
                        ELSE 'Cancelled'
                     END;

    -- Insert vào bảng appointments
    INSERT INTO appointments (schedule_id, patient_id, scheduled_time, status)
    VALUES (@schedule_id, @patient_id, @random_time, @status);

    SET @i += 1;
END;
