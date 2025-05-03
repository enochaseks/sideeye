import React from 'react';
import Box from '@mui/material/Box';

// Define keyframes for the dot animation
const bounce = {
  '0%, 80%, 100%': {
    transform: 'scale(0)',
  },
  '40%': {
    transform: 'scale(1.0)',
  },
};

const TypingIndicator: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', pl: 1, py: 1.2 }}> {/* Match padding roughly */}
      <Box
        sx={{
          height: 8,
          width: 8,
          borderRadius: '50%',
          bgcolor: 'grey.400',
          animation: 'bounce 1.4s infinite ease-in-out both',
          mx: 0.5, // Margin between dots
          animationName: 'bounceKeyframes', // Reference keyframes defined below
        }}
      />
      <Box
        sx={{
          height: 8,
          width: 8,
          borderRadius: '50%',
          bgcolor: 'grey.400',
          animation: 'bounce 1.4s infinite ease-in-out both',
          mx: 0.5,
          animationDelay: '0.2s', // Delay second dot
          animationName: 'bounceKeyframes',
        }}
      />
      <Box
        sx={{
          height: 8,
          width: 8,
          borderRadius: '50%',
          bgcolor: 'grey.400',
          animation: 'bounce 1.4s infinite ease-in-out both',
          mx: 0.5,
          animationDelay: '0.4s', // Delay third dot
          animationName: 'bounceKeyframes',
        }}
      />
      {/* Inject keyframes into the Box component scope */}
      <style>
        {`
          @keyframes bounceKeyframes {
            0%, 80%, 100% {
              transform: scale(0);
            }
            40% {
              transform: scale(1.0);
            }
          }
        `}
      </style>
    </Box>
  );
};

export default TypingIndicator; 