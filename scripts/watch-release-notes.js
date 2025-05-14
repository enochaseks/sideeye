const chokidar = require('chokidar');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to RELEASE_NOTES.md relative to this script
const releaseNotesPath = path.resolve(__dirname, '../RELEASE_NOTES.md');

// Path to update-version.js script relative to this script
const updateVersionScriptPath = path.resolve(__dirname, './update-version.js');

// Check that both files exist
if (!fs.existsSync(releaseNotesPath)) {
  console.error(`Error: RELEASE_NOTES.md not found at ${releaseNotesPath}`);
  process.exit(1);
}

if (!fs.existsSync(updateVersionScriptPath)) {
  console.error(`Error: update-version.js not found at ${updateVersionScriptPath}`);
  process.exit(1);
}

console.log(`👀 Watching for changes to RELEASE_NOTES.md...`);

// Initialize watcher
const watcher = chokidar.watch(releaseNotesPath, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 500,  // Wait 500ms after last change
    pollInterval: 100         // Poll every 100ms
  }
});

// Define the function to run the update script
const runUpdateScript = () => {
  console.log(`📝 RELEASE_NOTES.md changed. Updating version.json...`);
  
  const updateProcess = spawn('node', [updateVersionScriptPath], {
    stdio: 'inherit' // This will show the script's output in the current console
  });

  updateProcess.on('close', (code) => {
    if (code === 0) {
      console.log(`✅ version.json updated successfully!`);
    } else {
      console.error(`❌ Error: update-version.js exited with code ${code}`);
    }
  });
};

// Add event listeners
watcher
  .on('change', runUpdateScript)
  .on('error', error => console.error(`Watcher error: ${error}`));

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Stopping watcher...');
  watcher.close();
  process.exit(0);
});

console.log(`✅ Watcher started! Press Ctrl+C to stop.`); 