import React, { useEffect, useState } from 'react';
// vis-timeline imports removed - D3.js only
// Timeline styles are now included in the main design system
import D3Timeline from './D3Timeline';
// ReactCalendarTimeline removed - D3.js only

// Vis-timeline interfaces removed - D3.js only

interface TimelineEvent {
  id: string;
  rfid_tag_id: string;
  text: string;
  start_date: string;
  end_date: string | null;
  section_id: string;
  color: string;
}

const TimelinePage: React.FC = () => {
  // Timeline ref removed - D3.js only
  // Timeline instance removed - D3.js only
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState<'day' | 'week' | 'month' | 'year'>('day');
  // Force D3.js timeline only - no buttons needed

  console.log('TimelinePage component rendered');

  // Separate data fetching and timeline creation
  const [timelineData, setTimelineData] = useState<{groups: any[], events: TimelineEvent[]} | null>(null);

  // Fetch data first
  useEffect(() => {
    const fetchTimelineData = async () => {
      console.log('Fetching timeline data...');
      try {
        setLoading(true);
        setError(null);

        const [groupsResponse, eventsResponse] = await Promise.all([
          fetch('/api/tree', { headers: { 'Accept': 'application/json' } }),
          fetch(`/api/treehist?timeScale=${timeScale}`, { headers: { 'Accept': 'application/json' } })
        ]);

        if (!groupsResponse.ok || !eventsResponse.ok) {
          throw new Error('Failed to fetch timeline data');
        }

        const groups = await groupsResponse.json();
        const events: TimelineEvent[] = await eventsResponse.json();
        
        console.log('Timeline data loaded:', { groups, events });
        setTimelineData({ groups, events });
        setLoading(false);
      } catch (err) {
        console.error('Error loading timeline data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load timeline data');
        setLoading(false);
      }
    };

    fetchTimelineData();
  }, [timeScale]);

  // Vis-timeline removed - D3.js only

  // handleItemClick removed - using D3Timeline handleD3ItemClick instead

  const handleD3ItemClick = (event: TimelineEvent) => {
    const startDate = new Date(event.start_date);
    const endDate = event.end_date ? new Date(event.end_date) : null;
    const startPosix = Math.floor(startDate.getTime() / 1000);
    const endPosix = endDate ? Math.floor(endDate.getTime() / 1000) : startPosix;
    
    console.log('D3 Timeline item clicked:', {
      item: event.text,
      start: startPosix,
      end: endPosix
    });

    // Launch video player with time range
    alert(`Élément: ${event.text}\nDébut: ${startDate.toLocaleString('fr-FR')}\nFin: ${endDate?.toLocaleString('fr-FR') || 'En cours'}`);
  };

  const handleTimeScaleChange = (scale: 'day' | 'week' | 'month' | 'year') => {
    setTimeScale(scale);
    // D3Timeline handles time scale internally - no manual range setting needed
  };

  if (loading) {
    return (
      <div className="timeline-container">
        <div className="timeline-header">
          <h1>Timeline - Historique RFID</h1>
          <div className="loading-spinner">Chargement...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="timeline-container">
        <div className="timeline-header">
          <h1>Timeline - Historique RFID</h1>
          <div className="error-message">Erreur: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <div className="timeline-title">
          <h1>Historique de détection RFID</h1>
          <p>Les éléments colorés indiquent l'absence de détection</p>
          <small>Cliquer sur les éléments pour afficher la vidéo-surveillance</small>
        </div>
        
        <div className="timeline-controls">
          {/* Timeline selector buttons removed - D3.js only */}

          <div className="scale-buttons">
            <button 
              type="button" 
              className={`btn-scale ${timeScale === 'day' ? 'active' : ''}`}
              onClick={() => handleTimeScaleChange('day')}
            >
              24h
            </button>
            <button 
              type="button" 
              className={`btn-scale ${timeScale === 'week' ? 'active' : ''}`}
              onClick={() => handleTimeScaleChange('week')}
            >
              Semaine
            </button>
            <button 
              type="button" 
              className={`btn-scale ${timeScale === 'month' ? 'active' : ''}`}
              onClick={() => handleTimeScaleChange('month')}
            >
              Mois
            </button>
            <button 
              type="button" 
              className={`btn-scale ${timeScale === 'year' ? 'active' : ''}`}
              onClick={() => handleTimeScaleChange('year')}
            >
              Année
            </button>
          </div>
          
          {/* Zoom control removed - D3.js handles zoom natively with mouse wheel */}
        </div>
      </div>

      <div className="timeline-wrapper">
        {timelineData ? (
          <D3Timeline
            groups={timelineData.groups}
            events={timelineData.events}
            onItemClick={handleD3ItemClick}
            width={1200}
            timeScale={timeScale}
          />
        ) : null}
      </div>
    </div>
  );
};

export default TimelinePage;