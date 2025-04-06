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
import { doc, getDoc, updateDoc, increment, Timestamp, setDoc, deleteDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../services/firebase';
import { formatDate, convertTimestampToDate, compareTimestamps } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';

const Post: React.FC<PostProps> = ({
  id,
  authorId,
  authorName,
  authorAvatar,
  content,
  imageUrl,
  timestamp,
  likes,
  likedBy,
  comments: initialComments,
  isOwnPost,
  onDelete,
  onEdit,
  onLike,
  onComment,
  onShare,
  originalPostId,
  originalAuthor,
  tags
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
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [replyingToComment, setReplyingToComment] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleProfileClick = (username: string) => {
    navigate(`/profile/${username}`);
  };

  const handleDelete = async () => {
    if (!currentUser || isDeleting) return;
    setIsDeleting(true);

    try {
      await onDelete(id);
    } catch (error) {
      console.error('Error deleting post:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = async () => {
    if (!currentUser || isEditing || !editedContent.trim() || !onEdit) return;
    setIsEditing(true);

    try {
      await onEdit(id, editedContent.trim());
    } catch (error) {
      console.error('Error editing post:', error);
    } finally {
      setIsEditing(false);
    }
  };

  const handleLike = async () => {
    if (!currentUser || isLiking) return;
    setIsLiking(true);

    try {
      if (onLike) {
        await onLike(id);
      }
    } catch (error) {
      console.error('Error updating like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = async () => {
    if (!currentUser || !commentText.trim() || isCommenting) return;
    setIsCommenting(true);

    try {
      if (onComment) {
        await onComment(id, commentText.trim());
        setCommentText('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
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
      setComments(updatedComments);
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
      setComments(updatedComments);
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
      setComments(updatedComments);
      setEditingCommentId(null);
      setEditedCommentText('');
    } catch (error) {
      console.error('Error editing comment:', error);
    } finally {
      setIsEditingComment(false);
    }
  };

  return (
    <Card sx={{ mb: 3, borderRadius: 2 }}>
      <CardContent>
        {originalPostId && originalAuthor && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
            <Repeat sx={{ fontSize: 16, mr: 1 }} />
            <Typography variant="caption">
              {originalAuthor.name} reposted
            </Typography>
          </Box>
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
              {comments?.length || 0}
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

        {comments && comments.length > 0 && (
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
                  {showComments ? 'Hide comments' : `Show ${comments.length} comments`}
                </Typography>
                {showComments ? <ExpandLess /> : <ExpandMore />}
              </Box>
              
              <Collapse in={showComments} timeout="auto" unmountOnExit>
                <List>
                  {comments.map((comment, index) => (
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
  );
};

export default Post;