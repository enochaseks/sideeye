import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { CircularProgress, Box } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireEmailVerification?: boolean;
  requireDeviceSetup?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireEmailVerification = true,
  requireDeviceSetup = true
}) => {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // If not loading and no user, redirect to login
    if (!loading && !currentUser) {
      window.location.href = `/login?redirect=${encodeURIComponent(location.pathname)}`;
    }
  }, [currentUser, loading, location]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (requireAuth && !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requireEmailVerification && currentUser && !(currentUser as User).emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (requireDeviceSetup && currentUser && userProfile && !userProfile.sourceCodeSetupComplete) {
    return <Navigate to="/setup-source-code" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 