import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, TextField, Button, CircularProgress, Divider, Chip, LinearProgress, IconButton, Avatar } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { io, Socket } from "socket.io-client";
import { useLocation } from 'react-router-dom';

// Define step type
type BreathingStep = { text: string, duration: number };

// Define breathing state type
type BreathingState = {
  active: boolean;
  steps: BreathingStep[];
  currentStepIndex: number;
  timer: number;
  intervalId: NodeJS.Timeout | null;
} | null;

// Define type for game state
type GameState = {
  gameType: 'guess_the_number';
  targetNumber: number;
  guessesMade: number;
  lowerBound: number; // To provide hints
  upperBound: number; // To provide hints
} | null; // Can be expanded later for other games

// Define type for messages
type Message = { sender: 'user' | 'ai', text: string };

const SadeAIPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeGame, setActiveGame] = useState<GameState>(null);
  const [breathingState, setBreathingState] = useState<BreathingState>(null);
  const [forceSearchNext, setForceSearchNext] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const location = useLocation();

  // Ref to scroll to bottom
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Effect to scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Define suggestions
  const suggestions = [
    "I'm feeling a bit down today",
    "Can we just talk?",
    "Tell me a fact",
    "What does 'wagwan' mean?",
    "Play 'Would You Rather?'",
    "Feeling a bit lost",
    "Play Guess the Number",
    "Breathing exercise"
  ];

  // --- Socket.IO Connection Setup ---
  useEffect(() => {
    // Determine backend URL (adjust if your API URL isn't the base URL)
    // For local dev, usually the same origin or localhost:PORT
    const backendUrl = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL || window.location.origin;
    console.log(`[Frontend] Connecting Socket.IO to: ${backendUrl}`);

    // Initialize socket connection
    const newSocket = io(backendUrl, {
        // Optional: Add withCredentials if needed for cookies/sessions, depends on CORS setup
        // withCredentials: true,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
        console.log('[Frontend] Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', (reason) => {
        console.log('[Frontend] Socket disconnected:', reason);
        // Optional: Implement reconnection logic if needed
    });

    newSocket.on('connect_error', (error) => {
        console.error('[Frontend] Socket connection error:', error);
    });

    // Cleanup function to disconnect socket on component unmount
    return () => {
        console.log('[Frontend] Disconnecting socket...');
        newSocket.disconnect();
        setSocket(null);
    };
    // Run only once on component mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Listener for AI Messages (including moderation alerts if using 'ai-message') ---
  useEffect(() => {
    if (socket) { // Only set up listener if socket is connected
      const handleAiMessage = (data: { sender: string, text: string }) => {
        // Basic validation
        if (data && data.sender === 'ai' && typeof data.text === 'string') {
          console.log("[Frontend] Received 'ai-message' via Socket:", data);
          // Add the message to the chat state
          setMessages(msgs => [...msgs, { sender: 'ai', text: data.text }]);
        } else {
          console.warn("[Frontend] Received malformed 'ai-message' data via Socket:", data);
        }
      };

      // Listen for the event emitted by the backend
      socket.on('ai-message', handleAiMessage);

      // Cleanup listener on component unmount or when socket changes
      return () => {
        console.log("[Frontend] Removing 'ai-message' listener");
        socket.off('ai-message', handleAiMessage);
      };
    }
  }, [socket]); // Dependency array includes socket instance

  // --- Handle Initial Intent from URL ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const intent = params.get('intent');

    if (intent === 'help' && messages.length === 0) { // Check messages.length to avoid adding on re-renders if chat history exists
      console.log("[Frontend] Detected intent=help from URL params.");
      const initialHelpMessage: Message = {
        sender: 'ai',
        text: "Hi there! Looks like you clicked 'Get Help' in settings. How can I assist you today? Just type your question below. 😊"
      };
      // Add message directly, avoiding sending to backend initially
      setMessages([initialHelpMessage]);
    }
    // Only run once on initial load based on location search string
    // Note: If chat history is loaded later, this might run before history and get overwritten.
    // Consider integrating with history loading logic if needed.
  }, [location.search]); // Rerun if the search string changes

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

  // --- Breathing Exercise Logic ---
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // Use ref to store interval ID

  // Function to clear interval safely
  const clearBreathingInterval = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Moved endBreathingExercise up as it's called by others
  const endBreathingExercise = () => {
     console.log("[Frontend] endBreathingExercise called."); // Log end
     clearBreathingInterval();
     setMessages(msgs => [...msgs, { sender: 'ai', text: "Nicely done! Hope that helped you feel a bit calmer, mate. 😊" }]);
     setBreathingState(null);
     setLoading(false);
  };

  const handleTimerTick = () => {
    setBreathingState(prevState => {
      if (!prevState || !prevState.active) {
        console.log("[Frontend] handleTimerTick: No active state, clearing interval."); // Log clear
        clearBreathingInterval();
        return null;
      }
      const newTimer = prevState.timer - 1;
      console.log(`[Frontend] handleTimerTick: Prev Timer: ${prevState.timer}, New Timer: ${newTimer}, Step Index: ${prevState.currentStepIndex}`); // Log tick
      if (newTimer <= 0) {
        console.log("[Frontend] handleTimerTick: Timer reached 0, starting next step."); // Log step change trigger
        setTimeout(startNextBreathingStep, 0);
        return { ...prevState, timer: 0 }; // Set timer to 0 while waiting for next step state change
      } else {
        return { ...prevState, timer: newTimer };
      }
    });
  };

  const startNextBreathingStep = () => {
    console.log("[Frontend] startNextBreathingStep called."); // Log function start
    clearBreathingInterval();

    setBreathingState(prevState => {
      if (!prevState || !prevState.active) {
          console.warn("[Frontend] startNextBreathingStep: No active breathing state found on entry.");
          return null;
      }

      const nextStepIndex = prevState.currentStepIndex + 1;
      console.log(`[Frontend] startNextBreathingStep: Prev Index: ${prevState.currentStepIndex}, Next Index: ${nextStepIndex}`); // Log index change

      if (nextStepIndex >= prevState.steps.length) {
        console.log("[Frontend] startNextBreathingStep: Exercise finished."); // Log finish
        endBreathingExercise();
        return null;
      }

      const nextStep = prevState.steps[nextStepIndex];
      console.log("[Frontend] startNextBreathingStep: Next step details:", nextStep); // Log step details

      // Add instruction message
      setMessages(msgs => {
          const lastMsg = msgs[msgs.length -1];
          if(lastMsg?.sender === 'ai' && lastMsg?.text === nextStep.text) return msgs; // Avoid duplicate message
          return [...msgs, { sender: 'ai', text: nextStep.text }];
      });

      // Start new timer
      timerIntervalRef.current = setInterval(handleTimerTick, 1000);
      console.log("[Frontend] startNextBreathingStep: Interval started:", timerIntervalRef.current); // Log interval start

      // Define the new state explicitly before returning
      const newState = {
        ...prevState,
        currentStepIndex: nextStepIndex,
        timer: nextStep.duration,
        intervalId: timerIntervalRef.current
      };
      console.log("[Frontend] startNextBreathingStep: Setting new state:", newState); // Log state being set
      return newState;
    });
  };

   // Function to manually stop the exercise
  const stopBreathingExercise = () => {
     // Check state directly, not via event
     setBreathingState(currentState => {
         if (currentState?.active) {
             console.log("[Frontend] Manually stopping breathing exercise.");
             clearBreathingInterval();
             setMessages(msgs => [...msgs, { sender: 'ai', text: "Okay, no worries! Stopping the exercise now." }]);
             setLoading(false);
             return null; // Set state to null
         }
         return currentState; // No change if not active
     });
  }

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => clearBreathingInterval();
  }, []);

  // Modify sendMessage to optionally accept message text directly AND handle forceSearch
  const sendMessage = async (messageToSend: string = input, forceSearch: boolean = false) => {
    if (!messageToSend.trim()) return;

    const userMessage: Message = { sender: 'user' as const, text: messageToSend };
    setMessages(msgs => [...msgs, userMessage]);
    setInput('');
    setLoading(true); // Set loading true ONCE at the beginning
    setForceSearchNext(false); // Reset force search flag

    try { // Wrap main logic in try block
      console.log("[Frontend] sendMessage called. forceSearch=", forceSearch, "Current activeGame/breathing state:", activeGame, breathingState);

      // --- Check for STOP command during active exercise ---
      if (breathingState?.active && messageToSend.toLowerCase().includes('stop')) {
          stopBreathingExercise(); // This function already sets loading to false internally
          return; // Exit early, finally block will still run
      }

      // Block regular messages during breathing exercise (unless it's 'stop')
      if (breathingState?.active) {
          setMessages(msgs => [...msgs, { sender: 'ai', text: "Let's focus on breathing for now. You can type 'stop' if you need to." }]);
          // setLoading(false); // No need, finally block handles it
          return; // Exit early, finally block will still run
      }

      // --- Game Logic Check (Guess the Number) ---
      if (activeGame && activeGame.gameType === 'guess_the_number') {
          console.log("[Frontend] Guess the Number game is active. Processing locally.");
          // setLoading(false); // No need, finally block handles it
          const guessAttempt = parseInt(messageToSend, 10);
          const lowerCaseMessage = messageToSend.toLowerCase();
          if (!isNaN(guessAttempt)) {
              handleGuess(guessAttempt);
          }
          else if (lowerCaseMessage.includes('even') || lowerCaseMessage.includes('odd')) {
               const isEven = activeGame.targetNumber % 2 === 0;
               const hintResponse = isEven
                   ? "Okay, cheeky hint for you... It's an **even** number! 😉"
                   : "Alright, since you asked nicely... It's an **odd** number! 🤔";
               setMessages(msgs => [...msgs, { sender: 'ai', text: hintResponse }]);
          }
          else {
              const nonGuessResponse = "Ah, trying to be clever? 😉 Just give me a number guess between 1 and 100!";
              setMessages(msgs => [...msgs, { sender: 'ai', text: nonGuessResponse }]);
          }
          return; // Exit early after handling game logic, finally block will still run
      }

      // --- Send to Backend (if no game/breathing logic handled it) ---
      console.log("[Frontend] No active game/exercise or local action. Sending message to backend via HTTP.");
      // setLoading(true); // Already set at the start

      const backendBaseUrl = process.env.REACT_APP_API_URL;
      if (!backendBaseUrl) {
          console.error("[SadeAIPage] ERROR: REACT_APP_API_URL is not defined.");
          setMessages(msgs => [...msgs, { sender: 'ai', text: "Configuration error: Backend URL not set." }]);
          // setLoading(false); // No need, finally block handles it
          return; // Exit on config error
      }
      const apiUrl = `${backendBaseUrl}/api/sade-ai`;
      const requestBody = {
          message: messageToSend,
          forceSearch: forceSearch
      };
      console.log("[Frontend] Sending HTTP request body:", requestBody);
      const fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
      };
      const res = await fetch(apiUrl, fetchOptions);
      if (!res.ok) {
           let errorMsg = `HTTP error! status: ${res.status}`;
           try {
               const errorData = await res.json();
               errorMsg = errorData.error || errorMsg;
           } catch (e) { /* Ignore */ }
           throw new Error(errorMsg); // Throw error to be caught by catch block
      }
      const data = await res.json();
      console.log("[Frontend] HTTP Backend response data:", data);
      // setLoading(false); // No need, finally block handles it

      // --- Handle Backend Response ---
      if (data.startBreathingExercise && data.steps) {
         console.log("[Frontend] sendMessage: Received signal to start breathing exercise.");
         // setLoading(false); // No need, finally block handles it
         setMessages(msgs => [...msgs, { sender: 'ai', text: data.response }]);
         const initialBreathingState = {
             active: true,
             steps: data.steps,
             currentStepIndex: -1,
             timer: 0,
             intervalId: null
         };
         setBreathingState(initialBreathingState);
         setTimeout(startNextBreathingStep, 100);

      } else if (data.startGame === 'guess_the_number' && data.response) {
        // setLoading(false); // No need, finally block handles it
        startGame('guess_the_number', data.response);
      } else if (data.response) {
        setMessages(msgs => [...msgs, { sender: 'ai', text: data.response }]);
      } else {
         console.error("[SadeAIPage] Received unexpected HTTP response structure:", data);
         setMessages(msgs => [...msgs, { sender: 'ai', text: "Sorry, I got a bit confused there." }]);
      }

    } catch (err: any) { // Catch errors from fetch or other logic within try
      console.error("[SadeAIPage] sendMessage Error:", err);
      setMessages(msgs => [...msgs, { sender: 'ai', text: `Sorry, there was an error: ${err.message || 'Unknown error'}` }]);
      // setLoading(false); // No need, finally block handles it
    } finally {
      // This block ALWAYS runs, ensuring loading is set to false
      console.log("[SadeAIPage sendMessage finally] Setting loading to false.");
      setLoading(false);
    }
  };

  // Handler for suggestion chip click
  const handleSuggestionClick = (suggestion: string) => {
    // Directly call sendMessage with the suggestion text
    sendMessage(suggestion);
  };

  // --- Game Logic ---

  const startGame = (gameType: 'guess_the_number', initialMessage: string) => {
    if (gameType === 'guess_the_number') {
      const target = Math.floor(Math.random() * 100) + 1;
      const newGameState = {
        gameType: 'guess_the_number' as const,
        targetNumber: target,
        guessesMade: 0,
        lowerBound: 1,
        upperBound: 100
      };
      console.log(`[Frontend] startGame called. Setting activeGame state to:`, newGameState);
      setActiveGame(newGameState);
      // Add Sade's starting message to the chat
      setMessages(msgs => [...msgs, { sender: 'ai', text: initialMessage }]);
    }
    // Can add else if for other game types later
  };

  const handleGuess = (guess: number) => {
    if (!activeGame || activeGame.gameType !== 'guess_the_number') return;

    let responseText = '';
    const guesses = activeGame.guessesMade + 1;
    let newLowerBound = activeGame.lowerBound;
    let newUpperBound = activeGame.upperBound;
    let gameFinished = false;

    console.log(`[Frontend] handleGuess called with valid number: ${guess}`);

    // Simplified check - assuming guess is a valid number now
    if (guess < 1 || guess > 100) {
        responseText = "Whoops! That number's not between 1 and 100, mate. Try again!";
        console.log("[Frontend] handleGuess: Input out of bounds.");
    } else if (guess === activeGame.targetNumber) {
        responseText = `Yes! You got it in ${guesses} guesses! Proper smart. 🎉 Fancy another round? (Just ask!)`;
        gameFinished = true;
    } else if (guess < activeGame.targetNumber) {
        responseText = `A bit higher than ${guess}... 😉`;
        newLowerBound = Math.max(activeGame.lowerBound, guess + 1);
    } else { // guess > activeGame.targetNumber
        responseText = `Lower than ${guess}, try again! 👇`;
        newUpperBound = Math.min(activeGame.upperBound, guess - 1);
    }

    setMessages(msgs => [...msgs, { sender: 'ai', text: responseText }]);

    if (gameFinished) {
        setActiveGame(null);
    } else if (guess >= 1 && guess <= 100) { // Only update state for valid bounds guesses
        setActiveGame({
           ...activeGame,
           guessesMade: guesses,
           lowerBound: newLowerBound,
           upperBound: newUpperBound
         });
    }
  };

  // Calculate progress for LinearProgress
  const isBreathingActive = breathingState?.active;
  const currentStepIndex = breathingState?.currentStepIndex ?? -1;
  const currentStep = isBreathingActive && currentStepIndex >= 0 ? breathingState.steps[currentStepIndex] : null;
  const currentStepDuration = currentStep?.duration ?? 0;
  const currentTimer = breathingState?.timer ?? 0;
  const timerProgress = currentStepDuration > 0 ? ((currentStepDuration - currentTimer) / currentStepDuration) * 100 : 0;

  // Log values used for rendering timer UI
  // console.log(`[Frontend Render] breathingState Active: ${isBreathingActive}, Step Index: ${currentStepIndex}, Current Step Duration: ${currentStepDuration}, Current Timer: ${currentTimer}, Progress: ${timerProgress}`);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #FFF8DC 0%, #FFC0CB 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        pb: { xs: 10, sm: 7 },
        pt: { xs: 2, sm: 6 },
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 500,
          p: { xs: 2, sm: 4 },
          borderRadius: 4,
          mb: 2,
          mt: 2,
          bgcolor: '#fffefa',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.12)'
      }}>
        <Typography variant="h4" align="center" fontWeight={700} color="primary.dark" gutterBottom sx={{ letterSpacing: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Sade AI ✨
          <Typography component="span" variant="body1" sx={{ ml: 1.5, fontWeight: 400, fontSize: '1.1rem', color: 'text.secondary' }}>
            (SHA-DEY)
          </Typography>
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box
          sx={{
            minHeight: 320,
            maxHeight: { xs: 350, sm: 400 },
            overflowY: 'auto',
            bgcolor: 'rgba(255, 255, 255, 0.6)',
            borderRadius: 3,
            p: 2,
            mb: 2,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
            transition: 'background 0.3s',
          }}
        >
          {messages.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ mt: 8 }}>
              Say hello to <b>Sade AI</b>, your friendly AI chatbot! 🌸
              <br />
              Ask me anything! Search the web for information, or just chat.
            </Typography>
          )}
          {messages.map((msg, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: msg.sender === 'ai' ? 'flex-start' : 'flex-end',
                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                mb: 1.5,
              }}
            >
              {msg.sender === 'ai' && (
                <Avatar
                  src="/images/sade-avatar.jpg"
                  alt="Sade AI Avatar"
                  sx={{ width: 36, height: 36, mr: 1.5 }}
                />
              )}
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
          {loading && !activeGame && <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', mt: 2 }} />}
          <div ref={messagesEndRef} />
        </Box>

        {!loading && !activeGame && !breathingState?.active && messages.length <= 1 && (
             <Box sx={{
                 pt: 1,
                 pb: 1.5,
                 mb: 2,
                 overflow: 'hidden', 
             }}>
                 <Typography variant="caption" sx={{ width: '100%', textAlign: 'center', color: 'text.secondary', mb: 1 }} >Try asking:</Typography>
                 <Box sx={{
                     display: 'flex',
                     gap: 1,
                     flexWrap: 'nowrap', // Force single line
                     overflowX: 'auto', // Enable horizontal scroll
                     justifyContent: 'flex-start', // Align items to the start
                     px: { xs: 2, sm: 0 }, // Add horizontal padding for breathing room
                     pb: 1, // Padding at the bottom for scrollbar space if visible
                     // Hide scrollbar visually but keep functionality
                     '&::-webkit-scrollbar': {
                         display: 'none', // For Chrome, Safari, Opera
                     },
                     scrollbarWidth: 'none', // For Firefox
                     '-ms-overflow-style': 'none', // For IE/Edge
                 }}>
                 {suggestions.map((text, index) => (
                    <Chip
                      key={index}
                      label={text}
                      onClick={() => handleSuggestionClick(text)}
                      clickable
                      variant="outlined"
                      color="primary"
                      size="small"
                      disabled={loading}
                      sx={{ fontWeight: 500 }}
                    />
                  ))}
                </Box>
             </Box>
        )}

        {activeGame && !breathingState?.active && activeGame.gameType === 'guess_the_number' && (
           <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 1, color: 'text.secondary' }}>
             Guessing between {activeGame.lowerBound} and {activeGame.upperBound} (Guess #{activeGame.guessesMade + 1})
           </Typography>
        )}

        {isBreathingActive && currentStepIndex >= 0 && (
           <Box sx={{ p: 1, mt: 1, border: '1px dashed grey', borderRadius: 2, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.7)' }}>
                <Typography variant="caption" display="block" sx={{ mb: 0.5, fontWeight: 500 }}>
                    {currentStep?.text}
                </Typography>
                <LinearProgress
                    variant="determinate"
                    value={timerProgress}
                    sx={{ height: 8, borderRadius: 4, mb: 0.5, '& .MuiLinearProgress-bar': { transition: 'transform .2s linear'} }}
                 />
                 <Typography variant="caption" display="block">
                    {currentTimer}s remaining... (type 'stop' to end)
                 </Typography>
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
            placeholder={
                breathingState?.active ? "Focus on breathing... (or type 'stop')" :
                activeGame ? "Enter your guess..." :
                "Type your message..."
            }
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && input.trim()) sendMessage(input, forceSearchNext); }}
            disabled={loading || !socket?.connected}
            type={activeGame?.gameType === 'guess_the_number' ? 'number' : 'text'}
            sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 4px 0 rgba(31,38,135,0.04)' }}
          />

          {breathingState?.active ? (
              <Button variant="contained" color="secondary" onClick={stopBreathingExercise} sx={{ minWidth: 80, fontWeight: 600 }}>
                Stop
              </Button>
          ) : (
             <>
              {/* Send Button */}
              <Button variant="contained" onClick={() => sendMessage(input, false)} disabled={loading || !input.trim() || !socket?.connected} sx={{ minWidth: 80, fontWeight: 600 }}>
                {activeGame ? "Guess" : "Send"}
              </Button>
              {/* Search Button - Added */}
              <IconButton
                 color="primary"
                 onClick={() => sendMessage(input, true)}
                 disabled={loading || !input.trim() || !socket?.connected}
                 sx={{ border: '1px solid', borderColor: 'primary.main', ml: 0.5 }}
                 title="Search the web for this query"
              >
                  <SearchIcon />
              </IconButton>
             </>
          )}

          {!activeGame && !breathingState?.active && (
             <Button variant="outlined" color="secondary" onClick={() => { setMessages([]); localStorage.removeItem('sadeai_chat_history'); setActiveGame(null); setBreathingState(null); /* Clear all states on clear */ }} disabled={loading} sx={{ minWidth: 90, fontWeight: 500 }} >
              Clear Chat
             </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default SadeAIPage;