import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Container } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import theme from './theme';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Forums from './pages/Forums';
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
import SearchResults from './pages/SearchResults';
import TrashPage from './pages/TrashPage';
import FollowersList from './pages/FollowersList';
import FollowingList from './pages/FollowingList';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import RateLimiter from './components/RateLimiter';
import './App.css';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <ErrorBoundary>
          <RateLimiter>
            <Toaster position="top-right" />
            <Navbar />
            <Container>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/profile/:userId/followers" element={<FollowersList />} />
                <Route path="/profile/:userId/following" element={<FollowingList />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/forums" element={
                  <ProtectedRoute>
                    <Forums />
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
                <Route path="/messages" element={
                  <ProtectedRoute>
                    <Messages />
                  </ProtectedRoute>
                } />
                <Route path="/chat" element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                } />
                <Route path="/safety" element={<SafetyPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/about" element={<About />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/cookies" element={<CookiePolicy />} />
                <Route path="/verify-email" element={<EmailVerification />} />
                <Route path="/2fa" element={<TwoFactorAuth />} />
                <Route path="/trash" element={
                  <ProtectedRoute>
                    <TrashPage />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<HomePage />} />
              </Routes>
            </Container>
          </RateLimiter>
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
