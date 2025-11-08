---
name: media-extractor
agent: content-capture
type: extraction
model: claude-3-haiku
---

# Media Extractor Skill

## Purpose
**AUTOMATICALLY DOWNLOADS** and catalogs all media assets (images, videos, PDFs) from target websites for rebranding.

## CRITICAL: AUTO-DOWNLOAD REQUIREMENT
**THIS SKILL MUST DOWNLOAD ALL IMAGES AUTOMATICALLY!**
- Do NOT just create a download script
- Do NOT just catalog URLs
- ACTUALLY DOWNLOAD every image to `.hos/memory/media/images/`
- Use Playwright's built-in download capabilities
- Report total images downloaded with file sizes

## Trigger Phrases
- "extract all media from [URL]"
- "download images and videos"
- "capture product photos"
- "get all PDF documents"
- "extract video embeds"

## Implementation

### 0. REQUIRED: Auto-Download with Playwright
```javascript
const fs = require('fs').promises;
const path = require('path');

/**
 * AUTOMATIC IMAGE DOWNLOAD - Use Playwright's built-in capabilities
 * This is the PRIMARY method - always use this first
 */
async function autoDownloadImagesWithPlaywright(page, outputDir) {
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Get all image elements
  const images = await page.locator('img').all();
  const downloadedImages = [];

  console.log(`Found ${images.length} images to download...`);

  for (let i = 0; i < images.length; i++) {
    try {
      const img = images[i];
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt') || '';

      if (!src || src.startsWith('data:')) continue; // Skip data URIs

      // Get the image element's bounding box
      const box = await img.boundingBox();
      if (!box || box.width < 10 || box.height < 10) continue; // Skip tiny images

      // Screenshot the specific image element
      const filename = `image-${i + 1}-${Date.now()}.png`;
      const filepath = path.join(outputDir, filename);

      await img.screenshot({ path: filepath });

      // Get file size
      const stats = await fs.stat(filepath);

      downloadedImages.push({
        originalUrl: src,
        localPath: filepath,
        alt: alt,
        width: Math.round(box.width),
        height: Math.round(box.height),
        fileSize: stats.size,
        index: i + 1
      });

      console.log(`✓ Downloaded ${i + 1}/${images.length}: ${filename} (${(stats.size / 1024).toFixed(1)}KB)`);
    } catch (error) {
      console.error(`✗ Failed to download image ${i + 1}:`, error.message);
    }
  }

  console.log(`\n✅ Successfully downloaded ${downloadedImages.length}/${images.length} images`);
  console.log(`📦 Total size: ${(downloadedImages.reduce((sum, img) => sum + img.fileSize, 0) / 1024 / 1024).toFixed(2)}MB`);

  return downloadedImages;
}

### 1. Image Extraction (Fallback Method with fetch)
```javascript
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

