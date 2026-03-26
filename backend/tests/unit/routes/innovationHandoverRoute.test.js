import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

import innovationRoutes from '../../../src/routes/innovation.js';
import { jwtConfig } from '../../../src/config/jwt.js';

describe('innovation handover route authorization', () => {
  it('returns 403 when a non-privileged role requests handover history', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/innovation', innovationRoutes);

    const patientToken = jwt.sign(
      { id: 101, email: 'patient@clinic.com', role: 'patient' },
      jwtConfig.secret,
      { expiresIn: '1h' }
    );

    const response = await request(app)
      .get('/api/innovation/operations/handover')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(String(response.body.message || '')).toContain('Access forbidden');
  });
});
