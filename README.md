# CCTV Video Viewer

A React application for viewing CCTV videos with backend API integration.

## Features

- Camera selection (1-6)
- Date and time picker for video search
- Video player with controls
- Video grid showing all available videos around the selected time
- Folder D rule implementation for video discovery
- Authentication token management
- Video caching system
- Health check endpoint

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the React app:
```bash
npm run build
```

## Running the Application

### Development Mode
Run both frontend and backend concurrently:
```bash
npm run dev
```

### Production Mode
1. Build the React app:
```bash
npm run build
```

2. Start the server:
```bash
npm run server
```

The application will be available at `http://localhost:3001`

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/cctv/videos?target={timestamp}&camera={camera_id}` - Get videos for specified time and camera

## Configuration

The CCTV server configuration is in `server.js`:
- Base URL: `http://xxx.xxx.fr:8090`
- Login: `CCTV`
- Password: `xxxxxxxxxxxxxxxxx`

## Usage

1. Select a camera (1-6) from the dropdown
2. Choose a date and time using the datetime picker
3. Click "Search Videos" to find videos around that time
4. Use "Test API" to test with a known timestamp (2025-07-15T08:10:00)
5. Click on any video in the grid to play it in the main player

## Implementation Details

### Folder D Rule
The application implements the "Folder D" rule:
1. First tries normal folder format: `/YYYY-MM-DD/HH/`
2. If empty, tries D folder format: `/YYYY-MM-DD/HHD/`
3. Searches hour-1, hour, and hour+1 for better coverage

### Authentication
- Automatic token management with 50-minute expiry
- Auto-renewal before expiration
- XML response parsing for token extraction

### Video Caching
- Videos are cached locally to avoid repeated downloads
- Cache naming: `cam{ID}_{timestamp}_{hash}.mp4`
- Cache directory: `/static/cache/videos/`

### Response Format
API returns data in the exact format specified in the instructions:
```json
[
  {"0": "/path/to/video1.mp4", "1": "/path/to/video2.mp4"},
  10,
  -60,
  1,
  {"0": 1752567000, "1": 1752567120}
]
```

## File Structure

```
/
├── src/
│   ├── components/
│   │   ├── VideoPlayer.tsx
│   │   └── VideoGrid.tsx
│   ├── services/
│   │   └── CCTVService.ts
│   ├── App.tsx
│   ├── App.css
│   └── index.tsx
├── public/
│   └── index.html
├── static/
│   └── cache/
│       └── videos/
├── server.js
├── package.json
└── README.md
```

## Technologies Used

- **Frontend**: React 18, TypeScript, HTML5 video
- **Backend**: Node.js, Express
- **Dependencies**: cors, node-fetch, xmldom
- **Development**: concurrently for running both frontend and backend