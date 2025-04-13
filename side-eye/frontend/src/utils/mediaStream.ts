// MediaStream utility functions

/**
 * Get user's audio and/or video stream
 */
export const getUserMedia = async (constraints: MediaStreamConstraints = { audio: true, video: true }) => {
  try {
    // Check if browser supports getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Your browser does not support getUserMedia API');
    }

    // Request media stream with specified constraints
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: constraints.audio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100,
        channelCount: 2
      } : false,
      video: constraints.video ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: 'user',
        aspectRatio: { ideal: 1.7777777778 }
      } : false
    });

    // Add event listeners to track state changes
    stream.getTracks().forEach(track => {
      track.onended = () => {
        console.log(`${track.kind} track ended`);
      };
      track.onmute = () => {
        console.log(`${track.kind} track muted`);
      };
      track.onunmute = () => {
        console.log(`${track.kind} track unmuted`);
      };
    });

    console.log('Got media stream:', stream.getTracks().map(track => `${track.kind}: ${track.label}`));
    return stream;
  } catch (err) {
    console.error('Error accessing media devices:', err);
    if (err instanceof Error) {
      switch (err.name) {
        case 'NotAllowedError':
          throw new Error('Please allow access to your camera and microphone');
        case 'NotFoundError':
          throw new Error('No camera or microphone found');
        case 'NotReadableError':
          throw new Error('Your camera or microphone is already in use');
        case 'OverconstrainedError':
          throw new Error('The requested media settings are not available');
        default:
          throw err;
      }
    }
    throw err;
  }
};

/**
 * Get user's screen sharing stream
 */
export const getDisplayMedia = async () => {
  try {
    // Check if browser supports getDisplayMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Your browser does not support screen sharing');
    }

    // Request screen sharing stream with specific constraints
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100,
        channelCount: 2
      }
    });

    // Handle when user stops sharing through browser UI
    stream.getVideoTracks()[0].onended = () => {
      console.log('Screen sharing ended by user');
      stopMediaStream(stream);
    };

    console.log('Got screen share stream:', stream.getTracks().map(track => `${track.kind}: ${track.label}`));
    return stream;
  } catch (err) {
    console.error('Error accessing screen share:', err);
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Please allow access to share your screen');
      } else if (err.name === 'NotFoundError') {
        throw new Error('No screen sharing source found');
      } else if (err.name === 'NotReadableError') {
        throw new Error('Screen sharing is already in use');
      } else if (err.name === 'OverconstrainedError') {
        throw new Error('Screen sharing constraints could not be satisfied');
      }
    }
    throw err;
  }
};

/**
 * Stop all tracks in a media stream
 */
export const stopMediaStream = (stream: MediaStream | null) => {
  if (!stream) return;
  
  stream.getTracks().forEach(track => {
    console.log(`Stopping ${track.kind} track:`, track.label);
    track.stop();
    track.enabled = false;
  });
};

/**
 * Toggle track enabled state (mute/unmute or show/hide)
 */
export const toggleTrack = (stream: MediaStream | null, kind: 'audio' | 'video') => {
  if (!stream) return false;

  const tracks = kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks();
  if (tracks.length === 0) return false;

  const enabled = !tracks[0].enabled;
  tracks.forEach(track => {
    track.enabled = enabled;
    console.log(`${track.kind} track ${enabled ? 'enabled' : 'disabled'}:`, track.label);
  });

  return enabled;
};

/**
 * Check if media devices are available
 */
export const checkMediaDevices = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      throw new Error('Media devices API not supported');
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasAudio = devices.some(device => device.kind === 'audioinput');
    const hasVideo = devices.some(device => device.kind === 'videoinput');

    return {
      audio: hasAudio,
      video: hasVideo,
      devices: devices.map(device => ({
        id: device.deviceId,
        kind: device.kind,
        label: device.label,
        groupId: device.groupId
      }))
    };
  } catch (err) {
    console.error('Error checking media devices:', err);
    throw err;
  }
}; 