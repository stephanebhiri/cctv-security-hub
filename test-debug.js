const fetch = require('node-fetch');

async function testCCTVAPI() {
  console.log('🧪 Testing CCTV API...');
  
  try {
    // Test health endpoint
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:3002/api/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health:', healthData);
    
    // Test videos endpoint
    console.log('\n2. Testing videos endpoint...');
    const videosResponse = await fetch('http://localhost:3002/api/cctv/videos?target=1752567000&camera=1');
    const videosData = await videosResponse.json();
    console.log('📹 Videos response:', videosData);
    
    // Test with current timestamp
    console.log('\n3. Testing with current timestamp...');
    const now = Math.floor(Date.now() / 1000);
    const currentResponse = await fetch(`http://localhost:3002/api/cctv/videos?target=${now}&camera=1`);
    const currentData = await currentResponse.json();
    console.log('📅 Current timestamp response:', currentData);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCCTVAPI();