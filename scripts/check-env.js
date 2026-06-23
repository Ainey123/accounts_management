const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const required = ['DATABASE_URL'];
const optional = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET'];

let hasErrors = false;

if (!fs.existsSync(envPath)) {
  console.error('ERROR: .env file not found!');
  console.error('Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');

required.forEach((key) => {
  if (!envContent.includes(key) || envContent.includes(`${key}="your-`)) {
    console.error(`ERROR: Required env var ${key} is missing or has a placeholder value.`);
    hasErrors = true;
  }
});

optional.forEach((key) => {
  if (!envContent.includes(key) || envContent.includes(`${key}="your-`)) {
    console.warn(`WARNING: Optional env var ${key} is missing. Some features may not work.`);
  }
});

if (hasErrors) {
  console.error('\nFix the above errors and run setup again.');
  process.exit(1);
}

console.log('Environment variables look good.');
process.exit(0);
