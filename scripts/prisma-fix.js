const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const prismaDir = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');

function removeLockFiles() {
  if (!fs.existsSync(prismaDir)) return;
  const files = fs.readdirSync(prismaDir);
  files.forEach((f) => {
    if (f.endsWith('.tmp')) {
      const fp = path.join(prismaDir, f);
      try { fs.unlinkSync(fp); } catch {}
    }
  });
}

function runWithRetry(cmd, retries = 3) {
  for (let i = 0; i < retries; i++) {
    removeLockFiles();
    try {
      return execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    } catch (e) {
      if (i === retries - 1) throw e;
      const wait = 1000 * (i + 1);
      console.log(`Retry ${i + 1}/${retries} after ${wait}ms...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

(async () => {
  try {
    removeLockFiles();
    runWithRetry('npx prisma generate');
  } catch (e) {
    console.error('Prisma generate failed. Try restarting your terminal.');
    process.exit(1);
  }
})();
