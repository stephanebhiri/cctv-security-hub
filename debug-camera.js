const fetch = require('node-fetch');

async function testCamera(cameraId) {
  try {
    const response = await fetch(`http://localhost:3002/api/cctv/videos?target=1752612707&camera=${cameraId}`);
    const data = await response.json();
    
    console.log(`\n=== CAMERA ${cameraId} ===`);
    console.log('Videos count:', Object.keys(data[0]).length);
    console.log('Closest index:', data[1]);
    console.log('Offset seconds:', data[2]);
    console.log('Camera ID:', data[3]);
    console.log('Timestamps count:', Object.keys(data[4]).length);
    
    const closestVideoUrl = data[0][data[1].toString()];
    console.log('Closest video URL:', closestVideoUrl);
    console.log('Is closest video defined?', closestVideoUrl ? 'YES' : 'NO');
    
  } catch (error) {
    console.error(`Camera ${cameraId} error:`, error.message);
  }
}

async function main() {
  for (let i = 1; i <= 6; i++) {
    await testCamera(i);
  }
}

main();