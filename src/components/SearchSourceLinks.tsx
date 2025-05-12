import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

// Type definition for source link data
export type SourceLink = {
  title: string;
  url: string;
  displayUrl: string;
};

// Component to display search result citations as chips
const SearchSourceLinks: React.FC<{ links: SourceLink[] }> = ({ links }) => {
  if (!links || links.length === 0) return null;
  
  return (
    <Box mt={1}>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontStyle: 'italic', mb: 0.5 }}>
        Sources:
      </Typography>
      <Box display="flex" flexWrap="wrap" gap={0.5}>
        {links.map((link, index) => (
          <Chip
            key={index}
            size="small"
            label={link.title}
            component="a"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            clickable
            sx={{
              maxWidth: '100%',
              '& .MuiChip-label': {
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
              fontSize: '0.7rem',
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
              }
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default SearchSourceLinks; 