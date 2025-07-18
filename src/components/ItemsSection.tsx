import React, { useState, useCallback, useEffect } from 'react';
import { useItems } from '../hooks/useItems';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import ItemsTable from './ItemsTable';
import { automationAPI } from '../api/AutomationAPI';

interface ItemsSectionProps {
  onItemClick: (timestamp: number, designation: string, groupId: number) => void;
  onHealthCheck: () => void;
}


const ItemsSection: React.FC<ItemsSectionProps> = React.memo(({ onItemClick, onHealthCheck }) => {
  const { items, loading, error, refetch } = useItems();
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Memoized callbacks to prevent unnecessary re-renders
  const silentRefresh = useCallback(() => {
    refetch(true);
  }, [refetch]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(prev => !prev);
  }, []);

  useAutoRefresh(silentRefresh, 30000, autoRefreshEnabled); // 30 seconds instead of 5

  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString());
  
  // Update timestamp every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update automation API state when items change
  useEffect(() => {
    automationAPI.updateState({
      items: items.map((item, index) => ({
        id: index, // Use array index as ID since Item doesn't have an ID field
        epc: item.epc,
        designation: item.designation,
        timestamp: item.updated_atposix || item.sec, // Use updated_atposix or sec as timestamp
        groupId: item.group_id
      })),
      autoRefresh: autoRefreshEnabled,
      isLoading: loading,
      error: error
    });
  }, [items, autoRefreshEnabled, loading, error]);

  // Listen for external refresh requests
  useEffect(() => {
    const handleExternalRefresh = () => {
      silentRefresh();
    };

    window.addEventListener('cctv-refresh-requested', handleExternalRefresh);
    return () => window.removeEventListener('cctv-refresh-requested', handleExternalRefresh);
  }, [silentRefresh]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-brand-50 to-accent-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm3-1a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1H6zm2 4a1 1 0 000 2h8a1 1 0 100-2H8zm0 3a1 1 0 000 2h8a1 1 0 100-2H8zm0 3a1 1 0 000 2h8a1 1 0 100-2H8z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Inventaire en temps réel</h2>
                <p className="text-sm text-gray-600">Cliquez sur un élément pour voir les images CCTV</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={toggleAutoRefresh}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                  autoRefreshEnabled 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {autoRefreshEnabled ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Auto-refresh ON</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Auto-refresh OFF</span>
                  </>
                )}
              </button>
              <button 
                onClick={onHealthCheck}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>Health Check</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg shadow-sm animate-fade-in">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 font-medium">Erreur: {error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 bg-brand-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900">Chargement des éléments...</p>
            </div>
          </div>
        </div>
      )}

      {/* Items Table */}
      <ItemsTable items={items} onItemClick={onItemClick} />

      {/* Info Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-800 font-medium">Total Items: {items.length}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-800 font-medium">Dernière mise à jour: {currentTime}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-gray-800 font-medium">
              Auto-refresh: {autoRefreshEnabled ? 'Toutes les 30 secondes' : 'Désactivé'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-gray-600">Cliquez sur un élément pour voir les images CCTV</span>
          </div>
        </div>
      </div>
    </div>
  );
});

// Add display name for debugging
ItemsSection.displayName = 'ItemsSection';

export default ItemsSection;