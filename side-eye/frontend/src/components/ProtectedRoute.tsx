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
  const { currentUser, loading, userProfile, tempUserForSourceCode } = useAuth();

  console.log(`ProtectedRoute Render: Loading: ${loading}, CurrentUser Exists: ${!!currentUser}, TempUser Exists: ${!!tempUserForSourceCode}`);

  if (loading) {
    console.log("ProtectedRoute: Auth loading is true, rendering spinner.");
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (requireAuth && !currentUser && !tempUserForSourceCode) {
    console.log("ProtectedRoute: Auth required, no currentUser or tempUser. Redirecting to /login.");
    return <Navigate to="/login" replace />;
  }

  if (requireEmailVerification && currentUser && !currentUser.emailVerified) {
    console.log("ProtectedRoute: Email verification required but currentUser is not verified. Redirecting to /verify-email.");
    return <Navigate to="/verify-email" replace />;
  }

  if (require2FA && userProfile && !userProfile.isVerified) {
    console.log("ProtectedRoute: 2FA required but userProfile indicates not verified. Redirecting to /2fa.");
    return <Navigate to="/2fa" replace />;
  }

  if (requireAuth && !currentUser && tempUserForSourceCode) {
    console.log("ProtectedRoute: Waiting for currentUser to be set after source code verification...");
    return <LoadingSpinner message="Finalizing login..." />;
  }

  console.log("ProtectedRoute: All checks passed. Rendering children.");
  return <>{children}</>;
};

export default ProtectedRoute; 