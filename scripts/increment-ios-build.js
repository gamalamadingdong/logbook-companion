/**
 * Increments iOS build number for App Store uploads
 * 
 * @source Extracted from ScheduleBoard v2
 * @license MIT
 * 
 * This script automatically increments the CURRENT_PROJECT_VERSION in your
 * Xcode project file, which is required for each new App Store submission.
 * 
 * Usage: npm run version:ios
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectPath = path.join(__dirname, '..', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

console.log('🔧 Incrementing iOS build number for App Store upload...');

if (fs.existsSync(projectPath)) {
  let content = fs.readFileSync(projectPath, 'utf8');
  
  // Find the current build number
  const buildMatch = content.match(/CURRENT_PROJECT_VERSION = (\d+);/);
  
  if (buildMatch) {
    const currentBuild = parseInt(buildMatch[1]);
    const newBuild = currentBuild + 1;
    
    console.log(`📊 Current build number: ${currentBuild}`);
    console.log(`📊 New build number: ${newBuild}`);
    
    // Replace all instances of the current build number
    content = content.replace(
      new RegExp(`CURRENT_PROJECT_VERSION = ${currentBuild};`, 'g'), 
      `CURRENT_PROJECT_VERSION = ${newBuild};`
    );
    
    fs.writeFileSync(projectPath, content, 'utf8');
    console.log(`✅ iOS build number incremented from ${currentBuild} to ${newBuild}`);
    console.log('🚀 Ready for App Store upload!');
  } else {
    console.log('❌ Could not find CURRENT_PROJECT_VERSION in project file');
    process.exit(1);
  }
} else {
  console.log('❌ Xcode project file not found!');
  console.log('💡 Make sure you have initialized Capacitor iOS: npx cap add ios');
  process.exit(1);
}
