import React, { useState, useEffect, useRef } from 'react';
import Timeline from 'react-calendar-timeline';
import 'react-calendar-timeline/lib/Timeline.css';
import moment from 'moment';
import '../styles/react-calendar-timeline.css';

interface TimelineGroup {
  key: string;
  label: string;
  color: string | null;
}

interface TimelineEvent {
  id: string;
  rfid_tag_id: string;
  text: string;
  start_date: string;
  end_date: string | null;
  section_id: string;
  color: string;
}

interface ReactCalendarTimelineProps {
  groups: TimelineGroup[];
  events: TimelineEvent[];
  onItemClick?: (event: TimelineEvent) => void;
  timeScale?: 'day' | 'week' | 'month' | 'year';
}

const ReactCalendarTimeline: React.FC<ReactCalendarTimelineProps> = ({
  groups,
  events,
  onItemClick,
  timeScale = 'day'
}) => {
  const timelineRef = useRef<any>(null);
  // Initialize with a reasonable default range
  const [visibleTimeStart, setVisibleTimeStart] = useState(moment().subtract(1, 'week').valueOf());
  const [visibleTimeEnd, setVisibleTimeEnd] = useState(moment().add(1, 'week').valueOf());

  console.log('ReactCalendarTimeline props:', { groups: groups.length, events: events.length });

  // Transform groups for react-calendar-timeline
  const calendarGroups = groups.map(group => ({
    id: group.key,
    title: group.label,
    rightTitle: group.label
  }));

  // Transform events for react-calendar-timeline
  const calendarItems = events
    .filter(event => {
      // Only show events with valid dates
      const startDate = moment(event.start_date);
      const isValid = startDate.isValid();
      if (!isValid) {
        console.log('Invalid date for event:', event);
      }
      return isValid;
    })
    .map((event, index) => {
      const startTime = moment(event.start_date);
      const endTime = event.end_date ? moment(event.end_date) : moment(event.start_date).add(30, 'minutes');
      
      // Log first few events to debug date format
      if (index < 3) {
        console.log('Event sample:', {
          originalStartDate: event.start_date,
          parsedStartDate: startTime.format(),
          timestamp: startTime.valueOf()
        });
      }
      
      const item = {
        id: event.id,
        group: event.section_id,
        title: event.text,
        start_time: startTime.valueOf(),
        end_time: endTime.valueOf(),
        itemProps: {
          style: {
            background: event.color || '#667eea',
            border: 'none',
            borderRadius: '4px',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: '500'
          }
        },
        originalEvent: event
      };
      
      return item;
    });

  console.log('Transformed calendar items:', calendarItems.length, calendarItems.slice(0, 3));
  
  // Log date range of items
  if (calendarItems.length > 0) {
    const dates = calendarItems.map(item => item.start_time);
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    console.log('Event date range:', {
      min: moment(minDate).format(),
      max: moment(maxDate).format(),
      minValue: minDate,
      maxValue: maxDate
    });
  }

  // Update visible time range based on timeScale and event dates
  useEffect(() => {
    if (calendarItems.length === 0) return;
    
    // Find the most recent event
    const mostRecentTime = Math.max(...calendarItems.map(item => item.start_time));
    const centerTime = moment(mostRecentTime);
    
    let start, end;

    switch (timeScale) {
      case 'day':
        start = centerTime.clone().subtract(12, 'hours');
        end = centerTime.clone().add(12, 'hours');
        break;
      case 'week':
        start = centerTime.clone().subtract(3, 'days');
        end = centerTime.clone().add(4, 'days');
        break;
      case 'month':
        start = centerTime.clone().subtract(15, 'days');
        end = centerTime.clone().add(15, 'days');
        break;
      case 'year':
        start = centerTime.clone().subtract(6, 'months');
        end = centerTime.clone().add(6, 'months');
        break;
      default:
        start = centerTime.clone().subtract(12, 'hours');
        end = centerTime.clone().add(12, 'hours');
    }

    console.log('Time window:', {
      timeScale,
      centerTime: centerTime.format(),
      start: start.format(),
      end: end.format(),
      startValue: start.valueOf(),
      endValue: end.valueOf()
    });

    setVisibleTimeStart(start.valueOf());
    setVisibleTimeEnd(end.valueOf());
  }, [timeScale, calendarItems]);

  const handleItemClick = (itemId: any, e: any, time: number) => {
    const clickedItem = calendarItems.find(item => item.id === itemId);
    if (clickedItem && onItemClick) {
      onItemClick(clickedItem.originalEvent);
    }
  };

  const handleTimeChange = (visibleTimeStart: number, visibleTimeEnd: number, updateScrollCanvas: any) => {
    // Just log changes, don't interfere with timeline state
    console.log('Time changed:', {
      start: moment(visibleTimeStart).format(),
      end: moment(visibleTimeEnd).format()
    });
  };

  // Handle mouse wheel zoom
  const handleCanvasContextMenu = (group: any, time: number, e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  // Add zoom controls by simulating wheel events
  const handleZoomIn = () => {
    const timelineElement = document.querySelector('.react-calendar-timeline');
    if (timelineElement) {
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: false,
        bubbles: true,
        cancelable: true
      });
      timelineElement.dispatchEvent(wheelEvent);
    }
  };

  const handleZoomOut = () => {
    const timelineElement = document.querySelector('.react-calendar-timeline');
    if (timelineElement) {
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100,
        ctrlKey: false,
        bubbles: true,
        cancelable: true
      });
      timelineElement.dispatchEvent(wheelEvent);
    }
  };

  return (
    <div className="react-calendar-timeline-wrapper">
      <div className="react-calendar-timeline-controls">
        <span className="zoom-info">💡 Use mouse wheel over timeline to zoom in/out</span>
      </div>
      <div className="react-calendar-timeline-container react-calendar-timeline" style={{ height: '750px', overflowY: 'auto' }}>
        <Timeline
        groups={calendarGroups}
        items={calendarItems}
        defaultTimeStart={visibleTimeStart}
        defaultTimeEnd={visibleTimeEnd}
        onTimeChange={handleTimeChange}
        onItemClick={handleItemClick}
        canMove={false}
        canResize={false}
        stackItems={true}
        lineHeight={100}
        itemHeightRatio={0.5}
        itemTouchSendsClick={true}
        traditionalZoom={true}
        buffer={1}
        timeSteps={{
          second: 1,
          minute: 1,
          hour: 1,
          day: 1,
          month: 1,
          year: 1
        }}
        sidebarContent={<div>Zones RFID</div>}
        rightSidebarContent={<div></div>}
        minZoom={1000} // 1 second for very fine zoom
        maxZoom={5 * 365.24 * 86400 * 1000} // 5 years
        sidebarWidth={200}
        rightSidebarWidth={0}
        canChangeGroup={false}
        canSelect={true}
        horizontalLineClassNamesForGroup={(group) => [`group-${group.id}`]}
        onZoom={(timelineContext) => {
          console.log('Zoom event fired:', timelineContext);
        }}
        itemRenderer={({ item, itemContext, getItemProps, getResizeProps }) => {
          const { left: leftResizeProps, right: rightResizeProps } = getResizeProps();
          const backgroundColor = item.itemProps?.style?.background || '#667eea';
          
          return (
            <div
              {...getItemProps({
                style: {
                  backgroundColor,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '4px 8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  cursor: 'pointer'
                }
              })}
            >
              {leftResizeProps && <div {...leftResizeProps} />}
              <div
                style={{
                  height: itemContext.dimensions.height,
                  overflow: 'hidden',
                  paddingLeft: 3,
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {itemContext.title}
              </div>
              {rightResizeProps && <div {...rightResizeProps} />}
            </div>
          );
        }}
      />
      </div>
    </div>
  );
};

export default ReactCalendarTimeline;