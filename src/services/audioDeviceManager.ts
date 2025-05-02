import { toast } from 'react-hot-toast';

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

class AudioDeviceManager {
  private devices: AudioDevice[] = [];
  private currentInputDevice: string | null = null;
  private currentOutputDevice: string | null = null;
  private onDeviceChangeCallbacks: Set<() => void> = new Set();
  private isInitializing: boolean = true;

  constructor() {
    this.initDeviceListener();
  }

  private async initDeviceListener() {
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange.bind(this));
    
    // Get initial device list (enumerateDevices might still work without prior permission, 
    // but the user will be properly prompted when getAudioStream is called later)
    await this.updateDeviceList();
  }

  private async handleDeviceChange() {
    await this.updateDeviceList();
    this.onDeviceChangeCallbacks.forEach(callback => callback());
  }

  private async updateDeviceList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices
        .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind === 'audioinput' ? 'Microphone' : 'Speaker'} ${device.deviceId.slice(0, 5)}`,
          kind: device.kind as 'audioinput' | 'audiooutput'
        }));

      // Set default devices if not already set
      if (!this.currentInputDevice) {
        const defaultInput = this.devices.find(d => d.kind === 'audioinput');
        if (defaultInput) this.currentInputDevice = defaultInput.deviceId;
      }
      if (!this.currentOutputDevice) {
        const defaultOutput = this.devices.find(d => d.kind === 'audiooutput');
        if (defaultOutput) this.currentOutputDevice = defaultOutput.deviceId;
      }
    } catch (error) {
      console.error('Failed to update device list:', error);
      toast.error('Failed to get audio devices list');
    } finally {
      this.isInitializing = false;
    }
  }

  public async getAudioStream(options: MediaTrackConstraints = {}): Promise<MediaStream | null> {
    if (this.isInitializing) {
        console.warn('Device manager still initializing, delaying getAudioStream');
        await new Promise(resolve => setTimeout(resolve, 100)); // Simple delay
        // Could implement a more robust waiting mechanism if needed
    }
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...options,
          deviceId: this.currentInputDevice ? { exact: this.currentInputDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (error) {
      console.error('Failed to get audio stream:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('Microphone access was denied');
        } else if (error.name === 'NotFoundError') {
          toast.error('No microphone found');
        } else {
          toast.error(`Failed to access microphone: ${error.message}`);
        }
      }
      return null;
    }
  }

  public async setAudioOutput(element: HTMLAudioElement | HTMLVideoElement, deviceId?: string) {
    if (this.isInitializing) {
        console.warn('Device manager still initializing, delaying setAudioOutput');
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if ('setSinkId' in element) {
      try {
        const sinkId = deviceId || this.currentOutputDevice;
        if (sinkId) {
          // @ts-ignore - setSinkId is not in the type definitions yet
          await element.setSinkId(sinkId);
          this.currentOutputDevice = sinkId;
        }
      } catch (error) {
        console.error('Failed to set audio output device:', error);
        toast.error('Error changing speaker. Please try again.');
      }
    }
  }

  public async setInputDevice(deviceId: string): Promise<boolean> {
    if (this.isInitializing) {
        console.warn('Device manager still initializing, delaying setInputDevice');
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    const device = this.devices.find(d => d.deviceId === deviceId && d.kind === 'audioinput');
    if (!device) return false;

    try {
      // Test if we can get a stream with this device
      const stream = await this.getAudioStream({ deviceId: { exact: deviceId } });
      if (stream) {
        stream.getTracks().forEach(track => track.stop()); // Clean up test stream
        this.currentInputDevice = deviceId;
        return true;
      }
    } catch (error) {
      console.error('Failed to set input device:', error);
      toast.error('Error changing microphone. Please try again.');
    }
    return false;
  }

  public async setOutputDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.find(d => d.deviceId === deviceId && d.kind === 'audiooutput');
    if (!device) return false;

    this.currentOutputDevice = deviceId;
    return true;
  }

  public getInputDevices(): AudioDevice[] {
    return this.devices.filter(d => d.kind === 'audioinput');
  }

  public getOutputDevices(): AudioDevice[] {
    return this.devices.filter(d => d.kind === 'audiooutput');
  }

  public getCurrentInputDevice(): string | null {
    return this.currentInputDevice;
  }

  public getCurrentOutputDevice(): string | null {
    return this.currentOutputDevice;
  }

  public onDeviceChange(callback: () => void) {
    this.onDeviceChangeCallbacks.add(callback);
    return () => this.onDeviceChangeCallbacks.delete(callback);
  }

  public async refreshDevices() {
    await this.updateDeviceList();
  }
}

export const audioDeviceManager = new AudioDeviceManager(); 