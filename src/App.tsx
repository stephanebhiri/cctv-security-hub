import React, { useState, useEffect } from 'react';
import { CCTVService, CCTVResponse } from './services/CCTVService';
import VideoPlayer from './components/VideoPlayer';
import ContinuousVideoPlayer from './components/ContinuousVideoPlayer';
import MultiCameraView from './components/MultiCameraView';
import ItemsSection from './components/ItemsSection';
import { automationAPI } from './api/AutomationAPI';

const App: React.FC = () => {
  const [selectedCamera, setSelectedCamera] = useState<number>(1);
  const [selectedDateTime, setSelectedDateTime] = useState<string>('');
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<CCTVResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoSectionVisible, setVideoSectionVisible] = useState(false);
  const [currentItemName, setCurrentItemName] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [useContinuousPlayer, setUseContinuousPlayer] = useState(true);
  const [useMultiCamera, setUseMultiCamera] = useState(false);

  const cctvService = new CCTVService();

  // Initialize Automation API
  useEffect(() => {
    automationAPI.init({
      onItemClick: handleItemClick,
      onRefresh: () => {
        // Trigger refresh - will be handled by ItemsSection
        window.dispatchEvent(new CustomEvent('cctv-refresh-requested'));
      },
      onHealthCheck: handleHealthCheck
    });

    // Update API state when app state changes
    automationAPI.updateState({
      isLoading: loading,
      currentVideo: currentVideo,
      error: error,
      selectedCamera: selectedCamera,
      selectedItem: currentItemName ? {
        id: Date.now(), // We don't have the actual item here, but this is for the selected state
        epc: '',
        designation: currentItemName,
        timestamp: selectedDateTime ? Math.floor(new Date(selectedDateTime).getTime() / 1000) : 0,
        groupId: 0
      } : null
    });

    console.log('🤖 CCTV Automation API ready - window.CCTV available');
  }, [loading, currentVideo, error, currentItemName, selectedDateTime, selectedCamera]);

  const handleSearch = async () => {
    if (!selectedDateTime) {
      setError('Please select a date and time');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentVideo(null); // Vider le player pendant le chargement

    try {
      const timestamp = Math.floor(new Date(selectedDateTime).getTime() / 1000);
      
      console.time('api-response-time');
      console.log('🚀 Starting API call for timestamp:', timestamp);
      
      const response = await cctvService.getVideos(timestamp, selectedCamera);
      
      console.timeEnd('api-response-time');
      console.log('🎬 CCTV Response:', { 
        videosCount: Object.keys(response.videos).length,
        closestIndex: response.closestIndex,
        cameraId: response.cameraId 
      });
      
      setVideoData(response);
      
      // Set the closest video as the current video
      const closestVideoUrl = response.videos[response.closestIndex.toString()];
      console.log('🎯 Closest video URL:', closestVideoUrl);
      
      if (!closestVideoUrl) {
        console.error('❌ No video URL found for closest index:', response.closestIndex);
        setError('No video found for selected time');
        return;
      }
      
      console.time('total-time-to-video-ready');
      setCurrentVideo(closestVideoUrl);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch videos');
      setVideoData(null);
      setCurrentVideo(null);
    } finally {
      setLoading(false);
    }
  };



  const handleItemClick = async (timestamp: number, designation: string, groupId: number) => {
    console.log(`🎬 Launching CCTV for item: ${designation} at timestamp: ${timestamp}`);
    
    setLoading(true);
    setError(null);
    setCurrentVideo(null); // Vider le player pendant le chargement
    setCurrentItemName(designation);
    setVideoSectionVisible(true);

    try {
      // Update datetime picker to show item time
      const itemDate = new Date(timestamp * 1000);
      setSelectedDateTime(itemDate.toISOString().slice(0, 16));
      
      // Default to camera 1 - could be made configurable
      const cameraId = 1;
      setSelectedCamera(cameraId);
      
      // Fetch CCTV videos for this timestamp
      const response = await cctvService.getVideos(timestamp, cameraId);
      setVideoData(response);
      
      // Set the closest video as current
      const closestVideoUrl = response.videos[response.closestIndex.toString()];
      setCurrentVideo(closestVideoUrl);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CCTV footage');
    } finally {
      setLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    setLoading(true);
    setError(null);

    try {
      const health = await cctvService.checkHealth();
      if (health.status === 'healthy') {
        alert(`✅ API is healthy! Timestamp: ${new Date(health.timestamp * 1000).toLocaleString()}`);
      } else {
        setError('API health check failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setLoading(false);
    }
  };

  const closeVideoPlayer = () => {
    setVideoSectionVisible(false);
  };

  const handleEraseCache = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir vider le cache vidéo ?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await cctvService.eraseCache();
      if (result.success) {
        window.alert(`✅ Cache vidé avec succès !\n${result.filesDeleted} fichiers supprimés\n${result.sizeFreed}MB libérés`);
      } else {
        setError('Échec du vidage du cache');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du vidage du cache');
    } finally {
      setLoading(false);
    }
  };

  // Edge case test handlers
  const handleTestSlowResponse = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessage('Testing slow response (6+ seconds)...');
    setVideoSectionVisible(true);
    setCurrentItemName('Slow Response Test');

    try {
      const response = await cctvService.testSlowResponse(6000);
      setVideoData(response);
      
      const closestVideoUrl = response.videos[response.closestIndex.toString()];
      setCurrentVideo(closestVideoUrl);
      
      console.log('✅ Slow response test completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Slow response test failed');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleTest404Response = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessage('Testing 404 video handling...');
    setVideoSectionVisible(true);
    setCurrentItemName('404 Video Test');

    try {
      const response = await cctvService.test404Response();
      setVideoData(response);
      
      const closestVideoUrl = response.videos[response.closestIndex.toString()];
      setCurrentVideo(closestVideoUrl);
      
      console.log('✅ 404 response test completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : '404 response test failed');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleTestRapidClicks = async () => {
    console.log('🚀 Testing rapid consecutive clicks...');
    setVideoSectionVisible(true);
    setCurrentItemName('Rapid Click Test');
    
    // Simulate rapid clicks on different items
    const testItems = [
      { timestamp: 1752567000, designation: 'Item 1', groupId: 1 },
      { timestamp: 1752567060, designation: 'Item 2', groupId: 2 },
      { timestamp: 1752567120, designation: 'Item 3', groupId: 3 },
      { timestamp: 1752567180, designation: 'Item 4', groupId: 4 },
      { timestamp: 1752567240, designation: 'Item 5', groupId: 5 }
    ];
    
    // Fire rapid requests
    for (let i = 0; i < testItems.length; i++) {
      const item = testItems[i];
      console.log(`📍 Rapid click ${i + 1}: ${item.designation}`);
      
      // Don't await - fire them rapidly
      handleItemClick(item.timestamp, item.designation, item.groupId);
      
      // Small delay between clicks
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('✅ Rapid click test initiated - check console for request cancellations');
  };

  return (
    <div className="app-container">
      {/* Surveillance Header */}
      <header className="app-header">
        <div>
          <h1 className="app-title">📹 CCTV SECURITY HUB</h1>
          <p className="app-subtitle">SURVEILLANCE SYSTEM • REAL-TIME MONITORING</p>
        </div>
      </header>

      <main className="main-content">
        {/* Error Alert */}
        {error && (
          <div className="error-alert">
            <button 
              onClick={() => setError(null)}
              className="error-close"
            >
              ✕
            </button>
            <strong>❌ ERREUR:</strong> {error}
          </div>
        )}

        {/* Developer Tools */}
        <div className="dev-tools">
          <div className="dev-tools-header">
            🛠️ DEVELOPER TOOLS
          </div>
          <div className="dev-tools-grid">
            <button 
              onClick={handleTestSlowResponse}
              disabled={loading}
              className="dev-button test-slow"
            >
              🐌 Test Slow (6s)
            </button>
            <button 
              onClick={handleTest404Response}
              disabled={loading}
              className="dev-button test-404"
            >
              🚫 Test 404
            </button>
            <button 
              onClick={handleTestRapidClicks}
              disabled={loading}
              className="dev-button test-rapid"
            >
              🚀 Test Rapid
            </button>
            <button 
              onClick={handleHealthCheck}
              disabled={loading}
              className="dev-button health"
            >
              ❤️ Health Check
            </button>
            <button 
              onClick={handleEraseCache}
              disabled={loading}
              className="dev-button cache"
            >
              🗑️ Erase Cache
            </button>
          </div>
          {loading && loadingMessage && (
            <div className="loading-message">
              {loadingMessage}
            </div>
          )}
        </div>

        {/* Items Table - Main Content */}
        <ItemsSection 
          onItemClick={handleItemClick}
          onHealthCheck={handleHealthCheck}
        />

        {/* CCTV Modal - Surveillance Style */}
        {videoSectionVisible && (
          <div className="cctv-modal">
            <div className="modal-content">
              {/* Modal Header */}
              <div className="modal-header">
                <h2 className="modal-title">
                  📹 {currentItemName}
                </h2>
                <button 
                  onClick={closeVideoPlayer}
                  className="modal-close"
                >
                  ✕ CLOSE
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="modal-body">
                {/* Video Player */}
                <div style={{marginBottom: '20px'}}>
                  {useMultiCamera ? (
                    <MultiCameraView
                      targetTimestamp={selectedDateTime ? Math.floor(new Date(selectedDateTime).getTime() / 1000) : Math.floor(Date.now() / 1000)}
                      onError={(error) => setError(error)}
                      isSearching={loading}
                    />
                  ) : useContinuousPlayer && videoData ? (
                    <ContinuousVideoPlayer
                      videos={videoData.videos}
                      timestamps={videoData.timestamps}
                      closestIndex={videoData.closestIndex}
                      onError={() => setError('Failed to load video')}
                      isSearching={loading}
                    />
                  ) : (
                    <VideoPlayer 
                      videoUrl={currentVideo}
                      onError={() => setError('Failed to load video')}
                      isSearching={loading}
                    />
                  )}
                </div>
                
                {/* Controls */}
                <div className="controls-panel">
                  <div className="controls-row">
                    <select 
                      value={selectedCamera} 
                      onChange={(e) => setSelectedCamera(parseInt(e.target.value))}
                      className="control-input"
                    >
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>📷 Camera {num}</option>
                      ))}
                    </select>
                    
                    <input
                      type="datetime-local"
                      value={selectedDateTime}
                      onChange={(e) => setSelectedDateTime(e.target.value)}
                      className="control-input"
                    />
                    
                    <button 
                      onClick={handleSearch} 
                      disabled={loading} 
                      className="control-button primary"
                    >
                      {loading ? '⏳' : '🔍'} Rechercher
                    </button>
                    
                    <button 
                      onClick={() => setUseMultiCamera(!useMultiCamera)}
                      className={`control-button ${useMultiCamera ? 'mode-active' : 'mode-inactive'}`}
                    >
                      {useMultiCamera ? '🎥 Single' : '📺 Multi'}
                    </button>
                    
                    {!useMultiCamera && (
                      <button 
                        onClick={() => setUseContinuousPlayer(!useContinuousPlayer)}
                        className={`control-button ${useContinuousPlayer ? 'mode-active' : 'mode-inactive'}`}
                      >
                        {useContinuousPlayer ? '📺 Continu' : '🎬 Simple'}
                      </button>
                    )}
                  </div>
                </div>
                
                
                {/* Metadata */}
                {videoData && (
                  <div className="metadata-panel">
                    📊 Camera {videoData.cameraId} • {Object.keys(videoData.videos).length} vidéos • {videoData.offsetSeconds}s offset
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;