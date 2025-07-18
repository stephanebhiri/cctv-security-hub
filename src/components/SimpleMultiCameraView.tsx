import React, { useState, useEffect, useCallback } from 'react';
import { CCTVService } from '../services/CCTVService';
import '../styles/surveillance.css';

interface SimpleMultiCameraViewProps {
  targetTimestamp: number;
  onError?: (error: string) => void;
  isSearching?: boolean;
  itemName?: string;
  onClose?: () => void;
}

interface CameraData {
  id: number;
  videoUrl: string | null;
  loading: boolean;
  error: string | null;
}

const SimpleMultiCameraView: React.FC<SimpleMultiCameraViewProps> = ({
  targetTimestamp,
  onError,
  isSearching,
  itemName,
  onClose
}) => {
  // État minimal
  const [currentTimestamp, setCurrentTimestamp] = useState(targetTimestamp);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cameras, setCameras] = useState<CameraData[]>([
    { id: 1, videoUrl: null, loading: true, error: null },
    { id: 2, videoUrl: null, loading: true, error: null },
    { id: 3, videoUrl: null, loading: true, error: null },
    { id: 4, videoUrl: null, loading: true, error: null },
    { id: 5, videoUrl: null, loading: true, error: null },
    { id: 6, videoUrl: null, loading: true, error: null },
  ]);

  // Timeline avec debouncing pour éviter les requêtes en masse
  const [timelineValue, setTimelineValue] = useState(targetTimestamp);
  const [debounceTimeout, setDebounceTimeout] = useState<number | null>(null);

  const cctvService = new CCTVService();

  // Calcul simple : timestamp global → position dans la vidéo
  const calculateVideoTime = (globalTimestamp: number): number => {
    const videoStart = Math.floor(globalTimestamp / 120) * 120;
    return globalTimestamp - videoStart;
  };

  // Fonction pour trouver la vidéo correspondant au timestamp
  const getVideoForTimestamp = async (cameraId: number, timestamp: number): Promise<string | null> => {
    try {
      const response = await cctvService.getVideos(timestamp, cameraId);
      
      if (response.videos && Object.keys(response.videos).length > 0) {
        // Trouve la vidéo la plus proche
        const videoEntries = Object.entries(response.videos);
        let closestVideo = videoEntries[0][1];
        let closestDiff = Infinity;
        
        videoEntries.forEach(([key, videoUrl]) => {
          const videoTimestamp = response.timestamps[key];
          const diff = Math.abs(timestamp - videoTimestamp);
          
          if (diff < closestDiff) {
            closestDiff = diff;
            closestVideo = videoUrl;
          }
        });
        
        return closestVideo;
      }
      
      return null;
    } catch (error) {
      console.error(`Error loading video for camera ${cameraId}:`, error);
      return null;
    }
  };

  // Charger les vidéos pour le timestamp actuel
  const loadVideos = useCallback(async (timestamp: number) => {
    console.log(`🎬 Loading videos for timestamp: ${timestamp}`);
    
    setCameras(prev => prev.map(cam => ({ ...cam, loading: true, error: null })));
    
    const cameraIds = [1, 2, 3, 4, 5, 6];
    const videoPromises = cameraIds.map(async (cameraId) => {
      try {
        const videoUrl = await getVideoForTimestamp(cameraId, timestamp);
        return {
          id: cameraId,
          videoUrl,
          loading: false,
          error: videoUrl ? null : 'No video found'
        };
      } catch (error) {
        return {
          id: cameraId,
          videoUrl: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const updatedCameras = await Promise.all(videoPromises);
    setCameras(updatedCameras);
  }, []);

  // Charger les vidéos au démarrage et quand le timestamp change
  useEffect(() => {
    loadVideos(currentTimestamp);
  }, [currentTimestamp, loadVideos]);

  // Synchronisation simple : applique le même currentTime à toutes les vidéos
  const syncVideos = () => {
    const videoTime = calculateVideoTime(currentTimestamp);
    console.log(`🔄 Syncing videos to time: ${videoTime}s`);
    
    const videoElements = document.querySelectorAll('.sync-video');
    videoElements.forEach((video: any) => {
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA
        video.currentTime = Math.min(videoTime, video.duration - 0.5);
      }
    });
  };

  // Navigation
  const goToPrevious = () => {
    const newTimestamp = currentTimestamp - 120; // 2 minutes précédent
    const minTimestamp = targetTimestamp - 1800; // 30 min avant
    
    if (newTimestamp >= minTimestamp) {
      setTimelineValue(newTimestamp);
      setCurrentTimestamp(newTimestamp);
    }
  };

  const goToNext = () => {
    const newTimestamp = currentTimestamp + 120; // 2 minutes suivant
    const maxTimestamp = targetTimestamp + 1800; // 30 min après
    
    if (newTimestamp <= maxTimestamp) {
      setTimelineValue(newTimestamp);
      setCurrentTimestamp(newTimestamp);
    }
  };

  // Play/Pause
  const togglePlayPause = () => {
    const videoElements = document.querySelectorAll('.sync-video');
    
    if (isPlaying) {
      videoElements.forEach((video: any) => video.pause());
      setIsPlaying(false);
    } else {
      // Sync avant de jouer
      syncVideos();
      
      videoElements.forEach((video: any) => {
        if (video.readyState >= 2) {
          video.play().catch(console.error);
        }
      });
      setIsPlaying(true);
    }
  };

  const handleTimelineChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTimestamp = Number(event.target.value);
    console.log(`🎯 TIMELINE MOVED: ${newTimestamp} (UI update only)`);
    setTimelineValue(newTimestamp); // Mise à jour immédiate de l'affichage
    setIsPlaying(false); // Pause quand on navigue
    
    // Annule le timeout précédent
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      console.log(`❌ CANCELLED previous timeout`);
    }
    
    // Démarre un nouveau timeout
    const timeout = setTimeout(() => {
      console.log(`🕐 DEBOUNCED: Timeline change to ${newTimestamp} after 300ms delay`);
      setCurrentTimestamp(newTimestamp);
    }, 300); // 300ms de délai
    
    setDebounceTimeout(timeout);
  };

  if (isSearching) {
    return (
      <div className="search-container">
        <div className="search-icon">
          <div className="loading-spinner"></div>
        </div>
        <h3 className="search-title">Chargement des 6 caméras...</h3>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="modal-header">
        <div className="modal-title-section">
          <h2 className="modal-title">📹 {itemName || 'CCTV Surveillance'}</h2>
          <div className="sync-info">
            <span className="time-display">
              {new Date(currentTimestamp * 1000).toLocaleString('fr-FR')}
            </span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="modal-close">
            ✕ CLOSE
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="video-controls">
        <div className="controls-row">
          <button 
            onClick={goToPrevious}
            disabled={currentTimestamp <= targetTimestamp - 1800}
            className="control-button"
          >
            ⏮️ Précédent
          </button>
          
          <button 
            onClick={togglePlayPause}
            className="control-button play"
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </button>
          
          <button 
            onClick={goToNext}
            disabled={currentTimestamp >= targetTimestamp + 1800}
            className="control-button"
          >
            Suivant ⏭️
          </button>
          
          <button 
            onClick={syncVideos}
            className="control-button sync"
          >
            🔄 Sync
          </button>
        </div>

        {/* Timeline simple */}
        <div className="timeline-container">
          <div className="timeline-info">
            <span>30 min avant</span>
            <span className="timeline-current">
              {new Date(timelineValue * 1000).toLocaleTimeString()}
            </span>
            <span>30 min après</span>
          </div>
          
          <input
            type="range"
            min={targetTimestamp - 1800}
            max={targetTimestamp + 1800}
            value={timelineValue}
            onChange={handleTimelineChange}
            className="timeline-slider"
            step="1"
          />
        </div>
      </div>

      {/* Grille de vidéos */}
      <div className="camera-grid">
        {cameras.map(camera => (
          <div key={camera.id} className="camera-slot">
            <div className="camera-label">CAM {camera.id}</div>
            
            {camera.loading && (
              <div className="camera-status">
                <div className="loading-spinner"></div>
                LOADING...
              </div>
            )}
            
            {camera.error && (
              <div className="camera-status error">
                ERROR: {camera.error}
              </div>
            )}
            
            {camera.videoUrl && !camera.loading && (
              <video
                className="sync-video"
                src={camera.videoUrl}
                controls
                muted
                onLoadedData={syncVideos}
                onError={() => {
                  setCameras(prev => prev.map(cam => 
                    cam.id === camera.id 
                      ? { ...cam, error: 'Video load error' }
                      : cam
                  ));
                }}
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </div>
        ))}
      </div>
    </>
  );
};

export default SimpleMultiCameraView;