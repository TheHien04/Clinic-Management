import {
  clamp,
  computeDeltaPercent,
  inferPatientRiskBand,
  monthKey,
  rollingStats,
  toDateOnly,
} from './reportUtils';

export const buildMonthlySeries = (appointments) => {
  const grouped = {};
  appointments.forEach((a) => {
    const key = monthKey(a.date);
    if (!grouped[key]) grouped[key] = { month: key, appointments: 0, revenue: 0, completed: 0, cancelled: 0, patients: new Set() };
    grouped[key].appointments += 1;
    grouped[key].revenue += Number(a.fee || 0);
    grouped[key].patients.add(a.patient);
    if (a.status === 'completed') grouped[key].completed += 1;
    if (a.status === 'cancelled') grouped[key].cancelled += 1;
  });
  const base = Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month)).map((item) => ({
    month: item.month,
    appointments: item.appointments,
    revenue: item.revenue,
    uniquePatients: item.patients.size,
    completionRate: item.appointments ? Math.round((item.completed / item.appointments) * 100) : 0,
    cancellationRate: item.appointments ? Math.round((item.cancelled / item.appointments) * 100) : 0,
  }));
  return base.map((item, idx) => {
    const { avg, std } = rollingStats(base, idx, 'appointments', 3);
    const lower = Math.max(0, avg - std * 1.28);
    const upper = avg + std * 1.28;
    return { ...item, trend: Number(avg.toFixed(2)), lower: Number(lower.toFixed(2)), upper: Number(upper.toFixed(2)), band: Number((upper - lower).toFixed(2)) };
  });
};

export const buildCohortSeries = (appointments) => {
  const ordered = [...appointments].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const seenPatients = new Set();
  const bucket = {};
  ordered.forEach((a) => {
    const m = monthKey(a.date);
    if (!bucket[m]) bucket[m] = { month: m, newSet: new Set(), returningSet: new Set() };
    if (seenPatients.has(a.patient)) bucket[m].returningSet.add(a.patient);
    else bucket[m].newSet.add(a.patient);
    seenPatients.add(a.patient);
  });
  return Object.values(bucket).sort((a, b) => a.month.localeCompare(b.month)).map((item) => {
    const newPatients = item.newSet.size;
    const returningPatients = item.returningSet.size;
    const total = newPatients + returningPatients;
    return { month: item.month, newPatients, returningPatients, retentionRate: total ? Math.round((returningPatients / total) * 100) : 0 };
  });
};

export const buildAnomalySignals = (appointments) => {
  if (!appointments.length) return [];
  const monthlyByPair = {};
  appointments.forEach((a) => {
    const key = `${a.doctor}__${a.service}`;
    const month = monthKey(a.date);
    if (!monthlyByPair[key]) monthlyByPair[key] = {};
    monthlyByPair[key][month] = (monthlyByPair[key][month] || 0) + 1;
  });
  const items = [];
  Object.entries(monthlyByPair).forEach(([pair, monthMap]) => {
    const points = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0]));
    if (points.length < 3) return;
    const values = points.map((p) => p[1]);
    const latest = values[values.length - 1];
    const base = values.slice(0, -1);
    const mean = base.reduce((s, v) => s + v, 0) / base.length;
    const variance = base.reduce((s, v) => s + (v - mean) ** 2, 0) / base.length;
    const std = Math.sqrt(variance);
    const z = std > 0 ? (latest - mean) / std : 0;
    if (z >= 1.5 && latest >= 3) {
      const [doctor, service] = pair.split('__');
      items.push({ type: 'demand-spike', doctor, service, detail: `${doctor} - ${service} jumped to ${latest} visits this month (z=${z.toFixed(2)}).`, severity: z >= 2 ? 'high' : 'medium' });
    }
  });
  const byDoctor = {};
  appointments.forEach((a) => {
    if (!byDoctor[a.doctor]) byDoctor[a.doctor] = { total: 0, cancelled: 0 };
    byDoctor[a.doctor].total += 1;
    if (a.status === 'cancelled') byDoctor[a.doctor].cancelled += 1;
  });
  Object.entries(byDoctor).forEach(([doctor, stat]) => {
    const rate = stat.total ? (stat.cancelled / stat.total) * 100 : 0;
    if (stat.total >= 3 && rate > 30) items.push({ type: 'cancellation-risk', doctor, service: 'all services', detail: `${doctor} has cancellation rate ${rate.toFixed(0)}% (${stat.cancelled}/${stat.total}).`, severity: rate > 45 ? 'high' : 'medium' });
  });
  return items.slice(0, 6);
};

