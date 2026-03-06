// Theme constants - colors, sizes, spacing
export const COLORS = {
  // Primary colors
  primary: '#1976d2',
  primaryLight: '#64b5f6',
  primaryDark: '#1565c0',
  
  // Status colors
  success: '#43a047',
  warning: '#ffa000',
  warningLight: '#fbc02d',
  error: '#d32f2f',
  info: '#1976d2',
  
  // UI colors
  background: '#f7faff',
  backgroundLight: '#f7fbff',
  backgroundDark: '#f4f8fd',
  cardBackground: '#fff',
  
  // Border colors
  border: '#e3f2fd',
  borderLight: '#e3eaf3',
  borderDark: '#b0bec5',
  
  // Text colors
  textPrimary: '#1976d2',
  textSecondary: '#444',
  textLight: '#888',
  textWhite: '#fff',
  
  // Special colors
  chronic: '#fbc02d',
  child: '#1976d2',
  elderly: '#d32f2f',
  
  // Chart colors
  chartBlue: '#1976d2',
  chartGreen: '#43a047',
  chartYellow: '#ffb74d',
  chartRed: '#d32f2f',
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
  status: ['#4caf50', '#fbc02d', '#1976d2', '#ff9800', '#d32f2f'],
};
