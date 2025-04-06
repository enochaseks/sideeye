export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isVerified: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  username: string;
  avatar: string;
  profilePic: string;
  bio: string;
  isVerified: boolean;
  followers: number;
  following: number;
  posts: number;
  createdAt: Date;
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

export interface TeaRoom {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: string[];
  memberCount: number;
  createdAt: Date;
  isPrivate: boolean;
  password?: string;
  tags?: string[];
  imageUrl?: string;
  temperature: number;
  category: string;
  scheduledReveals: TeaReveal[];
  activeUsers: number;
}

export interface TeaReveal {
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