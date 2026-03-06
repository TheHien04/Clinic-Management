import React from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../constants';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console (in production, send to error tracking service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.background,
          padding: '20px'
        }}>
          <div style={{
            background: COLORS.cardBackground,
            borderRadius: 16,
            padding: '48px 32px',
            maxWidth: 600,
            boxShadow: '0 8px 40px rgba(211, 47, 47, 0.15)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ color: COLORS.error, marginBottom: 16, fontSize: '1.8rem' }}>
              Oops! Something went wrong
            </h1>
            <p style={{ color: COLORS.textSecondary, marginBottom: 24, lineHeight: 1.6 }}>
              We're sorry for the inconvenience. An unexpected error occurred.
              {this.props.showDetails && this.state.error && (
                <>
                  <br /><br />
                  <strong>Error:</strong> {this.state.error.toString()}
                </>
              )}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  background: COLORS.primary,
                  color: COLORS.textWhite,
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(25, 118, 210, 0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = COLORS.primaryDark;
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = COLORS.primary;
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                🏠 Go to Home
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: COLORS.cardBackground,
                  color: COLORS.primary,
                  border: `2px solid ${COLORS.primary}`,
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = COLORS.border;
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = COLORS.cardBackground;
                }}
              >
                🔄 Reload Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details style={{ marginTop: 32, textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', color: COLORS.error, fontWeight: 600 }}>
                  Error Details (Development Only)
                </summary>
                <pre style={{
                  background: '#f5f5f5',
                  padding: 16,
                  borderRadius: 8,
                  overflow: 'auto',
                  fontSize: '0.85rem',
                  marginTop: 12,
                  maxHeight: 300
                }}>
                  {this.state.error && this.state.error.stack}
                  {'\n\n'}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  showDetails: PropTypes.bool,
};

ErrorBoundary.defaultProps = {
  showDetails: false,
};

export default ErrorBoundary;
