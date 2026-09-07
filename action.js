// Usage: node action.js <name> "<js-actions>"
// Opens the readme page in the persistent profile, runs the provided actions
// (async playwright code with `page` in scope), then dumps state + screenshot.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const name = process.argv[2] || 'action';
  const actionsFile = process.argv[3];

  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

  const ctx = await chromium.launchPersistentContext(path.join(__dirname, 'profile'), {
    headless: true,
    viewport: { width: 1440, height: 900 },