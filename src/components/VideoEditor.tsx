import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, CircularProgress, Typography, Button, IconButton, Dialog, Alert, TextField, DialogTitle, Slider, Select, MenuItem, DialogContent, LinearProgress } from '@mui/material';
import {
  PlayArrow,
  Pause,
  ArrowBack as BackIcon,
  Save,
  ContentCut as CutIcon,
  CallSplit as SplitIcon,
  Add as AddIcon,
  TextFields as TextIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Delete as DeleteIcon,
  VolumeOff,
  VolumeUp,
  MusicNote as MusicNoteIcon,
  AudioFile as AudioFileIcon
} from '@mui/icons-material';
import VibitIcon from '../components/VibitIcon';
import { toast } from 'react-hot-toast';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { getDoc, doc, addDoc, collection, serverTimestamp, Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';

// Define AND EXPORT the structure for editing instructions
export interface EditInstructions {
  segments: VideoSegment[];
  audioTracks: AudioTrack[];
  textOverlays: TextOverlay[];
  duration: number;
  videoVolume: number;
  originalVideoFile?: File;
}

// Export dependent interfaces as well
export interface VideoSegment {
  id: string;
  startTime: number;
  endTime: number;
  file: File;
  isMuted: boolean;
  volume: number;
}

export interface TimelineFrame {
  thumbnail: string;
  time: number;
}

export interface TextOverlay {
  id: string;
  text: string;
  position: { x: number; y: number };
  fontSize: number;
  color: string;
  rotation: number;
  startTime: number;
  duration: number;
  width: number;
  height: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  borderWidth: number;
  borderColor: string;
  backgroundColor: string;
  opacity: number;
}

export interface AudioTrack {
  id: string;
  file: File;
  name: string;
  startTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

interface VideoEditorProps {
  videoFile?: File;
  onSave: (instructions: EditInstructions) => Promise<void>;
  onCancel: () => void;
}

interface TimelineSegmentProps {
  segment: VideoSegment;
  duration: number;
  isActive: boolean;
  frames: TimelineFrame[];
  onSelect: (id: string) => void;
  onDragStart: (e: React.MouseEvent, segment: VideoSegment) => void;
  onTouchStart: (e: React.TouchEvent, segment: VideoSegment) => void;
}

interface EditorState {
  segments: VideoSegment[];
  activeSegment: string | null;
  textOverlays: TextOverlay[];
  audioTracks: AudioTrack[];
  currentTime: number;
}

const TimelineSegment: React.FC<TimelineSegmentProps> = ({ segment, duration, isActive, frames, onSelect, onDragStart, onTouchStart }) => {
  const segmentStart = (segment.startTime / duration) * 100;
  const segmentWidth = ((segment.endTime - segment.startTime) / duration) * 100;
  
  return (
    <Box
      onClick={() => onSelect(segment.id)}
      onMouseDown={(e) => onDragStart(e, segment)}
      onTouchStart={(e) => onTouchStart(e, segment)}
      sx={{
        position: 'absolute',
        left: `${segmentStart}%`,
        width: `${segmentWidth}%`,
        height: '100%',
        border: isActive ? '2px solid #4a90e2' : '1px solid rgba(255,255,255,0.3)',
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: 'grab',
        touchAction: 'none',
        '&:hover': {
          border: '2px solid #4a90e2'
        },
        '&:active': {
          cursor: 'grabbing'
        }
      }}
    >
      <Box sx={{ 
        display: 'flex',
        height: '100%',
        position: 'relative'
      }}>
        {frames
          .filter(frame => frame.time >= segment.startTime && frame.time <= segment.endTime)
          .map((frame, index) => (
            <Box
              key={index}
              sx={{
                flex: 1,
                height: '100%',
                position: 'relative',
                borderRight: index < frames.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'
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
    </Box>
  );
};

const VideoEditor: React.FC<VideoEditorProps> = ({ videoFile, onSave, onCancel }) => {
  // Core state
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frames, setFrames] = useState<TimelineFrame[]>([]);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedText, setSelectedText] = useState<TextOverlay | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0 });
  const { currentUser } = useAuth();
  
  // Undo/Redo state
  const [history, setHistory] = useState<EditorState[]>([{
    segments: [],
    activeSegment: null,
    textOverlays: [],
    audioTracks: [],
    currentTime: 0
  }]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const additionalVideoInputRef = useRef<HTMLInputElement>(null);

  // Add new state for audio control
  const [videoVolume, setVideoVolume] = useState(1);
  const [isAudioDetached, setIsAudioDetached] = useState(false);

  // Audio state
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null);
  const [isAudioDragging, setIsAudioDragging] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioElements = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Add these state variables at the top with other state declarations
  const [isDraggingSegment, setIsDraggingSegment] = useState(false);
  const [draggedSegment, setDraggedSegment] = useState<VideoSegment | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);

  // Video text movement state
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [videoTextDragStart, setVideoTextDragStart] = useState({ x: 0, y: 0 });

  // Timeline text movement state
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [timelineDragStart, setTimelineDragStart] = useState(0);

  // Initialize video and history when file is provided
  useEffect(() => {
    if (!videoFile || !videoRef.current) return;

    const video = videoRef.current;
    const url = URL.createObjectURL(videoFile);
    video.src = url;

    const handleLoad = () => {
      setDuration(video.duration);
      // Initialize first segment
      const initialSegment: VideoSegment = {
        id: 'initial',
        startTime: 0,
        endTime: video.duration,
        file: videoFile,
        isMuted: false,
        volume: 1
      };
      setSegments([initialSegment]);
      setActiveSegment(initialSegment.id);
      
      // Initialize history with initial state
      const initialState: EditorState = {
        segments: [initialSegment],
        activeSegment: initialSegment.id,
        textOverlays: [],
        audioTracks: [],
        currentTime: 0
      };
      setHistory([initialState]);
      setCurrentHistoryIndex(0);
      
      generateFrames();
    };

    video.addEventListener('loadeddata', handleLoad);

    return () => {
      video.removeEventListener('loadeddata', handleLoad);
      URL.revokeObjectURL(url);
    };
  }, [videoFile]);

  // Basic frame generation
  const generateFrames = useCallback(async () => {
    if (!videoRef.current || !videoFile) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return;

      canvas.width = 160;
      canvas.height = 90;

      const frameCount = 20;
      const interval = video.duration / frameCount;
      const newFrames: TimelineFrame[] = [];

      for (let i = 0; i < frameCount; i++) {
        const time = i * interval;
        video.currentTime = time;

        await new Promise<void>((resolve) => {
          const handleSeeked = () => {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            newFrames.push({
              thumbnail: canvas.toDataURL('image/jpeg'),
              time: time
            });
            video.removeEventListener('seeked', handleSeeked);
            resolve();
          };
          video.addEventListener('seeked', handleSeeked);
        });
      }

      video.currentTime = 0;
      setFrames(newFrames);
    } catch (error) {
      console.error('Error generating frames:', error);
      setError('Failed to generate video preview');
    }
  }, [videoFile]);

  // Handle timeline click
  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickTime = (clickX / rect.width) * duration;
    
    videoRef.current.currentTime = clickTime;
    setCurrentTime(clickTime);
  };

  // Handle play/pause
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle time update
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  // Save current state to history
  const saveToHistory = useCallback(() => {
    const currentState: EditorState = {
      segments,
      activeSegment,
      textOverlays,
      audioTracks,
      currentTime
    };

    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, currentHistoryIndex + 1);
      return [...newHistory, currentState];
    });
    setCurrentHistoryIndex(prev => prev + 1);
  }, [segments, activeSegment, textOverlays, audioTracks, currentTime, currentHistoryIndex]);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (currentHistoryIndex <= 0) return;

    const previousState = history[currentHistoryIndex - 1];
    setSegments(previousState.segments);
    setActiveSegment(previousState.activeSegment);
    setTextOverlays(previousState.textOverlays);
    setAudioTracks(previousState.audioTracks);
    setCurrentTime(previousState.currentTime);
    setCurrentHistoryIndex(prev => prev - 1);

    if (videoRef.current) {
      videoRef.current.currentTime = previousState.currentTime;
    }
  }, [currentHistoryIndex, history]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (currentHistoryIndex >= history.length - 1) return;

    const nextState = history[currentHistoryIndex + 1];
    setSegments(nextState.segments);
    setActiveSegment(nextState.activeSegment);
    setTextOverlays(nextState.textOverlays);
    setAudioTracks(nextState.audioTracks);
    setCurrentTime(nextState.currentTime);
    setCurrentHistoryIndex(prev => prev + 1);

    if (videoRef.current) {
      videoRef.current.currentTime = nextState.currentTime;
    }
  }, [currentHistoryIndex, history]);

  // Handle split
  const handleSplit = useCallback(() => {
    if (!videoRef.current || !activeSegment) return;
    
    const splitTime = currentTime;
    const currentSegment = segments.find(s => s.id === activeSegment);
    
    if (!currentSegment) return;

    if (splitTime <= currentSegment.startTime || splitTime >= currentSegment.endTime) {
      return;
    }

    const newSegments: VideoSegment[] = [
      {
        id: `segment-${Date.now()}-1`,
        startTime: currentSegment.startTime,
        endTime: splitTime,
        file: currentSegment.file,
        isMuted: currentSegment.isMuted,
        volume: currentSegment.volume
      },
      {
        id: `segment-${Date.now()}-2`,
        startTime: splitTime,
        endTime: currentSegment.endTime,
        file: currentSegment.file,
        isMuted: currentSegment.isMuted,
        volume: currentSegment.volume
      }
    ];

    setSegments(prev => [
      ...prev.filter(s => s.id !== activeSegment),
      ...newSegments
    ].sort((a, b) => a.startTime - b.startTime));

    setActiveSegment(newSegments[0].id);
    saveToHistory();
  }, [videoRef, activeSegment, currentTime, segments, saveToHistory]);

  // Handle cut
  const handleCut = useCallback(() => {
    if (!videoRef.current || !activeSegment) return;
    
    const cutTime = currentTime;
    const currentSegment = segments.find(s => s.id === activeSegment);
    if (!currentSegment) return;

    if (cutTime <= currentSegment.startTime || cutTime >= currentSegment.endTime) {
      return;
    }

    const remainingSegments: VideoSegment[] = [
      {
        id: `segment-${Date.now()}-1`,
        startTime: currentSegment.startTime,
        endTime: Math.max(currentSegment.startTime, cutTime - 0.5),
        file: currentSegment.file,
        isMuted: currentSegment.isMuted,
        volume: currentSegment.volume
      },
      {
        id: `segment-${Date.now()}-2`,
        startTime: Math.min(currentSegment.endTime, cutTime + 0.5),
        endTime: currentSegment.endTime,
        file: currentSegment.file,
        isMuted: currentSegment.isMuted,
        volume: currentSegment.volume
      }
    ];

    setSegments(prev => [
      ...prev.filter(s => s.id !== activeSegment),
      ...remainingSegments
    ].sort((a, b) => a.startTime - b.startTime));

    setActiveSegment(remainingSegments[0].id);
    saveToHistory();
  }, [videoRef, activeSegment, currentTime, segments, saveToHistory]);

  // Handle add video
  const handleAddVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      for (const file of Array.from(files)) {
      const videoUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = videoUrl;
      
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
        video.load();
      });

        // Calculate the start time based on current time
        const startTime = currentTime;
        const endTime = startTime + video.duration;

      // Add new segment
      const newSegment: VideoSegment = {
          id: `segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          startTime,
          endTime,
        file,
        isMuted: false,
        volume: 1
      };

        // Update segments array
        setSegments(prev => {
          const updatedSegments = [...prev];
          
          // Find the segment that contains the current time
          const currentSegmentIndex = prev.findIndex(s => 
            s.startTime <= currentTime && s.endTime >= currentTime
          );

          if (currentSegmentIndex !== -1) {
            const currentSegment = prev[currentSegmentIndex];
            
            // If we're adding in the middle of a segment, split it
            if (currentTime > currentSegment.startTime && currentTime < currentSegment.endTime) {
              const splitSegments = [
                {
                  ...currentSegment,
                  id: `segment-${Date.now()}-1-${Math.random().toString(36).substr(2, 9)}`,
                  endTime: currentTime
                },
                {
                  ...currentSegment,
                  id: `segment-${Date.now()}-2-${Math.random().toString(36).substr(2, 9)}`,
                  startTime: endTime
                }
              ];
              
              // Replace the current segment with split segments and new segment
              updatedSegments.splice(currentSegmentIndex, 1, ...splitSegments, newSegment);
            } else {
              // Just insert the new segment
              updatedSegments.splice(currentSegmentIndex + 1, 0, newSegment);
            }
          } else {
            // If no segment contains current time, just append
            updatedSegments.push(newSegment);
          }

          // Sort segments by start time
          return updatedSegments.sort((a, b) => a.startTime - b.startTime);
        });

      setActiveSegment(newSegment.id);
        
        // Create a new video element for the segment
        const segmentVideo = document.createElement('video');
        segmentVideo.src = videoUrl;
        await new Promise((resolve) => {
          segmentVideo.onloadedmetadata = resolve;
          segmentVideo.load();
        });

        // Generate frames for the new segment
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = 160;
        canvas.height = 90;

        const frameCount = 20;
        const interval = segmentVideo.duration / frameCount;
        const newFrames: TimelineFrame[] = [];

        for (let i = 0; i < frameCount; i++) {
          const time = i * interval;
          segmentVideo.currentTime = time;

          await new Promise<void>((resolve) => {
            const handleSeeked = () => {
              context.drawImage(segmentVideo, 0, 0, canvas.width, canvas.height);
              newFrames.push({
                thumbnail: canvas.toDataURL('image/jpeg'),
                time: time + startTime // Add the start time offset
              });
              segmentVideo.removeEventListener('seeked', handleSeeked);
              resolve();
            };
            segmentVideo.addEventListener('seeked', handleSeeked);
          });
        }

        // Update frames state with new frames
        setFrames(prev => [...prev, ...newFrames]);

        // Update video playback
        if (videoRef.current) {
          videoRef.current.currentTime = startTime;
          videoRef.current.play();
        }

      URL.revokeObjectURL(videoUrl);
      }

      // Reset the input value to allow adding more files
      if (additionalVideoInputRef.current) {
        additionalVideoInputRef.current.value = '';
      }
      
      saveToHistory();
    } catch (error) {
      console.error('Error adding video(s):', error);
      setError('Failed to add video(s). Please try again.');
    }
  };

  // Handle video text dragging
  const handleVideoTextMouseDown = (e: React.MouseEvent, text: TextOverlay) => {
    if (e.target instanceof HTMLElement && e.target.classList.contains('resize-handle')) {
      return;
    }
    e.stopPropagation();
    setIsDraggingVideo(true);
    setSelectedText(text);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setVideoTextDragStart({
      x: e.clientX - (text.position.x * rect.width / 100),
      y: e.clientY - (text.position.y * rect.height / 100)
    });
  };

  const handleVideoTextMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingVideo || !selectedText) return;

      const videoContainer = document.querySelector('.video-container');
      if (!videoContainer) return;

      const rect = videoContainer.getBoundingClientRect();
    const x = ((e.clientX - videoTextDragStart.x) / rect.width) * 100;
    const y = ((e.clientY - videoTextDragStart.y) / rect.height) * 100;

      setTextOverlays(prev => prev.map(t =>
        t.id === selectedText.id
        ? { ...t, position: { 
            x: Math.max(0, Math.min(100, x)), 
            y: Math.max(0, Math.min(100, y)) 
          }}
          : t
      ));
  }, [isDraggingVideo, selectedText, videoTextDragStart]);

  const handleVideoTextMouseUp = useCallback(() => {
    if (isDraggingVideo) {
      setIsDraggingVideo(false);
      saveToHistory();
    }
  }, [isDraggingVideo, saveToHistory]);

  // Handle timeline text dragging
  const handleTimelineTextMouseDown = (e: React.MouseEvent, text: TextOverlay) => {
    e.stopPropagation();
    setIsDraggingTimeline(true);
    setSelectedText(text);
    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect) {
      const clickX = e.clientX - rect.left;
      setTimelineDragStart(clickX);
    }
  };

  const handleTimelineTextMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingTimeline || !selectedText || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * duration;
    const newStartTime = Math.max(0, Math.min(duration - selectedText.duration, x));

      setTextOverlays(prev => prev.map(t =>
      t.id === selectedText.id ? { ...t, startTime: newStartTime } : t
      ));
  }, [isDraggingTimeline, selectedText, duration]);

  const handleTimelineTextMouseUp = useCallback(() => {
    if (isDraggingTimeline) {
      setIsDraggingTimeline(false);
      saveToHistory();
    }
  }, [isDraggingTimeline, saveToHistory]);

  // Add event listeners
  useEffect(() => {
    window.addEventListener('mousemove', handleVideoTextMouseMove);
    window.addEventListener('mouseup', handleVideoTextMouseUp);
    window.addEventListener('mousemove', handleTimelineTextMouseMove);
    window.addEventListener('mouseup', handleTimelineTextMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleVideoTextMouseMove);
      window.removeEventListener('mouseup', handleVideoTextMouseUp);
      window.removeEventListener('mousemove', handleTimelineTextMouseMove);
      window.removeEventListener('mouseup', handleTimelineTextMouseUp);
    };
  }, [handleVideoTextMouseMove, handleVideoTextMouseUp, handleTimelineTextMouseMove, handleTimelineTextMouseUp]);

  // Handle text resize
  const handleResizeMouseDown = (e: React.MouseEvent, text: TextOverlay) => {
    e.stopPropagation();
    setIsResizing(true);
    setSelectedText(text);
    setResizeStart({
      width: text.width,
      height: text.height
    });
  };

  // Handle add text
  const handleAddText = useCallback((text: string) => {
    if (!text.trim()) return;

    const newText: TextOverlay = {
      id: `text-${Date.now()}`,
      text: text.trim(),
      position: { x: 50, y: 50 },
      fontSize: 24,
      color: '#ffffff',
      rotation: 0,
      startTime: currentTime,
      duration: 5,
      width: 20,
      height: 10,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      borderWidth: 0,
      borderColor: '#000000',
      backgroundColor: 'transparent',
      opacity: 1
    };

    setTextOverlays(prev => [...prev, newText]);
    setShowTextEditor(false);
    saveToHistory();
  }, [currentTime, saveToHistory]);

  // Handle text edit
  const handleTextEdit = (text: TextOverlay) => {
    setSelectedText(text);
    setShowTextEditor(true);
  };

  // Handle text update
  const handleTextUpdate = (updatedText: string) => {
    if (!selectedText) return;

    setTextOverlays(prev => prev.map(t =>
      t.id === selectedText.id ? { 
        ...t, 
        text: updatedText,
        fontFamily: t.fontFamily || 'Arial',
        fontWeight: t.fontWeight || 'normal',
        fontStyle: t.fontStyle || 'normal',
        textDecoration: t.textDecoration || 'none',
        borderWidth: t.borderWidth || 0,
        borderColor: t.borderColor || '#000000',
        backgroundColor: t.backgroundColor || 'transparent',
        opacity: t.opacity || 1
      } : t
    ));
    setShowTextEditor(false);
    setSelectedText(null);
    saveToHistory();
  };

  // Format time display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Update handleSaveClick to gather instructions, including the original file reference
  const handleSaveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true); // Indicate processing start
    setError(null);

    // Gather all necessary data for processing
    const instructions: EditInstructions = {
      segments: segments, 
      audioTracks: audioTracks,
      textOverlays: textOverlays,
      duration: duration,
      videoVolume: videoVolume,
      originalVideoFile: videoFile // Include reference to the base video file
    };

    try {
      // Call the onSave prop passed from Vibits.tsx with the instructions
      onSave(instructions)
        .then(() => {
          setLoading(false);
          // toast.success('Video processing started!'); // Feedback given in Vibits.tsx
        })
        .catch((err) => {
          console.error("Error initiating video save:", err);
          setError('Failed to start video processing. Please try again.');
          setLoading(false);
        });
    } catch (err) {
      console.error("Error in handleSaveClick:", err);
      setError('An unexpected error occurred.');
      setLoading(false);
    }
  };

  // Handle delete segment
  const handleDelete = useCallback(() => {
    if (!activeSegment) return;

    // Don't allow deleting if it's the only segment
    if (segments.length <= 1) {
      setError('Cannot delete the only segment');
      return;
    }

    setSegments(prev => {
      const newSegments = prev.filter(s => s.id !== activeSegment);
      // Set active segment to the previous segment or the first one
      const nextActiveIndex = Math.max(
        0,
        prev.findIndex(s => s.id === activeSegment) - 1
      );
      setActiveSegment(newSegments[nextActiveIndex].id);
      return newSegments;
    });
    
    saveToHistory();
  }, [activeSegment, segments.length, saveToHistory]);

  // Add handleDeleteText function
  const handleDeleteText = useCallback((textId: string) => {
    setTextOverlays(prev => prev.filter(t => t.id !== textId));
    setSelectedText(null);
    setShowTextEditor(false);
    saveToHistory();
  }, [saveToHistory]);

  // Add audio control handlers
  const handleVolumeChange = (value: number) => {
    setVideoVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value;
    }
  };

  const handleAudioDetach = () => {
    setIsAudioDetached(!isAudioDetached);
    if (videoRef.current) {
      videoRef.current.muted = !isAudioDetached;
    }
  };

  // Add these new handlers before the return statement
  const handleSegmentDragStart = (e: React.MouseEvent, segment: VideoSegment) => {
    e.stopPropagation();
    setIsDraggingSegment(true);
    setDraggedSegment(segment);
    setDragStartX(e.clientX);
    setDragStartTime(segment.startTime);
  };

  const handleTimelineDrag = useCallback((e: MouseEvent) => {
    if (!isDraggingSegment || !draggedSegment || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX;
    const deltaTime = (deltaX / rect.width) * duration;
    const newStartTime = Math.max(0, dragStartTime + deltaTime);
    const segmentDuration = draggedSegment.endTime - draggedSegment.startTime;
    
    if (newStartTime + segmentDuration <= duration) {
      setSegments(prev => prev.map(s => 
        s.id === draggedSegment.id 
          ? { 
              ...s, 
              startTime: newStartTime,
              endTime: newStartTime + segmentDuration
            }
          : s
      ));
    }
  }, [isDraggingSegment, draggedSegment, dragStartX, dragStartTime, duration]);

  const handleTimelineDragEnd = useCallback(() => {
    if (isDraggingSegment) {
      setIsDraggingSegment(false);
      setDraggedSegment(null);
      saveToHistory();
    }
  }, [isDraggingSegment, saveToHistory]);

  // Add these useEffect hooks after the existing ones
  useEffect(() => {
    window.addEventListener('mousemove', handleTimelineDrag);
    window.addEventListener('mouseup', handleTimelineDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleTimelineDrag);
      window.removeEventListener('mouseup', handleTimelineDragEnd);
    };
  }, [handleTimelineDrag, handleTimelineDragEnd]);

  // Add this function before the return statement
  const getAudioTrackPosition = (trackIndex: number) => {
    const TRACK_HEIGHT = 20; // Height of each audio track in percentage
    const MAX_TRACKS = 4; // Maximum number of visible tracks
    const bottomPosition = Math.min(trackIndex * TRACK_HEIGHT, (MAX_TRACKS - 1) * TRACK_HEIGHT);
    return bottomPosition;
  };

  // Add touch event handlers
  const handleVideoTextTouchStart = (e: React.TouchEvent, text: TextOverlay) => {
    e.stopPropagation();
    setIsDraggingVideo(true);
    setSelectedText(text);
    const touch = e.touches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setVideoTextDragStart({
      x: touch.clientX - (text.position.x * rect.width / 100),
      y: touch.clientY - (text.position.y * rect.height / 100)
    });
  };

  const handleVideoTextTouchMove = (e: TouchEvent) => {
    if (!isDraggingVideo || !selectedText) return;

    const videoContainer = document.querySelector('.video-container');
    if (!videoContainer) return;

    const touch = e.touches[0];
    const rect = videoContainer.getBoundingClientRect();
    const newX = ((touch.clientX - videoTextDragStart.x) / rect.width) * 100;
    const newY = ((touch.clientY - videoTextDragStart.y) / rect.height) * 100;

    setTextOverlays((prevOverlays: TextOverlay[]) => prevOverlays.map((overlay: TextOverlay) =>
      overlay.id === selectedText.id
        ? { ...overlay, position: { 
            x: Math.max(0, Math.min(100, newX)), 
            y: Math.max(0, Math.min(100, newY)) 
          }}
        : overlay
    ));
  };

  const handleTimelineTextTouchStart = (e: React.TouchEvent, text: TextOverlay) => {
    e.stopPropagation();
    setIsDraggingTimeline(true);
    setSelectedText(text);
    const touch = e.touches[0];
    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect) {
      const touchX = touch.clientX - rect.left;
      setTimelineDragStart(touchX);
    }
  };

  const handleTimelineTextTouchMove = (e: TouchEvent) => {
    if (!isDraggingTimeline || !selectedText || !timelineRef.current) return;

    const touch = e.touches[0];
    const rect = timelineRef.current.getBoundingClientRect();
    const newX = ((touch.clientX - rect.left) / rect.width) * duration;
    const newStartTime = Math.max(0, Math.min(duration - selectedText.duration, newX));

    setTextOverlays((prevOverlays: TextOverlay[]) => prevOverlays.map((overlay: TextOverlay) =>
      overlay.id === selectedText.id ? { ...overlay, startTime: newStartTime } : overlay
    ));
  };

  const handleTouchEnd = () => {
    setIsDraggingVideo(false);
    setIsDraggingTimeline(false);
    setSelectedText(null);
  };

  // Add touch event listeners
  useEffect(() => {
    window.addEventListener('touchmove', handleVideoTextTouchMove);
    window.addEventListener('touchmove', handleTimelineTextTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleVideoTextTouchMove);
      window.removeEventListener('touchmove', handleTimelineTextTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleVideoTextTouchMove, handleTimelineTextTouchMove, handleTouchEnd]);

  // Add these handlers after the existing touch handlers

  const handleSegmentTouchStart = (e: React.TouchEvent, segment: VideoSegment) => {
    e.stopPropagation();
    setIsDraggingSegment(true);
    setDraggedSegment(segment);
    const touch = e.touches[0];
    setDragStartX(touch.clientX);
    setDragStartTime(segment.startTime);
  };

  const handleTimelineTouchMove = (e: TouchEvent) => {
    if (!isDraggingSegment || !draggedSegment || !timelineRef.current) return;

    const touch = e.touches[0];
    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = touch.clientX - dragStartX;
    const deltaTime = (deltaX / rect.width) * duration;
    const newStartTime = Math.max(0, dragStartTime + deltaTime);
    const segmentDuration = draggedSegment.endTime - draggedSegment.startTime;
    
    if (newStartTime + segmentDuration <= duration) {
      setSegments(prev => prev.map(s => 
        s.id === draggedSegment.id 
          ? { 
              ...s, 
              startTime: newStartTime,
              endTime: newStartTime + segmentDuration
            }
          : s
      ));
    }
  };

  const handleTimelineTouchEnd = () => {
    if (isDraggingSegment) {
      setIsDraggingSegment(false);
      setDraggedSegment(null);
      saveToHistory();
    }
  };

  // Add touch event listeners in useEffect
  useEffect(() => {
    window.addEventListener('touchmove', handleTimelineTouchMove);
    window.addEventListener('touchend', handleTimelineTouchEnd);
    window.addEventListener('touchcancel', handleTimelineTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTimelineTouchMove);
      window.removeEventListener('touchend', handleTimelineTouchEnd);
      window.removeEventListener('touchcancel', handleTimelineTouchEnd);
    };
  }, [handleTimelineTouchMove, handleTimelineTouchEnd]);

  return (
    <Box sx={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: '#000000',
      color: 'white',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 1300,
      overflowY: 'auto'
    }}>
      {/* Top Bar */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        bgcolor: '#1a1a1a'
      }}>
        <IconButton onClick={onCancel} sx={{ color: 'white' }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <VibitIcon sx={{ width: 32, height: 32 }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>
          <IconButton 
            onClick={handleUndo} 
            disabled={currentHistoryIndex <= 0}
            sx={{ 
              color: 'white',
              '&.Mui-disabled': {
                color: 'rgba(255,255,255,0.3)'
              }
            }}
          >
            <UndoIcon />
          </IconButton>
          <IconButton 
            onClick={handleRedo}
            disabled={currentHistoryIndex >= history.length - 1}
            sx={{ 
              color: 'white',
              '&.Mui-disabled': {
                color: 'rgba(255,255,255,0.3)'
              }
            }}
          >
            <RedoIcon />
          </IconButton>
          <Button
            variant="contained"
            onClick={handleSaveClick}
            disabled={loading || uploading}
            startIcon={loading ? <CircularProgress size={20} /> : <Save />}
            color="primary"
            sx={{ mr: 1 }}
          >
            {loading ? 'Starting...' : 'Upload'}
          </Button>
          <Button
            variant="outlined"
            onClick={onCancel}
            sx={{ 
              color: 'white',
              borderColor: 'white',
              '&:hover': {
                borderColor: 'white',
                backgroundColor: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            Cancel
          </Button>
        </Box>
      </Box>

      {/* Main Video Area */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#000000'
      }}>
        {/* Video Player */}
        <Box 
          className="video-container"
          sx={{ 
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 2,
            position: 'relative'
          }}
        >
          <video
            ref={videoRef}
            style={{ 
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 300px)',
              objectFit: 'contain'
            }}
          />
          {textOverlays.map(text => (
            <div
              key={text.id}
              style={{
                position: 'absolute',
                left: `${text.position.x}%`,
                top: `${text.position.y}%`,
                transform: `rotate(${text.rotation}deg)`,
                color: text.color,
                fontSize: `${text.fontSize}px`,
                cursor: isDraggingVideo ? 'grabbing' : 'grab',
                userSelect: 'none',
                width: `${text.width}%`,
                height: `${text.height}%`,
                border: selectedText?.id === text.id ? '1px solid #4a90e2' : 'none',
                fontFamily: text.fontFamily,
                fontWeight: text.fontWeight,
                fontStyle: text.fontStyle,
                textDecoration: text.textDecoration,
                WebkitTextStroke: text.borderWidth ? `${text.borderWidth}px ${text.borderColor}` : 'none',
                backgroundColor: text.backgroundColor,
                opacity: text.opacity,
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: selectedText?.id === text.id ? 2 : 1
              }}
              onMouseDown={(e) => handleVideoTextMouseDown(e, text)}
              onDoubleClick={() => handleTextEdit(text)}
              onTouchStart={(e) => handleVideoTextTouchStart(e, text)}
            >
              {text.text}
              {selectedText?.id === text.id && (
                <>
                  <div
                    className="resize-handle"
                    style={{
                      position: 'absolute',
                      right: -5,
                      bottom: -5,
                      width: 10,
                      height: 10,
                      background: '#4a90e2',
                      cursor: 'nwse-resize'
                    }}
                    onMouseDown={(e) => handleResizeMouseDown(e, text)}
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteText(text.id);
                    }}
                    sx={{
                      position: 'absolute',
                      top: -20,
                      right: -20,
                      backgroundColor: 'error.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'error.dark'
                      },
                      width: 24,
                      height: 24,
                      '& .MuiSvgIcon-root': {
                        fontSize: 16
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </>
              )}
            </div>
          ))}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Box>

        {/* Timeline */}
        <Box sx={{ 
          bgcolor: '#1a1a1a', 
          p: 2,
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          {/* Controls */}
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 2
          }}>
            <IconButton onClick={handlePlayPause} sx={{ color: 'white' }}>
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>
            
            {/* Add audio control buttons */}
            <IconButton 
              onClick={handleAudioDetach}
              sx={{ 
                color: 'white',
                bgcolor: isAudioDetached ? 'error.main' : 'transparent'
              }}
            >
              {isAudioDetached ? <VolumeOff /> : <VolumeUp />}
            </IconButton>
            
            {!isAudioDetached && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center',
                width: 100,
                mx: 1
              }}>
                <Slider
                  value={videoVolume}
                  onChange={(_, value) => handleVolumeChange(value as number)}
                  min={0}
                  max={1}
                  step={0.1}
                  sx={{ 
                    color: 'white',
                    '& .MuiSlider-thumb': {
                      width: 16,
                      height: 16
                    }
                  }}
                />
              </Box>
            )}

            <IconButton onClick={handleSplit} sx={{ color: 'white' }}>
              <SplitIcon />
            </IconButton>
            <IconButton onClick={handleCut} sx={{ color: 'white' }}>
              <CutIcon />
            </IconButton>
            <IconButton onClick={() => additionalVideoInputRef.current?.click()} sx={{ color: 'white' }}>
              <AddIcon />
            </IconButton>
            <IconButton onClick={() => setShowTextEditor(true)} sx={{ color: 'white' }}>
              <TextIcon />
            </IconButton>
            <IconButton 
              onClick={handleDelete} 
              sx={{ 
                color: 'white',
                '&.Mui-disabled': {
                  color: 'rgba(255,255,255,0.3)'
                }
              }}
              disabled={!activeSegment || segments.length <= 1}
            >
              <DeleteIcon />
            </IconButton>
          </Box>

          {/* Timeline Frames */}
          <Box
            ref={timelineRef}
            sx={{
              height: 90,
              bgcolor: '#2a2a2a',
              borderRadius: 1,
              overflow: 'hidden',
              cursor: 'pointer',
              position: 'relative'
            }}
            onClick={handleTimelineClick}
          >
            {/* Combined Timeline for Video and Audio */}
            <Box sx={{ 
              position: 'relative',
              height: '100%',
              width: '100%'
            }}>
              {/* Video Segments */}
            {segments.map(segment => (
              <TimelineSegment
                key={segment.id}
                segment={segment}
                duration={duration}
                isActive={segment.id === activeSegment}
                frames={frames}
                onSelect={setActiveSegment}
                  onDragStart={handleSegmentDragStart}
                  onTouchStart={handleSegmentTouchStart}
              />
            ))}

              {/* Audio Segments - Stacked on the timeline */}
              {audioTracks.map((track, index) => (
                <Box
                  key={track.id}
                  sx={{
                    position: 'absolute',
                    left: `${(track.startTime / duration) * 100}%`,
                    width: `${(track.duration / duration) * 100}%`,
                    height: '20%', // Fixed height for each audio track
                    bottom: `${getAudioTrackPosition(index)}%`, // Stack tracks from bottom
                    bgcolor: selectedAudioTrack?.id === track.id ? 'primary.main' : 'primary.dark',
                    opacity: 0.7,
                    cursor: 'grab',
                    '&:hover': {
                      opacity: 1,
                      bgcolor: 'primary.main'
                    },
                    '&:active': {
                      cursor: 'grabbing'
                    },
                    borderTop: '2px solid rgba(255,255,255,0.5)',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 4px'
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsAudioDragging(true);
                    setSelectedAudioTrack(track);
                    setDragStartX(e.clientX);
                    setDragStartTime(track.startTime);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setIsAudioDragging(true);
                    setSelectedAudioTrack(track);
                    setDragStartX(e.touches[0].clientX);
                    setDragStartTime(track.startTime);
                  }}
                >
                  <Typography variant="caption" sx={{ 
                    color: 'white', 
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    userSelect: 'none',
                    fontSize: '0.7rem',
                    maxWidth: '80%'
                  }}>
                    {track.name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAudioTracks(prev => prev.filter(t => t.id !== track.id));
                      if (selectedAudioTrack?.id === track.id) {
                        setSelectedAudioTrack(null);
                      }
                    }}
                    sx={{
                      padding: '2px',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: '0.8rem' }} />
                  </IconButton>
                </Box>
              ))}
            </Box>

            {/* Playhead */}
            <Box
              sx={{
                position: 'absolute',
                left: `${(currentTime / duration) * 100}%`,
                top: 0,
                bottom: 0,
                width: 2,
                bgcolor: '#ff0000',
                zIndex: 3,
                transform: 'translateX(-50%)',
                pointerEvents: 'none'
              }}
            />

            {/* Time Labels */}
            <Box sx={{
              position: 'absolute',
              top: -24,
              left: 0,
              right: 0,
              display: 'flex',
              color: 'white',
              fontSize: '12px'
            }}>
              {segments.map(segment => (
                <Box
                  key={segment.id}
                  sx={{
                    position: 'absolute',
                    left: `${(segment.startTime / duration) * 100}%`,
                    transform: 'translateX(-50%)'
                  }}
                >
                  {formatTime(segment.startTime)}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Audio Controls */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            mb: 2
          }}>
            <IconButton 
              onClick={() => audioInputRef.current?.click()}
              sx={{ color: 'white' }}
            >
              <AudioFileIcon />
            </IconButton>
            {/* Add Cut and Split buttons */}
            {selectedAudioTrack && (
              <>
                <IconButton 
                  onClick={() => {
                    if (!selectedAudioTrack) return;
                    
                    // Cut audio at current time
                    const cutTime = currentTime;
                    if (cutTime <= selectedAudioTrack.startTime || cutTime >= selectedAudioTrack.startTime + selectedAudioTrack.duration) {
                      return;
                    }

                    const remainingTracks = [
                      {
                        ...selectedAudioTrack,
                        id: `audio-${Date.now()}-1`,
                        duration: Math.max(selectedAudioTrack.startTime, cutTime - 0.5) - selectedAudioTrack.startTime
                      },
                      {
                        ...selectedAudioTrack,
                        id: `audio-${Date.now()}-2`,
                        startTime: Math.min(selectedAudioTrack.startTime + selectedAudioTrack.duration, cutTime + 0.5),
                        duration: selectedAudioTrack.startTime + selectedAudioTrack.duration - Math.min(selectedAudioTrack.startTime + selectedAudioTrack.duration, cutTime + 0.5)
                      }
                    ];

                    setAudioTracks(prev => [
                      ...prev.filter(t => t.id !== selectedAudioTrack.id),
                      ...remainingTracks
                    ]);
                    setSelectedAudioTrack(remainingTracks[0]);
                  }}
                  sx={{ color: 'white' }}
                >
                  <CutIcon />
                </IconButton>
                <IconButton 
                  onClick={() => {
                    if (!selectedAudioTrack) return;
                    
                    // Split audio at current time
                    const splitTime = currentTime;
                    if (splitTime <= selectedAudioTrack.startTime || splitTime >= selectedAudioTrack.startTime + selectedAudioTrack.duration) {
                      return;
                    }

                    const newTracks = [
                      {
                        ...selectedAudioTrack,
                        id: `audio-${Date.now()}-1`,
                        duration: splitTime - selectedAudioTrack.startTime
                      },
                      {
                        ...selectedAudioTrack,
                        id: `audio-${Date.now()}-2`,
                        startTime: splitTime,
                        duration: selectedAudioTrack.startTime + selectedAudioTrack.duration - splitTime
                      }
                    ];

                    setAudioTracks(prev => [
                      ...prev.filter(t => t.id !== selectedAudioTrack.id),
                      ...newTracks
                    ]);
                    setSelectedAudioTrack(newTracks[0]);
                  }}
                  sx={{ color: 'white' }}
                >
                  <SplitIcon />
                </IconButton>
                <IconButton 
                  onClick={() => {
                    if (!selectedAudioTrack) return;
                    setAudioTracks(prev => prev.filter(t => t.id !== selectedAudioTrack.id));
                    setSelectedAudioTrack(null);
                  }}
                  sx={{ color: 'white' }}
                >
                  <DeleteIcon />
                </IconButton>
              </>
            )}
            <input
              type="file"
              accept="audio/*"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                try {
                  for (const file of Array.from(files)) {
                  const audioUrl = URL.createObjectURL(file);
                  const audio = new Audio(audioUrl);
                  
                  await new Promise((resolve) => {
                    audio.onloadedmetadata = resolve;
                    audio.load();
                  });

                  const newTrack: AudioTrack = {
                      id: `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    file,
                    name: file.name,
                    startTime: currentTime,
                    duration: audio.duration,
                    volume: 1,
                    isMuted: false
                  };

                  setAudioTracks(prev => [...prev, newTrack]);
                  audioElements.current[newTrack.id] = audio;
                  URL.revokeObjectURL(audioUrl);
                  }

                  // Reset the input value to allow adding more files
                  if (audioInputRef.current) {
                    audioInputRef.current.value = '';
                  }
                } catch (error) {
                  console.error('Error adding audio:', error);
                  setError('Failed to add audio track(s)');
                }
              }}
              style={{ display: 'none' }}
              ref={audioInputRef}
              multiple={true}
            />
            {selectedAudioTrack && (
              <>
                <IconButton 
                  onClick={() => {
                    setAudioTracks(prev => prev.map(t =>
                      t.id === selectedAudioTrack.id ? { ...t, isMuted: !t.isMuted } : t
                    ));
                  }}
                  sx={{ color: 'white' }}
                >
                  {selectedAudioTrack.isMuted ? <VolumeOff /> : <VolumeUp />}
                </IconButton>
                <Box sx={{ width: 100 }}>
                  <Slider
                    value={selectedAudioTrack.volume}
                    onChange={(_, value) => {
                      setAudioTracks(prev => prev.map(t =>
                        t.id === selectedAudioTrack.id ? { ...t, volume: value as number } : t
                      ));
                      if (audioElements.current[selectedAudioTrack.id]) {
                        audioElements.current[selectedAudioTrack.id].volume = value as number;
                      }
                    }}
                    min={0}
                    max={1}
                    step={0.1}
                    sx={{ 
                      color: 'white',
                      '& .MuiSlider-thumb': {
                        width: 12,
                        height: 12,
                      }
                    }}
                  />
                </Box>
              </>
            )}
          </Box>

          {/* Text Timeline */}
          <Box 
            sx={{ 
              height: 60, 
              bgcolor: '#2a2a2a', 
              borderRadius: 1, 
              position: 'relative', 
              mb: 2,
              overflowX: 'auto',
              overflowY: 'hidden'
            }}
          >
            <Box sx={{ 
              position: 'relative', 
              height: '100%', 
              width: '100%',
              minWidth: '100%'
            }}>
              {textOverlays.map(text => (
                <Box
                  key={text.id}
                  sx={{
                    position: 'absolute',
                    left: `${(text.startTime / duration) * 100}%`,
                    width: `${(text.duration / duration) * 100}%`,
                    height: '100%',
                    bgcolor: selectedText?.id === text.id ? 'primary.main' : 'primary.dark',
                    opacity: 0.7,
                    cursor: isDraggingTimeline ? 'grabbing' : 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    px: 1,
                    '&:hover': {
                      opacity: 1,
                      bgcolor: 'primary.main'
                    }
                  }}
                  onMouseDown={(e) => handleTimelineTextMouseDown(e, text)}
                  onTouchStart={(e) => handleTimelineTextTouchStart(e, text)}
                >
                  <Typography variant="caption" sx={{ 
                    color: 'white', 
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    userSelect: 'none'
                  }}>
                    {text.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Text Editor Dialog */}
      <Dialog 
        open={showTextEditor} 
        onClose={() => {
          setShowTextEditor(false);
          setSelectedText(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          {selectedText ? 'Edit Text' : 'Add Text'}
          {selectedText && (
            <IconButton
              color="error"
              onClick={() => handleDeleteText(selectedText.id)}
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          )}
        </DialogTitle>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            placeholder="Enter text..."
            defaultValue={selectedText?.text || ''}
            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                const input = e.target as HTMLInputElement;
                if (selectedText) {
                  handleTextUpdate(input.value);
                } else {
                  handleAddText(input.value);
                }
                input.value = '';
              }
            }}
            sx={{ mb: 2 }}
          />
          {selectedText && (
            <>
              <Typography gutterBottom>Font Family</Typography>
              <Select
                fullWidth
                value={selectedText.fontFamily}
                onChange={(e) => {
                  setTextOverlays(prev => prev.map(t =>
                    t.id === selectedText.id ? { ...t, fontFamily: e.target.value } : t
                  ));
                }}
                sx={{ mb: 2 }}
              >
                <MenuItem value="Arial">Arial</MenuItem>
                <MenuItem value="Times New Roman">Times New Roman</MenuItem>
                <MenuItem value="Courier New">Courier New</MenuItem>
                <MenuItem value="Georgia">Georgia</MenuItem>
                <MenuItem value="Verdana">Verdana</MenuItem>
                <MenuItem value="Impact">Impact</MenuItem>
              </Select>

              <Typography gutterBottom>Font Style</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant={selectedText.fontWeight === 'bold' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setTextOverlays(prev => prev.map(t =>
                      t.id === selectedText.id 
                        ? { ...t, fontWeight: t.fontWeight === 'bold' ? 'normal' : 'bold' }
                        : t
                    ));
                  }}
                >
                  B
                </Button>
                <Button
                  variant={selectedText.fontStyle === 'italic' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setTextOverlays(prev => prev.map(t =>
                      t.id === selectedText.id
                        ? { ...t, fontStyle: t.fontStyle === 'italic' ? 'normal' : 'italic' }
                        : t
                    ));
                  }}
                >
                  I
                </Button>
                <Button
                  variant={selectedText.textDecoration === 'underline' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setTextOverlays(prev => prev.map(t =>
                      t.id === selectedText.id
                        ? { ...t, textDecoration: t.textDecoration === 'underline' ? 'none' : 'underline' }
                        : t
                    ));
                  }}
                >
                  U
                </Button>
              </Box>

              <Typography gutterBottom>Text Color</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <input
                  type="color"
                  value={selectedText.color}
                  onChange={(e) => {
                    setTextOverlays(prev => prev.map(t =>
                      t.id === selectedText.id ? { ...t, color: e.target.value } : t
                    ));
                  }}
                />
              </Box>

              <Typography gutterBottom>Text Border</Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <Slider
                  value={selectedText.borderWidth}
                  min={0}
                  max={5}
                  step={0.5}
                  onChange={(_, value) => {
                    setTextOverlays(prev => prev.map(t =>
                      t.id === selectedText.id ? { ...t, borderWidth: value as number } : t
                    ));
                  }}
                  sx={{ flex: 1 }}
                />
                <input
                  type="color"
                  value={selectedText.borderColor}
                  onChange={(e) => {
                    setTextOverlays(prev => prev.map(t =>
                      t.id === selectedText.id ? { ...t, borderColor: e.target.value } : t
                    ));
                  }}
                />
              </Box>

              <Typography gutterBottom>Background Color</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                <input
                  type="color"
                  value={selectedText.backgroundColor === 'transparent' ? '#000000' : selectedText.backgroundColor}
                  onChange={(e) => {
                    setTextOverlays(prev => prev.map(t =>
                      t.id === selectedText.id ? { ...t, backgroundColor: e.target.value } : t
                    ));
                  }}
                />
                <Button
                  variant={selectedText.backgroundColor === 'transparent' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setTextOverlays(prev => prev.map(t =>
                      t.id === selectedText.id
                        ? { ...t, backgroundColor: t.backgroundColor === 'transparent' ? '#000000' : 'transparent' }
                        : t
                    ));
                  }}
                >
                  Transparent
                </Button>
              </Box>

              <Typography gutterBottom>Opacity</Typography>
              <Slider
                value={selectedText.opacity}
                min={0.1}
                max={1}
                step={0.1}
                onChange={(_, value) => {
                  setTextOverlays(prev => prev.map(t =>
                    t.id === selectedText.id ? { ...t, opacity: value as number } : t
                  ));
                }}
                valueLabelDisplay="auto"
                sx={{ mb: 2 }}
              />

              <Typography gutterBottom>Duration (seconds)</Typography>
              <Slider
                value={selectedText.duration}
                min={1}
                max={30}
                onChange={(_, value) => {
                  setTextOverlays(prev => prev.map(t =>
                    t.id === selectedText.id ? { ...t, duration: value as number } : t
                  ));
                }}
                valueLabelDisplay="auto"
                sx={{ mb: 2 }}
              />

              <Typography gutterBottom>Font Size</Typography>
              <Slider
                value={selectedText.fontSize}
                min={12}
                max={72}
                onChange={(_, value) => {
                  setTextOverlays(prev => prev.map(t =>
                    t.id === selectedText.id ? { ...t, fontSize: value as number } : t
                  ));
                }}
                valueLabelDisplay="auto"
              />
            </>
          )}
        </Box>
      </Dialog>

      {/* Hidden file inputs */}
      <input
        type="file"
        accept="video/*"
        onChange={handleAddVideo}
        style={{ display: 'none' }}
        ref={additionalVideoInputRef}
        multiple={true}
      />
      <input
        type="file"
        accept="audio/*"
        onChange={async (e) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;

          try {
            for (const file of Array.from(files)) {
              const audioUrl = URL.createObjectURL(file);
              const audio = new Audio(audioUrl);
              
              await new Promise((resolve) => {
                audio.onloadedmetadata = resolve;
                audio.load();
              });

              const newTrack: AudioTrack = {
                id: `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                name: file.name,
                startTime: currentTime,
                duration: audio.duration,
                volume: 1,
                isMuted: false
              };

              setAudioTracks(prev => [...prev, newTrack]);
              audioElements.current[newTrack.id] = audio;
              URL.revokeObjectURL(audioUrl);
            }

            // Reset the input value to allow adding more files
            if (audioInputRef.current) {
              audioInputRef.current.value = '';
            }
          } catch (error) {
            console.error('Error adding audio:', error);
            setError('Failed to add audio track(s)');
          }
        }}
        style={{ display: 'none' }}
        ref={audioInputRef}
        multiple={true}
      />

      {/* Upload Progress Dialog */}
      {loading && (
        <Dialog open={loading} maxWidth="sm" fullWidth>
          <DialogContent>
            <Typography variant="h6" gutterBottom>
              Uploading Video...
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={loading ? 0 : 100} 
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Typography variant="body2" align="center" sx={{ mt: 1, mb: 2 }}>
              {Math.round(loading ? 0 : 100)}%
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="error"
                onClick={onCancel}
              >
                Cancel Upload
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      )}

      {error && (
        <Alert severity="error" sx={{ position: 'absolute', top: 16, left: 16, right: 16 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default VideoEditor; 