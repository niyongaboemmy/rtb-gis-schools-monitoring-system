require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const { cacheControlFor } = require('./cache-control');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const { isUuid, resolveJwtSecret, createRequireUploader } = require('./auth');
const { findRejectedFiles } = require('./file-types');

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

// Optional legacy shared secret for server-to-server uploads
// (`x-file-server-token` header). Browsers authenticate with their JWT instead.
const UPLOAD_TOKEN = (process.env.FILE_SERVER_UPLOAD_TOKEN || '').trim();

// The API's JWT secret; uploads verify the user's access token against it.
const JWT_SECRET = resolveJwtSecret();

// Development escape hatch only: accept unauthenticated uploads when no JWT
// secret can be found. Never set this in production.
const ALLOW_ANONYMOUS_UPLOADS =
  process.env.FILE_SERVER_ALLOW_ANONYMOUS_UPLOADS === 'true';

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
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
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

const requireUploader = createRequireUploader({
  jwtSecret: JWT_SECRET,
  uploadToken: UPLOAD_TOKEN,
  allowAnonymous: ALLOW_ANONYMOUS_UPLOADS,
  resolveFolder,
});

// `schoolId` reaches filesystem paths, so only a UUID is accepted — a value
// like "../.." would otherwise escape STORAGE_DIR.
const rejectBadSchoolId = (req, res, next) => {
  const id = req.params.schoolId ?? req.query.schoolId;
  if (id !== undefined && !isUuid(String(id)))
    return res.status(400).json({ success: false, message: 'Invalid school id' });
  return next();
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
app.post('/upload', rejectBadSchoolId, requireUploader, upload.array('files', MAX_FILES), (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res
        .status(400)
        .json({ success: false, message: 'No files received' });
    }

    const folder = resolveFolder(req.query.folder);
    const { schoolId } = req.query;

    // Reject the whole batch if any file's content isn't allowed here.
    const rejected = findRejectedFiles(files, folder);
    if (rejected.length) {
      files.forEach((f) => fs.unlink(f.path, () => {}));
      return res.status(415).json({
        success: false,
        message: `Unsupported file type for ${folder}: ${rejected.join(', ')}`,
      });
    }

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
app.get('/files/schools/:schoolId/3d', rejectBadSchoolId, (req, res) => {
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

// ── Legacy school viewer state (read-only) ────────────────────────────────
// Viewer state now lives in the API (`/api/v1/schools/:id/viewer-state`). This
// GET remains so the 3D viewer can import a school's old state once; the PUT
// that let any client overwrite it has been removed.
app.get('/files/schools/:schoolId/viewer-state', rejectBadSchoolId, (req, res) => {
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

app.use(
  '/files',
  express.static(STORAGE_DIR, {
    dotfiles: 'ignore',
    setHeaders(res, filePath) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', cacheControlFor(filePath));
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
  console.log(
    `[file-server] Auth:    ${
      JWT_SECRET
        ? 'JWT required for uploads'
        : ALLOW_ANONYMOUS_UPLOADS
          ? 'OPEN (FILE_SERVER_ALLOW_ANONYMOUS_UPLOADS=true — dev only)'
          : 'uploads DISABLED (no JWT_SECRET found)'
    }`,
  );
  console.log(
    `[file-server] Limits:  ${MAX_FILE_SIZE_MB}MB per file, ${MAX_FILES} files max`,
  );
});

// Long timeouts for multi-GB geospatial uploads (1 hour).
server.timeout = 3600000;
server.keepAliveTimeout = 3600000;
server.headersTimeout = 3660000;
server.requestTimeout = 3600000;
