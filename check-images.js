const https = require('https');

function checkSite() {
  const url = 'https://resetbiology.com';
  
  https.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('✅ Site is accessible');
      console.log(`Status: ${res.statusCode}`);
      
      // Check for image references
      const imageReferences = [
        '/hero-background.jpg',
        '/logo1.png', 
        '/reset-logo-pro.png',
        '/logo.png'
      ];
      
      console.log('\n🖼️  Image references in HTML:');
      imageReferences.forEach(img => {
        if (data.includes(img)) {
          console.log(`✅ Found: ${img}`);
        } else {
          console.log(`❌ Missing: ${img}`);
        }
      });
      
      // Check if images are working by testing one
      console.log('\n🧪 Testing image accessibility...');
      https.get('https://resetbiology.com/logo1.png', (imgRes) => {
        console.log(`Logo image status: ${imgRes.statusCode}`);
        if (imgRes.statusCode === 200) {
          console.log('✅ Images are loading correctly!');
        } else {
          console.log('❌ Images are not loading');
        }
      }).on('error', (err) => {
        console.log('❌ Image request failed:', err.message);
      });
    });
  }).on('error', (err) => {
    console.log('❌ Site request failed:', err.message);
  });
}

checkSite();