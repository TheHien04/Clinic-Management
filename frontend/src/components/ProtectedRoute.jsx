import React from 'react';
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { STORAGE_KEYS, ROUTES } from '../constants';

/**
 * ProtectedRoute - Wrapper component for routes that require authentication
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem(STORAGE_KEYS.USER);
  
  if (!user) {
    // Redirect to login if not authenticated
    return <Navigate to={`/${ROUTES.LOGIN}`} replace />;
  }
  
  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ProtectedRoute;
