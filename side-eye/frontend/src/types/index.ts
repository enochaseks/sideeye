import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  username: string;
  email: string;
  profilePic?: string;
  photoURL?: string;
  displayName?: string;
}

export interface Post {
  id: string;
  userId: string;
  author: {
    name: string;
    avatar: string;
    username: string;
    isVerified: boolean;
  };
  content: string;
  imageUrl?: string;
  timestamp: any;
  likes: number;
  comments: number;
  likedBy: string[];
  tags: string[];
}

export interface SideRoom {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: RoomMember[];
  memberCount: number;
  createdAt: Date;
  isPrivate: boolean;
  password?: string;
  tags?: string[];
  imageUrl?: string;
  isLive: boolean;
  liveParticipants: string[];
  category: string;
  scheduledReveals: SideReveal[];
  activeUsers: number;
  maxParticipants?: number;
  rules?: string[];
  bannedUsers?: string[];
  lastActive: Date;
  maxMembers: number;
}

export interface RoomMember {
  userId: string;
  username: string;
  avatar: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joinedAt: Date;
}

export interface SideReveal {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  timestamp: Date;
  roomId: string;
  likes: number;
  comments: Comment[];
  isAnonymous: boolean;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  timestamp: Timestamp;
  likes: number;
  likedBy: string[];
  isEdited: boolean;
}

export interface Author {
  id: string;
  name: string;
  avatar: string;
}

export interface PostData {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  timestamp: Timestamp;
  likes: number;
  likedBy: string[];
  comments: Comment[];
  imageUrl?: string;
  tags?: string[];
  isPrivate: boolean;
  userId: string;
  reposts: number;
  views: number;
  isPinned: boolean;
  isEdited: boolean;
  lastEdited?: Timestamp;
  isArchived: boolean;
  deleted: boolean;
}

export interface PostProps extends Omit<PostData, 'comments'> {
  comments: Comment[];
  commentCount: number;
  onDelete: (id: string) => Promise<void>;
  onEdit?: (id: string, newContent: string) => Promise<void>;
  onLike?: (id: string) => Promise<void>;
  onComment?: (id: string, content: string) => Promise<void>;
  onShare?: (id: string) => Promise<void>;
  isOwnPost: boolean;
}

export interface TeaReveal {
  id: string;
  title: string;
  scheduledTime: Date;
  category: string;
  authorId: string;
  anonymous: boolean;
}

export interface RealityCheck {
  id: string;
  postId: string;
  userId: string;
  verdict: 'cap' | 'facts';
  timestamp: Date;
  evidence?: string;
}

export interface Reaction {
  id: string;
  userId: string;
  type: 'sideEye' | 'tea' | 'shade' | 'petty';
  timestamp: Date;
}

export interface Receipt {
  id: string;
  userId: string;
  title: string;
  imageUrl: string;
  timestamp: Date;
  category: string;
  credibilityScore: number;
}

export interface DramaHotspot {
  id: string;
  location: {
    lat: number;
    lng: number;
  };
  title: string;
  intensity: number; // 0-100 scale
  activeUsers: number;
  topTags: string[];
}

// Define UserPreferences interface
export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

// UserProfile interface
export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  profilePic: string;
  bio: string;
  location: string;
  website: string;
  followers: string[];
  following: string[];
  connections: string[];
  isVerified: boolean;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  settings: {
    theme: 'light' | 'dark';
    notifications: boolean;
    privacy: 'public' | 'private';
  };
  blockedUsers?: string[];
  updatedAt?: Date;
  isPrivate?: boolean;
  isActive?: boolean;
  lastSeen?: Date;
  status?: string;
  preferences: UserPreferences;
  sourceCodeHash?: string;
  sourceCodeSetupComplete?: boolean;
  dateOfBirth?: Timestamp;
}

export interface TrendingTopic {
  tag: string;
  count: number;
  lastUpdated: any;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: any;
  read: boolean;
  senderName?: string;
  senderAvatar?: string;
} 