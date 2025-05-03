import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { audioDeviceManager } from './audioDeviceManager';
import { useNavigate } from 'react-router-dom';

interface AudioLevelCallback {
  (userId: string, isSpeaking: boolean): void;
}

interface DeviceChangeCallback {
  (): void;
}

// --- Add type for User Left Callback --- 
interface UserLeftCallback {
  (userId: string): void;
}

class AudioService {
  private socket: Socket | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isRecording = false;
  private audioQueue: Map<string, ArrayBuffer[]> = new Map();
  private isPlaying = false;
  private gainNode: GainNode | null = null;
  private audioSources: Map<string, AudioBufferSourceNode> = new Map();
  private analyser: AnalyserNode | null = null;
  private audioLevelCallbacks: Set<AudioLevelCallback> = new Set();
  private speakingDetectionInterval: number | null = null;
  private currentRoomId: string = '';
  private audioElement: HTMLAudioElement | null = null;
  private deviceChangeCallbacks: Set<DeviceChangeCallback> = new Set();
  private isMuted: boolean = false;
  private microphoneNode: MediaStreamAudioSourceNode | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private audioChunks: Uint8Array[] = [];
  private lastChunkTime: number = 0;
  private speakingStates: Map<string, boolean> = new Map();
  private silenceTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private audioProcessingInterval: number | null = null; // Interval for processing queue
  private readonly BUFFER_TARGET_DURATION_MS = 150; // Target buffer duration before decoding
  private queueProcessingTimeouts: Map<string, NodeJS.Timeout> = new Map(); // Track timeouts for processing incomplete buffers
  private readonly QUEUE_MAX_WAIT_MS = 500; // Max time to wait before processing an incomplete buffer
  private currentUserId: string | null = null; // Store the current user ID
  private navigate: ReturnType<typeof useNavigate> | null = null; // Store navigate function
  // --- Add state for the user left callback --- 
  private userLeftCallback: UserLeftCallback | null = null;

