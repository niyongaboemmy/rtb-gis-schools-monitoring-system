require('dotenv').config({ path: require('path').join(__dirname, '.env') });

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
const buildingsDir = path.join(STORAGE_DIR, 'buildings');
const schoolsDir = path.join(STORAGE_DIR, 'schools');
[reportsDir, buildingsDir, schoolsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[file-server] Created directory: ${dir}`);
  }
});

// ── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'HEAD', 'OPTIONS'],
}));

app.use(express.json({ limit: '5mb' }));

// ── Multer ────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const { folder, schoolId } = req.query;
    
    // If we're uploading for a specific school building
    if (folder === 'buildings' && schoolId) {
      const targetDir = path.join(STORAGE_DIR, 'schools', schoolId, 'buildings');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`[file-server] Created dynamic directory: ${targetDir}`);
      }
      return cb(null, targetDir);
    }
    
    // Default to general buildings folder or reports
    const dest = folder === 'buildings' ? buildingsDir : reportsDir;
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuid()}`;
    cb(null, `asset-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

// ── Routes ────────────────────────────────────────────────────────────────
app.post('/upload', upload.array('files', MAX_FILES), (req, res) => {
  try {
    const { folder, schoolId } = req.query;
    const folderName = folder === 'buildings' ? 'buildings' : 'reports';
    
    const fileUrls = req.files.map((file) => {
      if (folder === 'buildings' && schoolId) {
        return `/files/schools/${schoolId}/buildings/${file.filename}`;
      }
      return `/files/${folderName}/${file.filename}`;
    });
    
    res.json({ success: true, urls: fileUrls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── School 3D model lookup ────────────────────────────────────────────────
app.get('/files/schools/:schoolId/3d', (req, res) => {
  const dir = path.join(schoolsDir, req.params.schoolId, '3d');
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'No 3D folder found' });
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.glb'));
  if (!files.length) return res.status(404).json({ error: 'No GLB file found' });
  const filename = files[0];
  res.json({
    url: `/schools/${req.params.schoolId}/3d/${filename}`,
    filename,
  });
});

// ── School viewer state (home position, annotations, measures) ───────────
app.get('/files/schools/:schoolId/viewer-state', (req, res) => {
  const file = path.join(schoolsDir, req.params.schoolId, 'viewer-state.json');
  if (!fs.existsSync(file)) return res.json({ home: null, annotations: [], measures: [] });
  try {
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch { res.json({ home: null, annotations: [], measures: [] }); }
});

app.put('/files/schools/:schoolId/viewer-state', (req, res) => {
  const dir = path.join(schoolsDir, req.params.schoolId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, 'viewer-state.json'), JSON.stringify(req.body));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use('/files', express.static(STORAGE_DIR, {
  setHeaders(res, filePath) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (filePath.endsWith('.glb')) {
      // GLB models rarely change — cache for 1 week; serve stale for 1 day while revalidating
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', port: PORT, storageDir: STORAGE_DIR }),
);

// ── Start ─────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[file-server] Port:    ${PORT}`);
  console.log(`[file-server] Storage: ${STORAGE_DIR}`);
  console.log(`[file-server] CORS:    ${CORS_ORIGINS.join(', ')}`);
  console.log(`[file-server] Limits:  ${MAX_FILE_SIZE_MB}MB (${MAX_FILE_SIZE_MB * 1024 * 1024} bytes) per file, ${MAX_FILES} files max`);
});

// For 5GB+ massive uploads, increase server timeouts (1 hour = 3600000ms)
server.timeout = 3600000;
server.keepAliveTimeout = 3600000;
server.headersTimeout = 3660000;
