/**
 * Reports & Analytics Controller
 */

import { executeQuery } from '../config/database.js';

const isProduction = process.env.NODE_ENV === 'production';
const allowDemoFallback = process.env.REPORTS_DEMO_FALLBACK === 'true' || !isProduction;

const normalizeStatus = (status) => String(status || 'pending').toLowerCase();

const monthKey = (dateValue) => {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toISOString().slice(0, 7);
};

const rollingStats = (arr, idx, field, windowSize = 3) => {
  const start = Math.max(0, idx - windowSize + 1);
  const values = arr.slice(start, idx + 1).map((item) => Number(item[field] || 0));
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return { avg, std: Math.sqrt(variance) };
};

const estimateFee = (specialtyName) => {
  const key = String(specialtyName || '').toLowerCase();
  if (key.includes('cardio')) return 320000;
  if (key.includes('derma')) return 250000;
  if (key.includes('ent')) return 220000;
  if (key.includes('pediatric')) return 210000;
  if (key.includes('eye')) return 240000;
  return 200000;
};

const toIsoDate = (value) => {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
};

const toTimeHHMM = (value) => {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }

  const raw = String(value);
  const hhmmMatch = raw.match(/\b(\d{2}:\d{2})/);
  if (hhmmMatch) return hhmmMatch[1];

  return raw.slice(0, 5);
};

const mapAnalyticsRow = (row) => ({
  id: row.AppointmentID,
  date: toIsoDate(row.AppointmentDate),
  time: toTimeHHMM(row.AppointmentTime),
  status: normalizeStatus(row.Status),
  patient: row.PatientName || 'Unknown Patient',
  doctor: row.DoctorName || 'Unknown Doctor',
  service: row.SpecialtyName || 'General Consultation',
  fee: Number(row.FeeEstimate || estimateFee(row.SpecialtyName)),
});

const computeAnalytics = (appointments) => {
  const normalized = appointments.map((item) => ({
    ...item,
    status: normalizeStatus(item.status),
    fee: Number(item.fee || estimateFee(item.service)),
  }));

  const groupedMonthly = {};
  normalized.forEach((a) => {
    const key = monthKey(a.date);
    if (!groupedMonthly[key]) {
      groupedMonthly[key] = {
        month: key,
        appointments: 0,
        revenue: 0,
        completed: 0,
        cancelled: 0,
        patients: new Set(),
      };
    }

    groupedMonthly[key].appointments += 1;
    groupedMonthly[key].revenue += Number(a.fee || 0);
    groupedMonthly[key].patients.add(a.patient);
    if (a.status === 'completed') groupedMonthly[key].completed += 1;
    if (a.status === 'cancelled') groupedMonthly[key].cancelled += 1;
  });

  const monthlyBase = Object.values(groupedMonthly)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      month: item.month,
      appointments: item.appointments,
      revenue: item.revenue,
      uniquePatients: item.patients.size,
      completionRate: item.appointments ? Math.round((item.completed / item.appointments) * 100) : 0,
      cancellationRate: item.appointments ? Math.round((item.cancelled / item.appointments) * 100) : 0,
    }));

  const monthlySeries = monthlyBase.map((item, idx) => {
    const { avg, std } = rollingStats(monthlyBase, idx, 'appointments', 3);
    const lower = Math.max(0, avg - std * 1.28);
    const upper = avg + std * 1.28;
    return {
      ...item,
      trend: Number(avg.toFixed(2)),
      lower: Number(lower.toFixed(2)),
      upper: Number(upper.toFixed(2)),
      band: Number((upper - lower).toFixed(2)),
    };
  });

  const ordered = [...normalized].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const seenPatients = new Set();
  const cohortMap = {};

  ordered.forEach((a) => {
    const month = monthKey(a.date);
    if (!cohortMap[month]) {
      cohortMap[month] = {
        month,
        newSet: new Set(),
        returningSet: new Set(),
      };
    }

    if (seenPatients.has(a.patient)) cohortMap[month].returningSet.add(a.patient);
    else cohortMap[month].newSet.add(a.patient);

    seenPatients.add(a.patient);
  });

  const cohortSeries = Object.values(cohortMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => {
      const newPatients = item.newSet.size;
      const returningPatients = item.returningSet.size;
      const total = newPatients + returningPatients;
      return {
        month: item.month,
        newPatients,
        returningPatients,
        retentionRate: total ? Math.round((returningPatients / total) * 100) : 0,
      };
    });

  const doctorMap = {};
  normalized.forEach((a) => {
    if (!doctorMap[a.doctor]) {
      doctorMap[a.doctor] = {
        name: a.doctor,
        specialty: a.service || 'General Consultation',
        appointments: 0,
        completed: 0,
        revenue: 0,
      };
    }

    doctorMap[a.doctor].appointments += 1;
    doctorMap[a.doctor].revenue += Number(a.fee || 0);
    if (a.status === 'completed') doctorMap[a.doctor].completed += 1;
  });

  const doctorMetrics = Object.values(doctorMap).map((d) => ({
    ...d,
    completionRate: d.appointments ? Math.round((d.completed / d.appointments) * 100) : 0,
  }));

  const monthlyByPair = {};
  normalized.forEach((a) => {
    const key = `${a.doctor}__${a.service}`;
    const month = monthKey(a.date);
    if (!monthlyByPair[key]) monthlyByPair[key] = {};
    monthlyByPair[key][month] = (monthlyByPair[key][month] || 0) + 1;
  });

  const anomalies = [];
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
      anomalies.push({
        type: 'demand-spike',
        doctor,
        service,
        severity: z >= 2 ? 'high' : 'medium',
        detail: `${doctor} - ${service} jumped to ${latest} visits (z=${z.toFixed(2)}).`,
      });
    }
  });

  const latestMonth = monthlySeries[monthlySeries.length - 1];
  const latestCohort = cohortSeries[cohortSeries.length - 1];
  const aiNotes = [];

  if (latestMonth) {
    if (latestMonth.appointments > latestMonth.upper) {
      aiNotes.push('Demand spike detected over confidence band. Consider overflow capacity.');
    }
    if (latestMonth.completionRate < 80) {
      aiNotes.push(`Completion rate ${latestMonth.completionRate}% is below outpatient target (80%+).`);
    }
  }

  if (latestCohort && latestCohort.retentionRate < 35) {
    aiNotes.push(`Cohort retention ${latestCohort.retentionRate}% is low. Increase follow-up reminder automation.`);
  }

  if (!aiNotes.length) {
    aiNotes.push('Operations look stable across throughput, quality, and retention indicators.');
  }

  return {
    totals: {
      totalAppointments: normalized.length,
      totalPatients: new Set(normalized.map((a) => a.patient)).size,
      totalRevenue: normalized.reduce((sum, a) => sum + Number(a.fee || 0), 0),
    },
    monthlySeries,
    cohortSeries,
    doctorMetrics,
    anomalies: anomalies.slice(0, 10),
    aiNotes,
  };
};

