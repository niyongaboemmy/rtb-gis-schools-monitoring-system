import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { join, dirname } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    // Navigate from dist/modules/storage to root/public/uploads
    this.uploadDir = join(process.cwd(), 'public', 'uploads');
    this.ensureDir(this.uploadDir).catch(err => 
      this.logger.error(`CRITICAL: Failed to initialize upload directory at ${this.uploadDir}`, err)
    );
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

  async uploadFile(objectName: string, buffer: Buffer, contentType: string): Promise<string | null> {
    try {
      const fullPath = join(this.uploadDir, objectName);
      await this.ensureDir(dirname(fullPath));
      await fs.writeFile(fullPath, buffer);
      
      this.logger.log(`Physical file deployed: ${objectName}`);
      // Return the public URL for the frontend
      return `/public/uploads/${objectName}`;
    } catch (err) {
      this.logger.error(`FAILED to deploy file: ${objectName}`, err);
      return null;
    }
  }

  async getFileUrl(objectName: string, expiry = 3600): Promise<string | null> {
    // Since we serve statically, the URL is just the public path
    return `/public/uploads/${objectName}`;
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
}
