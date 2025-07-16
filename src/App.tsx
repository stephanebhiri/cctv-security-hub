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
      selectedItem: currentItemName ? {
        id: Date.now(), // We don't have the actual item here, but this is for the selected state
        epc: '',
        designation: currentItemName,
        timestamp: selectedDateTime ? Math.floor(new Date(selectedDateTime).getTime() / 1000) : 0,
        groupId: 0
      } : null
    });

    console.log('🤖 CCTV Automation API ready - window.CCTV available');
  }, [loading, currentVideo, error, currentItemName, selectedDateTime]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Modern Header */}
      <header className="relative overflow-hidden bg-gradient-to-r from-brand-600 via-brand-700 to-accent-600 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-30"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 2v-7l-4 2z"/>
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              CCTV Security Hub
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 font-light max-w-2xl mx-auto">
              Surveillance intelligente en temps réel • Analyse vidéo avancée
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-8 animate-fade-in">
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 font-medium">Erreur: {error}</p>
                </div>
                <div className="ml-auto">
                  <button 
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Developer Tools */}
        <div className="mb-8 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
                Outils de développement
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <button 
                  onClick={handleTestSlowResponse}
                  disabled={loading}
                  className="flex items-center justify-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="mr-2">🐌</span>
                  Test Slow (6s)
                </button>
                <button 
                  onClick={handleTest404Response}
                  disabled={loading}
                  className="flex items-center justify-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="mr-2">🚫</span>
                  Test 404
                </button>
                <button 
                  onClick={handleTestRapidClicks}
                  disabled={loading}
                  className="flex items-center justify-center px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="mr-2">🚀</span>
                  Test Rapid
                </button>
                <button 
                  onClick={handleHealthCheck}
                  disabled={loading}
                  className="flex items-center justify-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="mr-2">❤️</span>
                  Health Check
                </button>
                <button 
                  onClick={handleEraseCache}
                  disabled={loading}
                  className="flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="mr-2">🗑️</span>
                  Erase Cache
                </button>
              </div>
              {loading && loadingMessage && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">{loadingMessage}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items Table - Main Content */}
        <ItemsSection 
          onItemClick={handleItemClick}
          onHealthCheck={handleHealthCheck}
        />

        {/* CCTV Modal - Ultra Modern */}
        {videoSectionVisible && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-7xl max-h-[90vh] w-full overflow-hidden animate-slide-up">
              {/* Modal Header */}
              <div className="relative bg-gradient-to-r from-brand-600 via-brand-700 to-accent-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 2v-7l-4 2z"/>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{currentItemName}</h2>
                      <p className="text-blue-100 text-sm font-light">Analyse vidéo en temps réel</p>
                    </div>
                  </div>
                  <button 
                    onClick={closeVideoPlayer}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Modal Content */}
              <div className="p-6 max-h-[calc(90vh-100px)] overflow-y-auto">
                {/* Video Player */}
                <div className="mb-6">
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
                <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                  <div className="flex flex-wrap gap-4 items-center">
                    <select 
                      value={selectedCamera} 
                      onChange={(e) => setSelectedCamera(parseInt(e.target.value))}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus-ring text-sm font-medium"
                    >
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>📷 Camera {num}</option>
                      ))}
                    </select>
                    
                    <input
                      type="datetime-local"
                      value={selectedDateTime}
                      onChange={(e) => setSelectedDateTime(e.target.value)}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus-ring text-sm"
                    />
                    
                    <button 
                      onClick={handleSearch} 
                      disabled={loading} 
                      className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {loading ? (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      )}
                      Rechercher
                    </button>
                    
                    <button 
                      onClick={() => setUseMultiCamera(!useMultiCamera)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        useMultiCamera 
                          ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {useMultiCamera ? '🎥 Single' : '📺 Multi'}
                    </button>
                    
                    {!useMultiCamera && (
                      <button 
                        onClick={() => setUseContinuousPlayer(!useContinuousPlayer)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          useContinuousPlayer 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {useContinuousPlayer ? '📺 Continu' : '🎬 Simple'}
                      </button>
                    )}
                  </div>
                </div>
                
                
                {/* Metadata */}
                {videoData && (
                  <div className="bg-blue-50 rounded-2xl p-4 text-center">
                    <p className="text-sm text-blue-700 font-medium">
                      📊 Camera {videoData.cameraId} • {Object.keys(videoData.videos).length} vidéos • {videoData.offsetSeconds}s offset
                    </p>
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