import React from 'react';
import { Box, Typography } from '@mui/material';

interface MediaContentProps {
  type: 'image' | 'gif';
  url: string;
  alt?: string;
}

const MediaContent: React.FC<MediaContentProps> = ({ type, url, alt }) => {
  return (
    <Box
      sx={{
        mt: 1,
        mb: 1,
        borderRadius: 1,
        overflow: 'hidden',
        maxWidth: '100%',
        position: 'relative',
      }}
    >
      {type === 'gif' ? (
        <img
          src={url}
          alt={alt || 'GIF'}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
          }}
        />
      ) : (
        <img
          src={url}
          alt={alt || 'Image'}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            maxHeight: '400px',
            objectFit: 'contain',
          }}
        />
      )}
    </Box>
  );
};

export default MediaContent; 