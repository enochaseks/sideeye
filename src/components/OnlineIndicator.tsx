import React from 'react';
import { Box, Tooltip } from '@mui/material';

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
}

const OnlineIndicator: React.FC<OnlineIndicatorProps> = ({ 
  isOnline, 
  size = 'small', 
  showTooltip = true 
}) => {
  const sizeMap = {
    small: 10,
    medium: 14,
    large: 18
  };

  const indicator = (
    <Box
      sx={{
        width: sizeMap[size],
        height: sizeMap[size],
        borderRadius: '50%',
        backgroundColor: isOnline ? '#4caf50' : '#bdbdbd',
        border: '2px solid white',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
        transition: 'background-color 0.3s ease'
      }}
    />
  );

  if (showTooltip) {
    return (
      <Tooltip title={isOnline ? 'Online' : 'Offline'} placement="top">
        {indicator}
      </Tooltip>
    );
  }

  return indicator;
};

export default OnlineIndicator; 