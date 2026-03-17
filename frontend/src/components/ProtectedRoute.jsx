import React from 'react';
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { hasValidSession } from '../utils/authSession';

/**
 * ProtectedRoute - Wrapper component for routes that require authentication
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children }) => {
  if (!hasValidSession()) {
    // Redirect to login if not authenticated
    return <Navigate to={`/${ROUTES.LOGIN}`} replace />;
  }
  
  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ProtectedRoute;
