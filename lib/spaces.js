const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const pick = (a, b) => (a ?? b);

const SPACES_ENDPOINT = pick(process.env.SPACES_ENDPOINT, process.env.DO_SPACE_ENDPOINT);
const SPACES_REGION   = pick(process.env.SPACES_REGION,   process.env.DO_SPACE_REGION) || 'us-east-1';
const SPACES_KEY      = pick(process.env.SPACES_KEY,      process.env.DO_SPACE_KEY);
const SPACES_SECRET   = pick(process.env.SPACES_SECRET,   process.env.DO_SPACE_SECRET);
const SPACES_BUCKET   = pick(process.env.SPACES_BUCKET,   process.env.DO_SPACE_BUCKET);
const SPACES_PUBLIC_BASE = pick(process.env.SPACES_PUBLIC_BASE, process.env.DO_SPACE_CDN_BASE);
const SPACES_FOLDER   = pick(process.env.SPACES_FOLDER,   process.env.DO_SPACE_FOLDER) || 'products';

if (!SPACES_ENDPOINT || !SPACES_KEY || !SPACES_SECRET || !SPACES_BUCKET || !SPACES_PUBLIC_BASE) {
  console.error('DigitalOcean Spaces env not set correctly:', {
    SPACES_ENDPOINT: !!SPACES_ENDPOINT,
    SPACES_KEY: !!SPACES_KEY,
    SPACES_SECRET: !!SPACES_SECRET,
    SPACES_BUCKET: !!SPACES_BUCKET,
    SPACES_PUBLIC_BASE: !!SPACES_PUBLIC_BASE,
    SPACES_FOLDER
  });
}

const s3 = new S3Client({
  region: SPACES_REGION,            
  endpoint: SPACES_ENDPOINT,       
  forcePathStyle: false,
  credentials: {
    accessKeyId: SPACES_KEY,
    secretAccessKey: SPACES_SECRET
  }
});

function safeName(name = '') {
  return String(name).trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, '_');
}

async function uploadBufferToSpaces(buffer, mimeType, originalName) {
  const filename = `${Date.now()}-${safeName(originalName)}`;
  const key = `${SPACES_FOLDER}/${filename}`;

  const put = new PutObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ACL: 'public-read'
  });

  await s3.send(put);

  const url = `${SPACES_PUBLIC_BASE}/${key}`;
  return { key, url };
}

module.exports = { uploadBufferToSpaces };
