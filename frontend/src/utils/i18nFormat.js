import { APP_I18N } from '../constants';

const numberFormatter = new Intl.NumberFormat(APP_I18N.LOCALE);

export const formatNumber = (value) => numberFormatter.format(Number(value || 0));

export const formatMonthShort = (dateValue) => {
  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_I18N.LOCALE, { month: 'short' }).format(parsed);
};

export const formatDateTimeCompact = (dateValue) => {
  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return 'unknown';
  }
  return new Intl.DateTimeFormat(APP_I18N.LOCALE, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

export const formatDateByOptions = (dateValue, options) => {
  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }
  return new Intl.DateTimeFormat(APP_I18N.LOCALE, options).format(parsed);
};

export const formatDateShort = (dateValue) => {
  return formatDateByOptions(dateValue, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatTimeShort = (dateValue) => {
  return formatDateByOptions(dateValue, {
    hour: '2-digit',
    minute: '2-digit',
  });
};
