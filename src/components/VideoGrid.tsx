import React from 'react';

interface VideoGridProps {
  videos: { [key: string]: string };
  timestamps: { [key: string]: number };
  onVideoSelect: (videoUrl: string) => void;
  closestIndex: number;
}

const VideoGrid: React.FC<VideoGridProps> = ({ 
  videos, 
  timestamps, 
  onVideoSelect, 
  closestIndex 
}) => {
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const videoEntries = Object.entries(videos);

  if (videoEntries.length === 0) {
    return (
      <div className="video-grid-empty">
        <p>No videos found for the selected time and camera</p>
      </div>
    );
  }

  // Show 90 videos in full grid (±44 around closest)
  const DISPLAY_RANGE = 44;
  const startIndex = Math.max(0, closestIndex - DISPLAY_RANGE);
  const endIndex = Math.min(videoEntries.length - 1, closestIndex + DISPLAY_RANGE);
  const visibleEntries = videoEntries.slice(startIndex, endIndex + 1);

  return (
    <div className="video-grid">
      <h3>Available Videos ({visibleEntries.length} of {videoEntries.length} shown)</h3>
      <div className="video-grid-container">
        {visibleEntries.map(([index, videoUrl]) => {
          const isClosest = parseInt(index) === closestIndex;
          const timestamp = timestamps[index];
          
          return (
            <div 
              key={index}
              className={`video-grid-item ${isClosest ? 'closest' : ''}`}
              onClick={() => onVideoSelect(videoUrl)}
            >
              <div className="video-thumbnail">
                <video 
                  width="120" 
                  height="90" 
                  preload="none"
                  poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 90'%3E%3Crect width='120' height='90' fill='%23667eea'/%3E%3Ctext x='60' y='45' text-anchor='middle' fill='white' font-family='Arial' font-size='10'%3E📹%3C/text%3E%3C/svg%3E"
                >
                  <source src={videoUrl} type="video/mp4" />
                </video>
              </div>
              <div className="video-info">
                <p className="video-time">{formatTimestamp(timestamp)}</p>
                {isClosest && <span className="closest-badge">Closest</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VideoGrid;