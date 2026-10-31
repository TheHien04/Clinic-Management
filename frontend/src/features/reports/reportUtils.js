export const normalizeStatus = (status) => String(status || 'pending').toLowerCase();

export const monthKey = (dateValue) => (dateValue ? dateValue.slice(0, 7) : 'Unknown');

export const rollingStats = (arr, idx, field, windowSize = 3) => {
  const start = Math.max(0, idx - windowSize + 1);
  const values = arr.slice(start, idx + 1).map((item) => Number(item[field] || 0));
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return { avg, std: Math.sqrt(variance) };
};

export const validateDtxPolicyPayload = (payload) => {
  const completion = Number(payload?.sessionWeights?.completion ?? Number.NaN);
  const engagement = Number(payload?.sessionWeights?.engagement ?? Number.NaN);
  const riskInverse = Number(payload?.sessionWeights?.riskInverse ?? Number.NaN);
  const sumWeights = completion + engagement + riskInverse;

  if ([completion, engagement, riskInverse].some((value) => Number.isNaN(value) || value < 0 || value > 1)) {
    throw new Error('sessionWeights must be numbers between 0 and 1');
  }
  if (Math.abs(sumWeights - 1) > 0.0001) {
    throw new Error('sessionWeights must sum to 1.0');
  }

  const high = Number(payload?.riskThresholds?.high ?? Number.NaN);
  const medium = Number(payload?.riskThresholds?.medium ?? Number.NaN);
  if ([high, medium].some((value) => Number.isNaN(value) || value < 0 || value > 100) || medium > high) {
    throw new Error('riskThresholds are invalid');
  }

  const expectedGainOffset = Number(payload?.expectedGainOffset ?? Number.NaN);
  if (Number.isNaN(expectedGainOffset)) throw new Error('expectedGainOffset is invalid');

  const min = Number(payload?.expectedGainClamp?.min ?? Number.NaN);
  const max = Number(payload?.expectedGainClamp?.max ?? Number.NaN);
  if ([min, max].some(Number.isNaN) || min > max) throw new Error('expectedGainClamp is invalid');

  return {
    sessionWeights: { completion, engagement, riskInverse },
    riskThresholds: { high, medium },
    expectedGainOffset,
    expectedGainClamp: { min, max },
  };
};

export const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

export const computeDeltaPercent = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const hashString = (value) => String(value || '')
  .split('')
  .reduce((sum, char) => sum + char.charCodeAt(0), 0);

export const buildAuditChainEntryHash = (chainIndex, previousHash, row) => {
  const payload = JSON.stringify({ index: chainIndex, previousHash, row });
  const primary = hashString(payload).toString(16).padStart(8, '0');
  const secondary = hashString(`${payload}|${chainIndex - 1}`).toString(16).padStart(8, '0');
  return `${primary}${secondary}`;
};

export const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const inferPatientRiskBand = (row) => {
  const service = String(row.service || '').toLowerCase();
  const status = String(row.status || '').toLowerCase();
  const fee = Number(row.fee || 0);

  let riskScore = 0;
  if (status === 'cancelled') riskScore += 2;
  if (status === 'pending') riskScore += 1;
  if (service.includes('cardio') || service.includes('neuro')) riskScore += 2;
  if (service.includes('derma') || service.includes('general')) riskScore += 0.5;
  if (fee >= 250000) riskScore += 1;

  if (riskScore >= 3) return 'high';
  if (riskScore >= 1.5) return 'medium';
  return 'low';
};

export const getPreviousWeekRange = (now = new Date()) => {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const thisWeekMonday = new Date(now);
  thisWeekMonday.setHours(0, 0, 0, 0);
  thisWeekMonday.setDate(now.getDate() - daysSinceMonday);

  const previousMonday = new Date(thisWeekMonday);
  previousMonday.setDate(thisWeekMonday.getDate() - 7);
  const previousSunday = new Date(previousMonday);
  previousSunday.setDate(previousMonday.getDate() + 6);

  const toLocalDateKey = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  return {
    from: toLocalDateKey(previousMonday),
    to: toLocalDateKey(previousSunday),
  };
};

export const mapAppointmentStatusToFhir = (status) => {
  if (status === 'completed') return 'fulfilled';
  if (status === 'cancelled') return 'cancelled';
  return 'booked';
};

export const toBase64 = (bytes) => {
  let binary = '';
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary);
};

export const toHex = (bytes) => Array.from(bytes)
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

export const fromBase64 = (value) => {
  const binary = atob(value || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};
