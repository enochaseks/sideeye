import React, { useState, useEffect, ChangeEvent } from 'react';
import { Container, Typography, Box, Grid, TextField, Select, MenuItem, FormControl, InputLabel, Button, CircularProgress, IconButton, LinearProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // To get the seller ID
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import toast from 'react-hot-toast'; // For feedback
import CloseIcon from '@mui/icons-material/Close'; // For removing previews
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'; // For upload button
import { v4 as uuidv4 } from 'uuid'; // For unique file names

// Reuse categories from Marketplace (excluding 'All')
const categories = ['Groceries', 'Hair & Beauty', 'Games', 'Technology', 'Home', 'Clothing', 'Other'];
// Add conditions
const conditions = ['New', 'Used - Like New', 'Used - Good', 'Used - Fair'];
const MAX_FILES = 5; // Limit number of files
const MAX_FILE_SIZE_MB = 10; // Limit file size (e.g., 10MB)

const AddProduct: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const db = getFirestore();
  const storage = getStorage();

  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Generate/Revoke Preview URLs
  useEffect(() => {
    const newPreviewUrls: string[] = [];
    selectedFiles.forEach(file => newPreviewUrls.push(URL.createObjectURL(file)));
    setPreviewUrls(newPreviewUrls);

    // Cleanup function
    return () => {
      newPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      const validFiles: File[] = [];
      let fileError = false;

      files.forEach(file => {
          if (selectedFiles.length + validFiles.length >= MAX_FILES) {
              toast.error(`You can upload a maximum of ${MAX_FILES} files.`);
              fileError = true;
              return; // Stop processing more files if limit reached
          }
          if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
              toast.error(`File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`);
              fileError = true;
              return; // Skip this file
          }
          validFiles.push(file);
      });
      
      // Only update state if no errors occurred with the new files and limit not exceeded immediately
       if (!fileError && (selectedFiles.length + validFiles.length <= MAX_FILES)) {
            setSelectedFiles(prevFiles => [...prevFiles, ...validFiles]);
       }
      // Clear the input value so the same file can be selected again if removed
      event.target.value = "";
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    // Revoke the specific object URL before removing the file state
    URL.revokeObjectURL(previewUrls[indexToRemove]);
    setSelectedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    // Previews will update via useEffect
  };

  // --- Upload Files Function --- 
  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    setUploadProgress(0); // Start progress indication

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uniqueFileName = `${uuidv4()}-${file.name}`;
      const storageRef = ref(storage, `products/${currentUser?.uid || 'unknown_user'}/${uniqueFileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Wait for each upload to complete - consider Promise.all for parallel uploads later
      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            // Update progress for the current file (or overall average)
             const progress = (snapshot.bytesTransferred / snapshot.totalBytes);
             // Calculate overall progress average
             const overallProgress = ((i + progress) / files.length) * 100;
             setUploadProgress(overallProgress);
          },
          (error) => {
            console.error("Upload Error:", error);
            toast.error(`Failed to upload ${file.name}. Error: ${error.code}`);
            reject(error); // Stop if one file fails
          },
          async () => {
            // Upload completed successfully, now get the download URL
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              urls.push(downloadURL);
              console.log('File available at', downloadURL);
              resolve();
            } catch (urlError) {
              console.error("Get Download URL Error:", urlError);
              toast.error(`Failed to get URL for ${file.name}.`);
              reject(urlError);
            }
          }
        );
      });
    }
    setUploadProgress(null); // Clear progress
    return urls;
  };
  // --- End Upload Files Function --- 

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!currentUser) {
        toast.error('You must be logged in to list a product.');
        return;
    }
    if (!productName || !description || !price || !category || !condition) {
        toast.error('Please fill in all required fields.');
        return;
    }
    if (selectedFiles.length === 0) {
        toast.error('Please upload at least one image or video.');
        return;
    }
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
        toast.error('Please enter a valid positive price.');
        return;
    }
    
    setLoading(true);
    setUploadProgress(0); // Show progress bar immediately

    let mediaUrls: string[] = [];
    try {
      // 1. Upload files
      mediaUrls = await uploadFiles(selectedFiles);
      
      // 2. Prepare product data with media URLs
      const productData = {
        name: productName,
        description: description,
        price: priceValue,
        category: category,
        condition: condition,
        sellerId: currentUser.uid,
        sellerName: currentUser.displayName || 'Anonymous',
        createdAt: serverTimestamp(), // Use serverTimestamp here
        mediaUrls: mediaUrls, // Add the array of URLs
        status: 'available',
      };

      // 3. Save product data to Firestore
      console.log("Submitting product data to Firestore:", productData);
      const docRef = await addDoc(collection(db, "products"), productData);
      console.log("Document written with ID: ", docRef.id);
      toast.success('Product listed successfully!');
      navigate('/marketplace'); // Redirect after successful submission

    } catch (error) {
      console.error("Submission Error (Upload or Firestore): ", error);
      toast.error('Failed to list product. Please try again.');
      // Attempt to delete already uploaded files if Firestore fails?
      // This adds complexity - maybe skip for now.
      /*
      if (mediaUrls.length > 0) {
          console.warn("Attempting to delete uploaded files due to Firestore error...");
          mediaUrls.forEach(async (url) => {
              try {
                  const fileRef = ref(storage, url); // Get ref from URL
                  await deleteObject(fileRef);
                  console.log(`Deleted orphaned file: ${url}`);
              } catch (deleteError) {
                  console.error(`Failed to delete orphaned file ${url}:`, deleteError);
              }
          });
      }
      */
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          List a New Product
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                id="productName"
                label="Product Name"
                name="productName"
                autoComplete="product-name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                id="description"
                label="Description"
                name="description"
                multiline
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                id="price"
                label="Price ($" type="number"
                name="price"
                autoComplete="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                InputProps={{ inputProps: { min: 0.01, step: 0.01 } }}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl required fullWidth disabled={loading}>
                <InputLabel id="category-label">Category</InputLabel>
                <Select
                  labelId="category-label"
                  id="category"
                  value={category}
                  label="Category"
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
             <Grid item xs={12} sm={6}>
              <FormControl required fullWidth disabled={loading}>
                <InputLabel id="condition-label">Condition</InputLabel>
                <Select
                  labelId="condition-label"
                  id="condition"
                  value={condition}
                  label="Condition"
                  onChange={(e) => setCondition(e.target.value)}
                >
                  {conditions.map((cond) => (
                    <MenuItem key={cond} value={cond}>
                      {cond}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* --- File Upload Section --- */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Upload Images/Videos ({selectedFiles.length}/{MAX_FILES})</Typography>
              <Button
                variant="outlined"
                component="label" // Makes the button act as a label for the hidden input
                startIcon={<AddPhotoAlternateIcon />}
                disabled={loading || selectedFiles.length >= MAX_FILES}
              >
                Select Files
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/*,video/*" // Accept images and videos
                  onChange={handleFileChange}
                />
              </Button>
               <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                 Max {MAX_FILES} files. Max {MAX_FILE_SIZE_MB}MB per file.
               </Typography>
            </Grid>

            {/* --- File Preview Section --- */}
            {previewUrls.length > 0 && (
              <Grid item xs={12}>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'nowrap', // Keep previews in one line
                  gap: 2,
                  overflowX: 'auto', // Allow horizontal scrolling
                  p: 1, // Add some padding
                  border: '1px dashed', // Visual cue for the area
                  borderColor: 'divider', 
                  borderRadius: 1,
                  minHeight: 100, // Ensure area has some height
                }}>
                  {previewUrls.map((url, index) => {
                    const file = selectedFiles[index]; // Get corresponding file for type check
                    const isVideo = file?.type.startsWith('video/');
                    return (
                      <Box key={index} sx={{ position: 'relative', flexShrink: 0 }}> {/* Prevent shrinking */}
                        {isVideo ? (
                          <video
                            src={url}
                            height="100" // Fixed height for consistency
                            style={{ display: 'block', borderRadius: '4px' }}
                            // controls // Optional: add basic video controls
                          />
                        ) : (
                          <img
                            src={url}
                            alt={`Preview ${index}`}
                            height="100" // Fixed height for consistency
                            style={{ display: 'block', borderRadius: '4px' }}
                          />
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveFile(index)}
                          sx={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            backgroundColor: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': { backgroundColor: 'white' },
                            p: 0.2, // Smaller padding
                          }}
                          disabled={loading}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              </Grid>
            )}
            {/* --- End File Preview Section --- */}

            {/* --- Upload Progress Bar --- */} 
            {uploadProgress !== null && (
                <Grid item xs={12}>
                     <Box sx={{ width: '100%', mb: 2 }}>
                        <Typography variant="caption">Uploading {selectedFiles.length} file(s)...</Typography>
                        <LinearProgress variant="determinate" value={uploadProgress} />
                    </Box>
                </Grid>
            )}
            {/* --- End Upload Progress Bar --- */} 

          </Grid>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading || selectedFiles.length === 0} // Disable if no files or loading
          >
            {loading ? <CircularProgress size={24} /> : 'List Product'}
          </Button>
          <Button
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
            onClick={() => navigate('/marketplace')} // Go back button
            disabled={loading}
          >
            Cancel
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default AddProduct; 