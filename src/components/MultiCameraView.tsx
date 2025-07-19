import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { CCTVService } from '../services/CCTVService';
// CCTV styles are now included in the main design system

interface MultiCameraViewProps {
  targetTimestamp: number;
  onError?: (error: string) => void;
  isSearching?: boolean;
  itemName?: string;
  onClose?: () => void;
}

interface CameraState {
  id: number;
  data: {
    videos: { [key: string]: string };
    timestamps: { [key: string]: number };
    closestIndex: number;
    cameraAvailable?: boolean;
    cameraError?: string | null;
  } | null;
  loading: boolean;
  error: string | null;
}

interface SyncData {
  cameraId: number;
  videoUrl: string;
  videoTimestamp: number;
  syncOffset: number;
  syncTime: number;
}

interface TimelineSegment {
  timestamp: number;
  videoUrl: string;
  cameraId: number;
  startTime: number;
  endTime: number;
  duration: number;
}

interface TimelineData {
  segments: TimelineSegment[];
  minTimestamp: number;
  maxTimestamp: number;
  totalDuration: number;
  currentPosition: number;
}

const MultiCameraView: React.FC<MultiCameraViewProps> = ({ 
  targetTimestamp, 
  onError,
  isSearching,
  itemName,
  onClose
}) => {
  const [cameras, setCameras] = useState<CameraState[]>([
    { id: 1, data: null, loading: false, error: null },
    { id: 2, data: null, loading: false, error: null },
    { id: 3, data: null, loading: false, error: null },
    { id: 4, data: null, loading: false, error: null },
    { id: 5, data: null, loading: false, error: null },
    { id: 6, data: null, loading: false, error: null },
  ]);
  const [currentVideoOffset, setCurrentVideoOffset] = useState(0); // Offset from target timestamp
  const [isPlaying, setIsPlaying] = useState(false);
  const [videosReadyCount, setVideosReadyCount] = useState(0);
  const [currentTimestamp, setCurrentTimestamp] = useState(targetTimestamp);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTimestamp, setHoverTimestamp] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const navigationTimeoutRef = useRef<number | null>(null);
  const playRequestRef = useRef<boolean>(false);
  const endTransitionRef = useRef<boolean>(false);
  const videoElementsRef = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const autoPlayTriggered = useRef(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const cctvService = useRef(new CCTVService()).current;

  // Preload video function
  const preloadVideo = useCallback(async (videoUrl: string) => {
    if (!videoUrl) return;
    
    try {
      // Skip preloading for URLs that are already our local cache
      if (videoUrl.includes('/static/cache/videos/')) {
        console.log('🚫 Skipping preload for cached URL:', videoUrl);
        return;
      }
      
      // Validate URL before creating URL object
      if (!videoUrl.startsWith('http') && !videoUrl.startsWith('/')) {
        console.warn('⚠️ Invalid video URL format:', videoUrl);
        return;
      }
      
      // Extract path from full URL
      const url = new URL(videoUrl, window.location.origin);
      const videoPath = url.pathname;
      
      console.log('🔄 Preloading video:', videoPath);
      
      const response = await fetch('/api/cache/preload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Video preloaded successfully:', result.videoPath);
      } else {
        console.warn('⚠️ Video preload failed:', result.error);
      }
    } catch (error) {
      console.warn('❌ Preload request failed:', error);
    }
  }, []);

  const loadAllCameras = useCallback(async () => {
    setCameras(prev => prev.map(cam => ({ ...cam, loading: true, error: null })));
    setVideosReadyCount(0);
    autoPlayTriggered.current = false;
    
    const cameraIds = [1, 2, 3, 4, 5, 6];
    const loadPromises = cameraIds.map(async (cameraId) => {
      try {
        const response = await cctvService.getVideos(targetTimestamp, cameraId);
        
        // Preload the target video (closest to timestamp) immediately
        if (response.videos && response.closestIndex !== undefined) {
          const videoEntries = Object.entries(response.videos).sort((a, b) => 
            response.timestamps[a[0]] - response.timestamps[b[0]]
          );
          const targetVideoUrl = videoEntries[response.closestIndex]?.[1];
          
          if (targetVideoUrl) {
            // Fire and forget - don't wait for preload to complete
            preloadVideo(targetVideoUrl).catch(() => {
              // Silent fail - preload is optimization, not critical
            });
          }
        }
        
        return {
          id: cameraId,
          data: {
            videos: response.videos,
            timestamps: response.timestamps,
            closestIndex: response.closestIndex,
            cameraAvailable: response.cameraStatus?.cameraAvailable ?? true,
            cameraError: response.cameraStatus?.cameraError ?? null
          },
          loading: false,
          error: null
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load camera';
        onError?.(errorMessage);
        return {
          id: cameraId,
          data: null,
          loading: false,
          error: errorMessage
        };
      }
    });

    const results = await Promise.all(loadPromises);
    setCameras(results);
  }, [targetTimestamp, cctvService, onError, preloadVideo]);

  useEffect(() => {
    loadAllCameras();
  }, [loadAllCameras]);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const getSortedVideoEntries = useCallback((cameraId: number) => {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera?.data) return [];
    
    return Object.entries(camera.data.videos).sort((a, b) => 
      camera.data!.timestamps[a[0]] - camera.data!.timestamps[b[0]]
    );
  }, [cameras]);

  const getCurrentVideoUrl = useCallback((cameraId: number) => {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera?.data) return null;
    
    const videoEntries = getSortedVideoEntries(cameraId);
    
    // Find the video that contains the current timestamp
    let bestIndex = 0;
    let bestDiff = Infinity;
    
    videoEntries.forEach(([key, videoUrl], index) => {
      const videoTimestamp = camera.data!.timestamps[key];
      const diff = Math.abs(currentTimestamp - videoTimestamp);
      
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = index;
      }
    });
      
    return videoEntries[bestIndex]?.[1] || null;
  }, [cameras, currentTimestamp, getSortedVideoEntries]);

  const getCurrentTimestamp = useCallback((cameraId: number) => {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera?.data) return null;
    
    const videoEntries = getSortedVideoEntries(cameraId);
    
    // Find the video that contains the current timestamp
    let bestIndex = 0;
    let bestDiff = Infinity;
    
    videoEntries.forEach(([key, videoUrl], index) => {
      const videoTimestamp = camera.data!.timestamps[key];
      const diff = Math.abs(currentTimestamp - videoTimestamp);
      
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = index;
      }
    });
      
    const videoEntry = videoEntries[bestIndex];
    
    return videoEntry ? camera.data.timestamps[videoEntry[0]] : null;
  }, [cameras, currentTimestamp, getSortedVideoEntries]);

  const getTotalVideos = () => {
    return Math.max(...cameras.map(camera => 
      camera.data ? Object.keys(camera.data.videos).length : 0
    ));
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  const formatFullTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('fr-FR');
  };

  // Calculate timeline data from all cameras - memoized for performance
  const calculateTimelineData = useMemo((): TimelineData | null => {
    const allSegments: TimelineSegment[] = [];
    
    // Limit to 1 hour around target (30 minutes before and after)
    const oneHourBefore = targetTimestamp - 1800; // 30 minutes before
    const oneHourAfter = targetTimestamp + 1800;  // 30 minutes after
    
    cameras.forEach(camera => {
      if (camera.data) {
        const videoEntries = Object.entries(camera.data.videos).sort((a, b) => 
          camera.data!.timestamps[a[0]] - camera.data!.timestamps[b[0]]
        );
        
        videoEntries.forEach(([key, videoUrl]) => {
          const timestamp = camera.data!.timestamps[key];
          
          // Only include videos within 1 hour of target
          if (timestamp >= oneHourBefore && timestamp <= oneHourAfter) {
            const duration = 120; // Assume 2 minutes per video
            
            allSegments.push({
              timestamp,
              videoUrl,
              cameraId: camera.id,
              startTime: timestamp,
              endTime: timestamp + duration,
              duration
            });
          }
        });
      }
    });
    
    if (allSegments.length === 0) return null;
    
    const timestamps = allSegments.map(s => s.timestamp);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const totalDuration = maxTimestamp - minTimestamp + 120; // Add last video duration
    
    const currentPosition = ((currentTimestamp - minTimestamp) / totalDuration) * 100;
    
    return {
      segments: allSegments,
      minTimestamp,
      maxTimestamp,
      totalDuration,
      currentPosition: Math.max(0, Math.min(100, currentPosition))
    };
  }, [cameras, currentTimestamp, targetTimestamp]);

  // Update timeline data when cameras change (not on every timestamp change)
  useEffect(() => {
    setTimelineData(calculateTimelineData);
  }, [calculateTimelineData]);

  // Calculate sync data for all cameras - memoized for performance
  const calculateSyncData = useMemo((): SyncData[] => {
    const syncData: SyncData[] = [];
    
    cameras.forEach(camera => {
      if (camera.data) {
        const videoUrl = getCurrentVideoUrl(camera.id);
        const videoTimestamp = getCurrentTimestamp(camera.id);
        
        if (videoUrl && videoTimestamp) {
          // Calculate how far into the video we should be
          const syncOffset = currentTimestamp - videoTimestamp;
          
          // Each video is 2 minutes (120 seconds)
          // syncOffset should be between 0 and 119 seconds
          let syncTime = syncOffset;
          
          // If we're beyond this video's duration, we need the next video
          if (syncTime >= 120) {
            // We're beyond this video, should be at the next one
            syncTime = 119; // Stay at end until next video loads
          } else if (syncTime < 0) {
            // We're before this video started
            syncTime = 0;
          }
          
          console.log(`📊 Camera ${camera.id}: currentTimestamp=${currentTimestamp}, videoTimestamp=${videoTimestamp}, syncOffset=${syncOffset}, syncTime=${syncTime}`);
          
          syncData.push({
            cameraId: camera.id,
            videoUrl,
            videoTimestamp,
            syncOffset,
            syncTime
          });
        }
      }
    });
    
    return syncData;
  }, [cameras, currentTimestamp, getCurrentVideoUrl, getCurrentTimestamp]);

  // Apply synchronization to all videos
  const syncAllVideos = useCallback(() => {
    console.log('🔄 Synchronizing videos to current timestamp:', currentTimestamp);
    
    calculateSyncData.forEach(({ cameraId, syncTime, syncOffset }) => {
      const videoElement = videoElementsRef.current[cameraId];
      
      if (videoElement) {
        // Only sync if the video is ready
        if (videoElement.readyState >= 2 && videoElement.duration > 0) {
          // Make sure we don't go past the video duration
          const timeToSet = Math.min(syncTime, videoElement.duration - 0.5); // Leave 0.5s buffer
          videoElement.currentTime = timeToSet;
          console.log(`📹 Camera ${cameraId}: set currentTime to ${timeToSet}s (syncTime=${syncTime}s, videoDuration=${videoElement.duration}s)`);
        } else {
          console.log(`⚠️ Camera ${cameraId}: Not ready for sync (readyState=${videoElement.readyState})`);
        }
      }
    });
  }, [calculateSyncData, currentTimestamp]);

  // Navigate to specific timestamp - debounced for performance
  const navigateToTimestamp = useCallback((timestamp: number) => {
    console.log(`🎯 Navigating to timestamp: ${timestamp}`);
    
    // Clear any pending navigation
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    // Debounce rapid navigation calls
    navigationTimeoutRef.current = setTimeout(() => {
      setCurrentTimestamp(timestamp);
      
      // Always pause videos first
      setIsPlaying(false);
      Object.values(videoElementsRef.current).forEach(video => {
        if (video) {
          video.pause();
        }
      });
      
      // Apply synchronization without reloading videos if within same segment
      const needsVideoChange = cameras.some(camera => {
        if (!camera.data) return false;
        
        const videoElement = videoElementsRef.current[camera.id];
        if (!videoElement) return false;
        
        const currentVideoTimestamp = getCurrentTimestamp(camera.id);
        if (!currentVideoTimestamp) return false;
        
        // Check if new timestamp requires different video
        const timeDiff = Math.abs(timestamp - currentVideoTimestamp);
        return timeDiff > 120; // Only change video if > 2 minutes difference
      });
      
      if (needsVideoChange) {
        console.log('🔄 Video change needed, updating sources');
        
        // Reset video ready count
        setVideosReadyCount(0);
        autoPlayTriggered.current = false;
        
        // Only reload videos if necessary
        cameras.forEach(camera => {
          if (camera.data) {
            const videoEntries = Object.entries(camera.data.videos).sort((a, b) => 
              camera.data!.timestamps[a[0]] - camera.data!.timestamps[b[0]]
            );
            
            // Find closest video to this timestamp
            let closestIndex = 0;
            let closestDiff = Infinity;
            
            videoEntries.forEach(([key, videoUrl], index) => {
              const videoTimestamp = camera.data!.timestamps[key];
              const diff = Math.abs(timestamp - videoTimestamp);
              
              if (diff < closestDiff) {
                closestDiff = diff;
                closestIndex = index;
              }
            });
            
            // Update the video source only if different
            const videoElement = videoElementsRef.current[camera.id];
            if (videoElement) {
              const newVideoUrl = videoEntries[closestIndex][1];
              if (videoElement.src !== newVideoUrl) {
                console.log(`📹 Changing video source for camera ${camera.id}: ${newVideoUrl}`);
                videoElement.src = newVideoUrl;
                videoElement.load();
              }
            }
          }
        });
        
        // Wait for videos to load before syncing and auto-playing
        setTimeout(() => {
          syncAllVideos();
          // Auto-play after video change
          setTimeout(() => {
            console.log('🔄 Auto-playing after video change');
            setIsPlaying(true);
            
            // Get available videos and play them
            const availableVideos = Object.entries(videoElementsRef.current)
              .filter(([cameraId, video]) => {
                const camera = cameras.find(c => c.id === parseInt(cameraId));
                const isAvailable = camera?.data?.cameraAvailable !== false;
                const hasVideo = video && video.src && !video.src.includes('videoerror.mp4');
                return isAvailable && hasVideo;
              })
              .map(([, video]) => video)
              .filter(Boolean);
            
            availableVideos.forEach(async (video) => {
              if (video) {
                try {
                  await video.play();
                  console.log(`✅ Auto-play started for video: ${video.src}`);
                } catch (err) {
                  console.error('Auto-play failed:', err);
                }
              }
            });
          }, 500);
        }, 800);
      } else {
        // Just sync without changing videos
        syncAllVideos();
      }
    }, 100); // 100ms debounce
  }, [cameras, syncAllVideos, getCurrentTimestamp]);

  // Navigate to previous/next video set with synchronization
  const navigateWithSync = useCallback((direction: 'prev' | 'next') => {
    if (!timelineData) return;
    
    const step = 120; // 2 minutes step
    const newTimestamp = direction === 'prev' ? 
      currentTimestamp - step : currentTimestamp + step;
    
    // Check bounds - limit to 1 hour around target
    const oneHourBefore = targetTimestamp - 1800;
    const oneHourAfter = targetTimestamp + 1800;
    
    if (newTimestamp < oneHourBefore || newTimestamp > oneHourAfter) {
      console.log('⚠️ Navigation out of bounds (1 hour limit)');
      return;
    }
    
    navigateToTimestamp(newTimestamp);
  }, [currentTimestamp, timelineData, navigateToTimestamp, targetTimestamp]);

  // Handle timeline click
  const handleTimelineClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineData || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    
    const newTimestamp = timelineData.minTimestamp + (percentage / 100) * timelineData.totalDuration;
    navigateToTimestamp(Math.round(newTimestamp));
  }, [timelineData, navigateToTimestamp]);

  // Handle timeline drag - throttled to prevent too many calls
  const handleTimelineDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !timelineData) return;
    
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const dragX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (dragX / rect.width) * 100));
    
    const newTimestamp = timelineData.minTimestamp + (percentage / 100) * timelineData.totalDuration;
    
    // Only navigate if timestamp changed significantly (reduces spam)
    const currentTs = getCurrentTimestamp(1) || currentTimestamp;
    if (Math.abs(newTimestamp - currentTs) > 5) { // 5 second threshold
      navigateToTimestamp(Math.round(newTimestamp));
    }
  }, [isDragging, timelineData, navigateToTimestamp, getCurrentTimestamp, currentTimestamp]);

  // Handle timeline hover with debouncing
  const handleTimelineHover = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineData || !timelineRef.current) return;
    
    // Clear previous timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Debounce hover updates to reduce performance impact
    hoverTimeoutRef.current = setTimeout(() => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const hoverX = event.clientX - rect.left;
      const percentage = (hoverX / rect.width) * 100;
      
      const hoverTimestamp = timelineData.minTimestamp + (percentage / 100) * timelineData.totalDuration;
      setHoverTimestamp(Math.round(hoverTimestamp));
    }, 50); // 50ms debounce
  }, [timelineData]);

  const getCurrentPosition = () => {
    // Limited to 10 clips range (±5 from target)
    const availableRange = Math.min(10, cameras.reduce((max, camera) => {
      if (!camera.data) return max;
      const videoEntries = getSortedVideoEntries(camera.id);
      return Math.max(max, videoEntries.length);
    }, 0));
    
    const currentPosition = Math.max(0, Math.min(
      5 + currentVideoOffset, // 5 is the center position (target)
      availableRange - 1
    ));
    
    return { current: currentPosition + 1, total: availableRange };
  };

  const handlePlayPause = useCallback(async () => {
    // Prevent overlapping play requests
    if (playRequestRef.current) {
      console.log('⚠️ Play request already in progress, skipping');
      return;
    }
    
    // Only get videos from available cameras
    const availableVideos = Object.entries(videoElementsRef.current)
      .filter(([cameraId, video]) => {
        const camera = cameras.find(c => c.id === parseInt(cameraId));
        const isAvailable = camera?.data?.cameraAvailable !== false;
        const hasVideo = video && video.src && !video.src.includes('videoerror.mp4');
        return isAvailable && hasVideo;
      })
      .map(([, video]) => video)
      .filter(Boolean);
    
    console.log(`🎬 handlePlayPause: Found ${availableVideos.length} available videos out of ${Object.keys(videoElementsRef.current).length} total`);
    
    if (!isPlaying) {
      playRequestRef.current = true;
      setIsPlaying(true);
      
      // Apply synchronization BEFORE starting playback
      syncAllVideos();
      
      // Safari needs sequential playback with forced loading
      for (const video of availableVideos) {
        if (video) {
          try {
            // Force load if not ready
            if (video.readyState < 2) {
              video.load();
              await new Promise(resolve => {
                const handler = () => {
                  video.removeEventListener('loadeddata', handler);
                  resolve(undefined);
                };
                video.addEventListener('loadeddata', handler);
                // Timeout to prevent hanging
                setTimeout(() => {
                  video.removeEventListener('loadeddata', handler);
                  resolve(undefined);
                }, 2000);
              });
            }
            
            await video.play();
            console.log(`✅ Video ${video.src} started`);
            // Small delay for Safari compatibility
            await new Promise(resolve => setTimeout(resolve, 150));
          } catch (err) {
            console.error('Play failed:', err);
            // Continue with other videos even if one fails
          }
        }
      }
      
      // Re-sync after all videos have started (to handle timing drift)
      setTimeout(() => {
        syncAllVideos();
      }, 500);
      
      playRequestRef.current = false;
      
    } else {
      setIsPlaying(false);
      availableVideos.forEach(video => {
        if (video) {
          video.pause();
        }
      });
    }
  }, [cameras, isPlaying, getCurrentVideoUrl, syncAllVideos]);

  const handleVideoEnded = useCallback(() => {
    console.log('🎬 Video ended, moving to next video');
    
    // Move to next video chunk (2 minutes forward)
    const nextTimestamp = currentTimestamp + 120; // 2 minutes forward
    
    // Check if we have videos for this timestamp
    const hasNextVideo = cameras.some(camera => {
      if (!camera.data) return false;
      
      const videoEntries = Object.entries(camera.data.videos).sort((a, b) => 
        camera.data!.timestamps[a[0]] - camera.data!.timestamps[b[0]]
      );
      
      // Check if we have a video close to the next timestamp
      return videoEntries.some(([key, videoUrl]) => {
        const videoTimestamp = camera.data!.timestamps[key];
        return Math.abs(nextTimestamp - videoTimestamp) <= 120; // Within 2 minutes
      });
    });
    
    if (hasNextVideo) {
      console.log(`🎯 Moving to next video at timestamp: ${nextTimestamp}`);
      navigateToTimestamp(nextTimestamp);
    } else {
      console.log('⏹️ No more videos available, stopping playback');
      setIsPlaying(false);
    }
  }, [currentTimestamp, cameras, navigateToTimestamp]);

  // Create video elements once - only for available cameras
  useEffect(() => {
    const videoElements = videoElementsRef.current;
    
    cameras.forEach(camera => {
      // Skip creating video elements for unavailable cameras
      if (camera.data?.cameraAvailable === false) {
        return;
      }
      
      if (!videoElements[camera.id]) {
        const videoElement = document.createElement('video');
        videoElement.controls = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.preload = 'none'; // Don't preload until needed
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        // Add ended event listener for auto-progression
        videoElement.addEventListener('ended', handleVideoEnded);
        
        // Add timeupdate to debug video timing
        videoElement.addEventListener('timeupdate', () => {
          // Debug: log current time occasionally
          if (Math.floor(videoElement.currentTime) % 10 === 0 && videoElement.currentTime > 0) {
            console.log(`📹 Camera ${camera.id}: currentTime=${videoElement.currentTime.toFixed(1)}s/${videoElement.duration.toFixed(1)}s`);
          }
        });
        
        // Auto-play detection - when video can play through
        videoElement.addEventListener('canplaythrough', () => {
          setVideosReadyCount(prev => prev + 1);
        });
        
        videoElements[camera.id] = videoElement;
      }
    });
    
    // Cleanup function to remove event listeners
    return () => {
      Object.values(videoElements).forEach(videoElement => {
        if (videoElement) {
          videoElement.removeEventListener('ended', handleVideoEnded);
          videoElement.pause(); // Ensure videos are paused
        }
      });
    };
  }, [cameras, handleVideoEnded]);
  
  // Update video sources separately - only for available cameras
  useEffect(() => {
    setVideosReadyCount(0); // Reset ready count when sources change
    autoPlayTriggered.current = false;
    
    cameras.forEach(camera => {
      // Skip updating video sources for unavailable cameras
      if (camera.data?.cameraAvailable === false) {
        return;
      }
      
      const videoElement = videoElementsRef.current[camera.id];
      const videoUrl = getCurrentVideoUrl(camera.id);
      
      if (videoElement && videoUrl && videoElement.src !== videoUrl) {
        console.log(`🎬 Setting video source for camera ${camera.id}: ${videoUrl}`);
        
        // Clear any pending play requests
        playRequestRef.current = false;
        
        // Safari fix: pause, clear, set source, then load
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load(); // Clear previous
        
        // Add error handling
        videoElement.onerror = (e) => {
          console.error(`❌ Video error for camera ${camera.id}:`, e);
          console.error('Video element error:', videoElement.error);
        };
        
        videoElement.onloadstart = () => {
          console.log(`📼 Video load started for camera ${camera.id}`);
        };
        
        videoElement.oncanplay = () => {
          console.log(`✅ Video can play for camera ${camera.id}`);
        };
        
        videoElement.src = videoUrl;
        videoElement.load(); // Load new source - forces Safari to show video
      }
    });
  }, [cameras, getCurrentVideoUrl]);

  // Auto-play when all videos are ready (Chrome mainly) - only count available cameras
  useEffect(() => {
    const validCamerasCount = cameras.filter(cam => {
      if (!cam.data || cam.data.cameraAvailable === false) {
        return false;
      }
      const videoUrl = getCurrentVideoUrl(cam.id);
      return videoUrl && !videoUrl.includes('videoerror.mp4');
    }).length;
    
    if (videosReadyCount >= validCamerasCount && validCamerasCount > 0 && !autoPlayTriggered.current && !isPlaying && !playRequestRef.current) {
      console.log(`🎬 Auto-play: ${videosReadyCount}/${validCamerasCount} videos ready`);
      autoPlayTriggered.current = true;
      
      // Small delay then auto-play
      setTimeout(() => {
        handlePlayPause();
      }, 500);
    }
  }, [videosReadyCount, cameras, isPlaying, getCurrentVideoUrl]);

  const goToPrevious = useCallback(() => {
    navigateWithSync('prev');
    
    // Preload next previous video for smooth navigation
    setTimeout(() => {
      cameras.forEach(camera => {
        if (camera.data) {
          const videoEntries = getSortedVideoEntries(camera.id);
          const nextIndex = camera.data.closestIndex + currentVideoOffset - 2;
          if (nextIndex >= 0 && nextIndex < videoEntries.length) {
            const nextVideoUrl = videoEntries[nextIndex]?.[1];
            if (nextVideoUrl) {
              preloadVideo(nextVideoUrl).catch(() => {});
            }
          }
        }
      });
    }, 100);
  }, [navigateWithSync, cameras, currentVideoOffset, getSortedVideoEntries, preloadVideo]);

  const goToNext = useCallback(() => {
    navigateWithSync('next');
    
    // Preload next video for smooth navigation
    setTimeout(() => {
      cameras.forEach(camera => {
        if (camera.data) {
          const videoEntries = getSortedVideoEntries(camera.id);
          const nextIndex = camera.data.closestIndex + currentVideoOffset + 2;
          if (nextIndex < videoEntries.length) {
            const nextVideoUrl = videoEntries[nextIndex]?.[1];
            if (nextVideoUrl) {
              preloadVideo(nextVideoUrl).catch(() => {});
            }
          }
        }
      });
    }, 100);
  }, [navigateWithSync, cameras, currentVideoOffset, getSortedVideoEntries, preloadVideo]);

  // Helper function to check if we can navigate (limited to ±5 clips)
  const canGoToPrevious = useCallback(() => {
    return currentVideoOffset > -5 && cameras.some(camera => {
      if (!camera.data) return false;
      const targetIndex = camera.data.closestIndex + currentVideoOffset - 1;
      return targetIndex >= 0;
    });
  }, [cameras, currentVideoOffset]);

  const canGoToNext = useCallback(() => {
    return currentVideoOffset < 5 && cameras.some(camera => {
      if (!camera.data) return false;
      const videoEntries = getSortedVideoEntries(camera.id);
      const targetIndex = camera.data.closestIndex + currentVideoOffset + 1;
      return targetIndex < videoEntries.length;
    });
  }, [cameras, currentVideoOffset, getSortedVideoEntries]);

  // Progress bar click navigation (limited to ±5 clips)
  const handleProgressClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const progressWidth = rect.width;
    const clickPercent = clickX / progressWidth;
    
    // Convert percentage to offset (-5 to +5)
    const newOffset = Math.round((clickPercent - 0.5) * 10); // 10 clips total range
    const clampedOffset = Math.max(-5, Math.min(5, newOffset));
    
    // Check if this offset is valid
    const validOffset = cameras.some(camera => {
      if (!camera.data) return false;
      const videoEntries = getSortedVideoEntries(camera.id);
      const targetIndex = camera.data.closestIndex + clampedOffset;
      return targetIndex >= 0 && targetIndex < videoEntries.length;
    });
    
    if (validOffset) {
      setCurrentVideoOffset(clampedOffset);
    }
  }, [cameras, getSortedVideoEntries]);

  // Progress bar drag navigation
  const progressRef = useRef<HTMLDivElement>(null);
  
  const handleProgressMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressClick(event);
  }, [handleProgressClick]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging || !progressRef.current) return;
      
      const rect = progressRef.current.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const progressWidth = rect.width;
      const clickPercent = Math.max(0, Math.min(1, clickX / progressWidth));
      
      const newOffset = Math.round((clickPercent - 0.5) * 10); // 10 clips total range
      const clampedOffset = Math.max(-5, Math.min(5, newOffset));
      
      const validOffset = cameras.some(camera => {
        if (!camera.data) return false;
        const videoEntries = getSortedVideoEntries(camera.id);
        const targetIndex = camera.data.closestIndex + clampedOffset;
        return targetIndex >= 0 && targetIndex < videoEntries.length;
      });
      
      if (validOffset) {
        setCurrentVideoOffset(clampedOffset);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, cameras, getTotalVideos, getSortedVideoEntries]);

  // Keyboard and mouse navigation for timeshift
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          if (canGoToPrevious()) {
            goToPrevious();
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (canGoToNext()) {
            goToNext();
          }
          break;
        case ' ':
          event.preventDefault();
          handlePlayPause();
          break;
        case 'Home':
          event.preventDefault();
          setCurrentVideoOffset(0);
          break;
      }
    };

    // Mouse wheel navigation disabled per user request

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canGoToPrevious, canGoToNext, goToPrevious, goToNext, handlePlayPause]);

  // Timeline segments component - memoized for performance
  const TimelineSegments = React.memo<{ segments: TimelineSegment[]; minTimestamp: number; totalDuration: number }>(({ segments, minTimestamp, totalDuration }) => {
    return (
      <>
        {segments.map((segment, index) => {
          const left = ((segment.startTime - minTimestamp) / totalDuration) * 100;
          const width = (segment.duration / totalDuration) * 100;
          
          return (
            <div
              key={`${segment.cameraId}-${index}`}
              className={`timeline-segment camera-${segment.cameraId}`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
              }}
              title={`Camera ${segment.cameraId}: ${formatTimestamp(segment.startTime)}`}
            />
          );
        })}
      </>
    );
  });

  // Video container component
  const VideoContainer: React.FC<{ cameraId: number }> = ({ cameraId }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const camera = cameras.find(c => c.id === cameraId);
    
    useEffect(() => {
      const container = containerRef.current;
      const videoElement = videoElementsRef.current[cameraId];
      
      if (container && videoElement && !container.contains(videoElement)) {
        container.appendChild(videoElement);
      }
      
      return () => {
        if (container && videoElement && container.contains(videoElement)) {
          container.removeChild(videoElement);
        }
      };
    }, [cameraId]);
    
    return (
      <div className="camera-slot">
        <div className="camera-label">CAM {cameraId}</div>
        
        <div ref={containerRef}>
          {!camera?.data && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: '#666'
            }}>
              <div>📹</div>
              <div style={{fontSize: '0.8em', marginTop: '5px'}}>En attente...</div>
            </div>
          )}
        </div>
        
        {camera?.data && (
          <div className="camera-status live">
            {getCurrentTimestamp(cameraId) 
              ? formatTimestamp(getCurrentTimestamp(cameraId)!) 
              : 'LIVE'
            }
          </div>
        )}
        
        {camera?.loading && (
          <div className="camera-status">
            <div className="loading-spinner"></div>
            LOADING
          </div>
        )}
        
        {camera?.error && (
          <div className="camera-status error">ERROR</div>
        )}
      </div>
    );
  };

  if (isSearching) {
    return (
      <div className="search-container">
        <div className="search-icon">
          <div className="loading-spinner"></div>
        </div>
        <h3 className="search-title">Chargement des 6 caméras...</h3>
        <p className="search-subtitle">
          Connexion aux flux vidéo en cours • Synchronisation multi-caméras
        </p>
        <div className="search-dots">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="search-dot" style={{animationDelay: `${i * 0.1}s`}}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Unified Header */}
      <div className="modal-header">
        <div className="modal-title-section">
          <h2 className="modal-title">
            📹 {itemName || 'CCTV Surveillance'}
          </h2>
          <div className="sync-info">
            <span className="offset-display">
              Video: {getCurrentPosition().current}/{getCurrentPosition().total} • 
              Offset: {currentVideoOffset >= 0 ? '+' : ''}{currentVideoOffset} 
              {currentVideoOffset === 0 && ' (Target)'}
            </span>
            {cameras.some(c => c.data) && (
              <span style={{marginLeft: '10px', color: '#888', fontSize: '0.9em'}}>
                {formatFullTimestamp(getCurrentTimestamp(1) || targetTimestamp)}
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="modal-close"
          >
            ✕ CLOSE
          </button>
        )}
      </div>
        
        {/* Controls */}
        <div className="video-controls">
          <div className="controls-row">
            <button 
              onClick={goToPrevious}
              disabled={!canGoToPrevious()}
              className="control-button"
              title="Précédent (Flèche gauche)"
            >
              ⏮️ Précédent
            </button>
            
            <button 
              onClick={handlePlayPause}
              className="control-button play"
              title="Play/Pause (Barre d'espace)"
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'} Toutes
            </button>
            
            <button 
              onClick={goToNext}
              disabled={!canGoToNext()}
              className="control-button"
              title="Suivant (Flèche droite)"
            >
              Suivant ⏭️
            </button>
            
            {currentVideoOffset !== 0 && (
              <button 
                onClick={() => {
                  setCurrentVideoOffset(0);
                  setTimeout(() => syncAllVideos(), 100);
                }}
                className="control-button target"
                title="Retour à la position cible (Home)"
              >
                🎯 Retour Target
              </button>
            )}
            
            <button 
              onClick={syncAllVideos}
              className="control-button sync"
              title="Forcer la synchronisation"
            >
              🔄 Sync
            </button>
            
            <div className="timeshift-info">
              <span className="keyboard-hint">
                ⌨️ ←→ Navigate | Space Play/Pause | Home Target | 🖱️ Click/Drag Progress
              </span>
            </div>
            
            {/* Sync Status Display */}
            {/* Sync status removed for performance */}
          </div>
          
          {/* Advanced Timeline */}
          {timelineData && (
            <div className="timeline-container">
              <div className="timeline-info">
                <span className="timeline-current">
                  {formatTimestamp(currentTimestamp)}
                </span>
                <span className="timeline-range">
                  {formatTimestamp(timelineData.minTimestamp)} → {formatTimestamp(timelineData.maxTimestamp)}
                </span>
                <span className="timeline-duration">
                  1 hour range
                </span>
              </div>
              
              <div className="timeline-legend">
                {[1, 2, 3, 4, 5, 6].map(camId => (
                  <div key={camId} className="timeline-legend-item">
                    <div className={`timeline-legend-color camera-${camId}`}></div>
                    <span>Cam {camId}</span>
                  </div>
                ))}
              </div>
              
              <div 
                ref={timelineRef}
                className="timeline-track"
                onClick={handleTimelineClick}
                onMouseMove={(e) => {
                  // Throttle mouse events to prevent performance issues
                  if (isDragging) {
                    handleTimelineDrag(e);
                  } else {
                    handleTimelineHover(e);
                  }
                }}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => {
                  setIsDragging(false);
                  setHoverTimestamp(null);
                  // Clear hover timeout on leave
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                  }
                  // Clear navigation timeout on leave
                  if (navigationTimeoutRef.current) {
                    clearTimeout(navigationTimeoutRef.current);
                  }
                }}
                onMouseEnter={handleTimelineHover}
              >
                {/* Video segments */}
                <TimelineSegments 
                  segments={timelineData.segments} 
                  minTimestamp={timelineData.minTimestamp} 
                  totalDuration={timelineData.totalDuration} 
                />
                
                {/* Current position indicator */}
                <div 
                  className="timeline-indicator"
                  style={{
                    left: `${((currentTimestamp - timelineData.minTimestamp) / timelineData.totalDuration) * 100}%`
                  }}
                />
                
                {/* Hover indicator */}
                {hoverTimestamp && (
                  <div 
                    className="timeline-hover"
                    style={{
                      left: `${((hoverTimestamp - timelineData.minTimestamp) / timelineData.totalDuration) * 100}%`
                    }}
                  >
                    <div className="timeline-tooltip">
                      {formatTimestamp(hoverTimestamp)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Camera Grid */}
        <div className="camera-grid">
          {cameras.map(camera => {
            const videoUrl = getCurrentVideoUrl(camera.id);
            
            // Check if camera is unavailable
            if (camera.data?.cameraAvailable === false) {
              return (
                <div key={camera.id} className="camera-slot unavailable">
                  <div className="camera-label">CAM {camera.id}</div>
                  <div className="camera-status" style={{color: '#ff8c00', fontSize: '0.9em'}}>
                    NOT AVAILABLE
                  </div>
                  <div style={{color: '#ff8c00', fontSize: '0.7em', textAlign: 'center', marginTop: '8px'}}>
                    {camera.data?.cameraError || 'Camera offline'}
                  </div>
                  {videoUrl && videoUrl.includes('videoerror.mp4') && (
                    <div style={{marginTop: '8px'}}>
                      <video 
                        style={{width: '100%', height: '80px', borderRadius: '4px'}}
                        controls
                        muted
                        loop
                        autoPlay
                      >
                        <source src={videoUrl} type="video/mp4" />
                      </video>
                    </div>
                  )}
                </div>
              );
            }

            if (camera.loading) {
              return (
                <div key={camera.id} className="camera-slot loading">
                  <div className="camera-label">CAM {camera.id}</div>
                  <div className="camera-status">
                    <div className="loading-spinner"></div>
                    LOADING...
                  </div>
                </div>
              );
            }
            
            if (camera.error) {
              return (
                <div key={camera.id} className="camera-slot error">
                  <div className="camera-label">CAM {camera.id}</div>
                  <div className="camera-status error">ERROR</div>
                  <div style={{color: '#ff4444', fontSize: '0.8em', textAlign: 'center'}}>
                    {camera.error}
                  </div>
                </div>
              );
            }
            
            if (!videoUrl) {
              return (
                <div key={camera.id} className="camera-slot">
                  <div className="camera-label">CAM {camera.id}</div>
                  <div className="camera-status">NO VIDEO</div>
                </div>
              );
            }
            
            return <VideoContainer key={camera.id} cameraId={camera.id} />;
          })}
        </div>
    </>
  );
};

export default MultiCameraView;