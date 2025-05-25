import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AccessTime as AccessTimeIcon, FiberManualRecord as LiveIcon, Stop as StopIcon } from '@mui/icons-material';
import type { RoomStyle } from '../../types/index';

interface TimeFrameProps {
    isHostLive: boolean;
    roomStyle?: RoomStyle;
    hostName?: string;
    isCurrentUserHost?: boolean;
    onStopLive?: () => void;
}

const TimeFrame: React.FC<TimeFrameProps> = ({ 
    isHostLive, 
    roomStyle, 
    hostName, 
    isCurrentUserHost = false,
    onStopLive 
}) => {
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

    // Reset and start timer when host goes live
    useEffect(() => {
        if (isHostLive && !startTime) {
            // Host just went live
            const now = Date.now();
            setStartTime(now);
            console.log('[TimeFrame] Host went live, starting timer at:', new Date(now).toLocaleTimeString());
        } else if (!isHostLive && startTime) {
            // Host went offline
            setStartTime(null);
            setElapsedTime('00:00:00');
            console.log('[TimeFrame] Host went offline, resetting timer');
        }
    }, [isHostLive, startTime]);

    // Update elapsed time every second while host is live
    useEffect(() => {
        if (!isHostLive || !startTime) {
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - startTime;
            
            const hours = Math.floor(elapsed / (1000 * 60 * 60));
            const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
            
            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            setElapsedTime(formattedTime);
        }, 1000);

        return () => clearInterval(interval);
    }, [isHostLive, startTime]);

    // Don't render anything if host is not live
    if (!isHostLive) {
        return null;
    }

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                backgroundColor: roomStyle?.headerColor 
                    ? alpha(roomStyle.headerColor, 0.1) 
                    : alpha('#ff0000', 0.1),
                border: `1px solid ${roomStyle?.accentColor || '#ff0000'}`,
                borderRadius: 2,
                backdropFilter: 'blur(5px)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                fontFamily: roomStyle?.font || 'inherit',
                color: roomStyle?.textColor || 'inherit',
                mb: 2,
                mx: 'auto',
                maxWidth: 'fit-content'
            }}
        >
            {/* Live indicator */}
            <Chip
                icon={<LiveIcon sx={{ color: '#ff0000', animation: 'pulse 1.5s infinite' }} />}
                label="LIVE"
                size="small"
                sx={{
                    backgroundColor: alpha('#ff0000', 0.1),
                    color: '#ff0000',
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                    border: '1px solid #ff0000',
                    '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.6 },
                        '100%': { opacity: 1 }
                    }
                }}
            />

            {/* Time display */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon 
                    fontSize="small" 
                    sx={{ color: roomStyle?.accentColor || '#666' }} 
                />
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        fontSize: '1rem',
                        color: roomStyle?.textColor || 'inherit'
                    }}
                >
                    {elapsedTime}
                </Typography>
            </Box>

            {/* Host name (optional) */}
            {hostName && (
                <Typography
                    variant="caption"
                    sx={{
                        color: roomStyle?.textColor 
                            ? alpha(roomStyle.textColor, 0.8) 
                            : 'text.secondary',
                        fontFamily: roomStyle?.font || 'inherit'
                    }}
                >
                    {hostName} is live
                </Typography>
            )}

            {/* Stop Live Button - Only show for the host */}
            {isCurrentUserHost && onStopLive && (
                <Tooltip title="End Live Session">
                    <IconButton
                        onClick={onStopLive}
                        size="small"
                        sx={{
                            backgroundColor: alpha('#ff0000', 0.1),
                            color: '#ff0000',
                            border: '1px solid #ff0000',
                            '&:hover': {
                                backgroundColor: alpha('#ff0000', 0.2),
                            },
                            ml: 1
                        }}
                    >
                        <StopIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
        </Box>
    );
};

export default TimeFrame; 