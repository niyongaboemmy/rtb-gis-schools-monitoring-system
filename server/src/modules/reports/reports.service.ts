import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { IssueReport, ReportStatus } from './entities/issue-report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(IssueReport)
    private readonly reportRepository: Repository<IssueReport>,
    private readonly storageService: StorageService,
  ) {}

  async create(
    createReportDto: CreateReportDto,
    userId: string,
  ): Promise<IssueReport> {
    const report = this.reportRepository.create({
      ...createReportDto,
      reportedBy: userId,
    });
    return this.reportRepository.save(report);
  }

  async findAll(filters: {
    schoolId?: string;
    buildingId?: string;
    status?: ReportStatus;
    facilityId?: string;
    reportedBy?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ data: IssueReport[]; total: number }> {
    const where: any = {};
    if (filters.schoolId) where.schoolId = filters.schoolId;
    if (filters.buildingId) where.buildingId = filters.buildingId;
    if (filters.status) where.status = filters.status;
    if (filters.facilityId) where.facilityId = filters.facilityId;
    if (filters.reportedBy) where.reportedBy = filters.reportedBy;

    if (filters.startDate && filters.endDate) {
      where.createdAt = Between(filters.startDate, filters.endDate);
    } else if (filters.startDate) {
      where.createdAt = MoreThanOrEqual(filters.startDate);
    } else if (filters.endDate) {
      where.createdAt = LessThanOrEqual(filters.endDate);
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.reportRepository.findAndCount({
      where,
      relations: ['school', 'building', 'reporter'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: skip,
    });

    return { data, total };
  }

  async findOne(id: string): Promise<IssueReport> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['school', 'building', 'reporter'],
    });
    if (!report) {
      throw new NotFoundException(`Issue report with ID "${id}" not found`);
    }
    return report;
  }

  async update(
    id: string,
    updateReportDto: Partial<CreateReportDto>,
  ): Promise<IssueReport> {
    const report = await this.findOne(id);
    Object.assign(report, updateReportDto);
    return this.reportRepository.save(report);
  }

  async updateStatus(id: string, status: ReportStatus): Promise<IssueReport> {
    const report = await this.findOne(id);
    report.status = status;
    return this.reportRepository.save(report);
  }

  async delete(id: string): Promise<void> {
    const report = await this.findOne(id);

    // Delete attachment files from the file server storage
    if (report.attachments?.length) {
      await Promise.allSettled(
        report.attachments.map((url: string) => {
          const objectName = this.storageService.urlToObjectName(url);
          return objectName
            ? this.storageService.deleteFile(objectName)
            : Promise.resolve();
        }),
      );
    }

    await this.reportRepository.remove(report);
  }
}
