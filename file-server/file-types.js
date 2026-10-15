/**
 * Content checks for uploads: a file is accepted only if its leading bytes
 * match a type allowed in the target folder. The extension alone is never
 * trusted. Mirrors server/src/common/security/upload-validation.ts.
 */
const fs = require('fs');

function detectFileKind(head) {
  const ascii = (a, b) => head.toString('ascii', a, b);
  if (head.length >= 4) {
    if (head[0] === 0x50 && head[1] === 0x4b &&
        ((head[2] === 0x03 && head[3] === 0x04) || (head[2] === 0x05 && head[3] === 0x06)))
      return 'zip';
    if (ascii(0, 4) === 'glTF') return 'glb';
    if (ascii(0, 4) === '%PDF') return 'pdf';
    if (ascii(0, 4) === 'GIF8') return 'gif';
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'webm';
    // TIFF / BigTIFF (GeoTIFF imagery), little- or big-endian.
    if ((ascii(0, 2) === 'II' && (head[2] === 0x2a || head[2] === 0x2b) && head[3] === 0) ||
        (ascii(0, 2) === 'MM' && head[2] === 0 && (head[3] === 0x2a || head[3] === 0x2b)))
      return 'tiff';
  }
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'png';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (head.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (/^(heic|heix|hevc|hevx|mif1|msf1|heim|heis)$/.test(brand)) return 'heic';
    return 'mp4'; // isom, mp41/42, avc1, M4V, qt (QuickTime)…
  }
  const text = head.toString('utf8').replace(/^﻿/, '').trimStart();
  if (text.startsWith('<?xml') || /^<(kml|gpx|Document)\b/i.test(text)) return 'xml';
  if (text.startsWith('{') || text.startsWith('[')) return 'json';
  return null;
}

const IMAGE = ['png', 'jpeg', 'webp', 'gif', 'heic'];
const VIDEO = ['mp4', 'webm'];

/** Kinds allowed per upload folder. */
const FOLDER_KINDS = {
  reports: [...IMAGE, ...VIDEO, 'pdf'],
  buildings: [...IMAGE, ...VIDEO],
  kmz: ['zip', 'xml', 'glb', 'tiff'],
  'places-overlay': ['zip', 'xml', 'json'],
};

function readHead(file, bytes = 64) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

/** Returns the names of files whose content is not allowed in `folder`. */
function findRejectedFiles(files, folder) {
  const allowed = FOLDER_KINDS[folder] || [];
  return files
    .filter((f) => {
      try {
        return !allowed.includes(detectFileKind(readHead(f.path)));
      } catch {
        return true;
      }
    })
    .map((f) => f.originalname);
}

module.exports = { detectFileKind, findRejectedFiles, FOLDER_KINDS };
