import React, { useState, useRef, useEffect } from 'react';
import { Box, CircularProgress, Typography, Button, Slider, Stack, Select, MenuItem, FormControl, InputLabel, Alert, IconButton, Dialog, TextField, Popover, DialogTitle } from '@mui/material';
import { 
  ContentCut as CutIcon,
  Save, 
  Close, 
  Add as AddIcon, 
  CallSplit as SplitIcon,
  PlayArrow, 
  Pause,
  EmojiEmotions as StickerIcon,
  Gif as GiphyIcon,
  Animation as AnimationIcon,
  Edit as EditIcon,
  TextFields as TextIcon,
  ArrowBack as BackIcon,
  Refresh as UndoIcon,
  Link as LinkIcon,
  Tune as FilterIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

interface VideoEditorProps {
  videoFile?: File;
  onSave: (editedVideo: File) => void;
  onCancel: () => void;
}

interface VideoSegment {
  id: string;
  startTime: number;
  endTime: number;
  file: File;
}

interface TimelineFrame {
  time: number;
  thumbnail: string;
}

interface Sticker {
  id: string;
  url: string;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
}

interface TextOverlay {
  id: string;
  text: string;
  position: { x: number; y: number };
  fontSize: number;
  color: string;
  rotation: number;
}

interface GiphyResult {
  id: string;
  url: string;
  title: string;
}

interface TimelineMarker {
  id: string;
  time: number;
  type: 'split' | 'cut';
}

const VideoEditor: React.FC<VideoEditorProps> = ({ videoFile, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [selectedEffect, setSelectedEffect] = useState('none');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const additionalVideoInputRef = useRef<HTMLInputElement>(null);
  const [frames, setFrames] = useState<TimelineFrame[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const frameInterval = 0.5; // Capture frame every 0.5 seconds

  // New state for editing features
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showGiphySearch, setShowGiphySearch] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [giphyResults, setGiphyResults] = useState<GiphyResult[]>([]);
  const [giphySearch, setGiphySearch] = useState('');
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [animations, setAnimations] = useState<Map<string, string>>(new Map());
  const [showFilters, setShowFilters] = useState(false);
  const [timelineMarkers, setTimelineMarkers] = useState<TimelineMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [isPlayheadVisible, setIsPlayheadVisible] = useState(true);

  const filters = [
    { value: 'none', label: 'None' },
    { value: 'boost', label: 'Boost' },
    { value: 'contrast', label: 'Contrast' },
    { value: 'muted', label: 'Muted' },
    { value: 'dramatic', label: 'Dramatic' }
  ];

  const effects = [
    { value: 'none', label: 'None' },
    { value: 'zoom', label: 'Zoom' },
    { value: 'slideLeft', label: 'Slide Left' },
    { value: 'slideRight', label: 'Slide Right' },
    { value: 'fadeIn', label: 'Fade In' }
  ];

  const handleVideoLoad = async () => {
    if (!videoFile) return;
    
    // Create a temporary URL for the video file
    const videoUrl = URL.createObjectURL(videoFile);
    const video = document.createElement('video');
    video.src = videoUrl;
    
    // Wait for metadata to load to get duration
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        setDuration(video.duration);
        setTrimEnd(video.duration);
        resolve(null);
      };
    });
    
    URL.revokeObjectURL(videoUrl);

    // Initialize first segment
    setSegments([{
      id: 'initial',
      startTime: 0,
      endTime: video.duration,
      file: videoFile
    }]);
    setActiveSegment('initial');
  };

  React.useEffect(() => {
    handleVideoLoad();
  }, [videoFile]);

  const handleSplit = () => {
    if (!videoRef.current || !activeSegment) return;
    
    const currentTime = videoRef.current.currentTime;
    const currentSegment = segments.find(s => s.id === activeSegment);
    
    if (!currentSegment) return;

    // Create two new segments from the split point
    const newSegments: VideoSegment[] = [
      {
        id: `segment-${Date.now()}-1`,
        startTime: currentSegment.startTime,
        endTime: currentTime,
        file: currentSegment.file
      },
      {
        id: `segment-${Date.now()}-2`,
        startTime: currentTime,
        endTime: currentSegment.endTime,
        file: currentSegment.file
      }
    ];

    // Replace the current segment with the new segments
    setSegments(prev => [
      ...prev.filter(s => s.id !== activeSegment),
      ...newSegments
    ].sort((a, b) => a.startTime - b.startTime));

    setActiveSegment(newSegments[0].id);
  };

  const handleAddVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Create a temporary URL for the video file
      const videoUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = videoUrl;
      
      // Wait for metadata to load
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          resolve(null);
        };
      });

      // Add new segment
      setSegments(prev => [...prev, {
        id: `segment-${Date.now()}`,
        startTime: 0,
        endTime: video.duration,
        file
      }]);

      URL.revokeObjectURL(videoUrl);
    } catch (error) {
      console.error('Error adding video:', error);
      setError('Failed to add video');
    }
  };

  const handleCut = () => {
    if (!activeSegment) return;
    
    const currentSegment = segments.find(s => s.id === activeSegment);
    if (!currentSegment) return;

    // Remove the selected region from the current segment
    const remainingSegments: VideoSegment[] = [
      {
        id: `segment-${Date.now()}-1`,
        startTime: currentSegment.startTime,
        endTime: trimStart,
        file: currentSegment.file
      },
      {
        id: `segment-${Date.now()}-2`,
        startTime: trimEnd,
        endTime: currentSegment.endTime,
        file: currentSegment.file
      }
    ];

    // Update segments, removing the cut portion
    setSegments(prev => [
      ...prev.filter(s => s.id !== activeSegment),
      ...remainingSegments
    ].sort((a, b) => a.startTime - b.startTime));

    setActiveSegment(remainingSegments[0].id);
  };

  const handleSave = async () => {
    if (!videoFile) return;

    try {
      setLoading(true);
      setError(null);
      
      // Check for API key
      const apiKey = process.env.REACT_APP_SHOTSTACK_API_KEY;
      if (!apiKey) {
        throw new Error('Shotstack API key is not configured');
      }

      // Create edit using direct API call
      const edit = {
        timeline: {
          background: "#000000",
          tracks: [
            {
              clips: segments.map((segment, index) => ({
                asset: {
                  type: "video",
                  src: URL.createObjectURL(segment.file)
                },
                start: index === 0 ? 0 : segments.slice(0, index).reduce((acc, seg) => acc + (seg.endTime - seg.startTime), 0),
                length: segment.endTime - segment.startTime,
                filter: selectedFilter !== 'none' ? selectedFilter : undefined,
                effect: selectedEffect !== 'none' ? selectedEffect : undefined,
                trim: {
                  start: segment.startTime,
                  length: segment.endTime - segment.startTime
                }
              }))
            }
          ]
        },
        output: {
          format: "mp4",
          resolution: "1080"
        }
      };

      // Submit edit using direct API call
      const response = await fetch('https://api.shotstack.io/v1/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(edit)
      });

      if (!response.ok) {
        throw new Error('Failed to submit video for processing');
      }

      const { id } = await response.json();

      // Poll for status
      const checkStatus = async () => {
        const statusResponse = await fetch(`https://api.shotstack.io/v1/render/${id}`, {
          headers: {
            'x-api-key': apiKey
          }
        });

        if (!statusResponse.ok) {
          throw new Error('Failed to check render status');
        }

        const status = await statusResponse.json();
        
        if (status.response.status === 'done') {
          // Download the edited video
          const videoResponse = await fetch(status.response.url);
          const blob = await videoResponse.blob();
          const file = new File([blob], 'edited_video.mp4', { type: 'video/mp4' });
          
          onSave(file);
          setLoading(false);
        } else if (status.response.status === 'failed') {
          throw new Error('Video processing failed');
        } else {
          // Update progress (remaining 50% is processing progress)
          setProgress(50 + (status.response.progress * 0.5));
          setTimeout(checkStatus, 1000);
        }
      };

      await checkStatus();

    } catch (error) {
      console.error('Error processing video:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while processing the video');
      setLoading(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Generate timeline frames
  const generateFrames = async (video: HTMLVideoElement) => {
    const frames: TimelineFrame[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    canvas.width = 160;
    canvas.height = 90;

    for (let time = 0; time < video.duration; time += 0.5) {
      video.currentTime = time;
      await new Promise(resolve => {
        video.onseeked = resolve;
      });
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({
        time,
        thumbnail: canvas.toDataURL('image/jpeg', 0.5)
      });
    }

    setFrames(frames);
  };

  // Initialize frames when video loads
  useEffect(() => {
    if (videoFile) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      video.onloadedmetadata = () => {
        setDuration(video.duration);
        setTrimEnd(video.duration);
        generateFrames(video);
      };
    }
  }, [videoFile]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleTrimStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTrimStart = percentage * duration;
    
    if (newTrimStart < trimEnd) {
      setTrimStart(newTrimStart);
      if (videoRef.current) {
        videoRef.current.currentTime = newTrimStart;
      }
    }
  };

  const handleTrimEnd = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTrimEnd = percentage * duration;
    
    if (newTrimEnd > trimStart) {
      setTrimEnd(newTrimEnd);
      if (videoRef.current) {
        videoRef.current.currentTime = newTrimEnd;
      }
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const handleVideoTimeUpdate = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
    };

    const handleVideoEnded = () => {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.currentTime = trimStart;
      }
    };

    const video = videoRef.current;
    if (video) {
      video.addEventListener('timeupdate', handleVideoTimeUpdate);
      video.addEventListener('ended', handleVideoEnded);
    }

    return () => {
      if (video) {
        video.removeEventListener('timeupdate', handleVideoTimeUpdate);
        video.removeEventListener('ended', handleVideoEnded);
      }
    };
  }, [trimStart]);

  // Handle sticker addition
  const handleAddSticker = (stickerUrl: string) => {
    const newSticker: Sticker = {
      id: `sticker-${Date.now()}`,
      url: stickerUrl,
      position: { x: 50, y: 50 },
      scale: 1,
      rotation: 0
    };
    setStickers([...stickers, newSticker]);
    addToHistory('add-sticker', newSticker);
    setShowStickerPicker(false);
  };

  // Handle text addition
  const handleAddText = (text: string) => {
    const newText: TextOverlay = {
      id: `text-${Date.now()}`,
      text,
      position: { x: 50, y: 50 },
      fontSize: 24,
      color: '#ffffff',
      rotation: 0
    };
    setTextOverlays([...textOverlays, newText]);
    addToHistory('add-text', newText);
    setShowTextEditor(false);
  };

  // Handle GIPHY search
  const handleGiphySearch = async (query: string) => {
    try {
      const GIPHY_API_KEY = process.env.REACT_APP_GIPHY_API_KEY;
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${query}&limit=20`
      );
      const data = await response.json();
      setGiphyResults(data.data.map((gif: any) => ({
        id: gif.id,
        url: gif.images.fixed_height.url,
        title: gif.title
      })));
    } catch (error) {
      console.error('Error searching GIPHY:', error);
      setError('Failed to search GIPHY');
    }
  };

  // Handle animation
  const handleAddAnimation = (elementId: string, animationType: string) => {
    setAnimations(new Map(animations.set(elementId, animationType)));
    addToHistory('add-animation', { elementId, animationType });
  };

  // Handle undo/redo
  const addToHistory = (actionType: string, data: any) => {
    const newAction = { type: actionType, data };
    const newHistory = [...editHistory.slice(0, historyIndex + 1), newAction];
    setEditHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex >= 0) {
      const action = editHistory[historyIndex];
      undoAction(action);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const undoAction = (action: { type: string; data: any }) => {
    switch (action.type) {
      case 'add-sticker':
        setStickers(stickers.filter(s => s.id !== action.data.id));
        break;
      case 'add-text':
        setTextOverlays(textOverlays.filter(t => t.id !== action.data.id));
        break;
      case 'split':
        setSplitPoints(splitPoints.filter(time => time !== action.data));
        break;
      case 'add-animation':
        const newAnimations = new Map(animations);
        newAnimations.delete(action.data.elementId);
        setAnimations(newAnimations);
        break;
    }
  };

  // Handle element dragging
  const handleDragStart = (e: React.MouseEvent, elementId: string) => {
    setSelectedElement(elementId);
    // Add drag logic
  };

  // Render functions
  const renderStickers = () => {
    return stickers.map(sticker => (
      <img
        key={sticker.id}
        src={sticker.url}
        style={{
          position: 'absolute',
          left: `${sticker.position.x}%`,
          top: `${sticker.position.y}%`,
          transform: `scale(${sticker.scale}) rotate(${sticker.rotation}deg)`,
          cursor: 'move',
          zIndex: selectedElement === sticker.id ? 2 : 1
        }}
        onMouseDown={(e) => handleDragStart(e, sticker.id)}
      />
    ));
  };

  const renderTextOverlays = () => {
    return textOverlays.map(text => (
      <div
        key={text.id}
        style={{
          position: 'absolute',
          left: `${text.position.x}%`,
          top: `${text.position.y}%`,
          transform: `rotate(${text.rotation}deg)`,
          cursor: 'move',
          zIndex: selectedElement === text.id ? 2 : 1,
          color: text.color,
          fontSize: `${text.fontSize}px`
        }}
        onMouseDown={(e) => handleDragStart(e, text.id)}
      >
        {text.text}
      </div>
    ));
  };

  // Add marker handlers
  const handleDeleteMarker = (markerId: string) => {
    setTimelineMarkers(prev => prev.filter(marker => marker.id !== markerId));
    setSelectedMarker(null);
  };

  // Update video time tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setIsPlayheadVisible(true);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  return (
    <Box 
      sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: '#000000',
        color: 'white'
      }}
      role="region"
      aria-label="Video Editor"
    >
      {/* Top Bar */}
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}
        role="toolbar"
        aria-label="Editor Controls"
      >
        <IconButton 
          onClick={onCancel} 
          sx={{ color: 'white' }}
          aria-label="Back"
        >
          <BackIcon />
        </IconButton>
        <Typography variant="h6" role="timer">
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            onClick={handleUndo} 
            sx={{ color: 'white' }}
            aria-label="Undo"
            disabled={historyIndex < 0}
          >
            <UndoIcon />
          </IconButton>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <Save />}
            sx={{
              bgcolor: '#8e44ad',
              '&:hover': {
                bgcolor: '#6c3483'
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(142, 68, 173, 0.5)'
              }
            }}
            aria-label={loading ? 'Processing video' : 'Upload video'}
          >
            {loading ? 'Processing...' : 'Upload'}
          </Button>
        </Box>
      </Box>

      {/* Main Video Area */}
      <Box 
        sx={{ flex: 1, position: 'relative', bgcolor: '#000000' }}
        role="region"
        aria-label="Video Preview"
      >
        <video
          ref={videoRef}
          src={videoFile ? URL.createObjectURL(videoFile) : ''}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
          onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
          aria-label="Video being edited"
        />
        {renderStickers()}
        {renderTextOverlays()}
        <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />
        {/* Playhead line overlay */}
        {isPlayheadVisible && (
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: '#8e44ad',
              zIndex: 2
            }}
          />
        )}
      </Box>

      {/* Timeline */}
      <Box sx={{ bgcolor: '#1a1a1a', p: 2 }}>
        <Box
          ref={timelineRef}
          sx={{
            position: 'relative',
            height: 100,
            bgcolor: '#2a2a2a',
            borderRadius: 1,
            overflow: 'hidden',
            cursor: 'pointer',
            mb: 2
          }}
          onClick={handleTimelineClick}
        >
          {/* Frame thumbnails */}
          <Box sx={{ 
            display: 'flex', 
            height: '100%',
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
          }}>
            {frames.map((frame, index) => (
              <Box
                key={index}
                sx={{
                  width: `${(0.5 / duration) * 100}%`,
                  height: '100%',
                  flexShrink: 0
                }}
              >
                <img
                  src={frame.thumbnail}
                  alt={`Frame ${index}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </Box>
            ))}
          </Box>

          {/* Trim region */}
          <Box
            sx={{
              position: 'absolute',
              left: `${(trimStart / duration) * 100}%`,
              width: `${((trimEnd - trimStart) / duration) * 100}%`,
              height: '100%',
              bgcolor: 'rgba(142, 68, 173, 0.3)',
              border: '2px solid #8e44ad',
              zIndex: 1
            }}
          >
            {/* Left trim handle */}
            <Box
              sx={{
                position: 'absolute',
                left: -6,
                top: 0,
                bottom: 0,
                width: 12,
                bgcolor: '#8e44ad',
                cursor: 'ew-resize',
                '&:hover': {
                  bgcolor: '#6c3483'
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  handleTrimStart(moveEvent as any);
                };
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
            {/* Right trim handle */}
            <Box
              sx={{
                position: 'absolute',
                right: -6,
                top: 0,
                bottom: 0,
                width: 12,
                bgcolor: '#8e44ad',
                cursor: 'ew-resize',
                '&:hover': {
                  bgcolor: '#6c3483'
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  handleTrimEnd(moveEvent as any);
                };
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
          </Box>

          {/* Playhead */}
          <Box
            sx={{
              position: 'absolute',
              left: `${(currentTime / duration) * 100}%`,
              top: 0,
              bottom: 0,
              width: 2,
              bgcolor: '#8e44ad',
              zIndex: 2
            }}
          />
        </Box>

        {/* Time indicators */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
          <Typography variant="caption" sx={{ color: 'white' }}>
            {formatTime(trimStart)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'white' }}>
            {formatTime(trimEnd)}
          </Typography>
        </Box>

        {/* Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = trimStart;
              }
            }}
          >
            Play Selection
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              // Save the trimmed portion
              if (videoFile) {
                onSave(videoFile);
              }
            }}
            disabled={!videoFile}
          >
            Save
          </Button>
        </Box>
      </Box>

      {/* Bottom Toolbar */}
      <Box 
        sx={{ 
          bgcolor: '#1a1a1a', 
          p: 2,
          display: 'flex',
          justifyContent: 'space-around',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}
        role="toolbar"
        aria-label="Editing Tools"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'white' }}>
          <IconButton 
            onClick={() => setShowTextEditor(true)} 
            sx={{ color: 'white' }}
            aria-label="Add Text"
          >
            <TextIcon />
          </IconButton>
          <Typography variant="caption">Text</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'white' }}>
          <IconButton 
            onClick={() => additionalVideoInputRef.current?.click()}
            sx={{ color: 'white' }}
            aria-label="Add Video"
          >
            <AddIcon />
          </IconButton>
          <Typography variant="caption">Add</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'white' }}>
          <IconButton 
            onClick={handleSplit}
            sx={{ color: 'white' }}
            aria-label="Split Video"
          >
            <SplitIcon />
          </IconButton>
          <Typography variant="caption">Split</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'white' }}>
          <IconButton 
            onClick={handleCut}
            sx={{ color: 'white' }}
            aria-label="Cut Video"
          >
            <CutIcon />
          </IconButton>
          <Typography variant="caption">Cut</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'white' }}>
          <IconButton 
            onClick={() => setShowFilters(true)}
            sx={{ color: 'white' }}
            aria-label="Apply Filters"
          >
            <FilterIcon />
          </IconButton>
          <Typography variant="caption">Filters</Typography>
        </Box>
      </Box>

      {/* Dialogs */}
      <Dialog 
        open={showTextEditor} 
        onClose={() => setShowTextEditor(false)}
        aria-labelledby="text-editor-title"
      >
        <DialogTitle id="text-editor-title">Add Text</DialogTitle>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            placeholder="Enter text..."
            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                const input = e.target as HTMLInputElement;
                handleAddText(input.value);
                input.value = '';
              }
            }}
            aria-label="Text to add"
          />
        </Box>
      </Dialog>

      <Dialog 
        open={showFilters} 
        onClose={() => setShowFilters(false)}
        aria-labelledby="filter-picker-title"
      >
        <DialogTitle id="filter-picker-title">Choose Filter</DialogTitle>
        <Box sx={{ p: 2 }}>
          <FormControl fullWidth>
            <Select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              aria-label="Select filter"
            >
              {filters.map((filter) => (
                <MenuItem key={filter.value} value={filter.value}>
                  {filter.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Dialog>

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            position: 'absolute', 
            top: 16, 
            left: 16, 
            right: 16,
            zIndex: 9999
          }}
          role="alert"
        >
          {error}
        </Alert>
      )}

      <input
        type="file"
        accept="video/*"
        onChange={handleAddVideo}
        style={{ display: 'none' }}
        ref={additionalVideoInputRef}
      />
    </Box>
  );
};

export default VideoEditor; 