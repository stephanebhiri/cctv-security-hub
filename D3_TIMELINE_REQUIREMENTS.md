# D3.js Timeline Implementation Requirements

## Project Context
Replace vis-timeline with a custom D3.js implementation that provides precise control over item positioning without auto-stacking/rearrangement behavior.

## Current Pain Points with vis-timeline
- **Auto-stacking**: Items automatically rearrange vertically (like FCPX), we want DaVinci-style precise positioning
- **No control**: Cannot disable the "helpful" auto-organization behavior
- **Overlapping vs Auto-arrange**: Forced choice between overlapping items or auto-stacking

## Core Requirements

### 1. Data Structure
**Groups API** (`/api/tree`):
```json
[
  {"key":"1","label":"📹 ENG1","parent":null,"open":true,"color":"darkred"},
  {"key":"2","label":"🎥 ENG2","parent":null,"open":true,"color":"dodgerblue"},
  // ... other groups (exclude group 9: ZZ_Not_Reg)
]
```

**Events API** (`/api/treehist`):
```json
[
  {
    "id": "123",
    "text": "Camera XYZ", 
    "start_date": "2024-12-01 14:30:00",
    "end_date": "2024-12-01 16:45:00", // can be null for ongoing
    "section_id": "1", // group_id
    "color": "#ef4444" // red if no end_date, else group color
  }
]
```

### 2. Visual Layout Requirements

#### Timeline Structure
- **Horizontal axis**: Time (zoomable, pannable)
- **Vertical axis**: Groups (fixed order by group_id)
- **Groups**: Fixed height rows (60px each), always visible even when empty
- **Items**: Positioned exactly at their temporal location (NO auto-stacking)

#### Group Display
- Each group gets a dedicated horizontal lane
- Group labels on the left panel with icons and colors
- Minimum 60px height per group
- Groups sorted by numeric group_id (1, 2, 3, etc.)
- All groups visible even if no events in time period

#### Item Display
- **Range items**: Rectangle from start_date to end_date
- **Point items**: Circle/dot if no end_date (ongoing events)
- **Positioning**: Exact temporal position (overlap allowed)
- **Colors**: Red (#ef4444) if ongoing, otherwise group color
- **No stacking**: Items can overlap - this is acceptable

### 3. Interaction Requirements

#### Navigation
- **Zoom**: Mouse wheel or pinch (time axis only)
- **Pan**: Click and drag (time axis only)
- **Time controls**: Buttons for 24h, Week, Month, Year views
- **Live time indicator**: Current time line

#### Item Interaction
- **Click**: Launch video player with time range
- **Hover**: Tooltip showing item details
- **Selection**: Visual feedback on hover/selection

#### Video Player Integration
```javascript
// When item clicked:
const startPosix = Math.floor(item.start.getTime() / 1000);
const endPosix = item.end ? Math.floor(item.end.getTime() / 1000) : startPosix;

// Launch video player modal/page with time range
handleItemClick({
  item: item.text,
  start: startPosix,
  end: endPosix
});
```

### 4. Technical Implementation

#### React Integration
- Custom React component: `<D3Timeline />`
- useRef for D3 container
- useState for data and zoom state
- useEffect for D3 lifecycle management

#### D3.js Components Needed
1. **Scales**: 
   - `d3.scaleTime()` for X-axis (time)
   - `d3.scaleOrdinal()` for Y-axis (groups)
2. **Axes**: Time axis with French locale
3. **Zoom**: `d3.zoom()` for pan/zoom
4. **Shapes**: Rectangles for ranges, circles for points
5. **Events**: Click handlers for video launch

#### Performance Considerations
- SVG for precision drawing
- Virtual scrolling if many groups
- Efficient re-rendering on zoom/pan
- Handle 1000+ events smoothly

### 5. Styling Requirements

#### Design System
- **Glassmorphism**: Semi-transparent backgrounds with blur
- **Colors**: Match existing brand colors (#667eea gradients)
- **Typography**: Inter font family
- **Spacing**: Consistent with existing app (60px group height)

#### Item Styling
- **Range items**: Rounded rectangles with gradient backgrounds
- **Point items**: Circles with pulsing animation if ongoing
- **Hover effects**: Subtle scale/glow on hover
- **Group colors**: Use authentic database colors

#### Layout
- **Left panel**: Group labels (200px width)
- **Main area**: Timeline canvas (remaining width)
- **Top controls**: Zoom buttons and time scale controls
- **Responsive**: Mobile-friendly scaling

### 6. Data Filtering

#### Backend Requirements (already implemented)
- Exclude group 9 (ZZ_Not_Reg) in SQL query
- 6-month data period with 1000 event limit
- Join with groupname table for authentic colors

#### Frontend Filtering
- Optional: Additional client-side filters
- Search/filter by item text
- Filter by specific groups

### 7. Time Handling

#### Time Formats
- **Input**: MySQL datetime strings ("2024-12-01 14:30:00")
- **Processing**: JavaScript Date objects
- **Display**: French locale formatting
- **Precision**: Minute-level accuracy

#### Time Zones
- All times in server local timezone
- No timezone conversion needed (local system)

### 8. Error Handling

#### Graceful Degradation
- Loading states during data fetch
- Empty state when no data
- Error boundaries for D3 failures
- Fallback to vis-timeline if D3 fails

#### User Feedback
- Loading spinners
- Error messages in French
- Smooth transitions and animations

### 9. Implementation Strategy

#### Phase 1: Basic Structure
1. Create D3Timeline React component
2. Set up SVG canvas with scales
3. Render basic rectangles for events
4. Add simple zoom/pan

#### Phase 2: Polish
1. Add group lanes and labels
2. Implement proper styling
3. Add click handlers for video launch
4. Polish animations and interactions

#### Phase 3: Integration
1. Replace vis-timeline in TimelinePage
2. Connect to existing video player
3. Test with real data
4. Performance optimization

### 10. Success Criteria

#### Functional
- ✅ Items display at exact temporal positions
- ✅ No auto-stacking or rearrangement
- ✅ All groups visible even when empty
- ✅ Clickable items launch video player
- ✅ Smooth zoom and pan
- ✅ 6 months of data (1000+ events)

#### User Experience
- ✅ DaVinci-style precise positioning
- ✅ Intuitive navigation
- ✅ Fast rendering and interaction
- ✅ Visual consistency with app design
- ✅ Mobile responsive

#### Technical
- ✅ Clean React/D3 integration
- ✅ Maintainable code structure
- ✅ Error handling and fallbacks
- ✅ Performance with large datasets

---

## Current Implementation Location
- **Component**: `/src/components/TimelinePage.tsx`
- **API**: `/server/routes/timeline.js`
- **Styling**: `/src/styles/timeline.css`

## Next Steps
1. Create `<D3Timeline />` component
2. Implement D3.js rendering logic
3. Test with existing data APIs
4. Replace vis-timeline integration
5. Add video player click integration