import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

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

  if (loading) {
    return <LoadingSpinner message="Checking authentication..." />;
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