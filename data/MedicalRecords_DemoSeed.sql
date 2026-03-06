-- Seed demo data for medical_records
INSERT INTO medical_records (record_id, app_id, diagnosis_code, prescription, notes, follow_up_date)
VALUES
(1, 1, 'J06.9', 'Paracetamol 500mg x 10 days', 'Mild fever, cough', '2026-03-10'),
(2, 2, 'A00.0', 'ORS, Ciprofloxacin', 'Acute diarrhea', '2026-03-15'),
(3, 3, 'E11.9', 'Metformin 500mg', 'Type 2 diabetes, stable', '2026-04-01');

-- You may need to ensure app_id 1,2,3 exist in appointments table, and related patients/doctors exist.
-- Add more records as needed for demo.
