import React from 'react';
import { 
  Routes, 
  Route, 
  Navigate,
  BrowserRouter
} from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import theme from './theme';
import Navbar from './components/Navbar';
import Feed from './pages/Feed';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import SearchResults from './pages/SearchResults';
import Discover from './pages/Discover';
import Messages from './pages/Messages';
import { Toaster } from 'react-hot-toast';
import SideRoomList from './components/SideRooms/SideRoomList';
import SideRoomComponent from './components/SideRooms/SideRoomComponent';
import Chat from './pages/Chat';
import SafetyPage from './pages/SafetyPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import About from './pages/About';
import TermsOfService from './pages/TermsOfService';
import CookiePolicy from './pages/CookiePolicy';
import EmailVerification from './pages/EmailVerification';
import TwoFactorAuth from './pages/TwoFactorAuth';
import TrashPage from './pages/TrashPage';
import FollowersList from './pages/FollowersList';
import FollowingList from './pages/FollowingList';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import RateLimiter from './components/RateLimiter';
import { FirestoreProvider } from './context/FirestoreContext';
import NotificationPage from './pages/Notifications';
import SetupSourceCode from './pages/SetupSourceCode';
import EnterSourceCode from './pages/EnterSourceCode';
import ResetSourceCode from './pages/ResetSourceCode';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import Debug from './pages/Debug';
import CookieConsent from './components/CookieConsent';
import './App.css';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <BrowserRouter>
            <AuthProvider>
              <NotificationProvider>
                <FirestoreProvider>
                  <RateLimiter>
                    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                      <Navbar />
                      <Box component="main" sx={{ flexGrow: 1, pt: 8 }}>
                        <Routes>
                          <Route path="/" element={<ProtectedRoute requireEmailVerification><Feed /></ProtectedRoute>} />
                          <Route path="/login" element={<Login />} />
                          <Route path="/register" element={<Register />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          <Route path="/verify-email" element={<EmailVerification />} />
                          <Route path="/setup-source-code" element={<SetupSourceCode />} />
                          <Route path="/enter-source-code" element={<EnterSourceCode />} />
                          <Route path="/reset-source-code" element={<ResetSourceCode />} />
                          <Route path="/profile/:userId?" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                          <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
                          <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
                          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                          <Route path="/side-rooms" element={<ProtectedRoute><SideRoomList /></ProtectedRoute>} />
                          <Route path="/side-room/:roomId" element={<ProtectedRoute><SideRoomComponent /></ProtectedRoute>} />
                          <Route path="/chat/:userId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                          <Route path="/safety" element={<SafetyPage />} />
                          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                          <Route path="/about" element={<About />} />
                          <Route path="/terms" element={<TermsOfService />} />
                          <Route path="/cookies" element={<CookiePolicy />} />
                          <Route path="/2fa" element={<TwoFactorAuth />} />
                          <Route path="/trash" element={<ProtectedRoute><TrashPage /></ProtectedRoute>} />
                          <Route path="/profile/:userId/followers" element={<ProtectedRoute><FollowersList /></ProtectedRoute>} />
                          <Route path="/profile/:userId/following" element={<ProtectedRoute><FollowingList /></ProtectedRoute>} />
                          <Route path="/notifications" element={<ProtectedRoute><NotificationPage /></ProtectedRoute>} />
                          <Route path="/debug" element={<Debug />} />
                        </Routes>
                      </Box>
                      <CookieConsent />
                      <Toaster position="bottom-right" />
                    </Box>
                  </RateLimiter>
                </FirestoreProvider>
              </NotificationProvider>
            </AuthProvider>
          </BrowserRouter>
        </LocalizationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
