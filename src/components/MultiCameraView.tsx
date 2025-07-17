import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CCTVService } from '../services/CCTVService';
import '../styles/surveillance.css';

interface MultiCameraViewProps {
  targetTimestamp: number;
  onError?: (error: string) => void;
  isSearching?: boolean;
}

interface CameraState {
  id: number;
  data: {
    videos: { [key: string]: string };
    timestamps: { [key: string]: number };
    closestIndex: number;
  } | null;
  loading: boolean;
  error: string | null;
}

const MultiCameraView: React.FC<MultiCameraViewProps> = ({ 
  targetTimestamp, 
  onError,
  isSearching 
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
  const videoElementsRef = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const autoPlayTriggered = useRef(false);
  
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
            closestIndex: response.closestIndex
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
    
    // Calculate actual index: closestIndex + offset (allows going before target)
    const targetIndex = Math.max(0, Math.min(
      camera.data.closestIndex + currentVideoOffset, 
      videoEntries.length - 1
    ));
      
    return videoEntries[targetIndex]?.[1] || null;
  }, [cameras, currentVideoOffset, getSortedVideoEntries]);

  const getCurrentTimestamp = useCallback((cameraId: number) => {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera?.data) return null;
    
    const videoEntries = getSortedVideoEntries(cameraId);
    
    // Calculate actual index: closestIndex + offset (allows going before target)
    const targetIndex = Math.max(0, Math.min(
      camera.data.closestIndex + currentVideoOffset, 
      videoEntries.length - 1
    ));
      
    const videoEntry = videoEntries[targetIndex];
    
    return videoEntry ? camera.data.timestamps[videoEntry[0]] : null;
  }, [cameras, currentVideoOffset, getSortedVideoEntries]);

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

  const getCurrentPosition = () => {
    const maxCamera = cameras.reduce((max, camera) => {
      if (!camera.data) return max;
      const videoEntries = getSortedVideoEntries(camera.id);
      return Math.max(max, videoEntries.length);
    }, 0);
    
    const currentPosition = Math.max(0, Math.min(
      cameras.find(c => c.data)?.data?.closestIndex || 0 + currentVideoOffset,
      maxCamera - 1
    ));
    
    return { current: currentPosition + 1, total: maxCamera };
  };

  const handlePlayPause = async () => {
    const videos = Object.values(videoElementsRef.current).filter(Boolean);
    
    if (!isPlaying) {
      setIsPlaying(true);
      
      // Safari needs sequential playback with forced loading
      for (const video of videos) {
        if (video) {
          try {
            // Force load if not ready
            if (video.readyState < 2) {
              video.load();
              await new Promise(resolve => {
                video.addEventListener('loadeddata', resolve, { once: true });
              });
            }
            
            await video.play();
            console.log(`✅ Video ${video.src} started`);
            // Small delay for Safari compatibility
            await new Promise(resolve => setTimeout(resolve, 150));
          } catch (err) {
            console.error('Play failed:', err);
          }
        }
      }
    } else {
      setIsPlaying(false);
      videos.forEach(video => {
        if (video) {
          video.pause();
        }
      });
    }
  };

  const handleVideoEnded = useCallback(() => {
    // Move to next video (positive offset)
    setCurrentVideoOffset(prev => prev + 1);
  }, []);

  // Create video elements once
  useEffect(() => {
    const videoElements = videoElementsRef.current;
    
    cameras.forEach(camera => {
      if (!videoElements[camera.id]) {
        const videoElement = document.createElement('video');
        videoElement.controls = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.preload = 'metadata';
        videoElement.style.width = '100%';
        videoElement.style.height = '200px';
        videoElement.addEventListener('ended', handleVideoEnded);
        
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
        }
      });
    };
  }, [cameras, handleVideoEnded]);
  
  // Update video sources separately
  useEffect(() => {
    setVideosReadyCount(0); // Reset ready count when sources change
    autoPlayTriggered.current = false;
    
    cameras.forEach(camera => {
      const videoElement = videoElementsRef.current[camera.id];
      const videoUrl = getCurrentVideoUrl(camera.id);
      
      if (videoElement && videoUrl && videoElement.src !== videoUrl) {
        // Safari fix: pause, clear, set source, then load
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load(); // Clear previous
        videoElement.src = videoUrl;
        videoElement.load(); // Load new source - forces Safari to show video
      }
    });
  }, [cameras, currentVideoOffset, getCurrentVideoUrl]);

  // Auto-play when all videos are ready (Chrome mainly)
  useEffect(() => {
    const validCamerasCount = cameras.filter(cam => cam.data && getCurrentVideoUrl(cam.id)).length;
    
    if (videosReadyCount >= validCamerasCount && validCamerasCount > 0 && !autoPlayTriggered.current && !isPlaying) {
      console.log(`🎬 Auto-play: ${videosReadyCount}/${validCamerasCount} videos ready`);
      autoPlayTriggered.current = true;
      
      // Small delay then auto-play
      setTimeout(() => {
        handlePlayPause();
      }, 500);
    }
  }, [videosReadyCount, cameras, isPlaying, getCurrentVideoUrl]);

  const goToPrevious = useCallback(() => {
    // Move to previous video (negative offset allows going before target)
    setCurrentVideoOffset(prev => prev - 1);
    
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
  }, [cameras, currentVideoOffset, getSortedVideoEntries, preloadVideo]);

  const goToNext = useCallback(() => {
    // Move to next video (positive offset)
    setCurrentVideoOffset(prev => prev + 1);
    
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
  }, [cameras, currentVideoOffset, getSortedVideoEntries, preloadVideo]);

  // Helper function to check if we can navigate
  const canGoToPrevious = useCallback(() => {
    return cameras.some(camera => {
      if (!camera.data) return false;
      const targetIndex = camera.data.closestIndex + currentVideoOffset - 1;
      return targetIndex >= 0;
    });
  }, [cameras, currentVideoOffset]);

  const canGoToNext = useCallback(() => {
    return cameras.some(camera => {
      if (!camera.data) return false;
      const videoEntries = getSortedVideoEntries(camera.id);
      const targetIndex = camera.data.closestIndex + currentVideoOffset + 1;
      return targetIndex < videoEntries.length;
    });
  }, [cameras, currentVideoOffset, getSortedVideoEntries]);

  // Keyboard navigation for timeshift
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoToPrevious, canGoToNext, goToPrevious, goToNext, handlePlayPause]);

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
    <div className="surveillance-container">
      <div className="cctv-window">
        {/* Header */}
        <div className="cctv-header">
          <div className="cctv-info">
            <div className="iconSituation">📹</div>
            <div className="elementdata">
              <div className="NomElement">Synchronisation Multi-Caméras</div>
              <div className="status-line">
                <span className="offset-display">
                  Video: {getCurrentPosition().current}/{getCurrentPosition().total} • 
                  Offset: {currentVideoOffset >= 0 ? '+' : ''}{currentVideoOffset} 
                  {currentVideoOffset === 0 && ' (Target)'}
                </span>
                {cameras.some(c => c.data) && (
                  <span style={{marginLeft: '10px', color: '#888'}}>
                    {formatFullTimestamp(getCurrentTimestamp(1) || targetTimestamp)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={loadAllCameras}
            className="refresh-button"
          >
            🔄 Actualiser
          </button>
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
                onClick={() => setCurrentVideoOffset(0)}
                className="control-button target"
                title="Retour à la position cible (Home)"
              >
                🎯 Retour Target
              </button>
            )}
            
            <div className="timeshift-info">
              <span className="keyboard-hint">
                ⌨️ ←→ Navigate | Space Play/Pause | Home Target
              </span>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="progress-container">
            <div 
              className="progress-bar"
              style={{ 
                width: `${50 + (currentVideoOffset / Math.max(getTotalVideos(), 1)) * 50}%`
              }}
            />
          </div>
        </div>

        {/* Camera Grid */}
        <div className="camera-grid">
          {cameras.map(camera => {
            const videoUrl = getCurrentVideoUrl(camera.id);
            
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
      </div>
    </div>
  );
};

export default MultiCameraView;