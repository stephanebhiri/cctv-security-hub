import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

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

interface D3TimelineProps {
  groups: TimelineGroup[];
  events: TimelineEvent[];
  onItemClick?: (event: TimelineEvent) => void;
  width?: number;
  height?: number;
  timeScale?: 'day' | 'week' | 'month' | 'year';
}

const D3Timeline: React.FC<D3TimelineProps> = ({
  groups,
  events,
  onItemClick,
  width = 1200,
  height = 600, // Minimum height, will be expanded based on groups
  timeScale = 'day'
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!svgRef.current || !groups.length || !events.length) return;

    setIsLoading(true);
    
    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions and margins
    const margin = { top: 40, right: 40, bottom: 60, left: 220 };
    const innerWidth = width - margin.left - margin.right;
    const groupHeight = 220; // Height for 8 lanes with 25px spacing + margin

    // Calculate total height needed for all groups (will be updated after calculating lanes)
    let totalHeight = Math.max(height, groups.length * groupHeight + margin.top + margin.bottom + 50);
    
    // Create main SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', totalHeight);

    // Create main group for content
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Clip path will be created after calculating total height

    // Parse dates
    const parseTime = d3.timeParse('%Y-%m-%d %H:%M:%S');
    const parsedEvents = events.map(event => {
      const startDate = parseTime(event.start_date) || new Date(event.start_date);
      const endDate = event.end_date ? (parseTime(event.end_date) || new Date(event.end_date)) : null;
      
      if (!parseTime(event.start_date)) {
        console.warn('Failed to parse date with d3.timeParse:', event.start_date, '- using Date constructor');
      }
      
      return {
        ...event,
        startDate,
        endDate
      };
    });

    // Create time scale based on timeScale prop
    const now = new Date();
    let timeWindow;
    
    switch (timeScale) {
      case 'day':
        timeWindow = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case 'week':
        timeWindow = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case 'month':
        timeWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      case 'year':
        timeWindow = 365 * 24 * 60 * 60 * 1000; // 365 days
        break;
      default:
        timeWindow = 24 * 60 * 60 * 1000;
    }
    
    const startTime = new Date(now.getTime() - timeWindow);
    
    const xScale = d3.scaleTime()
      .domain([startTime, now])
      .range([0, innerWidth]);

    // Create time axis with appropriate format and ticks based on scale
    let tickFormat, tickCount;
    switch (timeScale) {
      case 'day':
        tickFormat = d3.timeFormat('%H:%M');
        tickCount = 12;
        break;
      case 'week':
        tickFormat = d3.timeFormat('%d/%m');
        tickCount = 7;
        break;
      case 'month':
        tickFormat = d3.timeFormat('%d/%m');
        tickCount = 10;
        break;
      case 'year':
        tickFormat = d3.timeFormat('%m/%Y');
        tickCount = 12;
        break;
      default:
        tickFormat = d3.timeFormat('%H:%M');
        tickCount = 12;
    }
    
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(tickFormat as any)
      .ticks(tickCount);

    // X-axis will be positioned after calculating group heights
      

    // Filter events to only show those in the current time window
    const recentEvents = parsedEvents.filter(event => 
      event.startDate >= startTime && event.startDate <= now
    );
    
    console.log('D3Timeline debug:', {
      totalEvents: events.length,
      parsedEvents: parsedEvents.length,
      recentEvents: recentEvents.length,
      startTime,
      now,
      timeScale
    });
    
    // Count unique groups including virtual ones from events
    const eventGroupIds = new Set(recentEvents.map(e => e.section_id.toString()));
    const virtualGroups = Array.from(eventGroupIds).filter(gId => !groups.some(g => g.key === gId));
    const totalGroupsCount = groups.length + virtualGroups.length;
    
    // Rendering will be done after lane assignment

    // Create zoomable content group FIRST (before backgrounds)
    const zoomGroup = g.append('g')
      .attr('class', 'zoom-group')
      .attr('clip-path', 'url(#timeline-clip)');

    // Dedicated lane assignment - each item gets its own permanent lane
    const eventsWithPositions: any[] = [];
    
    // Create a stable mapping of RFID tags to lanes within each group
    const rfidToLane: { [groupId: string]: { [rfidId: string]: number } } = {};
    const groupLaneCounters: { [groupId: string]: number } = {};
    
    // First pass: assign lanes to unique RFID tags
    const uniqueRfidTags = new Set();
    recentEvents.forEach(event => {
      const groupId = event.section_id.toString();
      const rfidId = event.rfid_tag_id;
      const uniqueKey = `${groupId}-${rfidId}`;
      
      if (!uniqueRfidTags.has(uniqueKey)) {
        uniqueRfidTags.add(uniqueKey);
        
        // Check if this group exists in the groups list  
        // const groupExists = groups.some(g => g.key === groupId);
        // if (!groupExists) {
        //   console.warn(`⚠️ Event in Group ${groupId} but group not in timeline groups list!`);
        // } // Disabled for performance
        
        if (!rfidToLane[groupId]) {
          rfidToLane[groupId] = {};
          groupLaneCounters[groupId] = 0;
        }
        
        if (!rfidToLane[groupId][rfidId]) {
          rfidToLane[groupId][rfidId] = groupLaneCounters[groupId];
          // console.log(`🏁 Lane assigned: Group ${groupId}, RFID ${rfidId} -> Lane ${groupLaneCounters[groupId]}`); // Disabled for performance
          groupLaneCounters[groupId]++;
        }
      }
    });
    
    // Calculate adaptive group heights based on actual lane counts
    const groupHeights: { [groupId: string]: number } = {};
    const baseHeightPerLane = 30; // Height per lane
    const minGroupHeight = 60; // Minimum height per group
    
    // Calculate heights for real groups
    groups.forEach(group => {
      const groupId = group.key;
      const lanesInGroup = groupLaneCounters[groupId] || 1;
      groupHeights[groupId] = Math.max(minGroupHeight, lanesInGroup * baseHeightPerLane + 20);
    });
    
    // Calculate heights for virtual groups
    virtualGroups.forEach(groupId => {
      const lanesInGroup = groupLaneCounters[groupId] || 1;
      groupHeights[groupId] = Math.max(minGroupHeight, lanesInGroup * baseHeightPerLane + 20);
    });
    
    // Calculate cumulative Y positions for groups
    const groupYPositions: { [groupId: string]: number } = {};
    let cumulativeY = 0;
    
    // Real groups first
    groups.forEach(group => {
      groupYPositions[group.key] = cumulativeY;
      cumulativeY += groupHeights[group.key];
    });
    
    // Virtual groups after
    virtualGroups.forEach(groupId => {
      groupYPositions[groupId] = cumulativeY;
      cumulativeY += groupHeights[groupId];
    });
    
    // Sort events by start time for consistent lane assignment
    const sortedEvents = recentEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    
    // Second pass: assign positions using the stable lane mapping
    sortedEvents.forEach(event => {
      const groupId = event.section_id.toString();
      const rfidId = event.rfid_tag_id;
      let groupIndex = groups.findIndex(g => g.key === groupId);
      
      // Use adaptive group positioning
      const baseY = groupYPositions[groupId] || 0;
      
      // Get the pre-assigned lane for this RFID tag
      const assignedLane = rfidToLane[groupId] && rfidToLane[groupId][rfidId] !== undefined 
        ? rfidToLane[groupId][rfidId] 
        : 0; // Fallback to lane 0 if somehow not found
      
      // Calculate Y position based on assigned lane with adaptive spacing
      const laneY = baseY + 10 + (assignedLane * baseHeightPerLane);
      
      eventsWithPositions.push({
        ...event,
        yPosition: laneY,
        assignedLane: assignedLane,
        rfidId: rfidId
      });
      
      // console.log(`📍 Event positioned: Group ${groupId}, "${event.text}" (${rfidId}) -> Lane ${assignedLane}`); // Disabled for performance
    });

    // Update total height and SVG
    totalHeight = Math.max(height, cumulativeY + margin.top + margin.bottom + 50);
    svg.attr('height', totalHeight);
    
    // Create clip path with correct height
    svg.append('defs')
      .append('clipPath')
      .attr('id', 'timeline-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', cumulativeY);
    
    // Create adaptive group backgrounds and labels
    const allGroupData = [
      ...groups.map(g => ({ ...g, isVirtual: false })),
      ...virtualGroups.map(id => ({ key: id, label: `Virtual Group ${id}`, isVirtual: true }))
    ];
    
    // Add group background rectangles INSIDE zoomGroup (behind items)
    zoomGroup.selectAll('.group-background')
      .data(allGroupData)
      .enter()
      .append('rect')
      .attr('class', 'group-background')
      .attr('x', 0)
      .attr('y', d => groupYPositions[d.key])
      .attr('width', innerWidth)
      .attr('height', d => groupHeights[d.key] - 2)
      .attr('fill', (d, i) => i % 2 === 0 ? '#f8fafc' : '#ffffff');
    
    // Add group labels
    svg.append('g')
      .selectAll('.group-label')
      .data(allGroupData)
      .enter()
      .append('text')
      .attr('class', 'group-label')
      .attr('x', 10)
      .attr('y', d => margin.top + groupYPositions[d.key] + groupHeights[d.key]/2)
      .attr('dy', '0.35em')
      .text(d => d.label)
      .style('font-size', '14px')
      .style('font-weight', '500')
      .style('fill', d => d.isVirtual ? '#e53e3e' : '#2d3748');
      
    // Add X-axis at the bottom
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${cumulativeY})`)
      .call(xAxis);

    // Create timeline items
    console.log('Creating items with positions:', eventsWithPositions.length);
    const items = zoomGroup.selectAll('.timeline-item')
      .data(eventsWithPositions)
      .enter()
      .append('g')
      .attr('class', 'timeline-item')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (onItemClick) onItemClick(d);
      });

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-timeline-tooltip')
      .style('position', 'absolute')
      .style('padding', '8px 12px')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    // Add range items (rectangles)
    const rangeItems = items.filter(d => d.endDate !== null);
    console.log('Range items (with end date):', rangeItems.size());
    
    rangeItems.append('rect')
      .attr('x', d => xScale(d.startDate))
      .attr('y', d => d.yPosition)
      .attr('width', d => {
        const width = Math.max(xScale(d.endDate!) - xScale(d.startDate), 3);
        if (d.id === eventsWithPositions[0]?.id) {
          console.log('First rect dimensions:', {
            x: xScale(d.startDate),
            y: d.yPosition,
            width,
            color: d.color,
            startDate: d.startDate,
            endDate: d.endDate,
            xScaleStart: xScale(d.startDate),
            xScaleEnd: xScale(d.endDate),
            domain: xScale.domain(),
            range: xScale.range()
          });
        }
        return width;
      })
      .attr('height', 20)
      .attr('rx', 6)
      .attr('fill', d => d.color)
      .on('mouseover', function(event, d) {
        const duration = d.endDate ? 
          `${Math.round((d.endDate.getTime() - d.startDate.getTime()) / (1000 * 60))} min` : 
          'En cours';
        
        tooltip.style('opacity', 1);
        tooltip.html(`
          <strong>${d.text}</strong><br/>
          Début: ${d.startDate.toLocaleString('fr-FR')}<br/>
          Fin: ${d.endDate?.toLocaleString('fr-FR') || 'En cours'}<br/>
          Durée: ${duration}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        tooltip.style('opacity', 0);
      });

    // Add point items (circles for ongoing events)
    const pointItems = items.filter(d => d.endDate === null);
    console.log('Point items (no end date):', pointItems.size());
    
    pointItems.append('circle')
      .attr('cx', d => xScale(d.startDate))
      .attr('cy', d => d.yPosition + 10) // Center in the lane
      .attr('r', 12)
      .attr('fill', d => d.color)
      .on('mouseover', function(event, d) {
        tooltip.style('opacity', 1);
        tooltip.html(`
          <strong>${d.text}</strong><br/>
          Début: ${d.startDate.toLocaleString('fr-FR')}<br/>
          <span style="color: #ef4444;">● En cours</span>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        tooltip.style('opacity', 0);
      });

    // Add lane labels that span the full width
    // Collect unique lanes and their labels - group by RFID tag, not by event
    const rfidLanes: { [key: string]: { text: string, y: number, rfidId: string } } = {};
    
    eventsWithPositions.forEach(event => {
      const laneKey = `${event.section_id}-${event.assignedLane}`;
      const rfidId = event.rfid_tag_id;
      
      if (!rfidLanes[laneKey]) {
        rfidLanes[laneKey] = {
          text: event.text, // Use item designation
          y: event.yPosition,
          rfidId: rfidId
        };
      } else {
        // Verify it's the same RFID tag (should be, but let's check)
        if (rfidLanes[laneKey].rfidId !== rfidId) {
          console.warn(`🚨 REAL conflict! Lane ${laneKey}: RFID "${rfidLanes[laneKey].rfidId}" vs "${rfidId}"`);
          rfidLanes[laneKey].text = `${rfidLanes[laneKey].text} / ${event.text}`;
        }
        // Same RFID tag, same lane - that's expected, no need to change the label
      }
    });
    
    // Convert to the expected format
    const laneLabels: { [key: string]: { text: string, y: number } } = {};
    Object.entries(rfidLanes).forEach(([key, value]) => {
      laneLabels[key] = { text: value.text, y: value.y };
    });
    
    // Create lane background and labels
    Object.entries(laneLabels).forEach(([laneKey, lane]) => {
      const [groupId, laneNum] = laneKey.split('-');
      
      // Simplified lane background 
      zoomGroup.append('rect')
        .attr('x', 0)
        .attr('y', lane.y - 2)
        .attr('width', innerWidth)
        .attr('height', 20)
        .attr('fill', 'rgba(255,255,255,0.1)')
        .style('pointer-events', 'none');
      
      // Lane label text with group info for debugging
      zoomGroup.append('text')
        .attr('x', 10) // Left margin
        .attr('y', lane.y + 10)
        .attr('dy', '0.35em')
        .text(`[G${groupId}] ${lane.text}`) // Show group ID to see the separation
        .style('font-size', '11px')
        .style('font-weight', '500')
        .style('fill', '#000000')
        .style('pointer-events', 'none'); // Removed text-shadow for performance
    });

    // Add current time indicator
    const currentTime = new Date();
    const currentTimeLine = g.append('line')
      .attr('class', 'current-time-line')
      .attr('x1', xScale(currentTime))
      .attr('x2', xScale(currentTime))
      .attr('y1', 0)
      .attr('y2', cumulativeY)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 1); // Simplified - no dashed lines or opacity

    // Add zoom and pan behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 50])
      .on('zoom', (event) => {
        const { transform } = event;
        
        // Update x scale with zoom transform
        const newXScale = transform.rescaleX(xScale);
        
        // Update axis
        g.select('.x-axis').call(xAxis.scale(newXScale) as any);
        
        // Update items positions (only X positions change during zoom, Y positions stay the same)
        zoomGroup.selectAll('.timeline-item rect')
          .attr('x', (d: any) => newXScale(d.startDate))
          .attr('width', (d: any) => d.endDate ? Math.max(newXScale(d.endDate) - newXScale(d.startDate), 2) : 0);
        
        zoomGroup.selectAll('.timeline-item circle')
          .attr('cx', (d: any) => newXScale(d.startDate));
        
        zoomGroup.selectAll('.timeline-item text')
          .attr('x', (d: any) => d.endDate !== null ? 
            newXScale(d.startDate) + (newXScale(d.endDate!) - newXScale(d.startDate)) / 2 : 
            newXScale(d.startDate));

        // Update current time line
        currentTimeLine
          .attr('x1', newXScale(currentTime))
          .attr('x2', newXScale(currentTime));
      });

    // Apply zoom to SVG
    svg.call(zoom);

    setIsLoading(false);

    // Cleanup function
    return () => {
      tooltip.remove();
    };

  }, [groups, events, onItemClick, width, height, timeScale]);

  if (isLoading) {
    return (
      <div className="d3-timeline-loading">
        <div className="loading-spinner">Rendering timeline...</div>
      </div>
    );
  }

  return (
    <div className="d3-timeline-container" style={{ height: '800px', overflowY: 'auto' }}>
      <svg ref={svgRef} className="d3-timeline-svg" style={{ height: 'auto', minHeight: '800px' }} />
    </div>
  );
};

export default D3Timeline;