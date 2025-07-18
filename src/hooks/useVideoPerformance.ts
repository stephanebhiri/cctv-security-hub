import { useEffect, useRef, useCallback } from 'react';

interface VideoLoadingOptions {
  maxConcurrentLoads?: number;
  preloadStrategy?: 'none' | 'metadata' | 'auto';
  bufferTime?: number; // seconds to buffer ahead
}

export const useVideoPerformance = (options: VideoLoadingOptions = {}) => {
  const {
    maxConcurrentLoads = 2,
    preloadStrategy = 'metadata',
    bufferTime = 10
  } = options;

  const loadingVideos = useRef<Set<string>>(new Set());
  const loadQueue = useRef<Array<{ url: string; element: HTMLVideoElement }>>([]);
  const videoCache = useRef<Map<string, boolean>>(new Map());

  // Process the loading queue
  const processQueue = useCallback(() => {
    while (loadingVideos.current.size < maxConcurrentLoads && loadQueue.current.length > 0) {
      const next = loadQueue.current.shift();
      if (next) {
        loadVideo(next.url, next.element);
      }
    }
  }, [maxConcurrentLoads]);

  // Load a video with performance optimizations
  const loadVideo = useCallback((url: string, element: HTMLVideoElement) => {
    if (loadingVideos.current.has(url) || videoCache.current.has(url)) {
      return;
    }

    loadingVideos.current.add(url);
    console.log(`🎬 Loading video: ${url} (${loadingVideos.current.size}/${maxConcurrentLoads} concurrent)`);

    // Set up event handlers
    const handleCanPlay = () => {
      loadingVideos.current.delete(url);
      videoCache.current.set(url, true);
      console.log(`✅ Video ready: ${url}`);
      processQueue();
    };

    const handleError = () => {
      loadingVideos.current.delete(url);
      console.error(`❌ Video failed: ${url}`);
      processQueue();
    };

    element.addEventListener('canplay', handleCanPlay, { once: true });
    element.addEventListener('error', handleError, { once: true });

    // Start loading
    element.preload = preloadStrategy;
    element.src = url;
    
    if (preloadStrategy !== 'none') {
      element.load();
    }
  }, [maxConcurrentLoads, preloadStrategy, processQueue]);

  // Queue a video for loading
  const queueVideoLoad = useCallback((url: string, element: HTMLVideoElement, priority = false) => {
    if (videoCache.current.has(url)) {
      // Already loaded
      element.src = url;
      return;
    }

    if (priority) {
      loadQueue.current.unshift({ url, element });
    } else {
      loadQueue.current.push({ url, element });
    }
    
    processQueue();
  }, [processQueue]);

  // Preload adjacent videos for smooth playback
  const preloadAdjacentVideos = useCallback((
    currentIndex: number,
    videoUrls: string[],
    videoElements: HTMLVideoElement[]
  ) => {
    // Preload next 2 videos
    for (let i = 1; i <= 2; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < videoUrls.length && videoElements[nextIndex]) {
        queueVideoLoad(videoUrls[nextIndex], videoElements[nextIndex]);
      }
    }

    // Preload previous video
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0 && videoElements[prevIndex]) {
      queueVideoLoad(videoUrls[prevIndex], videoElements[prevIndex]);
    }
  }, [queueVideoLoad]);

  // Cancel all pending loads
  const cancelAllLoads = useCallback(() => {
    loadQueue.current = [];
    loadingVideos.current.clear();
  }, []);

  // Get loading statistics
  const getLoadingStats = useCallback(() => {
    return {
      loading: loadingVideos.current.size,
      queued: loadQueue.current.length,
      cached: videoCache.current.size,
      maxConcurrent: maxConcurrentLoads
    };
  }, [maxConcurrentLoads]);

  // Optimize video element for performance
  const optimizeVideoElement = useCallback((element: HTMLVideoElement) => {
    // Disable features that can impact performance
    element.disablePictureInPicture = true;
    element.disableRemotePlayback = true;
    
    // Set buffer hints
    if ('buffered' in element) {
      // Modern browsers support these attributes
      (element as any).preloadTime = bufferTime;
    }
    
    // Enable hardware acceleration hints
    element.style.transform = 'translateZ(0)';
    element.style.willChange = 'transform';
    
    return element;
  }, [bufferTime]);

  return {
    queueVideoLoad,
    preloadAdjacentVideos,
    cancelAllLoads,
    getLoadingStats,
    optimizeVideoElement,
    isVideoLoading: (url: string) => loadingVideos.current.has(url),
    isVideoCached: (url: string) => videoCache.current.has(url)
  };
};