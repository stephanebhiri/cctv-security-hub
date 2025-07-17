import React, { useState, useEffect } from 'react';
import { CCTVService } from './services/CCTVService';
import MultiCameraView from './components/MultiCameraView';
import ItemsSection from './components/ItemsSection';
import { automationAPI } from './api/AutomationAPI';
import './App.css';

const App: React.FC = () => {
  const [selectedDateTime, setSelectedDateTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoSectionVisible, setVideoSectionVisible] = useState(false);
  const [currentItemName, setCurrentItemName] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<string>('');

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
      currentVideo: null,
      error: error,
      selectedCamera: 1,
      selectedItem: currentItemName ? {
        id: Date.now(), // We don't have the actual item here, but this is for the selected state
        epc: '',
        designation: currentItemName,
        timestamp: selectedDateTime ? Math.floor(new Date(selectedDateTime).getTime() / 1000) : 0,
        groupId: 0
      } : null
    });

    console.log('🤖 CCTV Automation API ready - window.CCTV available');
  }, [loading, error, currentItemName, selectedDateTime]);

  // handleSearch removed - modal launched from item clicks only



  const handleItemClick = async (timestamp: number, designation: string, groupId: number) => {
    console.log(`🎬 Launching multi-camera CCTV for item: ${designation} at timestamp: ${timestamp}`);
    
    setLoading(true);
    setError(null);
    setCurrentItemName(designation);
    setVideoSectionVisible(true);

    try {
      // Update datetime picker to show item time
      const itemDate = new Date(timestamp * 1000);
      setSelectedDateTime(itemDate.toISOString().slice(0, 16));
      
      // Multi-camera view will handle the loading itself
      
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
      await cctvService.testSlowResponse(6000);
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
      await cctvService.test404Response();
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

        {/* CCTV Modal - Clean Structure */}
        {videoSectionVisible && (
          <div className="cctv-modal">
            <div className="modal-content">
              {/* Direct MultiCameraView with unified header */}
              <MultiCameraView
                targetTimestamp={selectedDateTime ? Math.floor(new Date(selectedDateTime).getTime() / 1000) : Math.floor(Date.now() / 1000)}
                onError={(error) => setError(error)}
                isSearching={loading}
                itemName={currentItemName}
                onClose={closeVideoPlayer}
              />
              
              <div className="metadata-panel">
                📺 6 Cameras Synchronized • Use ←→ keys to navigate • Limited to 10 clips range
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;