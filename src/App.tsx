import React, { useState, useEffect } from 'react';
import { CCTVService } from './services/CCTVService';
import SimpleMultiCameraView from './components/SimpleMultiCameraView';
import ItemsSection from './components/ItemsSection';
import HistoryPage from './components/HistoryPage';
import TimelinePage from './components/TimelinePage';
import { automationAPI } from './api/AutomationAPI';
import './App.css';

const App: React.FC = () => {
  const [selectedDateTime, setSelectedDateTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoSectionVisible, setVideoSectionVisible] = useState(false);
  const [currentItemName, setCurrentItemName] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<'live' | 'history' | 'timeline'>('live');

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


  return (
    <div className="app-container">
      {/* Surveillance Header */}
      <header className="app-header">
        <div>
          <h1 className="app-title">📹 CCTV SECURITY HUB</h1>
          <p className="app-subtitle">SURVEILLANCE SYSTEM • REAL-TIME MONITORING</p>
        </div>
        <nav className="app-nav">
          <button 
            onClick={() => setCurrentPage('live')}
            className={`nav-button ${currentPage === 'live' ? 'active' : ''}`}
          >
            📡 Live View
          </button>
          <button 
            onClick={() => setCurrentPage('history')}
            className={`nav-button ${currentPage === 'history' ? 'active' : ''}`}
          >
            📋 History
          </button>
          <button 
            onClick={() => setCurrentPage('timeline')}
            className={`nav-button ${currentPage === 'timeline' ? 'active' : ''}`}
          >
            📅 Timeline
          </button>
        </nav>
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

        {/* Conditional Page Rendering */}
        {currentPage === 'history' ? (
          <HistoryPage />
        ) : currentPage === 'timeline' ? (
          <TimelinePage />
        ) : (
          <>
            {/* Items Table - Main Content */}
            <ItemsSection 
              onItemClick={handleItemClick}
              onHealthCheck={handleHealthCheck}
            />

            {/* CCTV Fullscreen Overlay */}
            {videoSectionVisible && (
              <div className="cctv-fullscreen-overlay">
                <SimpleMultiCameraView
                  targetTimestamp={selectedDateTime ? Math.floor(new Date(selectedDateTime).getTime() / 1000) : Math.floor(Date.now() / 1000)}
                  onError={(error) => setError(error)}
                  isSearching={loading}
                  itemName={currentItemName}
                  onClose={closeVideoPlayer}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;