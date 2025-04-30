import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, TextField, Button, CircularProgress, Divider } from '@mui/material';

const SadeAIPage: React.FC = () => {
  const [messages, setMessages] = useState<{ sender: 'user' | 'ai', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sadeai_chat_history');
    if (saved) {
      setMessages(JSON.parse(saved));
    }
  }, []);

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    localStorage.setItem('sadeai_chat_history', JSON.stringify(messages));
  }, [messages]);

  // This function would call your backend or an AI API
  const sendMessage = async () => {
    if (!input.trim()) return;
    setMessages([...messages, { sender: 'user', text: input }]);
    setLoading(true);

    try {
      // Use environment variable for the base backend URL
      const backendBaseUrl = process.env.REACT_APP_API_URL;
      if (!backendBaseUrl) {
        console.error("[SadeAIPage] ERROR: REACT_APP_API_URL is not defined.");
        setMessages(msgs => [...msgs, { sender: 'ai', text: "Configuration error: Backend URL not set." }]);
        setLoading(false);
        return; // Stop if URL is not configured
      }

      // const apiUrl = `${backendBaseUrl}/api/sade-ai`; // Original URL
      const apiUrl = `${backendBaseUrl}/api/dummy-post-test`; // <<< Point to dummy endpoint for test

      console.log(`[SadeAIPage] Attempting XHR POST to (DUMMY): ${apiUrl}`); // Log change
      // const requestBody = JSON.stringify({ message: input }); // Don't need body for dummy test
      const requestBody = null; // Send empty body for dummy test
      console.log(`[SadeAIPage] Request Body (DUMMY):`, requestBody);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/json'); // Keep header for now, backend ignores it

        xhr.onload = function () {
          console.log("[SadeAIPage] XHR onload triggered. Status:", xhr.status);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              console.log("[SadeAIPage] Received XHR response data (DUMMY):", data);
              // setMessages(msgs => [...msgs, { sender: 'ai', text: data.response || "Dummy Success!" }]); // Don't update UI
              setMessages(msgs => [...msgs, { sender: 'ai', text: `Dummy Test OK: ${data.message}` }]); // Show dummy success
              resolve(data); // Resolve the promise on success
            } catch (parseError) {
              console.error("[SadeAIPage] Error parsing XHR JSON response:", parseError);
              console.error("[SadeAIPage] Raw XHR response text:", xhr.responseText);
              reject(new Error("Failed to parse response from server."));
            }
          } else {
            console.error("[SadeAIPage] XHR request failed with status:", xhr.status, xhr.statusText);
            console.error("[SadeAIPage] Raw XHR response text:", xhr.responseText);
            reject(new Error(`Request failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = function () {
          console.error("[SadeAIPage] XHR onerror triggered (Network error).");
          reject(new Error('Network request failed'));
        };

        xhr.ontimeout = function () {
          console.error("[SadeAIPage] XHR ontimeout triggered.");
          reject(new Error('Request timed out'));
        };

        console.log("[SadeAIPage] About to call xhr.send() (DUMMY)...");
        xhr.send(requestBody);
      });
    } catch (err) {
      console.error("[SadeAIPage] XHR request failed inside catch block:", err);
      if (err instanceof Error) {
        console.error(`[SadeAIPage] Error Name: ${err.name}`);
        console.error(`[SadeAIPage] Error Message: ${err.message}`);
      }
      setMessages(msgs => [...msgs, { sender: 'ai', text: "Sorry, there was an error connecting to Sade AI." }]);
    }
    setLoading(false);
    setInput('');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        pb: { xs: 10, sm: 7 },
        pt: { xs: 2, sm: 6 },
      }}
    >
      <Paper elevation={3} sx={{ width: '100%', maxWidth: 500, p: { xs: 2, sm: 4 }, borderRadius: 4, mb: 2, mt: 2, boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.10)' }}>
        <Typography variant="h4" align="center" fontWeight={700} color="primary.main" gutterBottom sx={{ letterSpacing: 1 }}>
          Sade AI <span style={{ fontWeight: 400, fontSize: '1.2rem', color: '#888' }}>(SHA-DEY)</span>
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box
          sx={{
            minHeight: 320,
            maxHeight: { xs: 350, sm: 400 },
            overflowY: 'auto',
            bgcolor: 'rgba(255,255,255,0.7)',
            borderRadius: 3,
            p: 2,
            mb: 2,
            boxShadow: '0 2px 8px 0 rgba(31, 38, 135, 0.05)',
            transition: 'background 0.3s',
          }}
        >
          {messages.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ mt: 8 }}>
              Say hello to <b>Sade AI</b>, your friendly AI therapist! 🌸
            </Typography>
          )}
          {messages.map((msg, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                mb: 1.5,
              }}
            >
              <Box
                sx={{
                  bgcolor: msg.sender === 'user' ? 'primary.main' : '#f3f6fb',
                  color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                  borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  px: 2,
                  py: 1.2,
                  maxWidth: '80%',
                  boxShadow: msg.sender === 'user' ? '0 2px 8px 0 rgba(33, 150, 243, 0.10)' : '0 2px 8px 0 rgba(31, 38, 135, 0.05)',
                  fontSize: '1.08rem',
                  wordBreak: 'break-word',
                  fontFamily: 'inherit',
                }}
              >
                {msg.text}
              </Box>
            </Box>
          ))}
          {loading && <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', mt: 2 }} />}
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            position: { xs: 'fixed', sm: 'static' },
            bottom: { xs: 64, sm: 'auto' },
            left: 0,
            width: { xs: '100vw', sm: 'auto' },
            maxWidth: { xs: '100vw', sm: 'none' },
            bgcolor: { xs: 'rgba(255,255,255,0.95)', sm: 'transparent' },
            p: { xs: 2, sm: 0 },
            borderTop: { xs: '1px solid #eee', sm: 'none' },
            zIndex: 1200,
          }}
        >
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
            disabled={loading}
            sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 4px 0 rgba(31,38,135,0.04)' }}
          />
          <Button variant="contained" onClick={sendMessage} disabled={loading || !input.trim()} sx={{ minWidth: 80, fontWeight: 600 }}>
            Send
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => {
              setMessages([]);
              localStorage.removeItem('sadeai_chat_history');
            }}
            disabled={loading}
            sx={{ minWidth: 90, fontWeight: 500 }}
          >
            Clear Chat
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SadeAIPage;