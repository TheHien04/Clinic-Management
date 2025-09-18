USE ClinicDB;
GO

SET NOCOUNT ON;

-- Số account muốn chèn (thay nếu cần)
DECLARE @Count INT = 100000;  -- chỉnh theo nhu cầu (ví dụ 50000)
IF @Count < 1 OR @Count > 200000
BEGIN
    RAISERROR('Please set @Count between 1 and 200000', 16, 1);
    RETURN;
END

BEGIN TRY
    BEGIN TRANSACTION;

    ;WITH ToInsert AS (
        -- Lấy TOP(@Count) patient chưa có account
        SELECT TOP (@Count)
            p.patient_id
        FROM patients p
        WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.patient_id = p.patient_id)
        ORDER BY p.patient_id
    )
    INSERT INTO accounts (patient_id, username, password_hash, last_login, created_at)
    SELECT
        t.patient_id,
        -- username duy nhất: patient{patient_id}
        'patient' + CAST(t.patient_id AS VARCHAR(12)) AS username,
        -- password hash: SHA2_256 của chuỗi 'Passw0rd!{patient_id}', lưu dưới dạng hex string (không có '0x')
        STUFF(sys.fn_varbintohexstr(HASHBYTES('SHA2_256', 'Passw0rd!' + CAST(t.patient_id AS VARCHAR(12)))), 1, 2, '') AS password_hash,
        -- last_login để NULL (chưa đăng nhập), nếu muốn tạo lịch sử có thể set GETDATE()
        NULL AS last_login,
        GETDATE() AS created_at
    FROM ToInsert t;

    DECLARE @Inserted INT = @@ROWCOUNT;

    COMMIT TRANSACTION;

    PRINT CONCAT('Inserted ', @Inserted, ' rows into accounts.');

    -- Một số kiểm tra nhanh
    SELECT COUNT(*) AS total_accounts FROM accounts;
    SELECT TOP (10) account_id, patient_id, username, created_at FROM accounts ORDER BY account_id DESC;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrSev INT = ERROR_SEVERITY();
    DECLARE @ErrState INT = ERROR_STATE();

    RAISERROR(@ErrMsg, @ErrSev, @ErrState);
END CATCH;
GO

SELECT TOP (50)
  a.account_id, a.patient_id, a.username, a.created_at,
  p.fullname, p.phone, p.email, p.date_of_birth, p.gender
FROM accounts a
JOIN patients p ON a.patient_id = p.patient_id
ORDER BY a.account_id DESC;