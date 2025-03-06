const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Define paths
const svgPath = path.join(__dirname, '../services/frontend/public/kaspa-logo.svg');
const outputDir = path.join(__dirname, '../services/frontend/public/favicons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Define favicon sizes to generate
const sizes = [16, 32, 48, 57, 60, 72, 76, 96, 114, 120, 144, 152, 180, 192, 512];

// Generate PNG favicons in different sizes
async function generateFavicons() {
  try {
    // Read the SVG file
    const svgBuffer = fs.readFileSync(svgPath);
    
    // Generate favicon.ico (32x32)
    await sharp(svgBuffer)
      .resize(32, 32)
      .toFile(path.join(outputDir, 'favicon.ico'));
    
    console.log('Generated favicon.ico');
    
    // Generate larger favicon.ico for root directory
    await sharp(svgBuffer)
      .resize(192, 192)
      .toFile(path.join(__dirname, '../services/frontend/public/favicon.ico'));
    
    console.log('Generated root favicon.ico');
    
    // Generate PNG files in different sizes
    for (const size of sizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(outputDir, `favicon-${size}x${size}.png`));
      
      console.log(`Generated favicon-${size}x${size}.png`);
    }
    
    // Generate favicon.png for root directory
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(path.join(__dirname, '../services/frontend/public/favicon.png'));
    
    console.log('Generated root favicon.png');
    
    // Generate apple-touch-icon.png (180x180)
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.join(outputDir, 'apple-touch-icon.png'));
    
    console.log('Generated apple-touch-icon.png');
    
    // Generate android-chrome icons
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(path.join(outputDir, 'android-chrome-192x192.png'));
    
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(outputDir, 'android-chrome-512x512.png'));
    
    console.log('Generated android-chrome icons');
    
    console.log('All favicons generated successfully!');
  } catch (error) {
    console.error('Error generating favicons:', error);
  }
}

generateFavicons(); 