async function extractImages(page, baseUrl) {
  const images = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      alt: img.alt || '',
      title: img.title || '',
      width: img.naturalWidth,
      height: img.naturalHeight,
      loading: img.loading,
      srcset: img.srcset,
      sizes: img.sizes,
      context: {
        parentClass: img.parentElement?.className,
        parentId: img.parentElement?.id,
        isLogo: img.className?.includes('logo') || img.alt?.toLowerCase().includes('logo'),
        isProduct: img.className?.includes('product') || img.closest('[class*="product"]'),
        isHero: img.closest('header, [class*="hero"]') !== null
      }
    }));
  });

  // Download images
  const downloadedImages = [];
  for (const image of images) {
    try {
      const url = new URL(image.src, baseUrl);
      const response = await fetch(url.href);
      const buffer = await response.buffer();

      // Generate filename
      const ext = path.extname(url.pathname) || '.jpg';
      const filename = `${Date.now()}-${path.basename(url.pathname, ext)}${ext}`;
      const filepath = path.join('.hos/memory/media/images', filename);

      await fs.writeFile(filepath, buffer);

      downloadedImages.push({
        ...image,
        localPath: filepath,
        originalUrl: image.src,
        fileSize: buffer.length
      });
    } catch (error) {
      console.error(`Failed to download image: ${image.src}`, error);
    }
  }

  return downloadedImages;
}
```

### 2. Video Extraction
```javascript
async function extractVideos(page) {
  const videos = await page.evaluate(() => {
    const videoData = [];

    // HTML5 videos
    document.querySelectorAll('video').forEach(video => {
      const sources = Array.from(video.querySelectorAll('source')).map(s => ({
        src: s.src,
        type: s.type
      }));

      videoData.push({
        type: 'html5',
        src: video.src || sources[0]?.src,
        sources,
        poster: video.poster,
        autoplay: video.autoplay,
        controls: video.controls,
        loop: video.loop,
        muted: video.muted,
        width: video.width,
        height: video.height
      });
    });

    // YouTube embeds
    document.querySelectorAll('iframe[src*="youtube"], iframe[src*="youtu.be"]').forEach(iframe => {
      const url = new URL(iframe.src);
      const videoId = url.pathname.includes('embed')
        ? url.pathname.split('/').pop()
        : url.searchParams.get('v');

      videoData.push({
        type: 'youtube',
        videoId,
        embedUrl: iframe.src,
        width: iframe.width,
        height: iframe.height,
        title: iframe.title
      });
    });

    // Vimeo embeds
    document.querySelectorAll('iframe[src*="vimeo"]').forEach(iframe => {
      const videoId = iframe.src.match(/vimeo\.com\/video\/(\d+)/)?.[1] ||
                     iframe.src.match(/vimeo\.com\/(\d+)/)?.[1];

      videoData.push({
        type: 'vimeo',
        videoId,
        embedUrl: iframe.src,
        width: iframe.width,
        height: iframe.height
      });
    });

    return videoData;
  });

  // For HTML5 videos, download if possible
  for (const video of videos.filter(v => v.type === 'html5')) {
    if (video.src && !video.src.startsWith('blob:')) {
      try {
        // Note: Large video downloads should be handled carefully
        console.log(`Video found: ${video.src}`);
        // Actual download logic would go here for smaller videos
      } catch (error) {
        console.error(`Failed to process video: ${video.src}`, error);
      }
    }
  }

  return videos;
}
```

### 3. Document Extraction
```javascript
async function extractDocuments(page, baseUrl) {
  const documents = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"]')).map(link => ({
      href: link.href,
      text: link.textContent.trim(),
      type: link.href.split('.').pop().toLowerCase(),
      context: {
        parentSection: link.closest('section')?.className,
        isDownload: link.hasAttribute('download')
      }
    }));
  });

  // Download PDFs and documents
  const downloadedDocs = [];
  for (const doc of documents) {
    try {
      const url = new URL(doc.href, baseUrl);
      const response = await fetch(url.href);
      const buffer = await response.buffer();

      const filename = `${Date.now()}-${path.basename(url.pathname)}`;
      const filepath = path.join('.hos/memory/media/documents', filename);

      await fs.writeFile(filepath, buffer);

      downloadedDocs.push({
        ...doc,
        localPath: filepath,
        originalUrl: doc.href,
        fileSize: buffer.length
      });
    } catch (error) {
      console.error(`Failed to download document: ${doc.href}`, error);
    }
  }

  return downloadedDocs;
}
```

### 4. Icon and Logo Extraction
```javascript
async function extractIcons(page, baseUrl) {
  const icons = await page.evaluate(() => {
    const iconData = [];

    // Favicon
    const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    if (favicon) {
      iconData.push({
        type: 'favicon',
        href: favicon.href,
        rel: favicon.rel
      });
    }

    // Apple touch icons
    document.querySelectorAll('link[rel*="apple-touch-icon"]').forEach(icon => {
      iconData.push({
        type: 'apple-touch-icon',
        href: icon.href,
        sizes: icon.sizes?.value
      });
    });

    // SVG logos
    document.querySelectorAll('svg').forEach(svg => {
      if (svg.closest('[class*="logo"], [id*="logo"], header')) {
        iconData.push({
          type: 'svg-logo',
          content: svg.outerHTML,
          viewBox: svg.getAttribute('viewBox'),
          width: svg.getAttribute('width'),
          height: svg.getAttribute('height')
        });
      }
    });

    // Font icons
    const fontIcons = new Set();
    document.querySelectorAll('[class*="icon-"], [class*="fa-"], .icon').forEach(el => {
      fontIcons.add(el.className);
    });

    return {
      icons: iconData,
      fontIcons: Array.from(fontIcons)
    };
  });

  return icons;
}
```

### 5. Background Images
```javascript
async function extractBackgroundImages(page) {
  const backgroundImages = await page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    const backgrounds = [];

    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;

      if (bgImage && bgImage !== 'none') {
        const urls = bgImage.match(/url\(['"]?([^'")]+)['"]?\)/g);
        if (urls) {
          urls.forEach(url => {
            const cleanUrl = url.replace(/url\(['"]?|['"]?\)/g, '');
            backgrounds.push({
              url: cleanUrl,
              element: {
                tag: el.tagName.toLowerCase(),
                class: el.className,
                id: el.id
              },
              size: style.backgroundSize,
              position: style.backgroundPosition,
              repeat: style.backgroundRepeat
            });
          });
        }
      }
    });

    return backgrounds;
  });

  return backgroundImages;
}
```

### 6. Media Catalog
```javascript
async function createMediaCatalog(allMedia) {
  const catalog = {
    timestamp: new Date().toISOString(),
    summary: {
      totalImages: allMedia.images.length,
      totalVideos: allMedia.videos.length,
      totalDocuments: allMedia.documents.length,
      totalSize: 0
    },
    images: allMedia.images.map(img => ({
      ...img,
      usage: categorizeImageUsage(img),
      needsReplacement: img.context.isLogo || img.context.isBrand
    })),
    videos: allMedia.videos,
    documents: allMedia.documents,
    icons: allMedia.icons,
    backgrounds: allMedia.backgrounds
  };

  // Calculate total size
  catalog.summary.totalSize = catalog.images.reduce((sum, img) =>
    sum + (img.fileSize || 0), 0
  );

  // Save catalog
  await fs.writeFile(
    '.hos/memory/media/catalog.json',
    JSON.stringify(catalog, null, 2)
  );

  return catalog;
}