  constructor() {
    // Use the CORRECT environment variable name
    const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    console.log(`Connecting to Socket.IO server at: ${socketUrl}`);

    this.socket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });
    this.setupSocketListeners();
    this.setupAudioContext();
    this.setupAudioElement();
    this.startAudioProcessingLoop(); // Start the loop

    // Listen for device changes from audioDeviceManager
    audioDeviceManager.onDeviceChange(() => {
      this.deviceChangeCallbacks.forEach(callback => callback());
    });

    // Add listener for page unload/hide
    window.addEventListener('pagehide', this.handlePageHide);
  }

  private handlePageHide = () => {
    console.log('[AudioService] Page hide event detected. Forcing audio cleanup.');
    this.stopAllAudioProcessing();
    // Optionally, also disconnect the socket cleanly if appropriate
    // if (this.socket) {
    //   this.socket.disconnect();
    // }
  }

  private setupAudioElement() {
    this.audioElement = document.createElement('audio');
    this.audioElement.autoplay = true;
    document.body.appendChild(this.audioElement);
  }

  private async setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Create and configure gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;
      this.gainNode.connect(this.audioContext.destination);

      // Create and configure analyser for speaking detection
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.2;
      this.analyser.minDecibels = -65;
      this.analyser.maxDecibels = -10;
      this.analyser.connect(this.gainNode);

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log('Audio context setup complete');
    } catch (error) {
      console.error('Error setting up audio context:', error);
      toast.error('Failed to initialize audio system');
    }
  }

  private async handleDeviceChange() {
    // If we're in a room, reconnect the audio with the new device
    if (this.currentRoomId && this.stream) {
      // Use the stored currentUserId directly
      if (this.currentUserId) {
        await this.leaveRoom(this.currentRoomId, this.currentUserId);
        await this.joinRoom(this.currentRoomId, this.currentUserId);
      }
    }
  }

  public onAudioLevel(callback: AudioLevelCallback) {
    this.audioLevelCallbacks.add(callback);
  }

  public removeAudioLevelCallback(callback: AudioLevelCallback) {
    this.audioLevelCallbacks.delete(callback);
  }

  private startSpeakingDetection() {
    if (!this.analyser || !this.stream || !this.currentUserId) return;
    const userId = this.currentUserId;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const SPEAKING_THRESHOLD = 25; // Lower threshold for better sensitivity
    const SPEAKING_HOLD_TIME = 200; // Shorter hold time for more responsive updates
    const CONSECUTIVE_FRAMES = 3; // Number of consecutive frames needed to trigger speaking
    let consecutiveSpeakingFrames = 0;

    this.speakingDetectionInterval = window.setInterval(() => {
      if (!this.analyser || this.isMuted) return;

      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate RMS (Root Mean Square) for better volume detection
      const rms = Math.sqrt(
        dataArray.reduce((acc, val) => acc + (val * val), 0) / bufferLength
      );
      
      const isSpeaking = rms > SPEAKING_THRESHOLD;

      // Clear any existing timeout
      const existingTimeout = this.silenceTimeouts.get(userId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      if (isSpeaking) {
        consecutiveSpeakingFrames++;
        if (consecutiveSpeakingFrames >= CONSECUTIVE_FRAMES && !this.speakingStates.get(userId)) {
          this.speakingStates.set(userId, true);
          this.audioLevelCallbacks.forEach(cb => cb(userId, true));
          this.socket?.emit('user-speaking', {
            roomId: this.currentRoomId,
            userId,
            isSpeaking: true
          });
        }
      } else {
        consecutiveSpeakingFrames = 0;
        // Set a timeout to change speaking state
        const timeout = setTimeout(() => {
          if (this.speakingStates.get(userId)) {
            this.speakingStates.set(userId, false);
            this.audioLevelCallbacks.forEach(cb => cb(userId, false));
            this.socket?.emit('user-speaking', {
              roomId: this.currentRoomId,
              userId,
              isSpeaking: false
            });
          }
        }, SPEAKING_HOLD_TIME);

        this.silenceTimeouts.set(userId, timeout);
      }
    }, 33); // Update more frequently (approximately 30fps)
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to audio server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from audio server');
      this.stopAllAudioProcessing();
      toast.error('Disconnected from audio server');
    });

    this.socket.on('user-joined', (userId: string) => {
      console.log('User joined:', userId);
    });

    this.socket.on('user-left', (userId: string) => {
      console.log('[AudioService] User left event received:', userId);
      this.stopUserAudio(userId); // Clean up audio resources
      // --- Call the registered callback --- 
      if (this.userLeftCallback) {
        this.userLeftCallback(userId);
      } else {
        console.warn('[AudioService] userLeftCallback not set.');
      }
    });

    this.socket.on('user-speaking', (data: { userId: string; isSpeaking: boolean }) => {
      this.audioLevelCallbacks.forEach(cb => cb(data.userId, data.isSpeaking));
    });

    this.socket.on('room-users', (users: string[]) => {
      console.log('Room users:', users);
    });

    this.socket.on('audio-stream', (data: { audio: ArrayBuffer; userId: string }) => {
      // Buffer the incoming audio chunk
          if (!this.audioQueue.has(data.userId)) {
            this.audioQueue.set(data.userId, []);
          }
        const queue = this.audioQueue.get(data.userId);
      if (queue) {
         // Basic check to prevent excessively large buffers
         if (queue.length < 100) { // Limit queue size
           queue.push(data.audio);
           // Reset/set a timeout to process this queue even if buffer target isn't met
           this.resetQueueProcessingTimeout(data.userId);
         } else {
           console.warn(`Audio queue for ${data.userId} is full, dropping chunk.`);
          }
        }
      // The processing loop still handles regular decoding
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error);
      toast.error('Connection error: ' + error.message);
    });

    this.socket.on('user-muted', (data: { userId: string; isMuted: boolean }) => {
      console.log(`User ${data.userId} mute status:`, data.isMuted);
      // You can add callbacks here if you need to update UI based on other users' mute status
    });

    // --- Listener for Sound Effects from others --- 
    this.socket.on('sound-effect', (data: { roomId: string, userId: string, soundUrl: string }) => {
        console.log(`[AudioService] Received sound-effect event: `, data);
        if (data.roomId === this.currentRoomId && data.userId !== this.currentUserId) {
            console.log(`[AudioService] Playing sound triggered by ${data.userId}`);
            this.playSoundLocally(data.soundUrl);
        } else {
            console.log(`[AudioService] Ignoring sound effect event (own event or different room).`);
        }
    });

    // --- Listeners for Owner Actions --- 
    this.socket.on('force-mute', () => {
      console.log('[AudioService] Received force-mute command.');
      toast.error('The room owner has muted you.');
      this.setMuted(true);
    });

    this.socket.on('force-unmute', () => {
      console.log('[AudioService] Received force-unmute command.');
      toast.success('The room owner has unmuted you.');
      this.setMuted(false);
    });

    this.socket.on('force-remove', (roomIdToRemoveFrom: string) => {
      console.log(`[AudioService] Received force-remove command for room ${roomIdToRemoveFrom}.`);
      toast.error('You have been removed from the room by the owner.');
      if (this.currentRoomId === roomIdToRemoveFrom && this.currentUserId) {
          this.leaveRoom(this.currentRoomId, this.currentUserId); 
      }
      if (this.navigate) {
          this.navigate('/side-rooms');
      } else {
          console.error('[AudioService] Navigate function not set, cannot redirect after removal.');
      }
    });
  }

  private async handleIncomingAudio(audioData: ArrayBuffer, userId: string) {
    if (!this.audioContext || !this.gainNode) return;

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.stopUserAudio(userId);

      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Create a more sophisticated audio processing chain
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // Add a low-latency mode
      source.playbackRate.value = 1.0;

      // Create a bandpass filter to focus on voice frequencies
      const bandpass = this.audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1000; // Center frequency for voice
      bandpass.Q.value = 0.5; // Wider Q for natural sound

      // Create a high-shelf filter to enhance clarity
      const highShelf = this.audioContext.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 4000;
      highShelf.gain.value = 3.0;

      // Connect the enhanced audio chain
      source
        .connect(bandpass)
        .connect(highShelf)
        .connect(compressor)
        .connect(this.gainNode);

      // Schedule the playback with minimal latency
      const latency = 0.02; // 20ms latency buffer
      const startTime = this.audioContext.currentTime + latency;
      source.start(startTime);
      
      this.audioSources.set(userId, source);

      source.onended = () => {
        source.disconnect();
        this.audioSources.delete(userId);
      };

    } catch (error) {
      console.error('Error handling incoming audio:', error);
    }
  }

  public async joinRoom(roomId: string, userId: string): Promise<boolean> {
    if (!this.socket) {
      console.error('Socket not initialized');
      return false;
    }
    
    try {
      this.currentRoomId = roomId;
      console.log('Requesting microphone access...');
      
      // Explicitly request permission first
      const permissionResult = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      if (permissionResult.state === 'denied') {
        throw new Error('Microphone permission denied. Please allow microphone access in your browser settings.');
      }

      // Show browser's permission dialog if not granted
      if (permissionResult.state === 'prompt') {
        toast.loading('Please allow microphone access...');
      }
      
      this.stream = await audioDeviceManager.getAudioStream();
      if (!this.stream) {
        throw new Error('Failed to get audio stream');
      }
      
      toast.success('Microphone access granted');
      console.log('Microphone access granted');

      // Apply initial mute state to the stream
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });

      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (this.audioContext && this.analyser) {
        const micSource = this.audioContext.createMediaStreamSource(this.stream);
        micSource.connect(this.analyser);
      }
      
      this.socket.emit('join-room', roomId, userId);
      console.log('Joined room:', roomId);
      
      this.currentUserId = userId; // Store the user ID
      
      this.setupAudioRecording(roomId, userId);
      this.startSpeakingDetection();
      
      return true;
    } catch (error) {
      console.error('Error joining room:', error);
      if (error instanceof Error) {
        toast.error('Failed to join room: ' + error.message);
      }
      return false;
    }
  }

  private setupAudioRecording(roomId: string, userId: string) {
    if (!this.stream || !this.audioContext) return;

    try {
      // Create and connect microphone input
      this.microphoneNode = this.audioContext.createMediaStreamSource(this.stream);

      // Create dynamics compressor for better audio quality
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.value = -50; // Lower threshold for more sensitivity
      compressor.knee.value = 40; // Softer knee for smoother compression
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // Create MediaRecorder with higher quality settings
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus',
        bitsPerSecond: 256000 // Increased bitrate for better quality
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && this.socket && !this.isMuted) {
          try {
            const arrayBuffer = await event.data.arrayBuffer();
            this.socket.emit('audio-stream', {
              roomId,
              userId,
              audio: arrayBuffer
            });
          } catch (error) {
            console.error('Error processing audio data:', error);
          }
        }
      };

      // Connect audio processing chain
      // Mic -> Compressor -> Analyser (for speaking detection)
      // DO NOT connect the analyser back to the output gainNode/destination
      this.microphoneNode
        .connect(compressor)
        .connect(this.analyser as AnalyserNode); // Stop the chain here

      // Start recording with smaller chunks for lower latency
      this.isRecording = true;
      this.mediaRecorder.start(10); // Reduced chunk size for lower latency

      // Apply initial mute state
      if (this.isMuted) {
        this.stream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
        this.microphoneNode.disconnect();
        this.mediaRecorder.pause();
      }

      // Start speaking detection
      this.startSpeakingDetection();

    } catch (error) {
      console.error('Error setting up audio recording:', error);
      toast.error('Failed to setup audio recording');
    }
  }

  public leaveRoom(roomId: string, userId: string) {
    console.log('Leaving room:', roomId);
    
    // Immediately stop all audio processing
    this.stopAllAudioProcessing();
    this.currentUserId = null; // Clear stored user ID

    if (this.socket) {
      this.socket.emit('leave-room', roomId, userId);
      this.currentRoomId = '';
    }
  }

  private stopAllAudioProcessing() {
    console.log('Stopping all audio processing...');
    this.stopAudioProcessingLoop(); // Also stop queue processing here
    // Clear speaking detection interval
    if (this.speakingDetectionInterval) {
      window.clearInterval(this.speakingDetectionInterval);
      this.speakingDetectionInterval = null;
    }

    // Stop media recorder
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }

    // Stop and cleanup microphone stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        console.log(`[AudioService] Stopping track: ${track.kind}, state: ${track.readyState}`);
        track.stop();
      });
      this.stream = null;
    } else {
        console.log('[AudioService] stopAllAudioProcessing: this.stream is null, cannot stop tracks.');
    }

    // Disconnect microphone node
    if (this.microphoneNode) {
      this.microphoneNode.disconnect();
      this.microphoneNode = null;
    }

    // Stop all audio sources immediately
    this.audioSources.forEach((source, userId) => {
      try {
        source.stop();
        source.disconnect();
      } catch (error) {
        console.warn('Minor error stopping audio source:', error);
      }
    });
    this.audioSources.clear();
    this.audioQueue.clear();

    // Reset speaking states
    this.speakingStates.clear();
    
    // Clear all timeouts
    this.silenceTimeouts.forEach(timeout => clearTimeout(timeout));
    this.silenceTimeouts.clear();
    this.stopAudioProcessingLoop(); // Ensure queue processing stops
  }

  public disconnect() {
    console.log('Disconnecting AudioService...');
    // Remove the pagehide listener
    window.removeEventListener('pagehide', this.handlePageHide);

    this.stopAllAudioProcessing();
    this.stopAudioProcessingLoop(); // Stop the queue processing
    this.currentUserId = null; // Clear stored user ID
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.audioSources.forEach((source, userId) => {
      this.stopUserAudio(userId);
    });
    this.audioQueue.clear();
    this.audioSources.clear();

    if (this.audioElement) {
      this.audioElement.remove();
      this.audioElement = null;
    }
  }

  private stopUserAudio(userId: string) {
    const source = this.audioSources.get(userId);
    if (source) {
      try {
        source.stop();
        source.disconnect();
      } catch (error) {
        console.warn('Minor error stopping user audio source:', error);
      }
      this.audioSources.delete(userId);
      this.audioQueue.delete(userId);
      // Clear speaking state for this user
      this.speakingStates.delete(userId);
      const timeout = this.silenceTimeouts.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        this.silenceTimeouts.delete(userId);
      }
      this.clearQueueProcessingTimeout(userId); // Clear any pending processing timeout
    }
  }

  public setMuted(muted: boolean) {
    if (this.isMuted === muted) return;
    
    this.isMuted = muted;
    console.log('Setting mute state:', muted);

    // 1. Mute the audio tracks
    if (this.stream) {
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
        console.log('Audio track enabled:', !muted);
      });
    }

    // 2. Disconnect/reconnect the microphone node
    if (this.microphoneNode && this.analyser && this.gainNode) {
      if (muted) {
        this.microphoneNode.disconnect();
      } else {
        this.microphoneNode
          .connect(this.analyser)
          .connect(this.gainNode);
      }
    }

    // 3. Stop/start the media recorder
    if (this.mediaRecorder && this.isRecording) {
      if (muted) {
        this.mediaRecorder.pause();
        console.log('MediaRecorder paused');
      } else {
        this.mediaRecorder.resume();
        console.log('MediaRecorder resumed');
      }
    }

    // 4. Clear speaking state
    if (muted) {
      if (this.currentUserId) {
        this.speakingStates.set(this.currentUserId, false);
        this.audioLevelCallbacks.forEach(cb => cb(this.currentUserId as string, false));
      }
    }

    // 5. Emit mute status to other users
    if (this.socket && this.currentRoomId) {
      if (this.currentUserId) {
        this.socket.emit('user-muted', {
          roomId: this.currentRoomId,
          userId: this.currentUserId,
          isMuted: muted
        });
      }
    }
  }

  public isMicrophoneMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
  }

  public async setAudioInput(deviceId: string): Promise<boolean> {
    const success = await audioDeviceManager.setInputDevice(deviceId);
    if (success && this.currentRoomId) {
      if (this.currentUserId) {
        await this.leaveRoom(this.currentRoomId, this.currentUserId);
        await this.joinRoom(this.currentRoomId, this.currentUserId);
      }
    }
    return success;
  }

  public async setAudioOutput(deviceId: string): Promise<boolean> {
    if (this.audioElement) {
      await audioDeviceManager.setAudioOutput(this.audioElement, deviceId);
    }
    return audioDeviceManager.setOutputDevice(deviceId);
  }

  public getInputDevices() {
    return audioDeviceManager.getInputDevices();
  }

  public getOutputDevices() {
    return audioDeviceManager.getOutputDevices();
  }

  public onDeviceChange(callback: DeviceChangeCallback) {
    this.deviceChangeCallbacks.add(callback);
    return () => this.deviceChangeCallbacks.delete(callback);
  }

  private startAudioProcessingLoop() {
    if (this.audioProcessingInterval) {
      clearInterval(this.audioProcessingInterval);
    }
    // Check the queue slightly more frequently than the target buffer duration
    this.audioProcessingInterval = window.setInterval(() => {
      this.processAudioQueue();
    }, this.BUFFER_TARGET_DURATION_MS / 2); // Check queue every ~75ms
  }

  private stopAudioProcessingLoop() {
    if (this.audioProcessingInterval) {
      clearInterval(this.audioProcessingInterval);
      this.audioProcessingInterval = null;
    }
    // Also clear all pending queue timeouts
    this.queueProcessingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.queueProcessingTimeouts.clear();
  }

  private async processAudioQueue() {
    if (!this.audioContext || this.audioContext.state !== 'running') return;

    const userIds = Array.from(this.audioQueue.keys());
    for (const userId of userIds) {
       this.processUserAudioQueue(userId); // Process normally (check buffer size)
    }
  }

  // Process a single user's queue
  private async processUserAudioQueue(userId: string, forceProcess: boolean = false) {
    const queue = this.audioQueue.get(userId);
    if (!queue || queue.length === 0) return; // Nothing to process

    // Estimate buffered duration (very rough estimate assuming 10ms chunks)
    const estimatedDurationMs = queue.length * 10;

    // Check if we should process
    if (forceProcess || estimatedDurationMs >= this.BUFFER_TARGET_DURATION_MS) {
        // Prevent processing if already playing for this user
        if (this.audioSources.has(userId)) {
            console.log(`[AudioQueue-${userId}] Already playing, skipping processing cycle.`);
            return;
        }

        const chunksToProcess = [...queue]; // Copy the chunks
        this.audioQueue.set(userId, []); // Clear the queue immediately
        this.clearQueueProcessingTimeout(userId); // Clear timeout as we are processing

        if (chunksToProcess.length === 0) {
            console.log(`[AudioQueue-${userId}] No chunks to process after clearing queue.`);
            return; // No data to process
        }

        console.log(`[AudioQueue-${userId}] Processing ${chunksToProcess.length} chunks.`);

        try {
            // Ensure the correct MIME type is specified for the Blob
            const audioBlob = new Blob(chunksToProcess, { type: 'audio/webm;codecs=opus' });
            const concatenatedBuffer = await audioBlob.arrayBuffer();

            if (concatenatedBuffer.byteLength > 0) {
               await this.decodeAndPlayAudio(concatenatedBuffer, userId);
            } else {
               console.warn(`[AudioQueue-${userId}] Concatenated buffer is empty.`);
            }
        } catch (error) {
            console.error(`[AudioQueue-${userId}] Error processing audio queue:`, error);
        }
    }
  }

  // Renamed the original handler to be called by the processing loop
  private async decodeAndPlayAudio(audioData: ArrayBuffer, userId: string) {
    if (!this.audioContext || !this.gainNode) {
        console.warn(`[AudioPlay-${userId}] Audio context or gain node not ready.`);
        return;
    }

    // Explicitly check and resume AudioContext state if needed
    if (this.audioContext.state === 'suspended') { // Check specifically for suspended state
        console.warn(`[AudioPlay-${userId}] AudioContext state is ${this.audioContext.state}, attempting resume.`);
        try {
            await this.audioContext.resume(); // Attempt resume
            // Assume resume worked if it didn't throw an error.
            console.log(`[AudioPlay-${userId}] AudioContext resume attempt finished.`);
        } catch (resumeError) {
            console.error(`[AudioPlay-${userId}] Error resuming audio context:`, resumeError);
            toast.error('Audio playback failed. Please try refreshing.');
            return; // Stop if context cannot be resumed
        }
    } else if (this.audioContext.state === 'closed') {
        console.error(`[AudioPlay-${userId}] Cannot play audio, context is closed.`);
        toast.error('Audio system closed unexpectedly. Please refresh.');
        return; // Cannot proceed if context is closed
    }

    // Re-check state *after* attempting resume, before proceeding
    if (this.audioContext.state !== 'running') {
      console.error(`[AudioPlay-${userId}] AudioContext is not running (${this.audioContext.state}) after resume attempt. Cannot play audio.`);
      return;
    }

    try {
      // Stop any previously playing audio for this user to prevent overlap
      this.stopUserAudio(userId);

      console.log(`[AudioPlay-${userId}] Decoding ${audioData.byteLength} bytes.`);
      const audioBuffer = await this.audioContext.decodeAudioData(audioData)
        .catch((err) => {
             console.error(`[AudioPlay-${userId}] decodeAudioData FAILED:`, err);
             toast.error(`Error decoding audio from user ${userId}.`); // More specific error
             throw err; // Re-throw to be caught by the outer try-catch
        });

      if (!audioBuffer) {
           console.warn(`[AudioPlay-${userId}] Decoding resulted in null buffer.`);
           return; // Stop if decoding failed or produced no buffer
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Create a more sophisticated audio processing chain
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // Add a low-latency mode
      source.playbackRate.value = 1.0;

      // Create a bandpass filter to focus on voice frequencies
      const bandpass = this.audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1000; // Center frequency for voice
      bandpass.Q.value = 0.5; // Wider Q for natural sound

      // Create a high-shelf filter to enhance clarity
      const highShelf = this.audioContext.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 4000;
      highShelf.gain.value = 3.0;

      // Connect the enhanced audio chain
      source
        .connect(bandpass)
        .connect(highShelf)
        .connect(compressor)
        .connect(this.gainNode);

      // Schedule the playback with minimal latency
      const latency = 0.02; // 20ms latency buffer
      const startTime = this.audioContext.currentTime + latency;
      console.log(`[AudioPlay-${userId}] Starting playback at ${startTime} (current: ${this.audioContext.currentTime})`);
      source.start(startTime);
      
      this.audioSources.set(userId, source);

      source.onended = () => {
        console.log(`[AudioPlay-${userId}] Playback ended.`);
        // Ensure disconnection happens cleanly
        try {
           source.disconnect();
        } catch(disconnectError) {
           console.warn(`[AudioPlay-${userId}] Minor error during source disconnection:`, disconnectError);
        }
        this.audioSources.delete(userId);
      };

    } catch (error) {
      // Catch errors from decodeAudioData or node connections
      console.error(`[AudioPlay-${userId}] Error handling incoming audio buffer:`, error);
    }
  }

  private resetQueueProcessingTimeout(userId: string) {
      // Clear existing timeout for this user
      const existingTimeout = this.queueProcessingTimeouts.get(userId);
      if (existingTimeout) {
          clearTimeout(existingTimeout);
      }

      // Set a new timeout
      const timeout = setTimeout(() => {
          console.log(`Processing queue for ${userId} due to timeout.`);
          this.processUserAudioQueue(userId, true); // Force processing
          this.queueProcessingTimeouts.delete(userId);
      }, this.QUEUE_MAX_WAIT_MS);

      this.queueProcessingTimeouts.set(userId, timeout);
  }

  private clearQueueProcessingTimeout(userId: string) {
      const existingTimeout = this.queueProcessingTimeouts.get(userId);
      if (existingTimeout) {
          clearTimeout(existingTimeout);
          this.queueProcessingTimeouts.delete(userId);
      }
  }

  // --- Moved Sound Effect Playback Method UP --- 
  private async playSoundLocally(soundUrl: string): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
        console.warn('[AudioService] Audio context not ready for sound effect.');
        return;
    }

    try {
        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        console.log(`[AudioService] Attempting to play sound locally: ${soundUrl}`);
        const response = await fetch(soundUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch sound: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.gainNode); // Connect to the main gain node
        source.start(0); // Play immediately

        source.onended = () => {
            console.log(`[AudioService] Sound effect finished: ${soundUrl}`);
            source.disconnect();
        };

    } catch (error) {
        console.error(`[AudioService] Error playing sound effect ${soundUrl}:`, error);
        toast.error(`Failed to play sound: ${soundUrl}`);
    }
  }

  // --- Public Method for Components --- 
  public triggerSoundEffect(roomId: string, soundUrl: string): void {
    if (!this.socket || !roomId || !soundUrl || !this.currentUserId) {
        console.error('[AudioService] Cannot trigger sound effect - missing socket, roomId, soundUrl, or userId.');
        return;
    }

    console.log(`[AudioService] Triggering sound effect: ${soundUrl} in room ${roomId} by user ${this.currentUserId}`);
    
    // 1. Play locally immediately for the user who triggered it
    this.playSoundLocally(soundUrl);

    // 2. Emit event to server for broadcasting to others
    this.socket.emit('sound-effect', {
        roomId,
        userId: this.currentUserId, // Send who triggered it
        soundUrl
    });
}

  // --- Add a way to set the navigate function --- 
  public setNavigate(navigateFunc: ReturnType<typeof useNavigate>): void {
    this.navigate = navigateFunc;
  }

  // --- Public Methods for Owner Actions --- 
  public sendForceMute(roomId: string, targetUserId: string): void {
    if (!this.socket) return;
    console.log(`[AudioService] Owner sending force-mute to ${targetUserId} in room ${roomId}`);
    this.socket.emit('force-mute', { roomId, targetUserId });
  }

  public sendForceUnmute(roomId: string, targetUserId: string): void {
    if (!this.socket) return;
    console.log(`[AudioService] Owner sending force-unmute to ${targetUserId} in room ${roomId}`);
    this.socket.emit('force-unmute', { roomId, targetUserId });
  }

  public sendForceRemove(roomId: string, targetUserId: string): void {
    if (!this.socket) return;
    console.log(`[AudioService] Owner sending force-remove to ${targetUserId} in room ${roomId}`);
    this.socket.emit('force-remove', { roomId, targetUserId });
  }

  public sendForceBan(roomId: string, targetUserId: string): void {
    if (!this.socket) return;
    console.log(`[AudioService] Owner sending force-ban to ${targetUserId} in room ${roomId}`);
    this.socket.emit('force-ban', { roomId, targetUserId });
  }

  // --- Method to register the callback --- 
  public onUserLeft(callback: UserLeftCallback): () => void {
    console.log('[AudioService] Registering onUserLeft callback.');
    this.userLeftCallback = callback;
    // Return a cleanup function to unregister
    return () => {
      console.log('[AudioService] Unregistering onUserLeft callback.');
      this.userLeftCallback = null;
    };
  }
}

export const audioService = new AudioService(); 