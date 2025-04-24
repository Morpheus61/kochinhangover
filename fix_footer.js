// Simple script to fix the PDF footer
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src', 'main.js');
const filePathFixed = path.join(__dirname, 'src', 'main_fixed.js');

// Read the main.js file
let content = fs.readFileSync(filePath, 'utf8');

// Replace the line with the copyright text
content = content.replace(/doc\.text\(['"](.*?)2025 Angels 153.*?rights reserved.*?['"]/g, 
                         "doc.text('KOCHIN HANGOVER - Event Management System'");

// Write the file back
fs.writeFileSync(filePath, content, 'utf8');

// Also fix main_fixed.js if it exists
if (fs.existsSync(filePathFixed)) {
    let contentFixed = fs.readFileSync(filePathFixed, 'utf8');
    contentFixed = contentFixed.replace(/doc\.text\(['"](.*?)2025 Angels 153.*?rights reserved.*?['"]/g, 
                             "doc.text('KOCHIN HANGOVER - Event Management System'");
    fs.writeFileSync(filePathFixed, contentFixed, 'utf8');
}

console.log('PDF footer fixed successfully!');
