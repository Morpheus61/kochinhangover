// Simple script to fix the PDF footer
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'main.js');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Replace the line with the copyright text
content = content.replace(/doc\.text\(['"](.*?)2025 Angels 153.*?rights reserved.*?['"]/g, 
                         "doc.text('KOCHIN HANGOVER'");

// Write the file back
fs.writeFileSync(filePath, content, 'utf8');

console.log('PDF footer fixed successfully!');
