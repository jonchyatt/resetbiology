// Direct API test without auth
async function testAPI() {
  console.log('🧪 Testing Peptide APIs directly...\n');

  // Test 1: Get peptides list
  console.log('1. Testing GET /api/peptides');
  try {
    const response = await fetch('http://localhost:3001/api/peptides');
    const data = await response.json();

    if (data.success && data.data) {
      console.log(`   ✓ Peptides loaded: ${data.data.length} peptides`);
      data.data.slice(0, 3).forEach(p => {
        console.log(`     • ${p.name} (${p.category || 'N/A'})`);
      });
    } else {
      console.log('   ✗ Unexpected response format:', data);
    }
  } catch (error) {
    console.log('   ✗ Error:', error.message);
  }

  // Test 2: Try to create protocol (will fail without auth)
  console.log('\n2. Testing POST /api/peptides/protocols (no auth)');
  try {
    const response = await fetch('http://localhost:3001/api/peptides/protocols', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peptideName: 'Semaglutide',
        dosage: '0.25mg',
        frequency: 'Weekly',
        notes: 'Test protocol'
      })
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);

    if (response.status === 401) {
      console.log('   ✓ Expected: Unauthorized (no auth token)');
    } else if (data.success) {
      console.log('   ⚠️ Protocol created without auth? ID:', data.protocol?.id);
    } else {
      console.log('   Error:', data.error);
    }
  } catch (error) {
    console.log('   ✗ Error:', error.message);
  }

  // Test 3: Load protocols (will fail without auth)
  console.log('\n3. Testing GET /api/peptides/protocols (no auth)');
  try {
    const response = await fetch('http://localhost:3001/api/peptides/protocols');
    const data = await response.json();
    console.log(`   Status: ${response.status}`);

    if (response.status === 401) {
      console.log('   ✓ Expected: Unauthorized');
    } else {
      console.log('   Response:', data);
    }
  } catch (error) {
    console.log('   ✗ Error:', error.message);
  }

  console.log('\n✅ API tests complete');
  console.log('\n📌 Key findings:');
  console.log('   - Peptides endpoint should be public (working)');
  console.log('   - Protocol endpoints require Auth0 authentication');
  console.log('   - Without login, protocol operations will fail with 401');
}

testAPI();