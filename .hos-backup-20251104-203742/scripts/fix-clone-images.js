#!/usr/bin/env node
/**
 * FIX CLONE IMAGE REFERENCES
 *
 * Fixes image paths in cloned HTML to reference local downloaded images
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

async function fixCloneImages(clonePath) {
  console.log('\n🔧 FIXING IMAGE REFERENCES IN CLONE\n');
  console.log(`Clone: ${clonePath}`);

  // Read the clone HTML
  let html = await fs.readFile(clonePath, 'utf8');
  console.log(`✓ Read ${html.length} bytes of HTML`);

  // Extract all image URLs from the HTML
  const imgRegex = /src=["']([^"']+)["']/g;
  const backgroundRegex = /url\(["']?([^"')]+)["']?\)/g;

  let matches = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    matches.push({ type: 'src', url: match[1], full: match[0] });
  }

  while ((match = backgroundRegex.exec(html)) !== null) {
    matches.push({ type: 'bg', url: match[1], full: match[0] });
  }

  console.log(`\nFound ${matches.length} image references`);

  // Fix each image reference
  let fixedCount = 0;
  let skipCount = 0;

  for (const item of matches) {
    let url = item.url;

    // Skip data URIs and already-fixed local paths
    if (url.startsWith('data:') || url.startsWith('images/') || url.startsWith('./images/')) {
      skipCount++;
      continue;
    }

    // Clean up the URL
    let cleanUrl = url.replace(/^file:\/\/+/, '');

    // Generate the expected local filename
    const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 12);
    const ext = path.extname(cleanUrl) || '.jpg';
    const localFilename = `img-${hash}${ext}`;
    const localPath = `images/${localFilename}`;

    // Check if the local file exists
    const fullPath = path.join(path.dirname(clonePath), localPath);
    try {
      await fs.access(fullPath);

      // Replace the URL
      if (item.type === 'src') {
        const newSrc = `src="${localPath}"`;
        html = html.replace(item.full, newSrc);
      } else {
        const newBg = `url('${localPath}')`;
        html = html.replace(item.full, newBg);
      }

      fixedCount++;

      if (fixedCount % 10 === 0) {
        console.log(`  Fixed ${fixedCount} references...`);
      }
    } catch (err) {
      // File doesn't exist locally, try alternate approaches

      // Try with original URL hash
      const origHash = crypto.createHash('md5').update(item.url).digest('hex').substring(0, 12);
      const altPath = `images/img-${origHash}${ext}`;
      const altFullPath = path.join(path.dirname(clonePath), altPath);

      try {
        await fs.access(altFullPath);

        if (item.type === 'src') {
          html = html.replace(item.full, `src="${altPath}"`);
        } else {
          html = html.replace(item.full, `url('${altPath}')`);
        }
        fixedCount++;
      } catch {
        // Can't find local version, skip
        skipCount++;
      }
    }
  }

  console.log(`\n✓ Fixed ${fixedCount} image references`);
  console.log(`  Skipped ${skipCount} (data URIs or missing files)`);

  // Also fix common absolute paths
  const baseUrls = [
    'https://cdn.shopify.com/s/files/',
    'https://www.stemregen.co/cdn/',
    '//cdn.shopify.com/s/files/',
    'file://www.stemregen.co/',
    'file:///www.stemregen.co/'
  ];

  for (const baseUrl of baseUrls) {
    if (html.includes(baseUrl)) {
      console.log(`\n🔍 Found absolute URLs with base: ${baseUrl}`);
      // These are already handled above, just logging
    }
  }

  // Write the fixed HTML
  const fixedPath = clonePath.replace('.html', '-fixed.html');
  await fs.writeFile(fixedPath, html, 'utf8');

  console.log(`\n✅ Fixed clone saved: ${fixedPath}`);
  console.log(`   Original: ${clonePath}`);

  return fixedPath;
}

async function main() {
  const clonePath = process.argv[2] || 'C:/Users/jonch/.hos/memory/visual/captures/collections-all-clone.html';

  try {
    const fixedPath = await fixCloneImages(clonePath);

    // Open in browser
    console.log('\n🌐 Opening fixed clone in browser...');
    require('child_process').exec(`cmd /c start chrome "file:///${fixedPath.replace(/\\/g, '/')}"`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixCloneImages };
