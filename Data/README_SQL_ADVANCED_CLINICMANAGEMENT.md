# SQL Advanced Upgrade (ClinicManagement)

Tai lieu nay danh cho schema backend hien tai (`ClinicManagement`) de dat chuan mon CSDL nang cao + thuc hanh SE.

## 1) Muc tieu

- Toi uu truy van read-heavy cho dashboard/reports.
- Dua business query vao stored procedure de de bao tri, de test.
- Chuan hoa datasource cho backend analytics endpoint.
- Co benchmark checklist de bao cao hieu nang.

## 2) File can chay

- `Data/create_clinicmanagement_core_schema.sql` (chay truoc neu DB dang rong)
- `Data/create_advanced_sqlserver_analytics.sql`

## 3) Thu tu chay

1. Dam bao DB dang dung la `ClinicManagement`.
2. Neu DB rong (chua co bang `Appointments`, `Doctors`, `Patients`, `Specialties`), chay truoc:

```sql
:r Data/create_clinicmanagement_core_schema.sql
```

3. Chay script analytics:

```sql
:r Data/create_advanced_sqlserver_analytics.sql
```

Hoac trong SSMS, mo file va Execute.

## 4) Artifacts duoc tao

### Indexes

- `IX_Appointments_Doctor_Date_Time_Status`
- `IX_Appointments_Date_Status`
- `IX_Appointments_Patient_Date`
- `IX_Doctors_SpecialtyID`
- `IX_Patients_FullName`
- `IX_Patients_PhoneNumber`

### Stored Procedure

- `dbo.sp_GetAnalyticsAppointments`
  - Filter theo `FromDate`, `ToDate`, `DoctorId`, `Status`, `Service`.
  - Tra ve dataset chuan cho backend reports.

### View

- `dbo.vw_AnalyticsMonthlyAppointments`
  - Tong hop theo thang cho BI/reporting.

## 5) Cac test query de bao cao

```sql
-- Kiem tra object da tao
SELECT name, type_desc
FROM sys.objects
WHERE name IN (
  'sp_GetAnalyticsAppointments',
  'vw_AnalyticsMonthlyAppointments',
  'IX_Appointments_Doctor_Date_Time_Status',
  'IX_Appointments_Date_Status',
  'IX_Appointments_Patient_Date'
);

-- Benchmark procedure
SET STATISTICS IO ON;
SET STATISTICS TIME ON;

EXEC dbo.sp_GetAnalyticsAppointments
  @FromDate = '2025-01-01',
  @ToDate = '2025-12-31',
  @DoctorId = NULL,
  @Status = NULL,
  @Service = NULL;

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;

-- View tong hop
SELECT TOP 12 *
FROM dbo.vw_AnalyticsMonthlyAppointments
ORDER BY YearMonth DESC;
```

## 6) Tich hop backend

Backend da duoc cap nhat theo procedure-first strategy trong:

- `backend/src/controllers/reportController.js`

Logic:

- Thu goi `dbo.sp_GetAnalyticsAppointments` truoc.
- Neu SP chua deploy hoac loi -> fallback ve query SQL truc tiep.
- Neu DB khong co data -> fallback demo dataset nhu truoc.

## 7) Checklist dat chuan CSDL nang cao

- [x] Co indexing strategy theo access pattern thuc te.
- [x] Co stored procedure gom business query.
- [x] Co view tong hop phuc vu BI/reporting.
- [x] Co benchmark bang `STATISTICS IO/TIME`.
- [x] Co fallback strategy o backend (SE production-minded).
