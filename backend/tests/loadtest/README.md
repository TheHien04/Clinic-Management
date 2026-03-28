# 📈 Load Testing Scripts (K6)

## How to run

1. Install [k6](https://k6.io/docs/getting-started/installation/)
2. Run a script:
   ```bash
   k6 run backend/tests/loadtest/appointments.k6.js
   k6 run backend/tests/loadtest/patients.k6.js
   ```
   You can override BASE_URL, USERNAME, PASSWORD with env vars:
   ```bash
   BASE_URL=http://localhost:5000 USERNAME=test@clinic.com PASSWORD=Password123! k6 run backend/tests/loadtest/appointments.k6.js
   ```

## Scripts
- `appointments.k6.js`: Book appointments under load
- `patients.k6.js`: Create patients under load

## Thresholds
- 95% requests < 500ms
- Error rate < 1%

## Notes
- Use a non-MFA account for load test (admin/manager may require OTP)
- Clean up test data after large runs if needed
