import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { join, dirname } from 'path';
import * as Minio from 'minio';

// ---------------------------------------------------------------------------
// Strategy interface
// ---------------------------------------------------------------------------

export interface IStorageBackend {
  upload(
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string | null>;
  getUrl(objectName: string, expiry?: number): Promise<string | null>;
  delete(objectName: string): Promise<void>;
  deleteDirectory(dirPath: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Local filesystem backend (original behaviour)
// ---------------------------------------------------------------------------

class LocalFsBackend implements IStorageBackend {
  private readonly urlPrefix = '/files';

  constructor(
    private readonly uploadDir: string,
    private readonly logger: Logger,
  ) {}

  private async ensureDir(path: string): Promise<void> {
    try {
      await fs.access(path);
    } catch {
      try {
        await fs.mkdir(path, { recursive: true });
      } catch (err) {
        this.logger.error(`Failed to create directory: ${path}`, err);
      }
    }
  }

  async upload(
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string | null> {
    try {
      const fullPath = join(this.uploadDir, objectName);
      await this.ensureDir(dirname(fullPath));
      await fs.writeFile(fullPath, buffer);
      this.logger.log(`[local] uploaded: ${objectName}`);
      return `${this.urlPrefix}/${objectName}`;
    } catch (err) {
      this.logger.error(`[local] upload failed: ${objectName}`, err);
      return null;
    }
  }

  async getUrl(objectName: string, _expiry?: number): Promise<string | null> {
    return `${this.urlPrefix}/${objectName}`;
  }

  async delete(objectName: string): Promise<void> {
    try {
      await fs.unlink(join(this.uploadDir, objectName));
      this.logger.log(`[local] deleted: ${objectName}`);
    } catch (err) {
      this.logger.error(`[local] delete failed: ${objectName}`, err);
    }
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(join(this.uploadDir, dirPath), { recursive: true, force: true });
      this.logger.log(`[local] directory deleted: ${dirPath}`);
    } catch (err) {
      this.logger.error(`[local] directory delete failed: ${dirPath}`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// MinIO backend
// ---------------------------------------------------------------------------

class MinioBackend implements IStorageBackend {
  private readonly client: Minio.Client;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor(
    private readonly logger: Logger,
    endpoint: string,
    port: number,
    useSSL: boolean,
    accessKey: string,
    secretKey: string,
    bucket: string,
  ) {
    this.client = new Minio.Client({ endPoint: endpoint, port, useSSL, accessKey, secretKey });
    this.bucket = bucket;
    const scheme = useSSL ? 'https' : 'http';
    this.baseUrl = `${scheme}://${endpoint}:${port}/${bucket}`;
  }

  async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`[minio] bucket created: ${this.bucket}`);
      }
    } catch (err) {
      this.logger.error(`[minio] bucket check/create failed`, err);
    }
  }

  async upload(
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string | null> {
    try {
      await this.client.putObject(this.bucket, objectName, buffer, buffer.length, {
        'Content-Type': contentType,
      });
      this.logger.log(`[minio] uploaded: ${objectName}`);
      return `${this.baseUrl}/${objectName}`;
    } catch (err) {
      this.logger.error(`[minio] upload failed: ${objectName}`, err);
      return null;
    }
  }

  async getUrl(objectName: string, expiry = 3600): Promise<string | null> {
    try {
      return await this.client.presignedGetObject(this.bucket, objectName, expiry);
    } catch (err) {
      this.logger.error(`[minio] presign failed: ${objectName}`, err);
      return null;
    }
  }

  async delete(objectName: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, objectName);
      this.logger.log(`[minio] deleted: ${objectName}`);
    } catch (err) {
      this.logger.error(`[minio] delete failed: ${objectName}`, err);
    }
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    try {
      const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
      const objectNames: string[] = await new Promise((resolve, reject) => {
        const names: string[] = [];
        const stream = this.client.listObjects(this.bucket, prefix, true);
        stream.on('data', (obj) => { if (obj.name) names.push(obj.name); });
        stream.on('end', () => resolve(names));
        stream.on('error', reject);
      });

      if (objectNames.length === 0) return;

      await this.client.removeObjects(
        this.bucket,
        objectNames.map((name) => ({ name })),
      );
      this.logger.log(`[minio] deleted ${objectNames.length} objects under: ${dirPath}`);
    } catch (err) {
      this.logger.error(`[minio] directory delete failed: ${dirPath}`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// StorageService — strategy context
// ---------------------------------------------------------------------------

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly backend: IStorageBackend;

  constructor(private readonly configService: ConfigService) {
    const backendType = configService.get<string>('STORAGE_BACKEND', 'local');

    if (backendType === 'minio') {
      const endpoint = configService.get<string>('MINIO_ENDPOINT', 'localhost');
      const port = parseInt(configService.get<string>('MINIO_PORT', '9000'), 10);
      const useSSL = configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
      const accessKey = configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
      const secretKey = configService.get<string>('MINIO_SECRET_KEY', 'minioadmin');
      const bucket = configService.get<string>('MINIO_BUCKET', 'rtb-gis-files');

      const minio = new MinioBackend(
        this.logger,
        endpoint,
        port,
        useSSL,
        accessKey,
        secretKey,
        bucket,
      );
      minio.ensureBucket().catch(() => {});
      this.backend = minio;
      this.logger.log(`Storage backend: MinIO (${endpoint}:${port}/${bucket})`);
    } else {
      const configured = configService.get<string>('FILE_SERVER_STORAGE_PATH');
      const uploadDir = configured
        ? join(process.cwd(), configured)
        : join(process.cwd(), '..', 'file-server', 'storage');

      this.backend = new LocalFsBackend(uploadDir, this.logger);
      this.logger.log(`Storage backend: local filesystem (${uploadDir})`);
    }
  }

  async uploadFile(
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string | null> {
    return this.backend.upload(objectName, buffer, contentType);
  }

  async getFileUrl(objectName: string, expiry = 3600): Promise<string | null> {
    return this.backend.getUrl(objectName, expiry);
  }

  async deleteFile(objectName: string): Promise<void> {
    return this.backend.delete(objectName);
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    return this.backend.deleteDirectory(dirPath);
  }

  /**
   * Extracts the storage object name from a stored URL.
   * Handles:
   *   /files/path/to/file            → path/to/file  (local)
   *   http://host:port/bucket/path   → path          (MinIO)
   */
  urlToObjectName(url: string): string | null {
    if (!url) return null;
    // Local filesystem URL
    const localMatch = url.match(/\/files\/(.+)$/);
    if (localMatch) return localMatch[1];
    // MinIO URL: http(s)://host:port/bucket/path
    const minioMatch = url.match(/^https?:\/\/[^/]+\/[^/]+\/(.+)$/);
    if (minioMatch) return minioMatch[1];
    return null;
  }
}
