import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IssueReport, ReportStatus } from './entities/issue-report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { StorageService } from '../storage/storage.service';
import { EventsGateway } from '../events/events.gateway';
import {
  AccessScope,
  applySchoolScope,
  schoolMatchesScope,
} from '../../common/scope/access-scope';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(IssueReport)
    private readonly reportRepository: Repository<IssueReport>,
    private readonly storageService: StorageService,
    @Optional() private readonly eventsGateway?: EventsGateway,
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

  async findAll(
    filters: {
      schoolId?: string;
      buildingId?: string;
      status?: ReportStatus;
      facilityId?: string;
      reportedBy?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
    scope?: AccessScope,
  ): Promise<{ data: IssueReport[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.school', 'school')
      .leftJoinAndSelect('report.building', 'building')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .orderBy('report.createdAt', 'DESC')
      .take(limit)
      .skip(skip);

    if (filters.schoolId)
      qb.andWhere('report.schoolId = :schoolId', {
        schoolId: filters.schoolId,
      });
    if (filters.buildingId)
      qb.andWhere('report.buildingId = :buildingId', {
        buildingId: filters.buildingId,
      });
    if (filters.status)
      qb.andWhere('report.status = :status', { status: filters.status });
    if (filters.facilityId)
      qb.andWhere('report.facilityId = :facilityId', {
        facilityId: filters.facilityId,
      });
    if (filters.reportedBy)
      qb.andWhere('report.reportedBy = :reportedBy', {
        reportedBy: filters.reportedBy,
      });

    if (filters.startDate && filters.endDate) {
      qb.andWhere('report.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters.startDate) {
      qb.andWhere('report.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    } else if (filters.endDate) {
      qb.andWhere('report.createdAt <= :endDate', { endDate: filters.endDate });
    }

    if (scope) applySchoolScope(qb, scope, 'school');

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string, scope?: AccessScope): Promise<IssueReport> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['school', 'building', 'reporter'],
    });
    if (!report) {
      throw new NotFoundException(`Issue report with ID "${id}" not found`);
    }
    if (
      scope &&
      scope.enforced &&
      !scope.isNational &&
      !schoolMatchesScope(report.school ?? {}, scope)
    ) {
      throw new ForbiddenException('This report is outside your access scope.');
    }
    return report;
  }

  async update(
    id: string,
    updateReportDto: Partial<CreateReportDto>,
    scope?: AccessScope,
  ): Promise<IssueReport> {
    const report = await this.findOne(id, scope);
    Object.assign(report, updateReportDto);
    return this.reportRepository.save(report);
  }

  async updateStatus(
    id: string,
    status: ReportStatus,
    scope?: AccessScope,
  ): Promise<IssueReport> {
    const report = await this.findOne(id, scope);
    report.status = status;
    if (status === ReportStatus.SOLVED && !report.resolvedAt) {
      report.resolvedAt = new Date();
    }
    const saved = await this.reportRepository.save(report);

    if (saved.reportedBy) {
      this.eventsGateway?.emitReportStatusChanged(saved.reportedBy, {
        reportId: saved.id,
        schoolId: saved.schoolId,
        newStatus: saved.status,
        reportedBy: saved.reportedBy,
      });
    }

    return saved;
  }

  async delete(id: string, scope?: AccessScope): Promise<void> {
    const report = await this.findOne(id, scope);

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
