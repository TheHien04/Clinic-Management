import React from 'react';
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { hasValidSession } from '../utils/authSession';
import { useAuth } from '../contexts/auth-context';

/**
 * ProtectedRoute - Wrapper component for routes that require authentication
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, loading } = useAuth();

  // AuthProvider restores the tab-scoped token and persisted user in an
  // effect. Waiting for that hydration prevents valid deep links from being
  // redirected to Dashboard before the user's role is available.
  if (loading) {
    return <div className="route-loading" role="status" aria-live="polite">Loading workspace…</div>;
  }

  if (!hasValidSession()) {
    // Redirect to login if not authenticated
    return <Navigate to={`/${ROUTES.LOGIN}`} replace />;
  }

  const normalizedRole = String(user?.role || '').toLowerCase();
  if (roles.length > 0 && !roles.includes(normalizedRole)) {
    const fallback = normalizedRole === 'patient' || normalizedRole === 'user'
      ? `/${ROUTES.PATIENT_PORTAL}`
      : `/${ROUTES.DASHBOARD}`;
    return <Navigate to={fallback} replace />;
  }
  
  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  roles: PropTypes.arrayOf(PropTypes.string),
};

export default ProtectedRoute;
