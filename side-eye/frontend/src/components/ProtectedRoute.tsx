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
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (requireAuth && !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requireEmailVerification && currentUser && !currentUser.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (require2FA && userProfile && !userProfile.isVerified) {
    return <Navigate to="/2fa" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 