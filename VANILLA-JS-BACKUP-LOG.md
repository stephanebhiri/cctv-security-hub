# 💾 VANILLA JS VERSION BACKUP - Pre-React Conversion

## 📋 **Current Working State**
Before converting to React, documenting the fully functional vanilla JavaScript version.

### **✅ Confirmed Working Features**
1. **Items Table**: Auto-loads 186 items on page load
2. **Real-time Updates**: 5-second auto-refresh with scroll position preservation
3. **Sortable Columns**: All columns clickable for sorting with indicators
4. **CCTV Integration**: Click any item to launch video player with timestamp
5. **Security**: Environment variables for DB and CCTV passwords
6. **Event Delegation**: Robust click handling with data attributes
7. **Video Caching**: Downloads and caches CCTV videos on demand
8. **Auto-refresh Toggle**: Can pause/resume real-time updates

### **Technical Stack (Current)**
- **Frontend**: Vanilla HTML5 + CSS3 + JavaScript ES6+
- **Backend**: Node.js Express server
- **Database**: MySQL with mysql2 driver
- **CCTV**: HTTP API integration with XML authentication
- **Deployment**: Single HTML file served by Express

### **Key Implementation Details**

#### **1. State Management (Global Variables)**
```javascript
let currentVideoData = null;
let itemsRefreshInterval = null;
let itemsVisible = false;
let currentItems = [];
let sortColumn = 'updated_atposix';
let sortDirection = 'desc';
```

#### **2. Event Handling (Event Delegation)**
```javascript
function handleItemClick(event) {
    const row = event.target.closest('tr.item-clickable');
    if (row) {
        const timestamp = row.getAttribute('data-timestamp');
        const designation = row.getAttribute('data-designation');
        const groupId = row.getAttribute('data-group-id');
        launchCCTVForItem(parseInt(timestamp), designation, parseInt(groupId));
    }
}
```

#### **3. Auto-refresh with Scroll Preservation**
```javascript
// Save scroll positions before refresh
const containerScrollTop = itemsContainer ? itemsContainer.scrollTop : 0;
const pageScrollTop = window.pageYOffset || document.documentElement.scrollTop;

// Restore after refresh
setTimeout(() => {
    const newContainer = document.querySelector('.items-container');
    if (newContainer) {
        newContainer.scrollTop = containerScrollTop;
    }
    window.scrollTo(0, pageScrollTop);
}, 10);
```

### **File Structure (Pre-React)**
```
/var/www/actinvent6/
├── server.js                 # Express server with API endpoints
├── build/
│   └── index.html           # Single-file application (HTML+CSS+JS)
├── package.json             # Node.js dependencies
├── .env                     # Environment variables (passwords)
├── .gitignore              # Git exclusions
├── static/cache/videos/    # CCTV video cache
└── *.md                    # Documentation files
```

### **Performance Metrics**
- **Load Time**: < 1 second for 186 items
- **Refresh Time**: ~500ms for database query + render
- **File Size**: 20KB total (HTML+CSS+JS combined)
- **Memory Usage**: Minimal (vanilla JS)
- **Dependencies**: None on frontend

### **Browser Compatibility**
- ✅ Chrome/Edge (ES6+ support)
- ✅ Firefox (Modern versions)
- ✅ Safari (Recent versions)
- ⚠️ IE11 (Would need polyfills)

## 🎯 **Why Convert to React?**

### **Current Pain Points**
1. **Monolithic**: Everything in one 800+ line HTML file
2. **Manual DOM**: Direct innerHTML manipulation
3. **Global State**: No structured state management
4. **No Components**: Code reuse limited
5. **Testing**: Difficult to unit test vanilla JS DOM manipulation

### **React Benefits**
1. **Component Structure**: Reusable, testable components
2. **State Management**: React hooks for cleaner state
3. **Virtual DOM**: More efficient updates
4. **DevTools**: Better debugging experience
5. **Maintainability**: Easier to extend and modify
6. **Industry Standard**: Modern React practices

## 💾 **Backup Strategy**

### **1. Files to Preserve**
- `build/index.html` - Complete working application
- `server.js` - Backend API (can be reused)
- `.env` - Environment configuration
- All documentation files

### **2. Backup Commands**
```bash
# Create complete backup
tar -czf /tmp/vanilla-js-complete-$(date +%Y%m%d-%H%M).tar.gz \
  --exclude='node_modules' \
  --exclude='static/cache/videos' \
  --exclude='*.log' \
  .

# Copy working HTML file separately
cp build/index.html build/index-vanilla-backup.html
```

### **3. Rollback Plan**
If React conversion fails:
1. Restore `build/index.html` from backup
2. Keep existing `server.js` unchanged
3. No database or CCTV changes needed

## 🚀 **React Conversion Plan**

### **Phase 1: Setup**
- Install React development dependencies
- Set up JSX build process
- Create component structure

### **Phase 2: Component Conversion**
- `App` - Main application container
- `ItemsTable` - Table with sorting and auto-refresh
- `VideoPlayer` - CCTV video interface
- `ItemRow` - Individual table row

### **Phase 3: State Management**
- Convert global variables to React hooks
- Implement useEffect for auto-refresh
- Add context for shared state

### **Phase 4: Testing**
- Verify all functionality works
- Test auto-refresh and scroll preservation
- Confirm CCTV integration

---
*Backup created: 2025-07-15*  
*Ready for React conversion*  
*All functionality confirmed working*