import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  IconButton,
  Avatar,
  Chip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  ChatBubbleOutline,
  Share,
  MoreVert,
  Delete,
} from '@mui/icons-material';
import { auth, db } from '../services/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

interface PostProps {
  id: string;
  author: {
    name: string;
    avatar: string;
    username: string;
    isVerified: boolean;
  };
  content: string;
  timestamp: Date;
  likes: number;
  comments: number;
  isLiked: boolean;
  imageUrl?: string;
  tags?: string[];
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onShare: (id: string) => void;
  onDelete?: (id: string) => void;
  isOwnPost?: boolean;
}

const Post: React.FC<PostProps> = ({
  id,
  author,
  content,
  timestamp,
  likes,
  comments,
  isLiked,
  imageUrl,
  tags,
  onLike,
  onComment,
  onShare,
  onDelete,
  isOwnPost,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(id);
    }
    handleMenuClose();
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(date);
  };

  return (
    <Card sx={{ mb: 3, borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar src={author.avatar} alt={author.name} sx={{ mr: 2 }}>
              {author.name.charAt(0)}
            </Avatar>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {author.name}
                </Typography>
                {author.isVerified && (
                  <Box sx={{ ml: 0.5, display: 'flex', alignItems: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DA1F2">
                      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                    </svg>
                  </Box>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                @{author.username} · {formatDate(timestamp)}
              </Typography>
            </Box>
          </Box>
          {isOwnPost && (
            <>
              <IconButton onClick={handleMenuClick}>
                <MoreVert />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleDelete}>
                  <Delete sx={{ mr: 1 }} /> Delete
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>

        <Typography variant="body1" sx={{ mb: 2 }}>
          {content}
        </Typography>

        {tags && tags.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={`#${tag}`}
                size="small"
                sx={{ borderRadius: 1 }}
              />
            ))}
          </Box>
        )}

        {imageUrl && (
          <CardMedia
            component="img"
            image={imageUrl}
            alt="Post image"
            sx={{ borderRadius: 1, mb: 2 }}
          />
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={() => onLike(id)} size="small">
              {isLiked ? (
                <Favorite color="error" />
              ) : (
                <FavoriteBorder />
              )}
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {likes}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={() => onComment(id)} size="small">
              <ChatBubbleOutline />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {comments}
            </Typography>
          </Box>

          <IconButton onClick={() => onShare(id)} size="small">
            <Share />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

export default Post; 