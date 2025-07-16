# 🤖 CCTV Automation API for Agents

This API provides programmatic access to the CCTV Security Hub, allowing external agents to interact with the system without DOM manipulation.

## Quick Start

```javascript
// The API is automatically available at window.CCTV
const api = window.CCTV;

// Get current state
const state = api.getState();
console.log('Items:', state.items.length);
console.log('Loading:', state.isLoading);

// Select an item to view its video
await api.selectItem(12345);

// Listen for events
api.on('video-loaded', (event) => {
  console.log('Video loaded:', event.detail.url);
});
```

## Core Methods

### `getState(): CCTVState`
Returns the current application state.

```javascript
const state = api.getState();
// {
//   isLoading: false,
//   items: [...],
//   selectedItem: {...},
//   autoRefresh: true,
//   currentVideo: "http://...",
//   error: null,
//   lastRefresh: 1234567890
// }
```

### `getItems(): CCTVItem[]`
Returns all available items.

```javascript
const items = api.getItems();
items.forEach(item => {
  console.log(`${item.designation} - ${item.epc}`);
});
```

### `selectItem(itemId: number): Promise<boolean>`
Selects an item and loads its CCTV video.

```javascript
const success = await api.selectItem(12345);
if (success) {
  console.log('Item selected successfully');
}
```

### `selectItemByEPC(epc: string): Promise<boolean>`
Selects an item by its EPC (barcode).

```javascript
const success = await api.selectItemByEPC("E28068940000402D96613E9D");
```

### `refreshNow(): Promise<boolean>`
Manually refresh items from the server.

```javascript
await api.refreshNow();
```

### `searchItems(query: string): CCTVItem[]`
Search items by designation or EPC.

```javascript
const results = api.searchItems("laptop");
console.log('Found:', results.length);
```

### `getItemsByTimeRange(start: number, end: number): CCTVItem[]`
Get items within a specific time range (Unix timestamps).

```javascript
const now = Math.floor(Date.now() / 1000);
const hourAgo = now - 3600;
const recentItems = api.getItemsByTimeRange(hourAgo, now);
```

## Events

### `item-selected`
Fired when an item is selected.

```javascript
api.on('item-selected', (event) => {
  const item = event.detail.item;
  console.log('Selected:', item.designation);
});
```

### `video-loaded`
Fired when a video is loaded and ready.

```javascript
api.on('video-loaded', (event) => {
  console.log('Video URL:', event.detail.url);
  console.log('Item:', event.detail.item.designation);
});
```

### `refresh-complete`
Fired when the item list is refreshed.

```javascript
api.on('refresh-complete', (event) => {
  console.log('Refreshed:', event.detail.itemCount, 'items');
});
```

### `error`
Fired when errors occur.

```javascript
api.on('error', (event) => {
  console.error('Error:', event.detail.message);
  console.error('Type:', event.detail.type); // 'api', 'video', 'network'
});
```

### `state-changed`
Fired whenever the application state changes.

```javascript
api.on('state-changed', (event) => {
  const state = event.detail.state;
  console.log('State updated:', state);
});
```

## Agent Usage Examples

### Example 1: Monitor for new items
```javascript
let lastItemCount = 0;

api.on('refresh-complete', (event) => {
  const newCount = event.detail.itemCount;
  if (newCount > lastItemCount) {
    console.log(`${newCount - lastItemCount} new items detected!`);
  }
  lastItemCount = newCount;
});
```

### Example 2: Auto-select items matching criteria
```javascript
api.on('refresh-complete', () => {
  const laptops = api.searchItems('laptop');
  const urgentLaptops = laptops.filter(item => 
    item.designation.includes('URGENT')
  );
  
  if (urgentLaptops.length > 0) {
    api.selectItem(urgentLaptops[0].id);
  }
});
```

### Example 3: Error handling and recovery
```javascript
api.on('error', (event) => {
  if (event.detail.type === 'network') {
    console.log('Network error, retrying in 5 seconds...');
    setTimeout(() => {
      api.refreshNow();
    }, 5000);
  }
});
```

### Example 4: Periodic monitoring
```javascript
// Check for items every 30 seconds
setInterval(async () => {
  const state = api.getState();
  if (!state.isLoading) {
    await api.refreshNow();
  }
}, 30000);
```

## Data Types

### CCTVItem
```typescript
interface CCTVItem {
  id: number;
  epc: string;           // Barcode/RFID
  designation: string;   // Item description
  timestamp: number;     // Unix timestamp
  groupId: number;       // Group identifier
}
```

### CCTVState
```typescript
interface CCTVState {
  isLoading: boolean;
  items: CCTVItem[];
  selectedItem: CCTVItem | null;
  autoRefresh: boolean;
  currentVideo: string | null;
  error: string | null;
  lastRefresh: number;
}
```

## Error Handling

The API provides comprehensive error handling:

- **API errors**: Invalid parameters, item not found
- **Network errors**: Server unavailable, timeout
- **Video errors**: Video loading failures

Always check return values and listen for error events in production agents.

## Performance Notes

- The API is lightweight and designed for real-time interaction
- Events are debounced to prevent spam
- State updates are batched for efficiency
- Video loading is asynchronous and non-blocking

## Support

For issues or questions about the Automation API, check the browser console for detailed logs and error messages. All API operations are logged with the 🤖 prefix.