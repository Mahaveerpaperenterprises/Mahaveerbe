const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

const {
  SPACES_ENDPOINT,
  SPACES_REGION,
  SPACES_KEY,
  SPACES_SECRET,
  SPACES_BUCKET,
  SPACES_PUBLIC_BASE,
  SPACES_FOLDER = 'products'
} = process.env;

const s3 = new S3Client({
  region: SPACES_REGION || 'us-east-1',
  endpoint: SPACES_ENDPOINT,
  forcePathStyle: false,
  credentials: {
    accessKeyId: SPACES_KEY,
    secretAccessKey: SPACES_SECRET
  }
});

function safeName(name = '') {
  return String(name)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w.\-]/g, '_');
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
