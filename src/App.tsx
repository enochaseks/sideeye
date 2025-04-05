import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import theme from './theme';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Forums from './pages/Forums';
import TeaRoomList from './pages/TeaRoomList';
import CreateForum from './components/CreateForum';
import CreateTeaRoom from './components/CreateTeaRoom';
import Chat from './pages/Chat';
import SafetyPage from './pages/SafetyPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import About from './pages/About';
import TermsOfService from './pages/TermsOfService';
import CookiePolicy from './pages/CookiePolicy';
import EmailVerification from './pages/EmailVerification';
import TwoFactorAuth from './pages/TwoFactorAuth';
import SearchResults from './pages/SearchResults';
import './App.css';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:userId" element={<Profile />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/forums" element={<Forums />} />
          <Route path="/tea-rooms" element={<TeaRoomList />} />
          <Route path="/create-forum" element={<CreateForum />} />
          <Route path="/create-tea-room" element={<CreateTeaRoom />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/safety" element={<SafetyPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/verify-email" element={<EmailVerification />} />
          <Route path="/setup-2fa" element={<TwoFactorAuth />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
