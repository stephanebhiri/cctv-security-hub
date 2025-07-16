const fetch = require('node-fetch');

async function testPriorityLoading() {
  console.log('🧪 Testing priority loading behavior...\n');
  
  // Clear cache first
  try {
    const clearResponse = await fetch('http://localhost:3002/api/cache', { method: 'DELETE' });
    const clearResult = await clearResponse.json();
    console.log(`🗑️  Cache cleared: ${clearResult.filesDeleted} files, ${clearResult.sizeFreed}MB\n`);
  } catch (err) {
    console.error('Failed to clear cache:', err.message);
  }
  
  // Test API call timing
  console.log('📡 Making API call...');
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3002/api/cctv/videos?target=1752612707&camera=2');
    const apiTime = Date.now() - startTime;
    
    console.log(`⏱️  API Response time: ${apiTime}ms`);
    
    const data = await response.json();
    console.log(`📊 Response received:`, {
      videosCount: Object.keys(data[0]).length,
      closestIndex: data[1],
      cameraId: data[3]
    });
    
    const closestVideoUrl = data[0][data[1].toString()];
    console.log(`🎯 Closest video URL: ${closestVideoUrl}`);
    
    // Test if closest video is immediately available
    const videoStartTime = Date.now();
    const videoResponse = await fetch(`http://localhost:3002${closestVideoUrl}`);
    const videoTime = Date.now() - videoStartTime;
    
    console.log(`🎬 Video availability: ${videoResponse.status} (${videoTime}ms)`);
    
    if (videoResponse.status === 200) {
      console.log('✅ Closest video is immediately available!');
    } else {
      console.log('❌ Closest video not ready yet');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  console.log('\n🔚 Test completed');
}

testPriorityLoading();