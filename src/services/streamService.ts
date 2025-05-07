import { StreamVideoClient, User, Call } from '@stream-io/video-react-sdk';
import { toast } from 'react-hot-toast';

const API_KEY = process.env.REACT_APP_STREAM_API_KEY; // To be set in .env

class StreamService {
  private client: StreamVideoClient | null = null;
  private activeCall: Call | null = null; // Use Call type
  private currentUser: User | null = null;

  constructor() {
    if (!API_KEY) {
      console.error('Stream API Key is not defined. Please set REACT_APP_STREAM_API_KEY in your .env file.');
      toast.error('Stream configuration error: API Key missing.');
      // Potentially throw an error or handle this state more gracefully
    }
  }

  public async initializeClient(userId: string, token: string): Promise<boolean> {
    if (!API_KEY) {
      toast.error('Stream API Key is missing.');
      return false;
    }
    if (this.client) {
      console.log('Stream client already initialized.');
      return true;
    }

    try {
      this.currentUser = {
        id: userId,
        // name: userName, // Optional: Add user name if available
        // image: userImage, // Optional: Add user image if available
      };

      this.client = new StreamVideoClient({ 
        apiKey: API_KEY, 
        user: this.currentUser, 
        token 
      });
      console.log('Stream client initialized successfully for user:', userId);
      toast.success('Stream client connected.');
      return true;
    } catch (error) {
      console.error('Error initializing Stream client:', error);
      toast.error('Failed to initialize Stream client.');
      this.client = null;
      this.currentUser = null;
      return false;
    }
  }

  public async joinCall(callId: string): Promise<boolean> {
    if (!this.client || !this.currentUser) {
      toast.error('Stream client not initialized or user not set.');
      return false;
    }

    try {
      // Ensure no active call before joining a new one
      if (this.activeCall) {
        await this.leaveCall();
      }

      const call = this.client.call('default', callId); // 'default' or your custom call type
      await call.join({ create: true }); // Create the call if it doesn't exist
      this.activeCall = call;
      console.log(`Successfully joined Stream call: ${callId}`);
      toast.success(`Joined call: ${callId}`);
      // TODO: Set up listeners for participants, audio/video tracks, etc.
      return true;
    } catch (error) {
      console.error('Error joining Stream call:', error);
      toast.error('Failed to join Stream call.');
      this.activeCall = null;
      return false;
    }
  }

  public async leaveCall(): Promise<void> {
    if (!this.activeCall) {
      console.log('No active Stream call to leave.');
      return;
    }

    try {
      await this.activeCall.leave();
      console.log('Successfully left Stream call:', this.activeCall.id);
      toast('Left the call.');
    } catch (error) {
      console.error('Error leaving Stream call:', error);
      toast.error('Failed to leave Stream call.');
    } finally {
      this.activeCall = null;
    }
  }

  public disconnectClient(): void {
    if (this.client) {
      // The React SDK handles disconnection when the StreamVideo component unmounts
      // or when the client instance is no longer used and garbage collected.
      // Explicit disconnect might be available on client.disconnectUser() or similar
      // For now, we'll rely on the SDK's lifecycle management or component unmounts.
      // If specific disconnection logic is needed, refer to Stream SDK docs.
      console.log('Stream client will be disconnected by SDK lifecycle or unmount.');
      // this.client.disconnectUser(); // Example if such a method exists
    }
    this.client = null;
    this.currentUser = null;
    this.activeCall = null;
  }

  // Placeholder for getting the active call object (if needed by components)
  public getActiveCall(): Call | null {
    return this.activeCall;
  }

  // Placeholder for getting the client object (if needed by components)
  public getClient(): StreamVideoClient | null {
    return this.client;
  }
}

export const streamService = new StreamService(); 