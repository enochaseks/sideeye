import React, { useState, Suspense, lazy, useEffect } from 'react';
import { 
  Routes, 
  Route, 
  Navigate,
  BrowserRouter as Router,
  useLocation,
  useNavigate
} from 'react-router-dom';
import { CssBaseline, Box, useTheme, useMediaQuery, CircularProgress, Fab } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeContextProvider } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import { ThemeProvider } from '@mui/material';
import theme from './theme';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import { Toaster } from 'react-hot-toast';
import SideRoomList from './components/SideRooms/SideRoomList';
import BottomNav from './components/BottomNav';
import './App.css';
import { ThemeProvider as CustomThemeProvider } from './theme/ThemeProvider';
import { HelmetProvider } from 'react-helmet-async';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import RateLimiter from './components/RateLimiter';
import { FirestoreProvider } from './context/FirestoreContext';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CookieConsent from './components/CookieConsent';
import CreateSideRoom from './components/CreateSideRoom';
import ProfileSetupDialog from './components/ProfileSetupDialog';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';

// Lazy load larger page components
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const Discover = lazy(() => import('./pages/Discover'));
const Messages = lazy(() => import('./pages/Messages'));
const SadeAIPage = lazy(() => import('./pages/SadeAIPage'));
const SideRoomComponent = lazy(() => import('./components/SideRooms/SideRoomComponent'));
const Chat = lazy(() => import('./pages/Chat'));
const RoomChat = lazy(() => import('./pages/RoomChat'));
const SafetyPage = lazy(() => import('./pages/SafetyPage'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const About = lazy(() => import('./pages/About'));
const AboutFounder = lazy(() => import('./pages/AboutFounder'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));
const EmailVerification = lazy(() => import('./pages/EmailVerification'));
const TrashPage = lazy(() => import('./pages/TrashPage'));
const FollowersList = lazy(() => import('./pages/FollowersList'));
const FollowingList = lazy(() => import('./pages/FollowingList'));
const DeletionDeactivatePage = lazy(() => import('./pages/DeletionDeactivatePage'));
const NotificationPage = lazy(() => import('./pages/Notifications'));
const SetupSourceCode = lazy(() => import('./pages/SetupSourceCode'));
const EnterSourceCode = lazy(() => import('./pages/EnterSourceCode'));
const Debug = lazy(() => import('./pages/Debug'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const SadeAIInfo = lazy(() => import('./pages/SadeAIInfo'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const Suggestions = lazy(() => import('./pages/Suggestions'));
const Wallet = lazy(() => import('./pages/Wallet'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancelled = lazy(() => import('./pages/PaymentCancelled'));
const GiftPurchasing = lazy(() => import('./pages/GiftPurchasing'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));


// Loading fallback component
const LoadingFallback = () => (
  <Box 
    sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      width: '100%', 
      height: '70vh' 
    }}
  >
    <CircularProgress />
  </Box>
);

const DRAWER_WIDTH = 240;
const COLLAPSED_DRAWER_WIDTH = 64;

const BottomNavWrapper: React.FC<{ onCreateRoomClick: () => void }> = ({ onCreateRoomClick }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  if (!currentUser || ['/login', '/register'].includes(location.pathname)) {
    return null;
  }
  
  return <BottomNav 
    isDrawerOpen={isDrawerOpen} 
    setIsDrawerOpen={setIsDrawerOpen} 
    onCreateRoomClick={onCreateRoomClick}
  />;
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isVibitsPage = location.pathname === '/vibits';
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { currentUser } = useAuth();
  
  // Global state for create room dialog
  const [showCreateRoomDialog, setShowCreateRoomDialog] = useState(false);
  
  // Profile setup dialog state
  const [showProfileSetupDialog, setShowProfileSetupDialog] = useState(false);
  const [profileSetupChecked, setProfileSetupChecked] = useState(false);
  const [lastProfileCheck, setLastProfileCheck] = useState<number>(0);

  // Check if user needs to complete profile setup
  useEffect(() => {
    const checkProfileSetup = async () => {
      if (!currentUser?.uid || profileSetupChecked) return;
      
      // Skip profile check for auth pages
      const authPages = ['/login', '/register', '/reset-password', '/verify-email', '/setup-source-code', '/enter-source-code'];
      if (authPages.includes(location.pathname)) {
        setProfileSetupChecked(true);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Check if user needs to complete profile setup
          const needsProfileSetup = !userData.profileCompleted && !userData.profilePic;
          
          // Check when they were last prompted (use the most recent timestamp)
          const lastPromptTime = userData.lastProfileSetupPrompt ? 
            new Date(userData.lastProfileSetupPrompt).getTime() : 
            (userData.profileSetupSkippedAt ? new Date(userData.profileSetupSkippedAt).getTime() : 0);
          
          // Show dialog if user still hasn't completed profile AND either:
          // 1. They've never been prompted before, OR
          // 2. It's been more than 24 hours since last prompt
          const shouldShowDialog = needsProfileSetup && (
            lastPromptTime === 0 || 
            (Date.now() - lastPromptTime) > 24 * 60 * 60 * 1000 // 24 hours
          );
          
          if (shouldShowDialog) {
            // Small delay to ensure the app is fully loaded
            setTimeout(() => {
              setShowProfileSetupDialog(true);
            }, 1000);
          }
        } else {
          // New user with no Firestore document - definitely needs setup
          setTimeout(() => {
            setShowProfileSetupDialog(true);
          }, 1000);
        }
        
        setProfileSetupChecked(true);
        setLastProfileCheck(Date.now());
      } catch (error) {
        console.error('Error checking profile setup status:', error);
        setProfileSetupChecked(true);
      }
    };

    checkProfileSetup();
  }, [currentUser?.uid, location.pathname, profileSetupChecked]);

  // Periodic check for existing users (every 24 hours) - even if they stay logged in
  useEffect(() => {
    if (!currentUser?.uid) return;

    const checkProfilePeriodically = async () => {
      const now = Date.now();
      const timeSinceLastCheck = now - lastProfileCheck;
      
      // Only check if it's been more than 23 hours since last check (slightly less than 24 to account for timing)
      if (timeSinceLastCheck < 23 * 60 * 60 * 1000) return;

      // Skip profile check for auth pages
      const authPages = ['/login', '/register', '/reset-password', '/verify-email', '/setup-source-code', '/enter-source-code'];
      if (authPages.includes(location.pathname)) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Check if user still needs to complete profile setup
          const needsProfileSetup = !userData.profileCompleted && !userData.profilePic;
          
          // Check when they were last prompted (use the most recent timestamp)
          const lastPromptTime = userData.lastProfileSetupPrompt ? 
            new Date(userData.lastProfileSetupPrompt).getTime() : 
            (userData.profileSetupSkippedAt ? new Date(userData.profileSetupSkippedAt).getTime() : 0);
          
          // Show dialog if user still hasn't completed profile AND either:
          // 1. They've never been prompted before, OR
          // 2. It's been more than 24 hours since last prompt
          const shouldShowDialog = needsProfileSetup && (
            lastPromptTime === 0 || 
            (Date.now() - lastPromptTime) > 24 * 60 * 60 * 1000 // 24 hours
          );
          
          if (shouldShowDialog) {
            console.log('[Profile Setup] Showing periodic reminder dialog');
            setShowProfileSetupDialog(true);
          }
        }
        
        setLastProfileCheck(now);
      } catch (error) {
        console.error('Error in periodic profile check:', error);
      }
    };

    // Set up interval to check every hour
    const intervalId = setInterval(checkProfilePeriodically, 60 * 60 * 1000); // Check every hour

    // Also run the check immediately if enough time has passed
    checkProfilePeriodically();

    return () => clearInterval(intervalId);
  }, [currentUser?.uid, lastProfileCheck, location.pathname]);

  // Reset profile setup check when user changes or logs out
  useEffect(() => {
    if (!currentUser?.uid) {
      setProfileSetupChecked(false);
      setLastProfileCheck(0);
    }
  }, [currentUser?.uid]);

  // Create a global function for the create room dialog
  React.useEffect(() => {
    // @ts-ignore - Adding a global function
    window.openCreateRoomDialog = () => {
      setShowCreateRoomDialog(true);
    };
    
    // @ts-ignore - Adding a global function for profile setup
    window.openProfileSetupDialog = () => {
      setShowProfileSetupDialog(true);
    };
    
    return () => {
      // @ts-ignore - Clean up on unmount
      delete window.openCreateRoomDialog;
      // @ts-ignore - Clean up on unmount
      delete window.openProfileSetupDialog;
    };
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {!isVibitsPage && <Navbar />}
      <Box sx={{ 
        display: 'flex', 
        flexGrow: 1,
        pt: { 
          xs: 1, // Reduced top padding on mobile
          sm: 2,
          md: 3 
        },
        px: { // Add horizontal padding
          xs: 1, // Smaller padding on mobile
          sm: 2,
          md: 3
        },
        ml: { 
          xs: 0, 
          sm: isDrawerOpen ? '60px' : '60px' 
        },
        transition: theme.transitions.create(['margin', 'padding'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        pb: { 
          xs: '72px', // Increased bottom padding on mobile to account for bottom nav
          sm: 2,
          md: 3 
        },
        width: {
          xs: '100%', // Full width on mobile
          sm: 'auto'
        },
        overflow: 'hidden', // Prevent horizontal scrolling
      }}>
        <Box component="main" sx={{ flexGrow: 1, width: '100%', position: 'relative' }}>
          {/* Floating Sade AI button for mobile */}
          {isMobile && location.pathname === '/' && (
            <Fab
              color="secondary"
              aria-label="sade-ai"
              onClick={() => navigate('/sade-ai')}
              sx={{
                position: 'fixed',
                bottom: 80, // Position above bottom nav
                right: 16,
                zIndex: 1000,
              }}
            >
              <img
                src="/images/sade-avatar.jpg"
                alt="Sade AI"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                }}
              />
            </Fab>
          )}

          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<EmailVerification />} />
              <Route path="/setup-source-code" element={<SetupSourceCode />} />
              <Route path="/enter-source-code" element={<EnterSourceCode />} />
              <Route path="/safety" element={<SafetyPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/about" element={<About />} />
              <Route path="/about-founder" element={<AboutFounder />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/cookies" element={<CookiePolicy />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/gift-purchasing" element={<GiftPurchasing />} />
              <Route path="/admin" element={<AdminDashboard />} />
              
              {/* Protected routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Discover />
                </ProtectedRoute>
              } />
              <Route path="/profile/:userId" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/security" element={
                <ProtectedRoute>
                  <SecurityPage />
                </ProtectedRoute>
              } />
              <Route path="/search" element={
                <ProtectedRoute>
                  <SearchResults />
                </ProtectedRoute>
              } />
              <Route path="/messages" element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              } />
              <Route path="/side-rooms" element={
                <ProtectedRoute>
                  <SideRoomList />
                </ProtectedRoute>
              } />
              <Route path="/side-room/:roomId" element={
                <ProtectedRoute>
                  <SideRoomComponent />
                </ProtectedRoute>
              } />
              <Route path="/chat/conversation/:conversationId" element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              } />
              <Route path="/chat/user/:userId" element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              } />
              <Route path="/chat/room/:roomId" element={
                <ProtectedRoute>
                  <RoomChat />
                </ProtectedRoute>
              } />
              <Route path="/trash" element={
                <ProtectedRoute>
                  <TrashPage />
                </ProtectedRoute>
              } />
              <Route path="/profile/:userId/followers" element={
                <ProtectedRoute>
                  <FollowersList />
                </ProtectedRoute>
              } />
              <Route path="/profile/:userId/following" element={
                <ProtectedRoute>
                  <FollowingList />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute>
                  <NotificationPage />
                </ProtectedRoute>
              } />
              <Route path="/account-management" element={
                <ProtectedRoute>
                  <DeletionDeactivatePage />
                </ProtectedRoute>
              } />
              <Route path="/report" element={
                <ProtectedRoute>
                  <ReportPage />
                </ProtectedRoute>
              } />
              <Route path="/sade-ai-info" element={
                <ProtectedRoute>
                  <SadeAIInfo />
                </ProtectedRoute>
              } />
              <Route path="/sade-ai" element={<SadeAIPage />} />
              <Route path="/debug" element={<Debug />} />
              <Route path="/suggestions" element={
                <ProtectedRoute>
                  <Suggestions />
                </ProtectedRoute>
              } />
              <Route path="/wallet" element={
                <ProtectedRoute>
                  <Wallet />
                </ProtectedRoute>
              } />
              <Route path="/payment-success" element={
                <ProtectedRoute>
                  <PaymentSuccess />
                </ProtectedRoute>
              } />
              <Route path="/payment-cancelled" element={
                <ProtectedRoute>
                  <PaymentCancelled />
                </ProtectedRoute>
              } />

              
              {/* Redirect all other routes to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Box>
      </Box>
      <BottomNavWrapper onCreateRoomClick={() => setShowCreateRoomDialog(true)} />
      <CookieConsent />
      <Toaster 
        position="bottom-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: theme.palette.background.paper,
            color: theme.palette.text.primary,
          },
        }}
      />
      
      {/* GLOBAL Create Room Dialog that works from ANY page */}
      <CreateSideRoom
        open={showCreateRoomDialog}
        onClose={() => setShowCreateRoomDialog(false)}
      />
      
      {/* Profile Setup Dialog for new users */}
      <ProfileSetupDialog
        open={showProfileSetupDialog}
        onClose={() => {
          setShowProfileSetupDialog(false);
          // Reset the check so it can re-evaluate on next app load if still incomplete
          setProfileSetupChecked(false);
        }}
        canSkip={true}
      />
    </Box>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CustomThemeProvider>
            <ThemeContextProvider>
              <CssBaseline />
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <AuthProvider>
                  <FirestoreProvider>
                    <NotificationProvider>
                      <RateLimiter>
                        <AppContent />
                      </RateLimiter>
                    </NotificationProvider>
                  </FirestoreProvider>
                </AuthProvider>
              </LocalizationProvider>
            </ThemeContextProvider>
          </CustomThemeProvider>
        </Router>
      </HelmetProvider>
    </ErrorBoundary>
  );
};

export default App;
