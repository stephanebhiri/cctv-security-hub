import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

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
  height = 800,
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
    const groupHeight = 80; // Reasonable height for single lane with slight offset

    // Calculate total height needed for all groups
    const totalHeight = Math.max(height, groups.length * groupHeight + margin.top + margin.bottom + 50);
    
    // Create main SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', totalHeight);

    // Create main group for content
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create clip path for zooming
    svg.append('defs')
      .append('clipPath')
      .attr('id', 'timeline-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', groups.length * groupHeight);

    // Parse dates
    const parseTime = d3.timeParse('%Y-%m-%d %H:%M:%S');
    const parsedEvents = events.map(event => ({
      ...event,
      startDate: parseTime(event.start_date)!,
      endDate: event.end_date ? parseTime(event.end_date) : null
    }));

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

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${groups.length * groupHeight})`)
      .call(xAxis);

    // Create group lanes
    const groupLanes = g.selectAll('.group-lane')
      .data(groups)
      .enter()
      .append('g')
      .attr('class', 'group-lane')
      .attr('transform', (d, i) => `translate(0, ${i * groupHeight})`);

    // Add group background rectangles
    groupLanes.append('rect')
      .attr('width', innerWidth)
      .attr('height', groupHeight - 2)
      .attr('fill', (d, i) => i % 2 === 0 ? '#f8fafc' : '#ffffff')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1);

    // Add group labels (on left side)
    svg.append('g')
      .selectAll('.group-label')
      .data(groups)
      .enter()
      .append('text')
      .attr('x', 10)
      .attr('y', (d, i) => margin.top + i * groupHeight + groupHeight/2)
      .attr('dy', '0.35em')
      .text(d => d.label)
      .style('font-size', '14px')
      .style('font-weight', '500')
      .style('fill', '#2d3748');

    // Filter events to only show those in the current time window
    const recentEvents = parsedEvents.filter(event => 
      event.startDate >= startTime && event.startDate <= now
    );

    // Create zoomable content group
    const zoomGroup = g.append('g')
      .attr('class', 'zoom-group')
      .attr('clip-path', 'url(#timeline-clip)');

    // Simple single-lane positioning with slight random offset to break visual overlap
    const eventsWithPositions: any[] = recentEvents.map(event => {
      const groupIndex = groups.findIndex(g => g.key === event.section_id.toString());
      const baseY = groupIndex >= 0 ? groupIndex * groupHeight : 0;
      
      // Small random vertical offset (±8px) to break visual overlap without being "magnetic"
      const randomOffset = (Math.random() - 0.5) * 16; // -8 to +8 pixels
      
      return {
        ...event,
        yPosition: baseY + 30 + randomOffset // Center lane with slight randomization
      };
    });

    // Create timeline items
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
    items.filter(d => d.endDate !== null)
      .append('rect')
      .attr('x', d => xScale(d.startDate))
      .attr('y', d => d.yPosition)
      .attr('width', d => Math.max(xScale(d.endDate!) - xScale(d.startDate), 3))
      .attr('height', 38)
      .attr('rx', 6)
      .attr('fill', d => d.color)
      .attr('opacity', 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('opacity', 1)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2);
        
        const duration = d.endDate ? 
          `${Math.round((d.endDate.getTime() - d.startDate.getTime()) / (1000 * 60))} min` : 
          'En cours';
        
        tooltip.transition().duration(200).style('opacity', 1);
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
        d3.select(this)
          .attr('opacity', 0.8)
          .attr('stroke', 'none');
        
        tooltip.transition().duration(200).style('opacity', 0);
      });

    // Add point items (circles for ongoing events)
    items.filter(d => d.endDate === null)
      .append('circle')
      .attr('cx', d => xScale(d.startDate))
      .attr('cy', d => d.yPosition + 19) // Center in the lane
      .attr('r', 12)
      .attr('fill', d => d.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 16)
          .attr('stroke-width', 4);
        
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`
          <strong>${d.text}</strong><br/>
          Début: ${d.startDate.toLocaleString('fr-FR')}<br/>
          <span style="color: #ef4444;">● En cours</span>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 12)
          .attr('stroke-width', 3);
        
        tooltip.transition().duration(200).style('opacity', 0);
      });

    // Add text labels for items
    items.append('text')
      .attr('x', d => d.endDate !== null ? 
        xScale(d.startDate) + (xScale(d.endDate!) - xScale(d.startDate)) / 2 : 
        xScale(d.startDate))
      .attr('y', d => d.yPosition + 19) // Center in the lane
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .text(d => d.text.length > 12 ? d.text.substring(0, 12) + '...' : d.text)
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('fill', '#ffffff')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.8)');

    // Add current time indicator
    const currentTime = new Date();
    const currentTimeLine = g.append('line')
      .attr('class', 'current-time-line')
      .attr('x1', xScale(currentTime))
      .attr('x2', xScale(currentTime))
      .attr('y1', 0)
      .attr('y2', groups.length * groupHeight)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4')
      .style('opacity', 0.8);

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
    <div className="d3-timeline-container">
      <svg ref={svgRef} className="d3-timeline-svg" />
    </div>
  );
};

export default D3Timeline;