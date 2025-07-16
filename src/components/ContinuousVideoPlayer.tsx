import React, { useState, useRef, useMemo } from 'react';

interface ContinuousVideoPlayerProps {
  videos: { [key: string]: string };
  timestamps: { [key: string]: number };
  closestIndex: number;
  onError?: () => void;
  isSearching?: boolean;
}

const ContinuousVideoPlayer: React.FC<ContinuousVideoPlayerProps> = ({ 
  videos, 
  timestamps, 
  closestIndex, 
  onError,
  isSearching 
}) => {
  const [currentIndex, setCurrentIndex] = useState(closestIndex);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoEntries = useMemo(() => 
    Object.entries(videos).sort((a, b) => 
      timestamps[a[0]] - timestamps[b[0]]
    ), [videos, timestamps]
  );

  const currentVideoUrl = videos[currentIndex.toString()];
  const currentTimestamp = timestamps[currentIndex.toString()];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  const handleVideoEnded = () => {
    // Auto-play next video
    const nextIndex = videoEntries.findIndex(([index]) => parseInt(index) === currentIndex) + 1;
    if (nextIndex < videoEntries.length) {
      const nextVideoIndex = parseInt(videoEntries[nextIndex][0]);
      console.log(`🎬 Auto-playing next video: ${nextVideoIndex}`);
      setCurrentIndex(nextVideoIndex);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setTotalDuration(videoRef.current.duration);
    }
  };

  const goToPrevious = () => {
    const currentPos = videoEntries.findIndex(([index]) => parseInt(index) === currentIndex);
    if (currentPos > 0) {
      const prevIndex = parseInt(videoEntries[currentPos - 1][0]);
      setCurrentIndex(prevIndex);
    }
  };

  const goToNext = () => {
    const currentPos = videoEntries.findIndex(([index]) => parseInt(index) === currentIndex);
    if (currentPos < videoEntries.length - 1) {
      const nextIndex = parseInt(videoEntries[currentPos + 1][0]);
      setCurrentIndex(nextIndex);
    }
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
    console.time('continuous-video-load');
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    console.timeEnd('continuous-video-load');
  };

  // Get current position in the sequence
  const currentPosition = videoEntries.findIndex(([index]) => parseInt(index) === currentIndex) + 1;
  const totalVideos = videoEntries.length;
  const canGoPrevious = currentPosition > 1;
  const canGoNext = currentPosition < totalVideos;

  if (!currentVideoUrl) {
    return (
      <div className="video-placeholder">
        {isSearching ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              margin: '0 auto 20px',
              border: '3px solid #667eea',
              borderRadius: '50%',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite'
            }} />
            <p>🔍 Recherche des vidéos...</p>
          </div>
        ) : (
          <p>Aucune vidéo disponible</p>
        )}
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="video-error">
        <p>❌ Erreur lors du chargement de la vidéo</p>
        <button onClick={() => setHasError(false)}>Réessayer</button>
      </div>
    );
  }

  return (
    <div className="continuous-video-player">
      {/* Main Video */}
      <div className="video-container" style={{ position: 'relative' }}>
        {isLoading && (
          <div className="video-loading" style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '4px'
          }}>
            📥 Chargement en cours...
          </div>
        )}
        
        <video
          ref={videoRef}
          controls
          autoPlay
          onError={handleError}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
          onEnded={handleVideoEnded}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          preload="metadata"
          key={currentVideoUrl}
        >
          <source src={currentVideoUrl} type="video/mp4" />
        </video>
      </div>

      {/* Timeline Controls */}
      <div className="timeline-controls" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        margin: '15px 0'
      }}>
        {/* Previous Button */}
        <button
          onClick={goToPrevious}
          disabled={!canGoPrevious}
          style={{
            padding: '8px 12px',
            backgroundColor: canGoPrevious ? '#667eea' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: canGoPrevious ? 'pointer' : 'not-allowed'
          }}
        >
          ⏮️ Précédent
        </button>

        {/* Video Info */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#495057' }}>
            <strong>Vidéo {currentPosition}/{totalVideos}</strong>
          </div>
          <div style={{ fontSize: '12px', color: '#6c757d' }}>
            {formatTimestamp(currentTimestamp)}
          </div>
          <div style={{ fontSize: '12px', color: '#6c757d' }}>
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </div>
        </div>

        {/* Next Button */}
        <button
          onClick={goToNext}
          disabled={!canGoNext}
          style={{
            padding: '8px 12px',
            backgroundColor: canGoNext ? '#667eea' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: canGoNext ? 'pointer' : 'not-allowed'
          }}
        >
          Suivant ⏭️
        </button>
      </div>

      {/* Timeline Progress */}
      <div className="sequence-progress" style={{
        backgroundColor: '#e9ecef',
        borderRadius: '4px',
        height: '8px',
        overflow: 'hidden',
        marginBottom: '15px'
      }}>
        <div 
          style={{
            width: `${(currentPosition / totalVideos) * 100}%`,
            height: '100%',
            backgroundColor: '#667eea',
            transition: 'width 0.3s ease'
          }}
        />
      </div>

      {/* Auto-play Info */}
      <div style={{
        fontSize: '12px',
        color: '#6c757d',
        textAlign: 'center',
        padding: '10px',
        backgroundColor: '#e3f2fd',
        borderRadius: '4px',
        border: '1px solid #bbdefb'
      }}>
        🎬 Lecture continue activée - Les vidéos s'enchaînent automatiquement
      </div>
    </div>
  );
};

export default ContinuousVideoPlayer;