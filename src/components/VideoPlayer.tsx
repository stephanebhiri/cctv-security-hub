import React, { useState } from 'react';

interface VideoPlayerProps {
  videoUrl: string | null;
  onError?: () => void;
  isSearching?: boolean;
  cameraAvailable?: boolean;
  cameraError?: string | null;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, onError, isSearching, cameraAvailable, cameraError }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = (event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video playback error:', event);
    setHasError(true);
    setIsLoading(false);
    onError?.();
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
    console.time('video-load-time');
    console.log('📼 Video loading started:', videoUrl);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setHasError(false);
    console.timeEnd('video-load-time');
    console.timeEnd('total-time-to-video-ready');
    console.log('✅ Video ready to play:', videoUrl);
  };

  if (!videoUrl) {
    console.log('❌ VideoPlayer: No video URL provided:', videoUrl);
    return (
      <div className="w-full aspect-video bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200 flex items-center justify-center">
        {isSearching ? (
          <div className="text-center">
            <div className="relative mb-6">
              <div className="w-12 h-12 bg-brand-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Recherche des vidéos...</h3>
            <p className="text-sm text-gray-600">Chargement en cours</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 2v-7l-4 2z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune vidéo sélectionnée</h3>
            <p className="text-sm text-gray-600">Cliquez sur un élément ou utilisez la recherche</p>
          </div>
        )}
      </div>
    );
  }
  
  console.log('🎥 VideoPlayer: Rendering video:', videoUrl);

  // Handle camera unavailable case
  if (cameraAvailable === false) {
    return (
      <div className="w-full aspect-video bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border border-orange-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12l2-2m0 0l2 2m-2-2v4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-orange-900 mb-2">Caméra non disponible</h3>
          <p className="text-sm text-orange-700 mb-4">
            {cameraError || 'La caméra n\'est pas accessible pour le moment'}
          </p>
          <p className="text-xs text-orange-600 mb-4 bg-orange-100 px-3 py-2 rounded">
            💡 Les autres caméras restent disponibles
          </p>
          {videoUrl && videoUrl.includes('videoerror.mp4') && (
            <div className="mt-4">
              <video
                className="w-32 h-18 mx-auto rounded object-contain bg-black"
                controls
                muted
                loop
                autoPlay
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full aspect-video bg-gradient-to-br from-red-50 to-red-100 rounded-2xl border border-red-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Erreur de chargement</h3>
          <p className="text-sm text-red-700 mb-4">La vidéo n'a pas pu être chargée (404 ou corrompue)</p>
          <p className="text-xs text-red-600 mb-4 font-mono bg-red-100 px-2 py-1 rounded truncate max-w-xs">
            {videoUrl}
          </p>
          <button 
            onClick={() => {
              setHasError(false);
              setIsLoading(true);
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-xl">
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-white text-sm font-medium">Téléchargement en cours...</p>
          </div>
        </div>
      )}
      <video
        className="w-full h-full object-contain"
        controls
        autoPlay
        onError={handleError}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        preload="metadata"
        key={videoUrl}
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;