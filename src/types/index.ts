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

export interface TeaRoom {
  id: string;
  name: string;
  category: string;
  temperature: number; // 0-100 scale
  activeUsers: number;
  scheduledReveals: TeaReveal[];
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
  followers: number;
  following: number;
  posts: number;
  shadePoints?: number;
  pettyLevel?: number;
  badges?: Badge[];
  truthScore?: number;
  createdAt?: any;
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