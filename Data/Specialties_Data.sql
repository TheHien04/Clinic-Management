USE ClinicDB;
GO

SET NOCOUNT ON;

-- tạo table tạm trước khi dùng OUTPUT
IF OBJECT_ID('tempdb..#sp_out') IS NOT NULL DROP TABLE #sp_out;
CREATE TABLE #sp_out (
    action NVARCHAR(10),
    specialty_id INT,
    name NVARCHAR(100)
);

-- Danh sách chuyên khoa mẫu
DECLARE @Specialties TABLE (name NVARCHAR(100), description NVARCHAR(MAX));
INSERT INTO @Specialties (name, description)
VALUES
 (N'Nội tổng quát', N'Khám, điều trị nội khoa chung'),
 (N'Ngoại tổng quát', N'Phẫu thuật tổng quát'),
 (N'Nhi khoa', N'Chăm sóc trẻ em'),
 (N'Sản - Phụ khoa', N'Chăm sóc thai sản và sản phụ khoa'),
 (N'Tai Mũi Họng (ENT)', N'Chuyên Tai Mũi Họng'),
 (N'Mắt', N'Khám và điều trị bệnh mắt'),
 (N'Da liễu', N'Chuyên về da, tóc, móng'),
 (N'Răng Hàm Mặt', N'Răng miệng và chỉnh nha'),
 (N'Tâm thần', N'Chăm sóc sức khỏe tâm thần'),
 (N'Chẩn đoán hình ảnh', N'X-quang, CT, MRI'),
 (N'Tim mạch', N'Bệnh tim mạch'),
 (N'Chuyển hóa / Nội tiết', N'Tiểu đường, tuyến giáp');

-- MERGE idempotent, OUTPUT vào #sp_out (đã khai báo)
MERGE INTO specialties AS T
USING (SELECT name, description FROM @Specialties) AS S
  ON T.name = S.name
WHEN NOT MATCHED THEN
  INSERT (name, description) VALUES (S.name, S.description)
OUTPUT $action, inserted.specialty_id, inserted.name INTO #sp_out;

-- Kiểm tra kết quả
SELECT 'Inserted/Updated output (may be empty if none inserted):' AS note;
SELECT * FROM #sp_out;

SELECT COUNT(*) AS total_specialties FROM specialties;
SELECT specialty_id, name, description FROM specialties ORDER BY specialty_id;

