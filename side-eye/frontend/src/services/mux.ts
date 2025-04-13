import { Mux } from '@mux/mux-node';

// Validate environment variables
const tokenId = process.env.REACT_APP_MUX_TOKEN_ID;
const tokenSecret = process.env.REACT_APP_MUX_TOKEN_SECRET;

if (!tokenId || !tokenSecret) {
  throw new Error('Mux credentials are not properly configured. Please check your environment variables.');
}

// Initialize Mux with your API keys
const mux = new Mux({
  tokenId,
  tokenSecret,
});

export interface StreamInfo {
  streamKey: string;
  playbackId: string;
  status: 'active' | 'idle';
}

export const createStream = async (): Promise<StreamInfo> => {
  try {
    const stream = await mux.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: { playback_policy: ['public'] },
    });

    if (!stream.playback_ids?.[0]?.id) {
      throw new Error('No playback ID available');
    }

    return {
      streamKey: stream.stream_key,
      playbackId: stream.playback_ids[0].id,
      status: 'idle',
    };
  } catch (error) {
    console.error('Error creating Mux stream:', error);
    throw new Error('Failed to create stream');
  }
};

export const getStreamStatus = async (streamKey: string): Promise<StreamInfo> => {
  try {
    const stream = await mux.video.liveStreams.retrieve(streamKey);
    
    if (!stream.playback_ids?.[0]?.id) {
      throw new Error('No playback ID available');
    }

    return {
      streamKey: stream.stream_key,
      playbackId: stream.playback_ids[0].id,
      status: stream.status === 'active' ? 'active' : 'idle',
    };
  } catch (error) {
    console.error('Error getting stream status:', error);
    throw new Error('Failed to get stream status');
  }
};

export const deleteStream = async (streamKey: string): Promise<void> => {
  try {
    await mux.video.liveStreams.delete(streamKey);
  } catch (error) {
    console.error('Error deleting stream:', error);
    throw new Error('Failed to delete stream');
  }
}; 