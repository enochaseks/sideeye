import { Timestamp } from 'firebase/firestore';

export interface Story {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  author: {
    name: string;
    avatar: string;
    username: string;
  };
  authorId: string;
  timestamp: Date;
  expiresAt: Date;
  views: string[];
  viewDetails: {
    userId: string;
    timestamp: Date;
  }[];
} 