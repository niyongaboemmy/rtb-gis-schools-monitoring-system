import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { IssueReport, ReportStatus } from './entities/issue-report.entity';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(IssueReport)
    private readonly reportRepository: Repository<IssueReport>,
  ) {}

  async create(createReportDto: CreateReportDto, userId: string): Promise<IssueReport> {
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
  }): Promise<IssueReport[]> {
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

    return this.reportRepository.find({
      where,
      relations: ['school', 'building'],
      order: { createdAt: 'DESC' },
    });
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

  async updateStatus(id: string, status: ReportStatus): Promise<IssueReport> {
    const report = await this.findOne(id);
    report.status = status;
    return this.reportRepository.save(report);
  }

  async delete(id: string): Promise<void> {
    const report = await this.findOne(id);
    await this.reportRepository.remove(report);
  }
}
