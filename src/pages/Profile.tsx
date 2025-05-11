import React, { useState, useEffect, useCallback } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  TextField, 
  Button, 
  Avatar,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Alert,
  Menu,
  MenuItem,
  CardActions,
  CardMedia,
} from '@mui/material';
import { 
  Edit as EditIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  PhotoCamera,
  Message as MessageIcon,
  Lock as LockIcon,
  Group,
  Lock
} from '@mui/icons-material';
import { auth, storage } from '../services/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove, addDoc, onSnapshot, orderBy, serverTimestamp, setDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User, UserProfile, SideRoom, UserSideRoom } from '../types/index';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirestore } from '../context/FirestoreContext';
import { toast } from 'react-hot-toast';

interface ProfileProps {
  userId?: string;
}

// Simple component to display when a profile is deactivated
const DeactivatedProfileMessage: React.FC = () => (
  <Container maxWidth="sm" sx={{ mt: 4, textAlign: 'center' }}>
    <Paper elevation={2} sx={{ p: 3 }}>
      <LockIcon sx={{ fontSize: 40, mb: 2 }} color="action" />
      <Typography variant="h6" gutterBottom>
        Account Deactivated
      </Typography>
      <Typography color="text.secondary">
        This user's account is currently deactivated.
      </Typography>
    </Paper>
  </Container>
);

