import React from 'react';
import { PostData } from '../types';

export interface PostComponentProps {
  post: PostData;
  onLike: (postId: string) => Promise<void>;
  onComment: (postId: string, content: string) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
  isOwnPost: boolean;
  commentCount: number;
}

export const PostComponent: React.FC<PostComponentProps> = ({ post, onLike, onComment, onDelete, isOwnPost, commentCount }) => {
  return (
    <div>
      {/* Component implementation */}
    </div>
  );
}; 