declare module '@mux/mux-node' {
  export interface MuxConfig {
    tokenId: string;
    tokenSecret: string;
  }

  export interface LiveStream {
    stream_key: string;
    playback_ids: Array<{ id: string }>;
    status: string;
  }

  export interface Video {
    liveStreams: {
      create: (options: {
        playback_policy: string[];
        new_asset_settings: { playback_policy: string[] };
      }) => Promise<LiveStream>;
      retrieve: (streamKey: string) => Promise<LiveStream>;
      delete: (streamKey: string) => Promise<void>;
    };
  }

  export class Mux {
    constructor(config: MuxConfig);
    video: Video;
  }
} 