const demoAppointments = () => [
  { id: 1, date: '2025-04-10', time: '09:00', status: 'completed', patient: 'Patient A', doctor: 'Dr. Smith', service: 'Cardiology', fee: 320000 },
  { id: 2, date: '2025-04-21', time: '10:00', status: 'pending', patient: 'Patient B', doctor: 'Dr. John', service: 'ENT Exam', fee: 220000 },
  { id: 3, date: '2025-05-03', time: '11:00', status: 'completed', patient: 'Patient A', doctor: 'Dr. Smith', service: 'Cardiology', fee: 320000 },
  { id: 4, date: '2025-05-22', time: '14:00', status: 'cancelled', patient: 'Patient C', doctor: 'Dr. Anna', service: 'Dermatology', fee: 250000 },
  { id: 5, date: '2025-06-05', time: '09:30', status: 'completed', patient: 'Patient D', doctor: 'Dr. Smith', service: 'Cardiology', fee: 320000 },
  { id: 6, date: '2025-06-18', time: '13:00', status: 'completed', patient: 'Patient E', doctor: 'Dr. John', service: 'ENT Exam', fee: 220000 },
  { id: 7, date: '2025-07-11', time: '08:45', status: 'completed', patient: 'Patient A', doctor: 'Dr. Smith', service: 'Cardiology', fee: 320000 },
  { id: 8, date: '2025-07-17', time: '10:30', status: 'completed', patient: 'Patient F', doctor: 'Dr. Anna', service: 'Dermatology', fee: 250000 },
  { id: 9, date: '2025-08-01', time: '15:00', status: 'pending', patient: 'Patient G', doctor: 'Dr. Smith', service: 'Cardiology', fee: 320000 },
  { id: 10, date: '2025-08-23', time: '16:00', status: 'completed', patient: 'Patient H', doctor: 'Dr. John', service: 'ENT Exam', fee: 220000 },
];

const fetchAppointmentsViaProcedure = async (query) => {
  const { from, to, doctorId, status, service } = query;

  const result = await executeQuery(
    `
      EXEC dbo.sp_GetAnalyticsAppointments
        @FromDate = @from,
        @ToDate = @to,
        @DoctorId = @doctorId,
        @Status = @status,
        @Service = @service;
    `,
    {
      from: from || null,
      to: to || null,
      doctorId: doctorId ? Number(doctorId) : null,
      status: status ? String(status).toLowerCase() : null,
      service: service || null,
    }
  );

  return result.recordset.map(mapAnalyticsRow);
};

