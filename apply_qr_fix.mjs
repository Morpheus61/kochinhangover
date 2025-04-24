// Script to apply QR scanner error handling fixes to main.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const mainJsPath = path.join(__dirname, 'src', 'main.js');
const fixesPath = path.join(__dirname, 'src', 'qr_fix_undefined.js');

// Read the files
try {
    const mainJs = fs.readFileSync(mainJsPath, 'utf8');
    const fixes = fs.readFileSync(fixesPath, 'utf8');
    
    // Extract the initQRScanner function from fixes
    const initQRScannerRegex = /function initQRScanner\(\) \{[\s\S]*?\}/;
    const initQRScannerMatch = fixes.match(initQRScannerRegex);
    
    if (!initQRScannerMatch) {
        console.error('Could not find initQRScanner function in fixes');
        process.exit(1);
    }
    
    // Replace the function in main.js
    let updatedMainJs = mainJs;
    
    // Replace initQRScanner
    const mainInitQRScannerRegex = /function initQRScanner\(\) \{[\s\S]*?\}/;
    updatedMainJs = updatedMainJs.replace(mainInitQRScannerRegex, initQRScannerMatch[0]);
    
    // Write the updated file
    fs.writeFileSync(mainJsPath, updatedMainJs, 'utf8');
    console.log('Successfully applied QR scanner error handling fixes to main.js');
    
} catch (error) {
    console.error('Error applying fixes:', error);
    process.exit(1);
}
