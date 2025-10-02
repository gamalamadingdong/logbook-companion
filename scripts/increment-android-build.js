/**
 * Increments Android build number (versionCode) for Play Store uploads
 * 
 * @source Extracted from ScheduleBoard v2
 * @license MIT
 * 
 * This script automatically increments the versionCode in your Android
 * build.gradle file, which is required for each new Play Store submission.
 * 
 * Usage: npm run version:android
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

console.log('🔧 Incrementing Android build number for Play Store upload...');

if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  
  // Find the current versionCode
  const buildMatch = content.match(/versionCode (\d+)/);
  
  if (buildMatch) {
    const currentBuild = parseInt(buildMatch[1]);
    const newBuild = currentBuild + 1;
    
    console.log(`📊 Current Android versionCode: ${currentBuild}`);
    console.log(`📊 New Android versionCode: ${newBuild}`);
    
    // Replace the versionCode
    content = content.replace(
      new RegExp(`versionCode ${currentBuild}`, 'g'), 
      `versionCode ${newBuild}`
    );
    
    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log(`✅ Android versionCode incremented from ${currentBuild} to ${newBuild}`);
    console.log('🚀 Ready for Play Store upload!');
  } else {
    console.log('❌ Could not find versionCode in build.gradle');
    process.exit(1);
  }
} else {
  console.log('❌ Android build.gradle file not found!');
  console.log('💡 Make sure you have initialized Capacitor Android: npx cap add android');
  process.exit(1);
}
