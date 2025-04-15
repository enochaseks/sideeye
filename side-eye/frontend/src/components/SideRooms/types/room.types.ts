import { Timestamp } from 'firebase/firestore';

export interface RoomMember {
  userId: string;
  username: string;
  avatar: string;
  role: 'owner' | 'member' | 'viewer';
  joinedAt: Timestamp;
}

export interface RoomStyle {
  headerColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  font: string;
  customCss: string;
  headerGradient: boolean;
  backgroundGradient: boolean;
  glitterEffect: boolean;
  headerFontSize: number;
  stickers: string[];
}

export interface RecordedStream {
  id: string;
  playbackId: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  title?: string;
}

export interface SideRoom {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: RoomMember[];
  viewers: RoomMember[];
  isPrivate: boolean;
  password?: string;
  maxMembers: number;
  memberCount: number;
  viewerCount: number;
  activeUsers: number;
  lastActive: Timestamp;
  isLive: boolean;
  isRecording: boolean;
  currentRecordingId?: string;
  currentStreamId?: string;
  mobileStreamKey?: string;
  mobilePlaybackId?: string;
  mobileStreamerId?: string;
  isMobileStreaming?: boolean;
  style?: RoomStyle;
  recordedStreams?: RecordedStream[];
  category: string;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Message {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  timestamp: Timestamp;
  photoURL?: string;
  displayName?: string;
}

export interface PresenceData {
  userId: string;
  username: string;
  avatar: string;
  lastSeen: Timestamp;
  isOnline: boolean;
  role: 'owner' | 'member' | 'viewer';
}

export interface User {
  id: string;
  username: string;
  avatar: string;
  uid?: string;
  displayName?: string;
  photoURL?: string;
} 