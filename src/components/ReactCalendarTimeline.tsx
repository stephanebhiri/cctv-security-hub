import React, { useState, useEffect } from 'react';
import Timeline from 'react-calendar-timeline';
import moment from 'moment';
import '../styles/react-calendar-timeline.css';

interface TimelineGroup {
  key: string;
  label: string;
  color: string | null;
}

interface TimelineEvent {
  id: string;
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
  const [visibleTimeStart, setVisibleTimeStart] = useState(moment().startOf('day').valueOf());
  const [visibleTimeEnd, setVisibleTimeEnd] = useState(moment().endOf('day').valueOf());

  // Transform groups for react-calendar-timeline
  const calendarGroups = groups.map(group => ({
    id: group.key,
    title: group.label,
    rightTitle: group.label,
    stackItems: false
  }));

  // Transform events for react-calendar-timeline
  const calendarItems = events
    .filter(event => {
      // Only show events with valid dates
      const startDate = moment(event.start_date);
      return startDate.isValid();
    })
    .map(event => {
      const startTime = moment(event.start_date);
      const endTime = event.end_date ? moment(event.end_date) : moment(event.start_date).add(30, 'minutes');
      
      return {
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
    });

  // Update visible time range based on timeScale
  useEffect(() => {
    const now = moment();
    let start, end;

    switch (timeScale) {
      case 'day':
        start = now.clone().subtract(12, 'hours');
        end = now.clone().add(12, 'hours');
        break;
      case 'week':
        start = now.clone().startOf('week');
        end = now.clone().endOf('week');
        break;
      case 'month':
        start = now.clone().startOf('month');
        end = now.clone().endOf('month');
        break;
      case 'year':
        start = now.clone().startOf('year');
        end = now.clone().endOf('year');
        break;
      default:
        start = now.clone().subtract(12, 'hours');
        end = now.clone().add(12, 'hours');
    }

    setVisibleTimeStart(start.valueOf());
    setVisibleTimeEnd(end.valueOf());
  }, [timeScale]);

  const handleItemClick = (itemId: any, e: any, time: number) => {
    const clickedItem = calendarItems.find(item => item.id === itemId);
    if (clickedItem && onItemClick) {
      onItemClick(clickedItem.originalEvent);
    }
  };

  const handleTimeChange = (visibleTimeStart: number, visibleTimeEnd: number) => {
    setVisibleTimeStart(visibleTimeStart);
    setVisibleTimeEnd(visibleTimeEnd);
  };

  return (
    <div className="react-calendar-timeline-container">
      <Timeline
        groups={calendarGroups}
        items={calendarItems}
        visibleTimeStart={visibleTimeStart}
        visibleTimeEnd={visibleTimeEnd}
        onTimeChange={handleTimeChange}
        onItemClick={handleItemClick}
        canMove={false}
        canResize={false}
        stackItems={false}
        lineHeight={60}
        itemHeightRatio={0.75}
        buffer={1}
        traditionalZoom={true}
        sidebarContent={<div>Zones RFID</div>}
        rightSidebarContent={<div></div>}
        dragSnap={15 * 60 * 1000} // 15 minutes
        minZoom={60 * 1000} // 1 minute
        maxZoom={365.24 * 86400 * 1000} // 1 year
        sidebarWidth={200}
        rightSidebarWidth={0}
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
  );
};

export default ReactCalendarTimeline;