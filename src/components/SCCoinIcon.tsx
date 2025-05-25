import React from 'react';
import { Box, Typography, SxProps, Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';

interface SCCoinIconProps {
    size?: 'small' | 'medium' | 'large';
    color?: string;
    value?: number | string;
    showValue?: boolean;
    sx?: SxProps<Theme>;
}

const SCCoinIcon: React.FC<SCCoinIconProps> = ({ 
    size = 'medium', 
    color = '#FFD700', // Gold color by default
    value,
    showValue = true,
    sx = {} 
}) => {
    const getSizeValues = () => {
        switch (size) {
            case 'small':
                return { width: 20, height: 20, fontSize: '0.6rem', valueSize: '0.75rem' };
            case 'large':
                return { width: 32, height: 32, fontSize: '0.8rem', valueSize: '1rem' };
            default: // medium
                return { width: 24, height: 24, fontSize: '0.7rem', valueSize: '0.875rem' };
        }
    };

    const { width, height, fontSize, valueSize } = getSizeValues();

    const coinComponent = (
        <Box
            sx={{
                width,
                height,
                borderRadius: '50%',
                background: `linear-gradient(145deg, ${color}, ${alpha(color, 0.7)})`,
                border: `2px solid ${alpha(color, 0.8)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                boxShadow: `
                    inset 0 2px 4px ${alpha('#fff', 0.3)},
                    inset 0 -2px 4px ${alpha('#000', 0.2)},
                    0 2px 8px ${alpha(color, 0.3)}
                `,
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '15%',
                    left: '15%',
                    right: '15%',
                    bottom: '15%',
                    borderRadius: '50%',
                    border: `1px solid ${alpha(color, 0.6)}`,
                    background: `linear-gradient(145deg, ${alpha('#fff', 0.1)}, transparent)`
                }
            }}
        >
            <Typography
                variant="caption"
                sx={{
                    fontSize,
                    fontWeight: 'bold',
                    color: '#000',
                    textShadow: `0 1px 2px ${alpha('#fff', 0.8)}`,
                    zIndex: 1,
                    lineHeight: 1
                }}
            >
                SC
            </Typography>
        </Box>
    );

    if (value !== undefined && showValue) {
        return (
            <Box 
                sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5,
                    ...sx 
                }}
            >
                {coinComponent}
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: valueSize,
                        fontWeight: 'medium',
                        color: 'text.primary'
                    }}
                >
                    {value}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={sx}>
            {coinComponent}
        </Box>
    );
};

export default SCCoinIcon; 