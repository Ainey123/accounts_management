import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, 'nexus-daemon.log');

function log(msg) {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${msg}\n`;
  console.log(formatted.trim());
  try {
    fs.appendFileSync(LOG_FILE, formatted);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

log('NEXUS Daemon starting up...');

// Target host
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function syncGmail() {
  log('Starting Gmail synchronization cycle...');
  try {
    const res = await fetch(`${APP_URL}/api/gmail-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (res.ok) {
      log(`Gmail sync successful. Synced ${data.synced || 0} new ticket(s).`);
    } else {
      log(`Gmail sync warning: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    log(`Gmail sync error: ${err.message}`);
  }
}

async function runCheckpoint() {
  log('Starting database checkpoint backup and external sync...');
  const scriptPath = path.join(__dirname, 'db-checkpoint.mjs');
  
  exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      log(`Checkpoint error: ${error.message}`);
      return;
    }
    if (stderr) {
      log(`Checkpoint warning: ${stderr.trim()}`);
    }
    if (stdout) {
      const outputLines = stdout.split('\n').filter(line => line.trim());
      for (const line of outputLines) {
        log(`Checkpoint stdout: ${line}`);
      }
    }
  });
}

// Perform initial cycles
syncGmail();
setTimeout(runCheckpoint, 5000); // Run checkpoint 5s after startup

// Schedule periodic executions
const GMAIL_INTERVAL = 60 * 1000; // 60 seconds
const CHECKPOINT_INTERVAL = 5 * 60 * 1000; // 5 minutes

setInterval(syncGmail, GMAIL_INTERVAL);
setInterval(runCheckpoint, CHECKPOINT_INTERVAL);

log(`Gmail polling scheduled every ${GMAIL_INTERVAL / 1000}s.`);
log(`Database checkpoint scheduled every ${CHECKPOINT_INTERVAL / 1000 / 60}m.`);
