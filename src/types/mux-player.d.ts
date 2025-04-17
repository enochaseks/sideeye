import { DetailedHTMLProps, HTMLAttributes } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'mux-player': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        'stream-type'?: string;
        'playback-id'?: string;
        'metadata-video-title'?: string;
        'metadata-viewer-user-id'?: string;
        style?: React.CSSProperties;
      };
    }
  }
} 