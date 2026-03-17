// Theme constants - colors, sizes, spacing
export const COLORS = {
  // Primary colors
  primary: 'var(--brand-500)',
  primaryLight: '#64b5f6',
  primaryDark: 'var(--brand-600)',
  
  // Status colors
  success: 'var(--success-fg)',
  warning: 'var(--warning-fg)',
  warningLight: 'var(--warning-fg)',
  error: 'var(--danger-fg)',
  info: 'var(--brand-500)',
  
  // UI colors
  background: '#f7faff',
  backgroundLight: '#f7fbff',
  backgroundDark: '#f4f8fd',
  cardBackground: '#fff',
  
  // Border colors
  border: 'var(--brand-100)',
  borderLight: '#e3eaf3',
  borderDark: 'var(--surface-border)',
  
  // Text colors
  textPrimary: 'var(--brand-500)',
  textSecondary: '#444',
  textLight: '#888',
  textWhite: '#fff',
  
  // Special colors
  chronic: 'var(--warning-fg)',
  child: 'var(--brand-500)',
  elderly: 'var(--danger-fg)',
  
  // Chart colors
  chartBlue: 'var(--brand-500)',
  chartGreen: 'var(--success-fg)',
  chartYellow: '#ffb74d',
  chartRed: 'var(--danger-fg)',
  chartTeal: '#4db6ac',
  chartOrange: '#ff9800',
};

export const SIZES = {
  // Max widths
  maxWidthContent: 1400,
  maxWidthContentOld: 1200,
  
  // Border radius
  borderRadiusSmall: 6,
  borderRadiusMedium: 10,
  borderRadiusLarge: 16,
  borderRadiusXL: 18,
  borderRadiusXXL: 20,
  
  // Spacing
  spacingXS: 8,
  spacingS: 12,
  spacingM: 16,
  spacingL: 24,
  spacingXL: 32,
  spacingXXL: 48,
  
  // Padding
  paddingCard: 32,
  paddingButton: '10px 22px',
  paddingInput: '8px 12px',
  
  // Font sizes
  fontSizeSmall: '0.98rem',
  fontSizeMedium: '1rem',
  fontSizeLarge: '1.08rem',
  fontSizeXL: '1.15rem',
  fontSizeTitle: '2rem',
  fontSizeHero: '2.3rem',
  
  // Sidebar
  sidebarWidth: 200,
  
  // Header
  headerHeight: 64,
  
  // Scrollbar
  scrollbarWidth: 8,
};

export const SHADOWS = {
  small: '0 2px 8px #e0e7ef',
  medium: '0 2px 16px rgba(25, 118, 210, 0.1)',
  large: '0 4px 24px #dbeafe',
  card: '0 2px 16px rgba(25, 118, 210, 0.08)',
  elevated: '0 8px 40px rgba(25, 118, 210, 0.13), 0 2px 8px rgba(0, 0, 0, 0.08)',
  button: '0 2px 8px #e0e7ef',
};

export const TRANSITIONS = {
  fast: '0.18s',
  normal: '0.2s',
  slow: '0.3s',
};

export const Z_INDEX = {
  dropdown: 100,
  sticky: 100,
  modal: 1000,
  toast: 2000,
};

// Status badge colors
export const STATUS_COLORS = {
  Pending: COLORS.warningLight,
  Confirmed: COLORS.primary,
  'Checked-in': COLORS.success,
  Completed: COLORS.success,
  Cancelled: COLORS.error,
  active: COLORS.success,
  onleave: COLORS.warning,
  inactive: COLORS.error,
};

// Chart color palettes
export const CHART_COLORS = {
  appointment: [COLORS.chartBlue, COLORS.chartGreen, COLORS.chartYellow, COLORS.chartRed],
  pie: [COLORS.chartTeal, COLORS.chartYellow, COLORS.chartBlue],
  status: ['#4caf50', 'var(--warning-fg)', 'var(--brand-500)', '#ff9800', 'var(--danger-fg)'],
};
