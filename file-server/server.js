require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const fs = require('fs');

const app = express();

// ── Configuration from .env ───────────────────────────────────────────────
// Bind FILE_SERVER_PORT authoritatively. Do NOT fall back to process.env.PORT
// — on the EC2 box the PM2 environment carries PORT=3001 (the API's port) and
// the file-server would collide with it. (cPanel/Passenger is a separate,
// unused pipeline; if it ever returns, set FILE_SERVER_PORT from PORT there.)
const PORT = parseInt(process.env.FILE_SERVER_PORT || '3002', 10);
const MAX_FILE_SIZE_MB = parseInt(
  process.env.FILE_SERVER_MAX_FILE_SIZE_MB || '10',
  10,
);
const MAX_FILES = parseInt(
  process.env.FILE_SERVER_MAX_FILES_PER_REQUEST || '10',
  10,
);

// Optional shared secret. When set, /upload and the viewer-state PUT require
// the `x-file-server-token` header. Unset = open (backwards compatible).
const UPLOAD_TOKEN = (process.env.FILE_SERVER_UPLOAD_TOKEN || '').trim();

const STORAGE_DIR = path.isAbsolute(process.env.FILE_SERVER_STORAGE_DIR || '')
  ? process.env.FILE_SERVER_STORAGE_DIR
  : path.join(__dirname, process.env.FILE_SERVER_STORAGE_DIR || 'storage');

const CORS_ORIGINS = (process.env.FILE_SERVER_CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Folders a client may target via ?folder= (all direct children of STORAGE_DIR).
const ALLOWED_FOLDERS = ['reports', 'buildings', 'kmz', 'places-overlay'];
const DEFAULT_FOLDER = 'reports';
const resolveFolder = (f) =>
  ALLOWED_FOLDERS.includes(String(f)) ? String(f) : DEFAULT_FOLDER;

// ── Storage directories ───────────────────────────────────────────────────
[...ALLOWED_FOLDERS, 'schools'].forEach((sub) => {
  const dir = path.join(STORAGE_DIR, sub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[file-server] Created directory: ${dir}`);
  }
});

// ── Behind nginx ──────────────────────────────────────────────────────────
app.set('trust proxy', true);
app.disable('x-powered-by');

// ── CORS ──────────────────────────────────────────────────────────────────
// Public asset server. Same-origin in production (nginx proxies /files+/upload),
// but keep permissive CORS for direct cross-origin use. No credentials.
app.use(
  cors({
    origin: CORS_ORIGINS.length ? CORS_ORIGINS : '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'HEAD', 'OPTIONS'],
  }),
);

app.use(express.json({ limit: '25mb' }));

// Tiny request log (helps diagnose upload issues in prod logs)
app.use((req, _res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    console.log(`[file-server] ${req.method} ${req.originalUrl}`);
  }
  next();
});

const requireToken = (req, res, next) => {
  if (!UPLOAD_TOKEN) return next();
  if ((req.headers['x-file-server-token'] || '') === UPLOAD_TOKEN) return next();
  return res.status(401).json({ success: false, message: 'Invalid upload token' });
};

// ── Multer ────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folder = resolveFolder(req.query.folder);
    const { schoolId } = req.query;

    // Per-school scoping for building media.
    if (folder === 'buildings' && schoolId) {
      const targetDir = path.join(
        STORAGE_DIR,
        'schools',
        String(schoolId),
        'buildings',
      );
      fs.mkdirSync(targetDir, { recursive: true });
      return cb(null, targetDir);
    }

    cb(null, path.join(STORAGE_DIR, folder));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuid()}`;
    // Keep only a safe extension.
    const ext = path.extname(file.originalname).replace(/[^.a-z0-9]/gi, '');
    cb(null, `asset-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: MAX_FILES },
});

// ── Routes ────────────────────────────────────────────────────────────────
app.post('/upload', requireToken, upload.array('files', MAX_FILES), (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res
        .status(400)
        .json({ success: false, message: 'No files received' });
    }

    const folder = resolveFolder(req.query.folder);
    const { schoolId } = req.query;

    const urls = files.map((file) =>
      folder === 'buildings' && schoolId
        ? `/files/schools/${schoolId}/buildings/${file.filename}`
        : `/files/${folder}/${file.filename}`,
    );

    res.json({ success: true, urls });
  } catch (error) {
    console.error('[file-server] upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── School 3D model lookup ────────────────────────────────────────────────
app.get('/files/schools/:schoolId/3d', (req, res) => {
  const dir = path.join(STORAGE_DIR, 'schools', req.params.schoolId, '3d');
  if (!fs.existsSync(dir))
    return res.status(404).json({ error: 'No 3D folder found' });
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.glb'));
  if (!files.length)
    return res.status(404).json({ error: 'No GLB file found' });
  res.json({
    url: `/schools/${req.params.schoolId}/3d/${files[0]}`,
    filename: files[0],
  });
});

// ── School viewer state (home position, annotations, measures) ───────────
app.get('/files/schools/:schoolId/viewer-state', (req, res) => {
  const file = path.join(
    STORAGE_DIR,
    'schools',
    req.params.schoolId,
    'viewer-state.json',
  );
  if (!fs.existsSync(file))
    return res.json({ home: null, annotations: [], measures: [] });
  try {
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    res.json({ home: null, annotations: [], measures: [] });
  }
});

app.put(
  '/files/schools/:schoolId/viewer-state',
  requireToken,
  (req, res) => {
    const dir = path.join(STORAGE_DIR, 'schools', req.params.schoolId);
    fs.mkdirSync(dir, { recursive: true });
    try {
      fs.writeFileSync(
        path.join(dir, 'viewer-state.json'),
        JSON.stringify(req.body),
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.use(
  '/files',
  express.static(STORAGE_DIR, {
    dotfiles: 'ignore',
    setHeaders(res, filePath) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (filePath.endsWith('.glb')) {
        res.setHeader(
          'Cache-Control',
          'public, max-age=604800, stale-while-revalidate=86400',
        );
      } else {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    },
  }),
);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', port: PORT, storageDir: STORAGE_DIR }),
);

// ── Error handler — multer size/count errors → 4xx, not a generic 500 ─────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(413).json({ success: false, message: err.message });
  }
  console.error('[file-server] error:', err);
  res
    .status(500)
    .json({ success: false, message: err.message || 'Internal error' });
});

// ── Start ─────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[file-server] Port:    ${PORT}`);
  console.log(`[file-server] Storage: ${STORAGE_DIR}`);
  console.log(`[file-server] Auth:    ${UPLOAD_TOKEN ? 'token required' : 'open'}`);
  console.log(
    `[file-server] Limits:  ${MAX_FILE_SIZE_MB}MB per file, ${MAX_FILES} files max`,
  );
});

// Long timeouts for multi-GB geospatial uploads (1 hour).
server.timeout = 3600000;
server.keepAliveTimeout = 3600000;
server.headersTimeout = 3660000;
server.requestTimeout = 3600000;
