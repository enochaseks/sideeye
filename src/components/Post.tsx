import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  IconButton,
  Avatar,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Button,
  Paper,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  ChatBubbleOutline,
  Share,
  Delete,
  Repeat,
  ExpandMore,
  ExpandLess,
  Edit,
  Reply,
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { PostData, Comment, Author, PostProps } from '../types/index';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  increment, 
  Timestamp, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  addDoc, 
  collection, 
  Firestore,
  getDocs,
  arrayUnion,
  arrayRemove,
  DocumentReference
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../services/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { formatDate, convertTimestampToDate, compareTimestamps } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';

interface PostComponentProps extends Omit<PostData, 'id'> {
  id: string;
  onLike: (postId: string) => Promise<void>;
  onComment: (postId: string, comment: string) => Promise<void>;
  onShare: (postId: string) => Promise<void>;
  onDelete?: (postId: string) => Promise<void>;
  onEdit?: (postId: string, content: string) => Promise<void>;
  isOwnPost?: boolean;
  isRepost?: boolean;
}

const Post: React.FC<PostComponentProps> = ({
  id,
  authorId,
  authorName,
  authorAvatar,
  content,
  timestamp,
  likes,
  likedBy,
  comments: initialComments,
  imageUrl,
  tags,
  isPrivate,
  userId,
  reposts,
  views,
  isPinned,
  isEdited,
  lastEdited,
  isArchived,
  onLike,
  onComment,
  onShare,
  onDelete,
  onEdit,
  isOwnPost,
  isRepost = false
}) => {
  const [isLiking, setIsLiking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isLikingComment, setIsLikingComment] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentText, setEditedCommentText] = useState('');
  const [postComments, setPostComments] = useState<Comment[]>(initialComments);
  const [replyingToComment, setReplyingToComment] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${authorId}`);
  };

  const handleDelete = async () => {
    if (!currentUser || !isOwnPost) {
      setError('You can only delete your own posts');
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      if (onDelete) {
        await onDelete(id);
      }
    } catch (err) {
      setError('Failed to delete post');
      console.error('Error deleting post:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = async () => {
    if (!currentUser || !isOwnPost) {
      setError('You can only edit your own posts');
      return;
    }

    if (!editedContent.trim()) {
      setError('Post content cannot be empty');
      return;
    }

    try {
      setIsEditing(true);
      setError(null);
      if (onEdit) {
        await onEdit(id, editedContent);
        setIsEditing(false);
      }
    } catch (err) {
      setError('Failed to edit post');
      console.error('Error editing post:', err);
    } finally {
      setIsEditing(false);
    }
  };

  const handleLike = async () => {
    if (!currentUser) {
      setError('Please sign in to like posts');
      return;
    }

    try {
      setIsLiking(true);
      setError(null);
      await onLike(id);
    } catch (err) {
      setError('Failed to like post');
      console.error('Error liking post:', err);
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = async () => {
    if (!currentUser) {
      setError('Please sign in to comment');
      return;
    }

    if (!commentText.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    try {
      setIsCommenting(true);
      setError(null);
      await onComment(id, commentText);
      setCommentText('');
    } catch (err) {
      setError('Failed to add comment');
      console.error('Error adding comment:', err);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleShare = async () => {
    if (!currentUser || isCommenting) return;

    try {
      if (onShare) {
        await onShare(id);
      }
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const handleCommentLike = async (comment: Comment) => {
    if (!currentUser || isLikingComment) return;
    setIsLikingComment(true);

    try {
      const postRef = doc(db, 'posts', id);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) return;

      const postData = postDoc.data();
      const commentIndex = postData.comments.findIndex((c: Comment) => 
        compareTimestamps(c.timestamp, comment.timestamp) && c.authorId === comment.authorId
      );

      if (commentIndex === -1) return;

      const isLiked = comment.likedBy?.includes(currentUser.uid) || false;
      const updatedComments = [...postData.comments];
      
      if (isLiked) {
        updatedComments[commentIndex] = {
          ...updatedComments[commentIndex],
          likes: (updatedComments[commentIndex].likes || 0) - 1,
          likedBy: updatedComments[commentIndex].likedBy?.filter((id: string) => id !== currentUser.uid) || []
        };
      } else {
        updatedComments[commentIndex] = {
          ...updatedComments[commentIndex],
          likes: (updatedComments[commentIndex].likes || 0) + 1,
          likedBy: [...(updatedComments[commentIndex].likedBy || []), currentUser.uid]
        };
      }

      await updateDoc(postRef, { comments: updatedComments });
      setPostComments(updatedComments);
    } catch (error) {
      console.error('Error updating comment like:', error);
    } finally {
      setIsLikingComment(false);
    }
  };

  const handleCommentDelete = async (comment: Comment) => {
    if (!currentUser || isDeletingComment) return;
    setIsDeletingComment(true);

    try {
      const postRef = doc(db, 'posts', id);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) return;

      const postData = postDoc.data();
      const updatedComments = postData.comments.filter((c: Comment) => 
        !(compareTimestamps(c.timestamp, comment.timestamp) && c.authorId === comment.authorId)
      );

      await updateDoc(postRef, { comments: updatedComments });
      setPostComments(updatedComments);
    } catch (error) {
      console.error('Error deleting comment:', error);
    } finally {
      setIsDeletingComment(false);
    }
  };

  const handleCommentEdit = async (comment: Comment) => {
    if (!currentUser || isEditingComment || !editedCommentText.trim()) return;
    setIsEditingComment(true);

    try {
      const postRef = doc(db, 'posts', id);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) return;

      const postData = postDoc.data();
      const commentIndex = postData.comments.findIndex((c: Comment) => 
        compareTimestamps(c.timestamp, comment.timestamp) && c.authorId === comment.authorId
      );

      if (commentIndex === -1) return;

      const updatedComments = [...postData.comments];
      updatedComments[commentIndex] = {
        ...updatedComments[commentIndex],
        content: editedCommentText.trim(),
        isEdited: true,
        lastEdited: new Date()
      };

      await updateDoc(postRef, { comments: updatedComments });
      setPostComments(updatedComments);
      setEditingCommentId(null);
      setEditedCommentText('');
    } catch (error) {
      console.error('Error editing comment:', error);
    } finally {
      setIsEditingComment(false);
    }
  };

  // Skeleton loader for post
  if (!authorId || !content) {
    return (
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ ml: 2, flex: 1 }}>
            <Skeleton variant="text" width={120} />
            <Skeleton variant="text" width={80} />
          </Box>
        </Box>
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, borderRadius: 1, maxWidth: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}
      
      <Card sx={{ mb: 2, borderRadius: 1 }}>
        <CardContent sx={{ p: 1.5 }}>
          {isRepost && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Repeat sx={{ fontSize: 14, mr: 0.5 }} />
              Reposted
            </Typography>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
            <Link to={`/profile/${authorId}`} style={{ textDecoration: 'none' }}>
              <Avatar 
                src={authorAvatar} 
                alt={authorName}
                sx={{ width: 40, height: 40 }}
              />
            </Link>
            <Box sx={{ flex: 1, ml: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Link to={`/profile/${authorId}`} style={{ textDecoration: 'none' }}>
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      fontWeight: 'bold',
                      color: 'text.primary',
                      '&:hover': { textDecoration: 'underline' }
                    }}
                  >
                    {authorName}
                  </Typography>
                </Link>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {formatDistanceToNow(timestamp?.toDate?.() || new Date(), { addSuffix: true })}
                </Typography>
              </Box>
              {isEditing ? (
                <TextField
                  fullWidth
                  multiline
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  sx={{ mb: 1 }}
                />
              ) : (
                <Typography variant="body1">{content}</Typography>
              )}
            </Box>
            {isOwnPost && (
              <IconButton 
                onClick={handleDelete} 
                disabled={isDeleting}
                aria-label="Delete post"
                size="small"
              >
                {isDeleting ? (
                  <CircularProgress size={20} />
                ) : (
                  <Delete fontSize="small" />
                )}
              </IconButton>
            )}
          </Box>

          {tags && tags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              {tags.map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          )}

          {imageUrl && (
            <Box sx={{ mb: 2 }}>
              <img
                src={imageUrl}
                alt="Post content"
                style={{ maxWidth: '100%', borderRadius: 8 }}
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <IconButton
                onClick={handleLike}
                disabled={isLiking}
                size="small"
              >
                {isLiking ? (
                  <CircularProgress size={20} />
                ) : likedBy?.includes(currentUser?.uid || '') ? (
                  <Favorite color="error" />
                ) : (
                  <FavoriteBorder />
                )}
              </IconButton>
              <Typography variant="body2" color="text.secondary">
                {likes || 0}
              </Typography>

              <IconButton
                onClick={() => setShowComments(!showComments)}
                size="small"
              >
                <ChatBubbleOutline />
              </IconButton>
              <Typography variant="body2" color="text.secondary">
                {postComments.length}
              </Typography>

              <IconButton
                onClick={handleShare}
                size="small"
              >
                <Share />
              </IconButton>
              <Typography variant="body2" color="text.secondary">
                {reposts || 0}
              </Typography>
            </Box>
          </Box>

          {showComments && (
            <Box sx={{ mt: 2 }}>
              <List>
                {postComments.map((comment) => (
                  <ListItem key={comment.id} alignItems="flex-start">
                    <ListItemAvatar>
                      <Link to={`/profile/${comment.authorId}`} style={{ textDecoration: 'none' }}>
                        <Avatar src={comment.authorAvatar} />
                      </Link>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Link to={`/profile/${comment.authorId}`} style={{ textDecoration: 'none' }}>
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 'bold',
                                color: 'text.primary',
                                '&:hover': { textDecoration: 'underline' }
                              }}
                            >
                              {comment.authorName}
                            </Typography>
                          </Link>
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {formatDistanceToNow(comment.timestamp?.toDate?.() || new Date(), { addSuffix: true })}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2">
                          {comment.content}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>

              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Button
                  variant="contained"
                  onClick={handleComment}
                  disabled={isCommenting}
                >
                  {isCommenting ? <CircularProgress size={24} /> : 'Comment'}
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Paper>
  );
};

export default Post;