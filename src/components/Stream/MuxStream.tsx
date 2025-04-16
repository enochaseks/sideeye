import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, Alert, CircularProgress } from '@mui/material';
import '@mux/mux-player';
import { createLiveStream, deleteLiveStream, fetchWithCORS } from '../../api/mux';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'mux-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'stream-type'?: string;
        'playback-id'?: string;
        'metadata-video-title'?: string;
        'metadata-viewer-user-id'?: string;
      };
    }
  }
}

interface MuxStreamProps {
  isOwner: boolean;
  roomId: string;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const MuxStream: React.FC<MuxStreamProps> = ({ isOwner, roomId }) => {
  const [streamId, setStreamId] = useState<string>('');
  const [streamKey, setStreamKey] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackId, setPlaybackId] = useState<string>('');
  const [isStreamActive, setIsStreamActive] = useState(false);
  const playerRef = useRef<HTMLElement>(null);
  const checkStreamInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isOwner && roomId) {
      initializeStream();
    } else if (roomId) {
      // For viewers, only check stream status
      checkStreamStatus();
      // Set up periodic checking for viewers
      checkStreamInterval.current = setInterval(checkStreamStatus, 5000);
    }

    return () => {
      if (checkStreamInterval.current) {
        clearInterval(checkStreamInterval.current);
      }
    };
  }, [isOwner, roomId]);

  const checkStreamStatus = async () => {
    try {
      const response = await fetchWithCORS(`${API_URL}/api/streams/${roomId}/status`);
      if (response.status === 404) {
        if (isOwner) {
          console.log('No stream found, creating new stream...');
          await initializeStream();
          return;
        } else {
          console.log('No stream found for this room');
          setError('Stream is not available. Please wait for the owner to start streaming.');
          return;
        }
      }
      if (!response.ok) {
        throw new Error('Failed to check stream status');
      }
      const data = await response.json();
      setIsStreamActive(data.isActive);
      if (data.playbackId) {
        setPlaybackId(data.playbackId);
      }
      if (data.streamId) {
        setStreamId(data.streamId);
      }
      setError(null);
    } catch (err) {
      console.error('Error checking stream status:', err);
      setIsStreamActive(false);
      setError('Failed to check stream status. Please try again later.');
    }
  };

  const initializeStream = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!roomId) {
        throw new Error('Room ID is required');
      }

      console.log('Creating stream for room:', roomId);
      const data = await createLiveStream(roomId, 'owner');
      console.log('Stream created successfully:', data);

      if (!data.stream_key || !data.playback_ids?.[0]?.id) {
        console.error('Invalid stream data:', data);
        throw new Error('Invalid stream data received from server');
      }

      setStreamId(data.id);
      setStreamKey(data.stream_key);
      setPlaybackId(data.playback_ids[0].id);
      setIsStreamActive(false);

      if (checkStreamInterval.current) {
        clearInterval(checkStreamInterval.current);
      }
      checkStreamInterval.current = setInterval(checkStreamStatus, 5000);
    } catch (err) {
      console.error('Error initializing stream:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize streaming. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const startStreaming = async () => {
    try {
      setIsLoading(true);
      if (!streamId) {
        throw new Error('No stream ID available');
      }
      // In a real application, you would use OBS or another streaming software
      // to stream to the RTMP URL with the stream key
      setIsStreamActive(true);
    } catch (err) {
      console.error('Error starting stream:', err);
      setError('Failed to start streaming. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const stopStreaming = async () => {
    try {
      setIsLoading(true);
      if (!streamId) {
        throw new Error('No stream ID available');
      }
      
      await deleteLiveStream(streamId);
      setIsStreamActive(false);
      setStreamId('');
      setStreamKey('');
      setPlaybackId('');
    } catch (err) {
      console.error('Error stopping stream:', err);
      setError('Failed to stop streaming. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <CircularProgress />
        </Box>
      )}
      
      {isOwner && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={startStreaming}
            disabled={isLoading || !streamId || isStreamActive}
          >
            Start Streaming
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={stopStreaming}
            disabled={isLoading || !streamId || !isStreamActive}
          >
            Stop Streaming
          </Button>
        </Box>
      )}
      
      {isOwner && streamId && (
        <Box sx={{ mb: 2, p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Stream Setup Instructions</Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" color="primary">Stream Key (Required for OBS):</Typography>
            <Typography variant="body2" sx={{ 
              wordBreak: 'break-all',
              p: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              fontFamily: 'monospace'
            }}>
              {streamKey}
            </Typography>
          </Box>

          <Typography variant="subtitle1" sx={{ mb: 1 }}>How to Start Streaming:</Typography>
          <ol style={{ marginLeft: '20px' }}>
            <li>Open OBS Studio</li>
            <li>Go to Settings {`>`} Stream</li>
            <li>Select "Custom..." as Service</li>
            <li>Set Server URL to: <Typography component="span" sx={{ fontFamily: 'monospace' }}>rtmps://global-live.mux.com:443/app</Typography></li>
            <li>Copy the Stream Key shown above and paste it into the "Stream Key" field</li>
            <li>Click "OK" to save settings</li>
            <li>Click "Start Streaming" in OBS when ready</li>
          </ol>

          <Alert severity="info" sx={{ mt: 2 }}>
            Keep your stream key private! Anyone with this key can stream to your channel.
          </Alert>
        </Box>
      )}

      {playbackId && (
        <Box sx={{ mt: 2 }}>
          {!isStreamActive ? (
            <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Alert severity="info">
                The stream is not currently active. {isOwner ? 'Use the stream key above to start streaming.' : 'Please wait for the streamer to start broadcasting.'}
              </Alert>
            </Box>
          ) : (
            <mux-player
              ref={playerRef}
              stream-type="live"
              playback-id={playbackId}
              metadata-video-title="Live Stream"
              metadata-viewer-user-id={roomId}
              style={{ width: '100%', maxHeight: '500px' }}
            />
          )}
        </Box>
      )}
    </Box>
  );
};

export default MuxStream; 