import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

const VibitIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Stylized V with curved line across it - similar to reference image */}
      <path 
        d="M6 4h12M12 19L7 8M12 19L17 8" 
        fill="none" 
        strokeWidth="2" 
        stroke="currentColor" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M4 14C8 10 16 10 20 14" 
        fill="none" 
        strokeWidth="2" 
        stroke="currentColor" 
        strokeLinecap="round"
      />
    </SvgIcon>
  );
};

export default VibitIcon; 