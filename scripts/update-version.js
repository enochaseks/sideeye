const fs = require('fs');
const path = require('path');

// Read the main package.json to get the current version
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Get version from package.json
const version = packageJson.version || '1.0.0';

// Read release notes from RELEASE_NOTES.md
const releaseNotesPath = path.join(__dirname, '../RELEASE_NOTES.md');
const releaseNotesContent = fs.readFileSync(releaseNotesPath, 'utf8');

// Extract the current version's release notes
const currentVersionHeader = `## Version ${version}`;
let releaseNotes = '';

if (releaseNotesContent.includes(currentVersionHeader)) {
  const versionSection = releaseNotesContent.split(currentVersionHeader)[1].split(/^## Version /m)[0];
  releaseNotes = versionSection.trim().split('\n').map(line => line.replace(/^- /, '')).join('\n');
} else {
  releaseNotes = `Version ${version} update`;
}

// Generate the version.json content
const versionData = {
  version: version,
  buildTimestamp: Date.now(),
  requiredUpdate: false, // Set this to true when you need to force users to update
  releaseNotes: releaseNotes
};

// Write to the public folder
const outputPath = path.join(__dirname, '../public/version.json');
fs.writeFileSync(outputPath, JSON.stringify(versionData, null, 2));

console.log(`✅ Updated version.json to ${version} with timestamp ${new Date(versionData.buildTimestamp).toISOString()}`);
console.log(`📝 Release notes: ${releaseNotes.split('\n')[0]}...`); 