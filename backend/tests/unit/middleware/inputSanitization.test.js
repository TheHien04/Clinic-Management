import { describe, expect, it, vi } from 'vitest';
import inputSanitization from '../../../src/middleware/inputSanitization.js';

describe('input sanitization middleware', () => {
  it('preserves signed decision package payloads byte-for-byte', () => {
    const decisionPackage = {
      digest: 'digest',
      signature: 'signature',
      payload: {
        symptoms: 'low oxygen saturation (<92%)',
        recommendation: 'Escalate <24h',
      },
    };
    const req = {
      body: {
        decisionPackage,
        note: '  safe note  ',
      },
      query: {},
      params: {},
    };
    const next = vi.fn();

    inputSanitization(req, {}, next);

    expect(req.body.decisionPackage).toBe(decisionPackage);
    expect(req.body.decisionPackage.payload.symptoms).toBe('low oxygen saturation (<92%)');
    expect(req.body.note).toBe('safe note');
    expect(next).toHaveBeenCalledOnce();
  });
});
