import React from 'react';

interface MuxPlayerProps {
  streamType: string;
  playbackId: string;
  metadataVideoTitle: string;
  metadataViewerUserId: string;
  style?: React.CSSProperties;
}

const MuxPlayer = React.forwardRef<HTMLElement | null, MuxPlayerProps>(
  ({ streamType, playbackId, metadataVideoTitle, metadataViewerUserId, style }, ref) => {
    return (
      <mux-player
        ref={ref}
        stream-type={streamType}
        playback-id={playbackId}
        metadata-video-title={metadataVideoTitle}
        metadata-viewer-user-id={metadataViewerUserId}
        style={style}
      />
    );
  }
);

MuxPlayer.displayName = 'MuxPlayer';

export default MuxPlayer; 