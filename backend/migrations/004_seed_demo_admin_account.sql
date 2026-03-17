PRINT '=== RUN 004_seed_demo_admin_account.sql ===';
GO

DECLARE @DemoEmail NVARCHAR(255) = 'admin@clinic.local';
DECLARE @DemoName NVARCHAR(200) = 'Clinic Admin';
DECLARE @DemoRole NVARCHAR(30) = 'admin';
DECLARE @DemoPasswordHash NVARCHAR(255) = '$2a$10$XmLpn4aXWJcibW2xvBtH4uX5vDQkwH7s26QfwOAiSdIy2Ki8eKijO';

IF EXISTS (SELECT 1 FROM dbo.Accounts WHERE Email = @DemoEmail)
BEGIN
    UPDATE dbo.Accounts
    SET Password = @DemoPasswordHash,
        FullName = @DemoName,
        Role = @DemoRole,
        IsActive = 1,
        UpdatedDate = GETDATE()
    WHERE Email = @DemoEmail;
END;
ELSE
BEGIN
    INSERT INTO dbo.Accounts (Email, Password, FullName, Role, IsActive, CreatedDate)
    VALUES (@DemoEmail, @DemoPasswordHash, @DemoName, @DemoRole, 1, GETDATE());
END;
GO

PRINT 'Seeded demo account: admin@clinic.local (password: Admin@123)';
PRINT '=== DONE 004_seed_demo_admin_account.sql ===';
GO
