import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'src', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Source logo file
const sourceFile = path.join(__dirname, 'src', 'assets', 'kochin-logo.png');

// Define the sizes we need for PWA
const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 192, 384, 512];

// Generate icons for each size
async function generateIcons() {
  try {
    for (const size of sizes) {
      const outputFile = path.join(iconsDir, `icon-${size}x${size}.png`);
      await sharp(sourceFile)
        .resize(size, size)
        .toFile(outputFile);
      console.log(`Generated ${outputFile}`);
    }

    // Generate apple-touch-icon
    await sharp(sourceFile)
      .resize(180, 180)
      .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
    console.log('Generated apple-touch-icon.png');

    // Generate favicon
    await sharp(sourceFile)
      .resize(32, 32)
      .toFile(path.join(__dirname, 'src', 'favicon.ico'));
    console.log('Generated favicon.ico');

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
