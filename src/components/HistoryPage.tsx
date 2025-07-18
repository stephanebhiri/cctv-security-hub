import React, { useState, useEffect, useCallback } from 'react';
import { HistoryService, HistoryItem } from '../services/HistoryService';
import HistoryTable from './HistoryTable';
import SimpleMultiCameraView from './SimpleMultiCameraView';
import '../styles/history.css';

const HistoryPage: React.FC = () => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(50);
  
  // CCTV Modal state
  const [cctvModalOpen, setCctvModalOpen] = useState(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number>(0);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<'départ' | 'retour'>('départ');

  const historyService = new HistoryService();

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await historyService.getHistory();
      setHistoryItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleCCTVClick = useCallback((timestamp: number, designation: string, mode: 'départ' | 'retour') => {
    setSelectedTimestamp(timestamp);
    setSelectedItem(designation);
    setSelectedMode(mode);
    setCctvModalOpen(true);
  }, []);

  const handleCloseCCTV = useCallback(() => {
    setCctvModalOpen(false);
  }, []);

  const loadMore = useCallback((additionalItems: number) => {
    setLimit(prev => prev + additionalItems);
  }, []);

  const filteredAndLimitedItems = historyItems.slice(0, limit);

  if (loading) {
    return (
      <div className="history-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading history...</p>
        </div>
      </div>
    );
  }

  if (cctvModalOpen) {
    return (
      <div className="history-page">
        <div className="cctv-modal-overlay">
          <div className="cctv-modal-content">
            <div className="cctv-modal-header">
              <h2>📹 Video surveillance pour {selectedMode} de {selectedItem}</h2>
              <button onClick={handleCloseCCTV} className="modal-close">
                ✕ CLOSE
              </button>
            </div>
            <SimpleMultiCameraView
              targetTimestamp={selectedTimestamp}
              itemName={`${selectedItem} - ${selectedMode}`}
              onClose={handleCloseCCTV}
              onError={(error) => setError(error)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="logo-section">
            <img src="/assets/images/sigactua2.png" alt="Logo" className="img-logo" />
            <span className="text-logo">Inventory History</span>
          </div>
          <div className="nav-links">
            <a href="/" className="nav-link">Switch to Live</a>
            <a href="/timeline" className="nav-link">Switch to Timeline</a>
          </div>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="controls-section">
        <div className="search-container">
          <label htmlFor="search">Search ({historyItems.length} items)</label>
          <input 
            type="text" 
            id="search"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search designation, code, group, antenna..."
          />
        </div>

        <div className="load-more-buttons">
          <button onClick={() => loadMore(20)} className="btn btn-primary">
            Afficher +20
          </button>
          <button onClick={() => loadMore(200)} className="btn btn-primary">
            Afficher +200
          </button>
          <button onClick={() => loadMore(2000)} className="btn btn-primary">
            Afficher +2000
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={loadHistory} className="btn btn-secondary">
            Retry
          </button>
        </div>
      )}

      {/* History Table */}
      {!error && (
        <HistoryTable 
          items={filteredAndLimitedItems}
          onCCTVClick={handleCCTVClick}
          searchQuery={searchQuery}
        />
      )}

      {/* Show more indicator */}
      {filteredAndLimitedItems.length < historyItems.length && (
        <div className="more-items-indicator">
          <p>Showing {filteredAndLimitedItems.length} of {historyItems.length} items</p>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;