const Profile: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser, user, userProfile, loading: authLoading, setUserProfile } = useAuth();
  const { db } = useFirestore();
  const { userId: urlParam } = useParams<{ userId: string }>();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<string[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [canViewFullProfile, setCanViewFullProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followRequested, setFollowRequested] = useState(false);
  const [pendingFollowRequests, setPendingFollowRequests] = useState<any[]>([]);
  const [showFollowRequestsDialog, setShowFollowRequestsDialog] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedUsername, setEditedUsername] = useState('');
  const [joinedRooms, setJoinedRooms] = useState<UserSideRoom[]>([]);
  const [createdRooms, setCreatedRooms] = useState<SideRoom[]>([]);
  const [isDeactivated, setIsDeactivated] = useState(false);
  const navigate = useNavigate();

  const userId = targetUserId || currentUser?.uid || '';

  useEffect(() => {
    if (!urlParam) {
      setTargetUserId(currentUser?.uid || null);
    } else {
      setTargetUserId(urlParam);
    }
  }, [urlParam, currentUser?.uid]);

  const fetchUserData = useCallback(async () => {
    if (!db || !targetUserId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIsDeactivated(false);

      const userRef = doc(db, 'users', targetUserId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        setError('Profile not found');
        setIsLoading(false);
        return;
      }

      const userData = userDoc.data() as UserProfile;

      if (userData.isActive === false) {
        setIsDeactivated(true);
        setError(null);
        setIsLoading(false);
        return;
      }

      const isPrivateAccount = userData.isPrivate || false;
      const isOwnProfile = currentUser?.uid === targetUserId;
      
      setIsPrivate(isPrivateAccount);
      setUsername(userData.username || '');
      setName(userData.name || '');
      setBio(userData.bio || '');
      setProfilePic(userData.profilePic || null);

      if (isOwnProfile || !isPrivateAccount) {
        setCanViewFullProfile(true);
        setError(null);
      } else {
        if (currentUser?.uid) {
          const followerRef = doc(db, `users/${targetUserId}/followers/${currentUser.uid}`);
          const followerDoc = await getDoc(followerRef);
          const isFollower = followerDoc.exists();
          
          setCanViewFullProfile(isFollower);
          if (!isFollower) {
            setError('This profile is private');
          }
        } else {
          setCanViewFullProfile(false);
          setError('This profile is private');
        }
      }

      // Fetch followers and following
      const [followersSnapshot, followingSnapshot] = await Promise.all([
        getDocs(collection(db, `users/${targetUserId}/followers`)),
        getDocs(collection(db, `users/${targetUserId}/following`))
      ]);

      setFollowers(followersSnapshot.docs.map(doc => doc.id));
      setConnections(followingSnapshot.docs.map(doc => doc.id));

      // Fetch side rooms
      const [joinedRoomsSnapshot, createdRoomsSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, 'sideRooms'),
          where('members', 'array-contains', targetUserId)
        )),
        getDocs(query(
          collection(db, 'sideRooms'),
          where('ownerId', '==', targetUserId),
          where("deleted", "==", false)
        ))
      ]);

      setJoinedRooms(joinedRoomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserSideRoom)));

      setCreatedRooms(createdRoomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SideRoom)));

    } catch (error) {
      console.error('Error in fetchUserData:', error);
      setError('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, [db, targetUserId, currentUser]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    if (!db || !userId) return;

    const followersRef = collection(db, 'users', userId, 'followers');
    const unsubscribe = onSnapshot(followersRef, (snapshot) => {
      const newFollowers = snapshot.docs.map(doc => doc.id);
      setFollowers(newFollowers);
    });

    // Debug: Fetch user data to verify the profile picture field
    const fetchUserDataForDebug = async () => {
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          console.log('DEBUG - User data structure:', userData);
          console.log('DEBUG - Profile pic field:', userData.profilePic);
          // Also check if there's an alternate field name that might be used
          console.log('DEBUG - Alternate fields:', {
            photoURL: userData.photoURL,
            avatarUrl: userData.avatarUrl,
            avatar: userData.avatar,
            photo: userData.photo,
            image: userData.image,
            profileImage: userData.profileImage
          });
        }
      } catch (error) {
        console.error('Error in debug fetch:', error);
      }
    };
    
    fetchUserDataForDebug();

    return () => unsubscribe();
  }, [db, userId]);

  useEffect(() => {
    if (!db || !userId) return;

    const followingRef = collection(db, 'users', userId, 'following');
    const unsubscribe = onSnapshot(followingRef, (snapshot) => {
      const newFollowing = snapshot.docs.map(doc => doc.id);
      setConnections(newFollowing);
    });

    return () => unsubscribe();
  }, [db, userId]);

  useEffect(() => {
    if (!db || !currentUser || !userId) return;

    const followingRef = doc(db, 'users', currentUser.uid, 'following', userId);
    const unsubscribe = onSnapshot(followingRef, (doc) => {
      setIsFollowing(doc.exists());
    });

    return () => unsubscribe();
  }, [db, currentUser, userId]);

  const handleFollow = async () => {
    if (!currentUser || !userId || !db) {
      setError('Database not initialized');
      return;
    }

    try {
      setIsLoading(true);
      
      if (isPrivate) {
        // Send follow request
        const requestRef = doc(db, 'users', userId, 'followRequests', currentUser.uid);
        await setDoc(requestRef, {
          timestamp: serverTimestamp()
        });
        setFollowRequested(true);
        toast.success('Follow request sent');
      } else {
        // Direct follow
        const followingRef = doc(db, 'users', currentUser.uid, 'following', userId);
        const followersRef = doc(db, 'users', userId, 'followers', currentUser.uid);
        
        await setDoc(followingRef, { timestamp: serverTimestamp() });
        await setDoc(followersRef, { timestamp: serverTimestamp() });
        
        setIsFollowing(true);
        toast.success('Followed successfully');
      }
    } catch (error) {
      console.error('Error handling follow:', error);
      setError('Failed to process follow request');
      toast.error('Failed to process follow request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!currentUser || !userId || !db) {
      setError('Database not initialized');
      return;
    }

    try {
      setIsLoading(true);
      
      const followingDocRef = doc(db, 'users', currentUser.uid, 'following', userId);
      await deleteDoc(followingDocRef);

      const followersRef = doc(db, 'users', userId, 'followers', currentUser.uid);
      await deleteDoc(followersRef);

      setIsFollowing(false);
      setFollowers(prev => prev.filter(id => id !== currentUser.uid));
      setConnections(prev => prev.filter(id => id !== userId));
      
      toast.success('Unfollowed successfully');
    } catch (error) {
      console.error('Error unfollowing user:', error);
      setError('Failed to unfollow user');
      toast.error('Failed to unfollow user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser || !db) return;

    try {
      setIsLoading(true);
      const userRef = doc(db, 'users', currentUser.uid);
      
      await updateDoc(userRef, {
        name: editedName,
        username: editedUsername,
        bio: editedBio,
        updatedAt: serverTimestamp()
      });

      setName(editedName);
      setUsername(editedUsername);
      setBio(editedBio);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfilePicChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser || !event.target.files?.[0]) return;

    try {
      setIsLoading(true);
      const file = event.target.files[0];
      const storageRef = ref(storage, `profilePics/${currentUser.uid}/${file.name}`);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Ensure db is not null before using it. The check at the function start should guarantee this,
      // but TypeScript might not infer it across async operations. Using non-null assertion operator '!'.
      const userRef = doc(db!, 'users', currentUser.uid);
      await updateDoc(userRef, {
        profilePic: downloadURL,
        updatedAt: serverTimestamp()
      });

      setProfilePic(downloadURL);
      toast.success('Profile picture updated successfully');
    } catch (error) {
      console.error('Error updating profile picture:', error);
      setError('Failed to update profile picture');
      toast.error('Failed to update profile picture');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (isDeactivated) {
    return <DeactivatedProfileMessage />;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Profile Header */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, backgroundColor: 'background.paper' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'center' }}>
            <Box sx={{ position: 'relative' }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  currentUser?.uid === targetUserId && (
                    <IconButton
                      component="label"
                      size="small"
                      sx={{
                        bgcolor: 'background.paper',
                        '&:hover': { bgcolor: 'background.default' }
                      }}
                    >
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleProfilePicChange}
                        onClick={(event) => { (event.target as HTMLInputElement).value = ''; }}
                      />
                      <PhotoCamera fontSize="small" />
                    </IconButton>
                  )
                }
              >
                <Avatar
                  src={profilePic || undefined}
                  alt={username}
                  sx={{ width: 120, height: 120 }}
                />
              </Badge>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {name || 'No name set'}
                </Typography>
                {isPrivate && (
                  <LockIcon color="action" />
                )}
                {currentUser?.uid === userId && (
                  <IconButton onClick={() => setIsEditing(true)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                @{username || 'No username set'}
              </Typography>
              {isPrivate && !canViewFullProfile && currentUser?.uid !== userId ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    This account is private. Follow to see their side rooms.
                  </Alert>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {!isFollowing ? (
                      <Button
                        variant="contained"
                        onClick={handleFollow}
                        disabled={isLoading}
                        startIcon={<PersonAddIcon />}
                      >
                        {followRequested ? 'Request Sent' : 'Follow'}
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        onClick={handleUnfollow}
                        disabled={isLoading}
                        startIcon={<PersonRemoveIcon />}
                      >
                        Unfollow
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<MessageIcon />}
                      onClick={() => navigate(`/chat/${userId}`)}
                    >
                      Message
                    </Button>
                  </Box>
                </Box>
              ) : (
                <>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    {bio || 'No bio set'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {currentUser?.uid !== userId && (
                      <>
                        {!isFollowing ? (
                          <Button
                            variant="contained"
                            onClick={handleFollow}
                            disabled={isLoading}
                            startIcon={<PersonAddIcon />}
                          >
                            {followRequested ? 'Request Sent' : 'Follow'}
                          </Button>
                        ) : (
                          <Button
                            variant="outlined"
                            onClick={handleUnfollow}
                            disabled={isLoading}
                            startIcon={<PersonRemoveIcon />}
                          >
                            Unfollow
                          </Button>
                        )}
                        <Button
                          variant="outlined"
                          startIcon={<MessageIcon />}
                          onClick={() => navigate(`/chat/${userId}`)}
                        >
                          Message
                        </Button>
                      </>
                    )}
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </Paper>

        {/* Stats */}
        {(!isPrivate || canViewFullProfile || currentUser?.uid === userId) && (
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, backgroundColor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', gap: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6">{createdRooms.length}</Typography>
                <Typography variant="body2" color="text.secondary">Rooms</Typography>
              </Box>
              <Box 
                sx={{ 
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
                component={Link}
                to={`/profile/${userId}/followers`}
              >
                <Typography variant="h6">{followers.length}</Typography>
                <Typography variant="body2" color="text.secondary">Followers</Typography>
              </Box>
              <Box 
                sx={{ 
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
                component={Link}
                to={`/profile/${userId}/following`}
              >
                <Typography variant="h6">{connections.length}</Typography>
                <Typography variant="body2" color="text.secondary">Following</Typography>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Side Rooms */}
        {(!isPrivate || canViewFullProfile || currentUser?.uid === userId) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {createdRooms.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Created Rooms
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  {createdRooms.map((room) => (
                    <Card 
                      key={room.id}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        '&:hover': {
                          boxShadow: 6,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                    >
                      {room.thumbnailUrl && (
                        <CardMedia
                          component="img"
                          height="140"
                          image={room.thumbnailUrl}
                          alt={room.name}
                          sx={{ objectFit: 'cover' }}
                        />
                      )}
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="h6" component="div">
                            {room.name}
                          </Typography>
                          <Chip size="small" label="Owner" color="primary" />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {room.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            label={`${room.memberCount || 0} members`}
                            icon={<Group />}
                          />
                          {room.category && (
                            <Chip
                              size="small"
                              label={room.category}
                              variant="outlined"
                            />
                          )}
                          {room.isPrivate && (
                            <Chip
                              size="small"
                              icon={<Lock />}
                              label="Private"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button
                          size="small"
                          component={Link}
                          to={`/side-room/${room.id}`}
                          variant="contained"
                          fullWidth
                        >
                          Enter Room
                        </Button>
                      </CardActions>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}

            {joinedRooms.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Joined Rooms
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  {joinedRooms.map((room) => (
                    <Card 
                      key={room.id}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        '&:hover': {
                          boxShadow: 6,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                    >
                      {room.thumbnailUrl && (
                        <CardMedia
                          component="img"
                          height="140"
                          image={room.thumbnailUrl}
                          alt={room.name}
                          sx={{ objectFit: 'cover' }}
                        />
                      )}
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="h6" component="div">
                            {room.name}
                          </Typography>
                          <Chip size="small" label="Member" />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {room.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            label={`${room.memberCount || 0} members`}
                            icon={<Group />}
                          />
                          {room.category && (
                            <Chip
                              size="small"
                              label={room.category}
                              variant="outlined"
                            />
                          )}
                          {room.isPrivate && (
                            <Chip
                              size="small"
                              icon={<Lock />}
                              label="Private"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button
                          size="small"
                          component={Link}
                          to={`/side-room/${room.id}`}
                          variant="contained"
                          fullWidth
                        >
                          Enter Room
                        </Button>
                      </CardActions>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}

            {createdRooms.length === 0 && joinedRooms.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  {currentUser?.uid === targetUserId 
                    ? "You have not created any side rooms yet."
                    : `${name || username || 'This person'} does not have an active room.`}
                </Typography>
                {currentUser?.uid === targetUserId && (
                  <Button
                    variant="contained"
                    color="primary"
                    component={Link}
                    to="/side-rooms"
                    sx={{ mt: 2 }}
                  >
                    Create Side Rooms
                  </Button>
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditing} onClose={() => setIsEditing(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Name"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Username"
              value={editedUsername}
              onChange={(e) => setEditedUsername(e.target.value)}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Bio"
              value={editedBio}
              onChange={(e) => setEditedBio(e.target.value)}
              multiline
              rows={4}
              fullWidth
              variant="outlined"
              helperText="Tell others about yourself (You can use emojis!)"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setIsEditing(false)}
            sx={{ 
              minWidth: '120px',
              borderColor: 'text.secondary',
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'text.primary',
                color: 'text.primary'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveProfile}
            disabled={isLoading}
            sx={{ 
              minWidth: '120px',
              bgcolor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Profile; 