function categorizeImageUsage(image) {
  if (image.context.isLogo) return 'logo';
  if (image.context.isHero) return 'hero';
  if (image.context.isProduct) return 'product';
  if (image.width < 100 && image.height < 100) return 'icon';
  if (image.width > 1200) return 'banner';
  return 'content';
}
```

## Output Format
```json
{
  "media": {
    "images": [
      {
        "originalUrl": "https://example.com/image.jpg",
        "localPath": ".hos/memory/media/images/12345-image.jpg",
        "alt": "Product image",
        "dimensions": { "width": 800, "height": 600 },
        "fileSize": 125000,
        "usage": "product",
        "needsReplacement": false
      }
    ],
    "videos": [
      {
        "type": "youtube",
        "videoId": "abc123",
        "embedUrl": "https://youtube.com/embed/abc123",
        "dimensions": { "width": 560, "height": 315 }
      }
    ],
    "documents": [
      {
        "originalUrl": "https://example.com/brochure.pdf",
        "localPath": ".hos/memory/media/documents/brochure.pdf",
        "text": "Download Brochure",
        "fileSize": 2500000
      }
    ]
  },
  "replacements": {
    "logos": ["logo.png", "logo-white.svg"],
    "brandImages": ["hero-bg.jpg", "about-team.jpg"]
  }
}
```

## Usage Example
```javascript
const media = await extractAllMedia(page, 'https://stemregen.co');
const catalog = await createMediaCatalog(media);

console.log(`Extracted ${catalog.summary.totalImages} images`);
console.log(`Found ${media.videos.length} videos`);
console.log(`Downloaded ${media.documents.length} documents`);
```