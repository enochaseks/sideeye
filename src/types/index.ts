export interface User {
  uid: string;
  username: string;
  email: string;
  shadePoints: number;
  pettyLevel: number;
  badges: Badge[];
  truthScore: number;
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

export interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: 'shade' | 'petty' | 'truth' | 'tea';
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
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
  timestamp: any;
  likes: number;
  likedBy: string[];
  isEdited: boolean;
  lastEdited?: any;
  replies?: Comment[];
}

export interface Author {
  id: string;
  name: string;
  avatar: string;
}

export interface PostData {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  imageUrl?: string;
  timestamp: any;
  likes: number;
  likedBy: string[];
  comments: Comment[];
  originalPostId?: string;
  originalAuthor?: Author;
  tags?: string[];
  location?: string;
  isPrivate?: boolean;
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

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  name: string;
  avatar: string;
  profilePic: string;
  bio?: string;
  isVerified: boolean;
  followers: string[];
  following: number;
  posts: number;
  shadePoints?: number;
  pettyLevel?: number;
  badges?: Badge[];
  truthScore?: number;
  createdAt?: any;
  connections?: string[];
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