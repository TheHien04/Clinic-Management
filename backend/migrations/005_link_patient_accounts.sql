IF OBJECT_ID('dbo.Patients', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.Patients', 'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Patients ADD AccountID INT NULL;
END;
GO

IF OBJECT_ID('dbo.Patients', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.Patients', 'AccountID') IS NOT NULL
   AND OBJECT_ID('dbo.FK_Patients_Accounts', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Patients
      ADD CONSTRAINT FK_Patients_Accounts
      FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
END;
GO

IF OBJECT_ID('dbo.Patients', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.Patients', 'AccountID') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
     FROM sys.indexes
     WHERE object_id = OBJECT_ID('dbo.Patients')
       AND name = 'UX_Patients_AccountID'
   )
BEGIN
    CREATE UNIQUE INDEX UX_Patients_AccountID
      ON dbo.Patients(AccountID)
      WHERE AccountID IS NOT NULL;
END;
GO

-- One-time deterministic migration for existing records. New links must be
-- established through an identity-verified administrative workflow.
UPDATE p
SET p.AccountID = a.AccountID
FROM dbo.Patients p
INNER JOIN dbo.Accounts a ON LOWER(a.Email) = LOWER(p.Email)
WHERE p.AccountID IS NULL
  AND LOWER(a.Role) IN ('patient', 'user');
GO
