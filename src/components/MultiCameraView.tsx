import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CCTVService } from '../services/CCTVService';

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
  const videoElementsRef = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  
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

  const handlePlayPause = async () => {
    const videos = Object.values(videoElementsRef.current).filter(Boolean);
    
    if (!isPlaying) {
      setIsPlaying(true);
      
      // Sequential playback for Safari compatibility
      for (const video of videos) {
        if (video && video.readyState >= 2) {
          try {
            await video.play();
            // Small delay to prevent Safari from rejecting concurrent plays
            await new Promise(resolve => setTimeout(resolve, 100));
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
    cameras.forEach(camera => {
      const videoElement = videoElementsRef.current[camera.id];
      const videoUrl = getCurrentVideoUrl(camera.id);
      
      if (videoElement && videoUrl && videoElement.src !== videoUrl) {
        videoElement.src = videoUrl;
      }
    });
  }, [cameras, currentVideoOffset, getCurrentVideoUrl]);

  const goToPrevious = useCallback(() => {
    // Move to previous video (negative offset allows going before target)
    setCurrentVideoOffset(prev => prev - 1);
  }, []);

  const goToNext = useCallback(() => {
    // Move to next video (positive offset)
    setCurrentVideoOffset(prev => prev + 1);
  }, []);

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
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 2v-7l-4 2z"/>
              </svg>
            </div>
            <span className="font-medium text-gray-900">Camera {cameraId}</span>
          </div>
          <div className="flex items-center space-x-2">
            {camera?.loading && (
              <div className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              </div>
            )}
            {camera?.error && (
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
            )}
          </div>
        </div>
        
        <div className="aspect-video bg-gray-100 relative" ref={containerRef}>
          {!camera?.data && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 2v-7l-4 2z"/>
                  </svg>
                </div>
                <p className="text-sm text-gray-500">En attente...</p>
              </div>
            </div>
          )}
        </div>
        
        {camera?.data && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {getCurrentTimestamp(cameraId) 
                  ? formatTimestamp(getCurrentTimestamp(cameraId)!) 
                  : 'No timestamp'
                }
              </span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-500">Live</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl">
        <div className="relative mb-6">
          <div className="w-16 h-16 bg-brand-500 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white animate-pulse" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 2v-7l-4 2z"/>
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Chargement des 6 caméras...</h3>
        <p className="text-gray-600 text-center max-w-md">
          Connexion aux flux vidéo en cours • Synchronisation multi-caméras
        </p>
        <div className="mt-4 flex space-x-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" style={{animationDelay: `${i * 0.1}s`}}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Controls Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-brand-50 to-accent-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Synchronisation Multi-Caméras</h3>
                <p className="text-sm text-gray-600">
                  Offset: {currentVideoOffset >= 0 ? '+' : ''}{currentVideoOffset} 
                  {currentVideoOffset === 0 && ' (Target)'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={loadAllCameras}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Actualiser</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={goToPrevious}
              disabled={!canGoToPrevious()}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
              <span>Précédent</span>
            </button>
            
            <button 
              onClick={handlePlayPause}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              {isPlaying ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V17M6 10h2.586a1 1 0 00.707-.293l4.414-4.414A1 1 0 0014 5h2m-5 5v2a4 4 0 008 0v-2m-8 0V7a2 2 0 012-2h4a2 2 0 012 2v3m0 0V7a2 2 0 012-2h4a2 2 0 012 2v3" />
                </svg>
              )}
              <span>{isPlaying ? 'Pause' : 'Play'} Toutes</span>
            </button>
            
            <button 
              onClick={goToNext}
              disabled={!canGoToNext()}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:cursor-not-allowed"
            >
              <span>Suivant</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
              </svg>
            </button>
            
            {currentVideoOffset !== 0 && (
              <button 
                onClick={() => setCurrentVideoOffset(0)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                <span>Retour Target</span>
              </button>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-300"
              style={{ 
                width: `${50 + (currentVideoOffset / Math.max(getTotalVideos(), 1)) * 50}%`,
                minWidth: '2px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cameras.map(camera => {
          const videoUrl = getCurrentVideoUrl(camera.id);
          
          if (camera.loading) {
            return (
              <div key={camera.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </div>
                    <span className="font-medium text-gray-900">Camera {camera.id}</span>
                  </div>
                </div>
                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <svg className="w-6 h-6 text-yellow-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600">Chargement...</p>
                  </div>
                </div>
              </div>
            );
          }
          
          if (camera.error) {
            return (
              <div key={camera.id} className="bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-red-100 px-4 py-3 border-b border-red-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-900">Camera {camera.id}</span>
                  </div>
                </div>
                <div className="aspect-video bg-red-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-600 font-medium">Erreur</p>
                    <p className="text-xs text-red-500 mt-1 max-w-32 truncate">{camera.error}</p>
                  </div>
                </div>
              </div>
            );
          }
          
          if (!videoUrl) {
            return (
              <div key={camera.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 2v-7l-4 2z"/>
                      </svg>
                    </div>
                    <span className="font-medium text-gray-900">Camera {camera.id}</span>
                  </div>
                </div>
                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
                      <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 2v-7l-4 2z"/>
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600">Pas de vidéo</p>
                  </div>
                </div>
              </div>
            );
          }
          
          return <VideoContainer key={camera.id} cameraId={camera.id} />;
        })}
      </div>
    </div>
  );
};

export default MultiCameraView;