export const buildComparisonMetrics = ({ appointments, dateRange, doctorFilter, serviceFilter, statusFilter }) => {
  const scoped = appointments.filter((app) => (!doctorFilter || app.doctor === doctorFilter) && (!serviceFilter || app.service === serviceFilter) && (!statusFilter || app.status === statusFilter));
  const empty = { current: { appointments: 0, revenue: 0, completionRate: 0, patients: 0 }, previous: { appointments: 0, revenue: 0, completionRate: 0, patients: 0 }, deltas: { appointments: 0, revenue: 0, completionRate: 0, patients: 0 } };
  if (!scoped.length) return empty;
  const dates = scoped.map((item) => toDateOnly(item.date)).filter(Boolean).sort((a, b) => a - b);
  if (!dates.length) return empty;
  const currentFrom = toDateOnly(dateRange.from) || dates[0];
  const currentTo = toDateOnly(dateRange.to) || dates[dates.length - 1];
  const windowDays = Math.max(1, Math.floor((currentTo - currentFrom) / 86400000) + 1);
  const previousTo = new Date(currentFrom); previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo); previousFrom.setDate(previousFrom.getDate() - (windowDays - 1));
  const inRange = (item, from, to) => { const d = toDateOnly(item.date); return Boolean(d && d >= from && d <= to); };
  const summarize = (rows) => ({ appointments: rows.length, revenue: rows.reduce((sum, row) => sum + Number(row.fee || 0), 0), completionRate: rows.length ? Math.round((rows.filter((r) => r.status === 'completed').length / rows.length) * 100) : 0, patients: new Set(rows.map((row) => row.patient)).size });
  const current = summarize(scoped.filter((item) => inRange(item, currentFrom, currentTo)));
  const previous = summarize(scoped.filter((item) => inRange(item, previousFrom, previousTo)));
  return { current, previous, deltas: { appointments: computeDeltaPercent(current.appointments, previous.appointments), revenue: computeDeltaPercent(current.revenue, previous.revenue), completionRate: current.completionRate - previous.completionRate, patients: computeDeltaPercent(current.patients, previous.patients) } };
};

export const buildDataQuality = (appointments) => {
  const total = appointments.length;
  if (!total) return { score: 100, grade: 'A', missingService: 0, missingFee: 0, invalidDate: 0, duplicatePairs: 0, issues: [] };
  const missingService = appointments.filter((a) => !String(a.service || '').trim()).length;
  const missingFee = appointments.filter((a) => Number(a.fee || 0) <= 0).length;
  const invalidDate = appointments.filter((a) => Number.isNaN(new Date(a.date).getTime())).length;
  const keyCount = new Map();
  appointments.forEach((a) => { const key = `${a.patient}__${a.doctor}__${a.date}`; keyCount.set(key, (keyCount.get(key) || 0) + 1); });
  const duplicatePairs = Array.from(keyCount.values()).filter((count) => count > 1).length;
  const weightedErrorRate = (missingService / total) * 0.35 + (missingFee / total) * 0.35 + (invalidDate / total) * 0.2 + (duplicatePairs / total) * 0.1;
  const score = Math.round(clamp(100 - weightedErrorRate * 100, 0, 100));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';
  const issues = [];
  if (missingService) issues.push(`${missingService} appointment(s) missing service label.`);
  if (missingFee) issues.push(`${missingFee} appointment(s) have missing or zero fee.`);
  if (invalidDate) issues.push(`${invalidDate} appointment(s) contain invalid date format.`);
  if (duplicatePairs) issues.push(`${duplicatePairs} duplicate patient-doctor-date pair(s) detected.`);
  if (!issues.length) issues.push('Dataset is clean under current quality rules.');
  return { score, grade, missingService, missingFee, invalidDate, duplicatePairs, issues };
};

export const buildPatientRiskTrajectory = (appointments) => {
  const grouped = {};
  appointments.forEach((item) => { const month = monthKey(item.date); if (!grouped[month]) grouped[month] = { month, high: 0, medium: 0, low: 0 }; grouped[month][inferPatientRiskBand(item)] += 1; });
  return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month)).map((row) => { const total = row.high + row.medium + row.low; return { ...row, riskPressure: total ? Math.round((row.high / total) * 100) : 0 }; });
};

export const buildPrecisionCareRows = (appointments, now = new Date()) => {
  const grouped = {};
  appointments.forEach((item) => {
    const patient = item.patient || 'Unknown Patient';
    if (!grouped[patient]) grouped[patient] = { patient, appointments: 0, completed: 0, cancelled: 0, pending: 0, totalFee: 0, lastDate: '', lastService: 'General Service', lastDoctor: 'Unknown Doctor' };
    const row = grouped[patient]; row.appointments += 1; row.totalFee += Number(item.fee || 0);
    if (item.status === 'completed') row.completed += 1;
    if (item.status === 'cancelled') row.cancelled += 1;
    if (item.status === 'pending' || item.status === 'booked') row.pending += 1;
    if (!row.lastDate || String(item.date || '') > row.lastDate) { row.lastDate = String(item.date || ''); row.lastService = item.service || 'General Service'; row.lastDoctor = item.doctor || 'Unknown Doctor'; }
  });
  return Object.values(grouped).map((row) => {
    const avgFee = row.appointments ? Math.round(row.totalFee / row.appointments) : 0;
    const completionRate = row.appointments ? Math.round((row.completed / row.appointments) * 100) : 0;
    const lastDate = row.lastDate ? new Date(row.lastDate) : null;
    const careGapDays = lastDate && !Number.isNaN(lastDate.getTime()) ? Math.max(0, Math.floor((now.getTime() - lastDate.getTime()) / 86400000)) : 0;
    const serviceRisk = /cardio|neuro|onc|resp/i.test(row.lastService) ? 12 : 4;
    const gapRisk = careGapDays > 60 ? 20 : careGapDays > 30 ? 12 : 4;
    const riskScore = Math.round(clamp(row.cancelled * 22 + row.pending * 14 + gapRisk + serviceRisk + (avgFee > 250000 ? 8 : 4), 0, 100));
    const riskBand = riskScore >= 70 ? 'high' : riskScore >= 45 ? 'medium' : 'low';
    const nextBestAction = riskBand === 'high' ? 'Activate nurse outreach + telehealth follow-up in 24h' : riskBand === 'medium' ? 'Send adherence reminder and schedule next checkpoint' : 'Keep preventive care cadence and monitor monthly';
    return { ...row, avgFee, completionRate, careGapDays, riskScore, riskBand, nextBestAction };
  }).sort((a, b) => b.riskScore - a.riskScore);
};
