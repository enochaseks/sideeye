import { createSignalingChannel } from '../services/signaling';
import { SignalingData, SignalingChannel, PeerConnection } from '../types';

export const createPeerConnection = (roomId: string, localUserId: string): PeerConnection => {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  } as RTCConfiguration;

  const pc = new RTCPeerConnection(configuration);
  const signaling = createSignalingChannel(roomId);
  let localStream: MediaStream | null = null;
  let isNegotiating = false;

  // Handle negotiation needed
  pc.onnegotiationneeded = async () => {
    try {
      if (isNegotiating) {
        console.log('[WebRTC] Negotiation already in progress, skipping');
        return;
      }
      isNegotiating = true;
      console.log('[WebRTC] Negotiation needed, creating offer');
      
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      if (pc.signalingState !== 'stable') {
        console.log('[WebRTC] Signaling state is not stable, waiting...');
        return;
      }

      await pc.setLocalDescription(offer);
      await signaling.sendOffer(offer, localUserId, localUserId);
    } catch (err) {
      console.error('[WebRTC] Error during negotiation:', err);
    } finally {
      isNegotiating = false;
    }
  };

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('[WebRTC] New ICE candidate:', event.candidate);
      signaling.sendIceCandidate(event.candidate, localUserId, localUserId)
        .catch(err => console.error('[WebRTC] Error sending ICE candidate:', err));
    }
  };

  // Handle connection state changes
  pc.onconnectionstatechange = () => {
    console.log('[WebRTC] Connection state:', pc.connectionState);
    if (pc.connectionState === 'failed') {
      console.log('[WebRTC] Connection failed, restarting ICE');
      pc.restartIce();
    }
  };

  // Handle ICE connection state changes
  pc.oniceconnectionstatechange = () => {
    console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
    if (pc.iceConnectionState === 'failed') {
      console.log('[WebRTC] ICE connection failed, restarting ICE');
      pc.restartIce();
    }
  };

  // Handle signaling state changes
  pc.onsignalingstatechange = () => {
    console.log('[WebRTC] Signaling state:', pc.signalingState);
    isNegotiating = pc.signalingState !== 'stable';
  };

  const addStream = (stream: MediaStream) => {
    console.log('[WebRTC] Adding stream:', {
      id: stream.id,
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length
    });

    localStream = stream;

    // Remove any existing tracks
    const senders = pc.getSenders();
    senders.forEach(sender => {
      try {
        pc.removeTrack(sender);
      } catch (err) {
        console.warn('[WebRTC] Error removing track:', err);
      }
    });

    // Add all tracks from the stream
    stream.getTracks().forEach(track => {
      try {
        console.log('[WebRTC] Adding track:', {
          kind: track.kind,
          label: track.label,
          enabled: track.enabled
        });
        pc.addTrack(track, stream);
      } catch (err) {
        console.warn('[WebRTC] Error adding track:', err);
      }
    });

    // Force renegotiation
    if (pc.signalingState === 'stable') {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription) {
            signaling.sendOffer(pc.localDescription, localUserId, localUserId);
          }
        })
        .catch(err => console.error('[WebRTC] Error during forced renegotiation:', err));
    }
  };

  // Handle track events
  pc.ontrack = (event) => {
    console.log('[WebRTC] Received remote track:', {
      kind: event.track.kind,
      streams: event.streams.length
    });
    
    event.track.onunmute = () => {
      console.log('[WebRTC] Track unmuted:', event.track.kind);
    };
    
    event.track.onended = () => {
      console.log('[WebRTC] Track ended:', event.track.kind);
    };
  };

  const createOffer = async (recipientId: string, senderId: string) => {
    if (isNegotiating) {
      console.log('[WebRTC] Negotiation in progress, skipping createOffer');
      throw new Error('Negotiation in progress');
    }

    try {
      isNegotiating = true;
      console.log('[WebRTC] Creating offer for:', recipientId);
      
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      console.log('[WebRTC] Setting local description:', offer);
      await pc.setLocalDescription(offer);

      console.log('[WebRTC] Sending offer to:', recipientId);
      await signaling.sendOffer(offer, recipientId, senderId);

      return offer;
    } catch (err) {
      console.error('[WebRTC] Error creating offer:', err);
      throw err;
    } finally {
      isNegotiating = false;
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, senderId: string) => {
    if (isNegotiating) {
      console.log('[WebRTC] Negotiation in progress, skipping handleOffer');
      return;
    }

    try {
      isNegotiating = true;
      console.log('[WebRTC] Handling offer from:', senderId);
      
      console.log('[WebRTC] Setting remote description:', offer);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      console.log('[WebRTC] Creating answer');
      const answer = await pc.createAnswer();

      console.log('[WebRTC] Setting local description:', answer);
      await pc.setLocalDescription(answer);

      console.log('[WebRTC] Sending answer to:', senderId);
      await signaling.sendAnswer(answer, senderId, localUserId);
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
      throw err;
    } finally {
      isNegotiating = false;
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      console.log('[WebRTC] Setting remote description:', answer);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('[WebRTC] Error handling answer:', err);
      throw err;
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidate) => {
    try {
      if (pc.remoteDescription) {
        console.log('[WebRTC] Adding ICE candidate:', candidate);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log('[WebRTC] Skipping ICE candidate - no remote description');
      }
    } catch (err) {
      console.error('[WebRTC] Error handling ICE candidate:', err);
      throw err;
    }
  };

  const cleanup = () => {
    console.log('[WebRTC] Cleaning up peer connection');
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
    }
    pc.getSenders().forEach(sender => {
      if (sender.track) {
        sender.track.stop();
      }
    });
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
      throw new Error('Your browser does not support video chat');
    }

    // First check if we have permission
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasPermission = devices.some(device => device.label !== '');
    
    if (!hasPermission) {
      // Request basic permissions first
      const tempStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      // Stop the temporary stream
      tempStream.getTracks().forEach(track => track.stop());
    }

    // Now request with our desired constraints
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: constraints.audio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100
      } : false,
      video: constraints.video ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: 'user'
      } : false
    });

    console.log('Got media stream:', {
      id: stream.id,
      tracks: stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        label: t.label
      }))
    });

    return stream;
  } catch (err) {
    console.error('Error accessing media devices:', err);
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Please allow access to your camera and microphone to use video chat');
      } else if (err.name === 'NotFoundError') {
        throw new Error('No camera or microphone found on your device');
      } else if (err.name === 'NotReadableError') {
        throw new Error('Camera or microphone is already in use by another application');
      } else if (err.name === 'OverconstrainedError') {
        throw new Error('Your camera does not support the requested video quality');
      } else {
        throw new Error('Failed to access camera and microphone: ' + err.message);
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

    console.log('Screen sharing started:', {
      id: stream.id,
      tracks: stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        label: t.label
      }))
    });

    return stream;
  } catch (err) {
    console.error('Error accessing screen share:', err);
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Screen sharing permission was denied');
      } else if (err.name === 'NotFoundError') {
        throw new Error('No screen sharing source found');
      } else if (err.name === 'NotReadableError') {
        throw new Error('Screen sharing is already in use');
      }
    }
    throw new Error('Failed to start screen sharing');
  }
};

export const stopMediaStream = (stream: MediaStream) => {
  console.log('Stopping media stream:', {
    id: stream.id,
    tracks: stream.getTracks().map(t => ({
      kind: t.kind,
      enabled: t.enabled,
      label: t.label
    }))
  });

  stream.getTracks().forEach(track => {
    track.stop();
    track.enabled = false;
  });
}; 