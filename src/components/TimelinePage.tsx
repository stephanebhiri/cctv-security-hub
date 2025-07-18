import React, { useEffect, useRef, useState } from 'react';
import { Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import '../styles/timeline.css';

interface TimelineItem {
  id: string;
  content: string;
  start: Date;
  end?: Date;
  group: string;
  type?: 'box' | 'point' | 'range' | 'background';
}

interface TimelineGroup {
  id: string;
  content: string;
}

interface TimelineEvent {
  id: string;
  text: string;
  start_date: string;
  end_date: string;
  section_id: string;
}

const TimelinePage: React.FC = () => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineInstance = useRef<Timeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState<'day' | 'week' | 'month' | 'year'>('week');

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
          fetch('/api/treehist', { headers: { 'Accept': 'application/json' } })
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
  }, []);

  // Create timeline when data is available AND ref is ready
  useEffect(() => {
    if (!timelineData || !timelineRef.current) {
      console.log('Not ready to create timeline:', { 
        hasData: !!timelineData, 
        hasRef: !!timelineRef.current 
      });
      return;
    }

    console.log('Creating timeline with ref:', timelineRef.current);

    try {
      const { groups, events } = timelineData;

      // Transform groups data for vis-timeline
      const timelineGroups = groups.map((group: any) => ({
        id: group.key.toString(),
        content: group.label,
        className: group.parent ? 'timeline-item' : 'timeline-group'
      }));

      // Transform events data for vis-timeline
      const timelineItems = events.map((event: TimelineEvent) => ({
        id: event.id,
        group: event.section_id,
        content: event.text,
        start: new Date(event.start_date),
        end: event.end_date ? new Date(event.end_date) : undefined,
        type: (event.end_date ? 'range' : 'point') as 'box' | 'point' | 'range' | 'background',
        className: 'timeline-event'
      }));

      // Timeline options
      const options = {
        width: '100%',
        height: '600px',
        stack: true,
        showMajorLabels: true,
        showMinorLabels: true,
        zoomable: true,
        moveable: true,
        orientation: 'top',
        locale: 'fr',
        format: {
          minorLabels: {
            millisecond: 'SSS',
            second: 's',
            minute: 'HH:mm',
            hour: 'HH:mm',
            weekday: 'ddd D',
            day: 'D',
            week: 'w',
            month: 'MMM',
            year: 'YYYY'
          },
          majorLabels: {
            millisecond: 'HH:mm:ss',
            second: 'D MMMM HH:mm',
            minute: 'ddd D MMMM',
            hour: 'ddd D MMMM',
            weekday: 'MMMM YYYY',
            day: 'MMMM YYYY',
            week: 'MMMM YYYY',
            month: 'YYYY',
            year: ''
          }
        },
        tooltip: {
          followMouse: true,
          overflowMethod: 'cap' as const
        }
      };

      // Destroy existing timeline
      if (timelineInstance.current) {
        timelineInstance.current.destroy();
      }

      // Create timeline
      timelineInstance.current = new Timeline(
        timelineRef.current,
        timelineItems,
        timelineGroups,
        options
      );

      // Handle item selection
      timelineInstance.current.on('select', (properties) => {
        if (properties.items.length > 0) {
          const selectedItem = timelineItems.find(item => item.id === properties.items[0]);
          if (selectedItem) {
            handleItemClick(selectedItem);
          }
        }
      });

      console.log('Timeline created successfully');
    } catch (err) {
      console.error('Error creating timeline:', err);
      setError(err instanceof Error ? err.message : 'Failed to create timeline');
    }

    return () => {
      if (timelineInstance.current) {
        timelineInstance.current.destroy();
        timelineInstance.current = null;
      }
    };
  }, [timelineData]);

  const handleItemClick = (item: TimelineItem) => {
    // Similar to the original timeline.html playerPop function
    const startPosix = Math.floor(item.start.getTime() / 1000);
    const endPosix = item.end ? Math.floor(item.end.getTime() / 1000) : startPosix;
    
    console.log('Timeline item clicked:', {
      item: item.content,
      start: startPosix,
      end: endPosix
    });

    // Here you could open a video player modal or navigate to the video player
    // For now, just log the event
    alert(`Élément: ${item.content}\nDébut: ${item.start.toLocaleString('fr-FR')}\nFin: ${item.end?.toLocaleString('fr-FR') || 'N/A'}`);
  };

  const handleTimeScaleChange = (scale: 'day' | 'week' | 'month' | 'year') => {
    setTimeScale(scale);
    
    if (!timelineInstance.current) return;

    const now = new Date();
    let range;

    switch (scale) {
      case 'day':
        range = {
          start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          end: new Date(now.getTime() + 24 * 60 * 60 * 1000)
        };
        break;
      case 'week':
        range = {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        };
        break;
      case 'month':
        range = {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        };
        break;
      case 'year':
        range = {
          start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          end: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        };
        break;
    }

    timelineInstance.current.setWindow(range.start, range.end);
  };

  const handleZoomChange = (zoomLevel: number) => {
    if (!timelineInstance.current) return;
    
    const range = timelineInstance.current.getWindow();
    const center = new Date((range.start.getTime() + range.end.getTime()) / 2);
    const duration = range.end.getTime() - range.start.getTime();
    const newDuration = duration / zoomLevel;
    
    timelineInstance.current.setWindow(
      new Date(center.getTime() - newDuration / 2),
      new Date(center.getTime() + newDuration / 2)
    );
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
          
          <div className="zoom-control">
            <label htmlFor="zoom-slider">ZOOM:</label>
            <input 
              type="range" 
              id="zoom-slider"
              min="0.1" 
              max="10" 
              step="0.1"
              defaultValue="1"
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="timeline-wrapper">
        <div ref={timelineRef} className="timeline-visualization" />
      </div>
    </div>
  );
};

export default TimelinePage;