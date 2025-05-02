import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, TextField, Button, CircularProgress, Divider, Chip } from '@mui/material';

const SadeAIPage: React.FC = () => {
  const [messages, setMessages] = useState<{ sender: 'user' | 'ai', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Define suggestions (adding therapeutic prompts)
  const suggestions = [
    "I'm feeling a bit down today",
    "Can we just talk?",
    "Tell me a fact",
    "What does 'wagwan' mean?",
    "Play 'Would You Rather?'",
    "Feeling a bit lost",
  ];

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

  // Modify sendMessage to optionally accept message text directly
  const sendMessage = async (messageToSend: string = input) => {
    // Use messageToSend instead of input for checks and sending
    if (!messageToSend.trim()) return;

    // Add user message using messageToSend
    setMessages(msgs => [...msgs, { sender: 'user', text: messageToSend }]);
    setInput(''); // Clear input regardless of how message was sent
    setLoading(true);

    try {
      const backendBaseUrl = process.env.REACT_APP_API_URL;
      if (!backendBaseUrl) {
        console.error("[SadeAIPage] ERROR: REACT_APP_API_URL is not defined.");
        setMessages(msgs => [...msgs, { sender: 'ai', text: "Configuration error: Backend URL not set." }]);
        setLoading(false);
        return;
      }

      const apiUrl = `${backendBaseUrl}/api/sade-ai`;
      console.log(`[SadeAIPage] Attempting to fetch: ${apiUrl}`);
      console.log(`[SadeAIPage] Request Body:`, { message: messageToSend }); // Use messageToSend

      try {
        const fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Send messageToSend in the body
          body: JSON.stringify({ message: messageToSend }),
        };
        console.log("[SadeAIPage] Fetch options prepared:", fetchOptions);

        console.log("[SadeAIPage] About to call fetch...");
        const res = await fetch(apiUrl, fetchOptions);
        console.log("[SadeAIPage] Fetch call completed. Response status:", res.status);

        const data = await res.json();
        console.log("[SadeAIPage] Received response data:", data);
        setMessages(msgs => [...msgs, { sender: 'ai', text: data.response || "Sorry, I couldn't think of a reply." }]);

      } catch (err) {
        console.error("[SadeAIPage] Fetch failed inside catch block:", err);
        if (err instanceof Error) {
          console.error(`[SadeAIPage] Error Name: ${err.name}`);
          console.error(`[SadeAIPage] Error Message: ${err.message}`);
        }
        setMessages(msgs => [...msgs, { sender: 'ai', text: "Sorry, there was an error connecting to Sade AI." }]);
      }

    } catch (err) {
      // This outer catch might be redundant now, but leave for safety
      console.error("[SadeAIPage] Outer request failed:", err);
       if (err instanceof Error) {
         console.error(`[SadeAIPage] Error Name: ${err.name}`);
         console.error(`[SadeAIPage] Error Message: ${err.message}`);
       }
      setMessages(msgs => [...msgs, { sender: 'ai', text: "Sorry, there was an error connecting to Sade AI." }]);
    } finally {
        setLoading(false);
        // Input is already cleared at the start of the function
    }
  };

  // Handler for suggestion chip click
  const handleSuggestionClick = (suggestion: string) => {
    // Directly call sendMessage with the suggestion text
    sendMessage(suggestion);
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

        {/* Suggestion Chips Area */}
        {!loading && messages.length <= 1 && ( // Show suggestions only when not loading and chat is new/empty
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mb: 2, px: { xs: 1, sm: 0 } }}>
             <Typography variant="caption" sx={{ width: '100%', textAlign: 'center', color: 'text.secondary', mb: 0.5 }}>Try asking:</Typography>
             {suggestions.map((text, index) => (
                <Chip
                  key={index}
                  label={text}
                  onClick={() => handleSuggestionClick(text)}
                  clickable
                  variant="outlined"
                  size="small"
                  disabled={loading} // Technically redundant due to outer check, but good practice
                />
              ))}
            </Box>
        )}

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
            // Ensure Enter key uses the input state
            onKeyDown={e => { if (e.key === 'Enter' && input.trim()) sendMessage(); }}
            disabled={loading}
            sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 4px 0 rgba(31,38,135,0.04)' }}
          />
          {/* Ensure Send button uses the input state */}
          <Button variant="contained" onClick={() => sendMessage()} disabled={loading || !input.trim()} sx={{ minWidth: 80, fontWeight: 600 }}>
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