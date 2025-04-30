import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  SelectChangeEvent
} from '@mui/material';
import {
  Mic as MicIcon,
  VolumeUp as VolumeUpIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { audioService } from '../services/audioService';
import { audioDeviceManager } from '../services/audioDeviceManager';
import type { AudioDevice } from '../services/audioDeviceManager';

const AudioDeviceSelector: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'input' | 'output' | null>(null);

  const loadDevices = async () => {
    await audioDeviceManager.refreshDevices();
    setInputDevices(audioDeviceManager.getInputDevices());
    setOutputDevices(audioDeviceManager.getOutputDevices());
    setSelectedInput(audioDeviceManager.getCurrentInputDevice() || '');
    setSelectedOutput(audioDeviceManager.getCurrentOutputDevice() || '');
  };

  useEffect(() => {
    loadDevices();

    const unsubscribe = audioDeviceManager.onDeviceChange(() => {
      loadDevices();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleInputChange = async (event: SelectChangeEvent<string>) => {
    const deviceId = event.target.value;
    setLoading('input');
    setError(null);
    try {
      const success = await audioService.setAudioInput(deviceId);
      if (success) {
        setSelectedInput(deviceId);
      } else {
        setError('Failed to set input device');
        setSelectedInput(audioDeviceManager.getCurrentInputDevice() || '');
      }
    } catch (error) {
      setError('Error changing input device');
      setSelectedInput(audioDeviceManager.getCurrentInputDevice() || '');
    } finally {
      setLoading(null);
    }
  };

  const handleOutputChange = async (event: SelectChangeEvent<string>) => {
    const deviceId = event.target.value;
    setLoading('output');
    setError(null);
    try {
      const success = await audioService.setAudioOutput(deviceId);
      if (success) {
        setSelectedOutput(deviceId);
      } else {
        setError('Failed to set output device');
        setSelectedOutput(audioDeviceManager.getCurrentOutputDevice() || '');
      }
    } catch (error) {
      setError('Error changing output device');
      setSelectedOutput(audioDeviceManager.getCurrentOutputDevice() || '');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Tooltip title="Audio Settings">
        <IconButton onClick={() => setOpen(true)} size="small">
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Audio Device Settings</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="input-device-label">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MicIcon fontSize="small" />
                  Microphone
                </Box>
              </InputLabel>
              <Select
                labelId="input-device-label"
                value={selectedInput}
                onChange={handleInputChange}
                label="Microphone"
                disabled={loading === 'input'}
              >
                {inputDevices.map((device) => (
                  <MenuItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="output-device-label">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VolumeUpIcon fontSize="small" />
                  Speaker
                </Box>
              </InputLabel>
              <Select
                labelId="output-device-label"
                value={selectedOutput}
                onChange={handleOutputChange}
                label="Speaker"
                disabled={loading === 'output'}
              >
                {outputDevices.map((device) => (
                  <MenuItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {inputDevices.length === 0 && outputDevices.length === 0 && (
              <Typography color="text.secondary">
                No audio devices found. Please make sure your devices are connected and you have granted permission to use them.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AudioDeviceSelector; 