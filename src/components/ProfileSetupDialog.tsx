import React, { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Avatar,
    Typography,
    CircularProgress,
    Alert,
    IconButton,
    Tooltip
} from '@mui/material';
import { PhotoCamera, Close } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { toast } from 'react-hot-toast';

interface ProfileSetupDialogProps {
    open: boolean;
    onClose: () => void;
    canSkip?: boolean;
}

const ProfileSetupDialog: React.FC<ProfileSetupDialogProps> = ({
    open,
    onClose,
    canSkip = true
}) => {
    const { currentUser } = useAuth();
    const [profilePicture, setProfilePicture] = useState<File | null>(null);
    const [profilePicturePreview, setProfilePicturePreview] = useState<string>('');
    const [bio, setBio] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Track when dialog is opened to update prompt timestamp
    useEffect(() => {
        if (open && currentUser?.uid) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            updateDoc(userDocRef, {
                lastProfileSetupPrompt: new Date().toISOString()
            }).catch(err => console.error('Error updating profile setup prompt timestamp:', err));
        }
    }, [open, currentUser?.uid]);

    const handleProfilePictureSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error('Please select a valid image file');
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size must be less than 5MB');
                return;
            }

            setProfilePicture(file);
            
            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setProfilePicturePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveProfilePicture = () => {
        setProfilePicture(null);
        setProfilePicturePreview('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async () => {
        if (!currentUser?.uid) {
            toast.error('User not authenticated');
            return;
        }

        if (!profilePicture) {
            toast.error('Please select a profile picture to continue');
            return;
        }

        setIsUploading(true);

        try {
            // Upload profile picture
            const fileExtension = profilePicture.name.split('.').pop();
            const fileName = `profile_${currentUser.uid}_${Date.now()}.${fileExtension}`;
            const storageRef = ref(storage, `profile-pictures/${fileName}`);
            
            const uploadResult = await uploadBytes(storageRef, profilePicture);
            const profilePictureUrl = await getDownloadURL(uploadResult.ref);

            // Update user profile in Firestore
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, {
                profilePic: profilePictureUrl,
                bio: bio.trim() || '',
                profileCompleted: true,
                updatedAt: new Date().toISOString()
            });

            toast.success('Profile updated successfully!');
            onClose();
            
            // Clear form
            setProfilePicture(null);
            setProfilePicturePreview('');
            setBio('');

        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSkip = () => {
        // Mark that user was prompted but chose to skip
        if (currentUser?.uid) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            updateDoc(userDocRef, {
                profileSetupSkipped: true,
                profileSetupSkippedAt: new Date().toISOString(),
                // Update this timestamp each time they skip to reset the 24-hour timer
                lastProfileSetupPrompt: new Date().toISOString()
            }).catch(err => console.error('Error marking profile setup as skipped:', err));
            
            console.log('[Profile Setup] User skipped profile setup, will be reminded again in 24 hours');
        }
        onClose();
    };

    return (
        <Dialog 
            open={open} 
            onClose={canSkip ? onClose : undefined}
            maxWidth="sm" 
            fullWidth
            disableEscapeKeyDown={!canSkip}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Complete Your Profile</Typography>
                {canSkip && (
                    <IconButton onClick={onClose} size="small">
                        <Close />
                    </IconButton>
                )}
            </DialogTitle>
            
            <DialogContent sx={{ pt: 2 }}>
                <Alert severity="info" sx={{ mb: 3 }}>
                    Welcome to SideEye! Please add a profile picture to help others recognize you in rooms and chat.
                </Alert>

                {/* Profile Picture Section */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                        Profile Picture *
                    </Typography>
                    
                    <Box sx={{ position: 'relative', mb: 2 }}>
                        <Avatar
                            src={profilePicturePreview || currentUser?.photoURL || ''}
                            alt="Profile Preview"
                            sx={{ 
                                width: 120, 
                                height: 120, 
                                border: '3px dashed',
                                borderColor: profilePicture ? 'success.main' : 'grey.400',
                                cursor: 'pointer'
                            }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {!profilePicturePreview && !currentUser?.photoURL && (
                                <PhotoCamera sx={{ fontSize: 40, color: 'grey.500' }} />
                            )}
                        </Avatar>
                        
                        {profilePicturePreview && (
                            <Tooltip title="Remove picture">
                                <IconButton
                                    onClick={handleRemoveProfilePicture}
                                    sx={{
                                        position: 'absolute',
                                        top: -5,
                                        right: -5,
                                        backgroundColor: 'error.main',
                                        color: 'white',
                                        width: 30,
                                        height: 30,
                                        '&:hover': {
                                            backgroundColor: 'error.dark'
                                        }
                                    }}
                                >
                                    <Close fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureSelect}
                        style={{ display: 'none' }}
                    />

                    <Button
                        variant="outlined"
                        startIcon={<PhotoCamera />}
                        onClick={() => fileInputRef.current?.click()}
                        sx={{ mb: 1 }}
                    >
                        {profilePicture ? 'Change Picture' : 'Select Picture'}
                    </Button>
                    
                    <Typography variant="caption" color="text.secondary" align="center">
                        Upload a photo to help others recognize you.<br />
                        Supported formats: JPG, PNG, GIF (max 5MB)
                    </Typography>
                </Box>

                {/* Bio Section */}
                <Box>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                        Bio (Optional)
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="Tell others about yourself..."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        inputProps={{ maxLength: 500 }}
                        helperText={`${bio.length}/500 characters`}
                    />
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3 }}>
                {canSkip && (
                    <Button 
                        onClick={handleSkip}
                        disabled={isUploading}
                        color="inherit"
                    >
                        Skip for Now
                    </Button>
                )}
                
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={isUploading || !profilePicture}
                    startIcon={isUploading ? <CircularProgress size={20} /> : null}
                >
                    {isUploading ? 'Saving...' : 'Complete Profile'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ProfileSetupDialog; 