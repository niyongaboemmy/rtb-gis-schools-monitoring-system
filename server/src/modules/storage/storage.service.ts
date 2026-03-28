import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { join, dirname } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  // URL prefix returned to clients — matches the file-server's /files route
  private readonly urlPrefix = '/files';

  constructor(private readonly configService: ConfigService) {
    // Resolve storage path: env var (absolute or relative to server/) → fallback to sibling file-server/storage
    const configured = this.configService.get<string>(
      'FILE_SERVER_STORAGE_PATH',
    );
    this.uploadDir = configured
      ? join(process.cwd(), configured)
      : join(process.cwd(), '..', 'file-server', 'storage');

    this.ensureDir(this.uploadDir).catch((err) =>
      this.logger.error(
        `CRITICAL: Failed to initialize upload directory at ${this.uploadDir}`,
        err,
      ),
    );
    this.logger.log(`Storage directory: ${this.uploadDir}`);
  }

  private async ensureDir(path: string) {
    try {
      await fs.access(path);
    } catch {
      try {
        await fs.mkdir(path, { recursive: true });
        this.logger.log(`Upload directory initialized at: ${path}`);
      } catch (err) {
        this.logger.error(`Failed to create directory: ${path}`, err);
      }
    }
  }

  async uploadFile(
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string | null> {
    try {
      const fullPath = join(this.uploadDir, objectName);
      await this.ensureDir(dirname(fullPath));
      await fs.writeFile(fullPath, buffer);

      this.logger.log(`Physical file deployed: ${objectName}`);
      return `${this.urlPrefix}/${objectName}`;
    } catch (err) {
      this.logger.error(`FAILED to deploy file: ${objectName}`, err);
      return null;
    }
  }

  async getFileUrl(objectName: string, expiry = 3600): Promise<string | null> {
    return `${this.urlPrefix}/${objectName}`;
  }

  async deleteFile(objectName: string): Promise<void> {
    const fullPath = join(this.uploadDir, objectName);
    try {
      await fs.unlink(fullPath);
      this.logger.log(`File purged from filesystem: ${objectName}`);
    } catch (err) {
      this.logger.error(`Failed to purge file: ${objectName}`, err);
    }
  }

  /** Delete an entire directory and everything inside it (e.g. schools/{id}). */
  async deleteDirectory(dirPath: string): Promise<void> {
    const fullPath = join(this.uploadDir, dirPath);
    try {
      await fs.rm(fullPath, { recursive: true, force: true });
      this.logger.log(`Directory purged: ${dirPath}`);
    } catch (err) {
      this.logger.error(`Failed to purge directory: ${dirPath}`, err);
    }
  }

  /**
   * Extract the storage object name from a file URL.
   * Handles both:
   *  - relative:  /files/reports/report-123.pdf  → reports/report-123.pdf
   *  - absolute:  http://localhost:3002/files/reports/report-123.pdf → reports/report-123.pdf
   */
  urlToObjectName(url: string): string | null {
    if (!url) return null;
    const match = url.match(/\/files\/(.+)$/);
    return match ? match[1] : null;
  }
}
