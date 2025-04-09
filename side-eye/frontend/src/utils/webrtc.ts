import { createSignalingChannel } from '../services/signaling';

interface SignalingData {
  senderId: string;
  data: any;
}

interface SignalingChannel {
  listenForOffer: (callback: (data: SignalingData) => void) => () => void;
  listenForAnswer: (callback: (data: SignalingData) => void) => () => void;
  listenForIceCandidate: (callback: (data: SignalingData) => void) => () => void;
  sendOffer: (offer: RTCSessionDescriptionInit, senderId: string) => Promise<void>;
  sendAnswer: (answer: RTCSessionDescriptionInit, senderId: string) => Promise<void>;
  sendIceCandidate: (candidate: RTCIceCandidate, senderId: string) => Promise<void>;
  cleanup: () => void;
}

interface PeerConnection {
  pc: RTCPeerConnection;
  signaling: SignalingChannel;
  addStream: (stream: MediaStream) => void;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  handleOffer: (offer: RTCSessionDescriptionInit) => Promise<void>;
  handleAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
  handleIceCandidate: (candidate: RTCIceCandidate) => Promise<void>;
  cleanup: () => void;
}

export const createPeerConnection = (roomId: string, userId: string): PeerConnection => {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const pc = new RTCPeerConnection(configuration);
  const signaling = createSignalingChannel(roomId);

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('New ICE candidate:', event.candidate);
      signaling.sendIceCandidate(event.candidate, userId);
    }
  };

  // Handle connection state changes
  pc.onconnectionstatechange = () => {
    console.log('Connection state:', pc.connectionState);
  };

  // Handle ICE connection state changes
  pc.oniceconnectionstatechange = () => {
    console.log('ICE connection state:', pc.iceConnectionState);
  };

  // Handle incoming tracks
  pc.ontrack = (event) => {
    console.log('Received track:', event.track.kind);
    const stream = event.streams[0];
    if (stream) {
      console.log('New stream received:', {
        id: event.track.id,
        kind: event.track.kind,
        label: event.track.label
      });
      return stream;
    }
  };

  const addStream = (stream: MediaStream) => {
    console.log('Adding stream to peer connection:', {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length
    });

    stream.getTracks().forEach(track => {
      console.log('Adding track:', {
        kind: track.kind,
        label: track.label,
        enabled: track.enabled
      });
      pc.addTrack(track, stream);
    });
  };

  const createOffer = async () => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signaling.sendOffer(offer, userId);
      return offer;
    } catch (err) {
      console.error('Error creating offer:', err);
      throw err;
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signaling.sendAnswer(answer, userId);
    } catch (err) {
      console.error('Error handling offer:', err);
      throw err;
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      await pc.setRemoteDescription(answer);
    } catch (err) {
      console.error('Error handling answer:', err);
      throw err;
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidate) => {
    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
      throw err;
    }
  };

  const cleanup = () => {
    pc.close();
    signaling.cleanup();
  };

  return {
    pc,
    signaling,
    addStream,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup
  };
};

export const getMediaStream = async (constraints: MediaStreamConstraints) => {
  try {
    // Check if browser supports getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser');
    }

    // Request permissions
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Got media stream:', stream.getTracks().map(t => t.kind));
    return stream;
  } catch (err) {
    console.error('Error accessing media devices:', err);
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Please allow access to your camera and microphone');
      } else if (err.name === 'NotFoundError') {
        throw new Error('No camera or microphone found');
      } else if (err.name === 'NotReadableError') {
        throw new Error('Camera or microphone is already in use');
      }
    }
    throw err;
  }
};

export const getScreenShare = async (): Promise<MediaStream> => {
  try {
    // Check if browser supports screen sharing
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing is not supported in this browser');
    }

    // Request screen sharing with specific constraints
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    });

    // Handle when user stops sharing
    stream.getVideoTracks()[0].onended = () => {
      console.log('Screen sharing ended by user');
      stopMediaStream(stream);
    };

    console.log('Screen sharing started successfully');
    return stream;
  } catch (err) {
    console.error('Error accessing screen share:', err);
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Screen sharing permission was denied. Please allow access to share your screen.');
      } else if (err.name === 'NotFoundError') {
        throw new Error('No screen sharing source found. Please make sure you have a screen to share.');
      } else if (err.name === 'NotReadableError') {
        throw new Error('Screen sharing is already in use by another application.');
      } else if (err.name === 'OverconstrainedError') {
        throw new Error('Screen sharing constraints could not be satisfied.');
      }
    }
    throw new Error('Failed to start screen sharing. Please try again.');
  }
};

export const stopMediaStream = (stream: MediaStream) => {
  stream.getTracks().forEach(track => {
    console.log('Stopping track:', track.kind);
    track.stop();
  });
}; 