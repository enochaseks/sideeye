import React, { useState, Suspense, lazy } from 'react';
import { 
  Routes, 
  Route, 
  Navigate,
  BrowserRouter as Router,
  useLocation
} from 'react-router-dom';
import { CssBaseline, Box, useTheme, useMediaQuery, CircularProgress } from '@mui/material';
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
import UpdateNotification from './components/UpdateNotification';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import RateLimiter from './components/RateLimiter';
import { FirestoreProvider } from './context/FirestoreContext';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CookieConsent from './components/CookieConsent';

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

const BottomNavWrapper: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  if (!currentUser || ['/login', '/register'].includes(location.pathname)) {
    return null;
  }
  
  return <BottomNav isDrawerOpen={isDrawerOpen} setIsDrawerOpen={setIsDrawerOpen} />;
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isVibitsPage = location.pathname === '/vibits';
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {!isVibitsPage && <Navbar />}
      <Box sx={{ 
        display: 'flex', 
        flexGrow: 1,
        pt: { xs: 2, sm: 3 },
        ml: { 
          xs: 0, 
          sm: isDrawerOpen ? '60px' : '60px' 
        },
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        pb: { xs: '56px', sm: 0 },
      }}>
        <Box component="main" sx={{ flexGrow: 1, width: '100%' }}>
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
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/cookies" element={<CookiePolicy />} />
              <Route path="/faq" element={<FAQPage />} />
              
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
              
              {/* Redirect all other routes to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Box>
      </Box>
      <BottomNavWrapper />
      <UpdateNotification />
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
