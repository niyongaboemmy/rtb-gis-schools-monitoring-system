require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const fs = require('fs');

const app = express();

// ── Configuration from .env ───────────────────────────────────────────────
const PORT = parseInt(process.env.FILE_SERVER_PORT || '3002', 10);
const MAX_FILE_SIZE_MB = parseInt(process.env.FILE_SERVER_MAX_FILE_SIZE_MB || '10', 10);
const MAX_FILES = parseInt(process.env.FILE_SERVER_MAX_FILES_PER_REQUEST || '10', 10);

const STORAGE_DIR = path.isAbsolute(process.env.FILE_SERVER_STORAGE_DIR || '')
  ? process.env.FILE_SERVER_STORAGE_DIR
  : path.join(__dirname, process.env.FILE_SERVER_STORAGE_DIR || 'storage');

const CORS_ORIGINS = (process.env.FILE_SERVER_CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ── Storage directories ───────────────────────────────────────────────────
const reportsDir = path.join(STORAGE_DIR, 'reports');
const schoolsDir = path.join(STORAGE_DIR, 'schools');
[reportsDir, schoolsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[file-server] Created directory: ${dir}`);
  }
});

// ── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: CORS_ORIGINS,
  methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
}));

// ── Multer ────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, reportsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuid()}`;
    cb(null, `attachment-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

// ── Routes ────────────────────────────────────────────────────────────────
app.post('/upload', upload.array('files', MAX_FILES), (req, res) => {
  try {
    const fileUrls = req.files.map((file) => `/files/reports/${file.filename}`);
    res.json({ success: true, urls: fileUrls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use('/files', express.static(STORAGE_DIR, {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', port: PORT, storageDir: STORAGE_DIR }),
);

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[file-server] Port:    ${PORT}`);
  console.log(`[file-server] Storage: ${STORAGE_DIR}`);
  console.log(`[file-server] CORS:    ${CORS_ORIGINS.join(', ')}`);
  console.log(`[file-server] Limits:  ${MAX_FILE_SIZE_MB}MB per file, ${MAX_FILES} files max`);
});
