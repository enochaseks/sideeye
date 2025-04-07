import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireEmailVerification?: boolean;
  require2FA?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireEmailVerification = false,
  require2FA = false
}) => {
  const { user, loading, userProfile } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireEmailVerification && user && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (require2FA && userProfile && !userProfile.isVerified) {
    return <Navigate to="/2fa" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 