const fetchAppointments = async (query) => {
  const { from, to, doctorId, status, service } = query;

  // Procedure-first strategy: when SQL script for advanced CSDL is deployed,
  // backend uses pre-optimized DB logic. If procedure isn't deployed yet,
  // we gracefully fallback to direct SQL query.
  try {
    const rows = await fetchAppointmentsViaProcedure(query);
    if (rows.length) return rows;
  } catch {
    // Silent fallback is intentional here.
  }

  let sqlQuery = `
    SELECT
      a.AppointmentID,
      a.AppointmentDate,
      a.AppointmentTime,
      a.Status,
      p.FullName AS PatientName,
      d.FullName AS DoctorName,
      s.SpecialtyName,
      CASE
        WHEN LOWER(ISNULL(s.SpecialtyName, '')) LIKE '%cardio%' THEN 320000
        WHEN LOWER(ISNULL(s.SpecialtyName, '')) LIKE '%derma%' THEN 250000
        WHEN LOWER(ISNULL(s.SpecialtyName, '')) LIKE '%ent%' THEN 220000
        WHEN LOWER(ISNULL(s.SpecialtyName, '')) LIKE '%pediatric%' THEN 210000
        WHEN LOWER(ISNULL(s.SpecialtyName, '')) LIKE '%eye%' THEN 240000
        ELSE 200000
      END AS FeeEstimate
    FROM Appointments a
    LEFT JOIN Patients p ON a.PatientID = p.PatientID
    LEFT JOIN Doctors d ON a.DoctorID = d.DoctorID
    LEFT JOIN Specialties s ON d.SpecialtyID = s.SpecialtyID
    WHERE 1=1
  `;

  const params = {};

  if (from) {
    sqlQuery += ' AND a.AppointmentDate >= @from';
    params.from = from;
  }

  if (to) {
    sqlQuery += ' AND a.AppointmentDate <= @to';
    params.to = to;
  }

  if (doctorId) {
    sqlQuery += ' AND a.DoctorID = @doctorId';
    params.doctorId = Number(doctorId);
  }

  if (status) {
    sqlQuery += ' AND LOWER(a.Status) = @status';
    params.status = String(status).toLowerCase();
  }

  if (service) {
    sqlQuery += ' AND s.SpecialtyName = @service';
    params.service = service;
  }

  sqlQuery += ' ORDER BY a.AppointmentDate ASC, a.AppointmentTime ASC';

  const result = await executeQuery(sqlQuery, params);
  return result.recordset.map(mapAnalyticsRow);
};

export const getAnalytics = async (req, res) => {
  try {
    let rows = [];
    let source = 'database';
    let warning = null;

    try {
      rows = await fetchAppointments(req.query);
      if (!rows.length && allowDemoFallback) {
        source = 'demo-fallback';
        warning = 'Database query returned no rows; demo dataset is used for analytics preview.';
        rows = demoAppointments();
      }
    } catch (error) {
      if (!allowDemoFallback) {
        return res.status(503).json({
          success: false,
          message: 'Analytics service unavailable: backend data source is not reachable.',
        });
      }

      source = 'demo-fallback';
      warning = `Database unavailable (${error.message}); demo dataset is used.`;
      rows = demoAppointments();
    }

    const analytics = computeAnalytics(rows);

    res.json({
      success: true,
      data: {
        ...analytics,
        source,
        warning,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating analytics',
    });
  }
};

export const askAssistant = async (req, res) => {
  try {
    const { question = '' } = req.body || {};

    let rows = [];
    try {
      rows = await fetchAppointments(req.body?.filters || {});
      if (!rows.length && allowDemoFallback) rows = demoAppointments();
    } catch {
      if (!allowDemoFallback) {
        return res.status(503).json({
          success: false,
          message: 'Assistant unavailable: backend analytics data source is not reachable.',
        });
      }

      rows = demoAppointments();
    }

    const analytics = computeAnalytics(rows);
    const q = String(question).toLowerCase();

    let answer = 'Operations look stable. Continue monitoring completion and retention monthly.';

    if (q.includes('retention') || q.includes('cohort')) {
      const latest = analytics.cohortSeries[analytics.cohortSeries.length - 1];
      answer = latest
        ? `Latest cohort retention is ${latest.retentionRate}% in ${latest.month}. Improve follow-up reminders for chronic care groups.`
        : 'Not enough data to calculate cohort retention.';
    } else if (q.includes('doctor') || q.includes('performance')) {
      const ranked = [...analytics.doctorMetrics].sort((a, b) => b.completionRate - a.completionRate);
      const top = ranked[0];
      answer = top
        ? `${top.name} leads with ${top.completionRate}% completion across ${top.appointments} appointments.`
        : 'Not enough doctor-level data for performance ranking.';
    } else if (q.includes('anomaly') || q.includes('risk') || q.includes('spike')) {
      answer = analytics.anomalies.length
        ? `Detected ${analytics.anomalies.length} anomaly signal(s). Highest severity: ${analytics.anomalies[0].detail}`
        : 'No significant anomaly signal detected for the selected range.';
    } else if (q.includes('revenue')) {
      const latest = analytics.monthlySeries[analytics.monthlySeries.length - 1];
      answer = latest
        ? `Latest monthly revenue is ${latest.revenue.toLocaleString()} VND in ${latest.month}.`
        : 'Not enough monthly data to report revenue trend.';
    }

    res.json({
      success: true,
      data: {
        answer,
        highlights: analytics.aiNotes,
        anomalies: analytics.anomalies.slice(0, 3),
        generatedAt: new Date().toISOString(),
        engine: 'explainable-analytics-v1',
      },
    });
  } catch (error) {
    console.error('Assistant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating assistant response',
    });
  }
};

export default {
  getAnalytics,
  askAssistant,
};
