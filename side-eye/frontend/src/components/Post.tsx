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
import { useNavigate } from 'react-router-dom';
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

  const handleProfileClick = (username: string) => {
    navigate(`/profile/${username}`);
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
    <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          {isRepost && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Repeat sx={{ fontSize: 16, mr: 0.5 }} />
              Reposted
            </Typography>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar 
                src={authorAvatar} 
                alt={authorName} 
                sx={{ mr: 2, cursor: 'pointer' }}
                onClick={() => handleProfileClick(authorId)}
              >
                {authorName ? authorName.charAt(0) : 'A'}
              </Avatar>
              <Box>
                <Typography 
                  variant="subtitle1" 
                  fontWeight="bold"
                  onClick={() => handleProfileClick(authorId)}
                  sx={{ cursor: 'pointer' }}
                >
                  {authorName || 'Anonymous'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(timestamp)}
                </Typography>
              </Box>
            </Box>
            {isOwnPost && (
              <IconButton 
                onClick={handleDelete} 
                disabled={isDeleting}
                aria-label="Delete post"
              >
                {isDeleting ? (
                  <CircularProgress size={24} />
                ) : (
                  <Delete />
                )}
              </IconButton>
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
              <IconButton 
                onClick={handleLike} 
                color={likedBy?.includes(currentUser?.uid || '') ? 'primary' : 'default'}
                disabled={isDeleting || isCommenting}
                aria-label={likedBy?.includes(currentUser?.uid || '') ? 'Unlike post' : 'Like post'}
              >
                {isLiking ? (
                  <CircularProgress size={24} />
                ) : likedBy?.includes(currentUser?.uid || '') ? (
                  <Favorite />
                ) : (
                  <FavoriteBorder />
                )}
              </IconButton>
              <Typography variant="body2" color="text.secondary">
                {likes}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton 
                onClick={() => setShowComments(!showComments)}
                disabled={isDeleting || isCommenting}
                aria-label="Toggle comments"
              >
                <ChatBubbleOutline />
              </IconButton>
              <Typography variant="body2" color="text.secondary">
                {postComments?.length || 0}
              </Typography>
            </Box>

            <IconButton 
              onClick={handleShare}
              disabled={isDeleting || isCommenting}
              aria-label="Share post"
            >
              <Share />
            </IconButton>
          </Box>

          {postComments && postComments.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    color: 'text.secondary',
                    mb: 1
                  }}
                  onClick={() => setShowComments(!showComments)}
                >
                  <Typography variant="caption">
                    {showComments ? 'Hide comments' : `Show ${postComments.length} comments`}
                  </Typography>
                  {showComments ? <ExpandLess /> : <ExpandMore />}
                </Box>
                
                <Collapse in={showComments} timeout="auto" unmountOnExit>
                  <List>
                    {postComments.map((comment, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                        <Avatar 
                          src={comment.authorAvatar} 
                          alt={comment.authorName}
                          sx={{ width: 24, height: 24, mr: 1 }}
                        />
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2">{comment.authorName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(comment.timestamp)}
                            </Typography>
                          </Box>
                          {editingCommentId === `${comment.authorId}_${convertTimestampToDate(comment.timestamp).getTime()}` ? (
                            <Box sx={{ mt: 1 }}>
                              <TextField
                                fullWidth
                                multiline
                                size="small"
                                value={editedCommentText}
                                onChange={(e) => setEditedCommentText(e.target.value)}
                                disabled={isEditingComment}
                              />
                              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleCommentEdit(comment)}
                                  disabled={isEditingComment || !editedCommentText.trim()}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => {
                                    setEditingCommentId(null);
                                    setEditedCommentText('');
                                  }}
                                  disabled={isEditingComment}
                                >
                                  Cancel
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <Typography variant="body2">{comment.content}</Typography>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleCommentLike(comment)}
                              disabled={isLikingComment}
                            >
                              {isLikingComment ? (
                                <CircularProgress size={20} />
                              ) : comment.likedBy?.includes(currentUser?.uid || '') ? (
                                <Favorite fontSize="small" color="error" />
                              ) : (
                                <FavoriteBorder fontSize="small" />
                              )}
                            </IconButton>
                            <Typography variant="caption">
                              {comment.likes || 0}
                            </Typography>
                            {(currentUser?.uid === comment.authorId || isOwnPost) && (
                              <>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingCommentId(`${comment.authorId}_${convertTimestampToDate(comment.timestamp).getTime()}`);
                                    setEditedCommentText(comment.content);
                                  }}
                                  disabled={isEditingComment || isDeletingComment}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleCommentDelete(comment)}
                                  disabled={isDeletingComment || isEditingComment}
                                >
                                  {isDeletingComment ? (
                                    <CircularProgress size={20} />
                                  ) : (
                                    <Delete fontSize="small" />
                                  )}
                                </IconButton>
                              </>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </List>
                </Collapse>
              </Box>
            </>
          )}

          {currentUser && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                multiline
                placeholder="Write a comment..."
                size="small"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={isCommenting}
              />
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={handleComment}
                  disabled={isCommenting || !commentText.trim()}
                >
                  {isCommenting ? 'Posting...' : 'Post'}
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