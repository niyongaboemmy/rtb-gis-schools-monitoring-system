import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import {
  ChangeRequestPayload,
  IssueReport,
  ReportStatus,
  ReportType,
} from './entities/issue-report.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { Permission } from '../../common/constants/permissions.constant';
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
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Issue Reports feed the resolution component of the School Condition
   * Score — any create / status change / delete triggers a rescore.
   */
  private rescore(schoolId: string | null | undefined): void {
    if (schoolId) this.eventEmitter?.emit('school.updated', { schoolId });
  }

  async create(
    createReportDto: CreateReportDto,
    userId: string,
    scope?: AccessScope,
  ): Promise<IssueReport> {
    if (scope) await this.assertSchoolInScope(createReportDto.schoolId, scope);
    const report = this.reportRepository.create({
      ...createReportDto,
      type: ReportType.ISSUE,
      reportedBy: userId,
    });
    applyStatus(report, report.status ?? ReportStatus.PENDING);
    const saved = await this.reportRepository.save(report);
    this.rescore(saved.schoolId);
    return saved;
  }

  /** A caller may only file reports against schools inside their scope. */
  private async assertSchoolInScope(schoolId: string, scope: AccessScope) {
    if (!scope.enforced || scope.isNational) return;
    const school = await this.reportRepository.manager.findOne(School, {
      where: { id: schoolId },
      select: ['id', 'province', 'district', 'sector'],
    });
    if (!school || !schoolMatchesScope(school, scope)) {
      throw new ForbiddenException('This school is outside your access scope.');
    }
  }

  /**
   * WS7.7: file a "data change request" against a locked school field. It is
   * an issue report of type DATA_CHANGE_REQUEST routed to the GIS analysts,
   * who apply (or reject) the change and update the report status. The
   * caller (SchoolsService) has already checked scope and field names.
   */
  async createChangeRequest(
    schoolId: string,
    payload: ChangeRequestPayload,
    userId: string,
    assignedRole = 'gis_analyst',
  ): Promise<IssueReport> {
    const fieldNames = payload.fields.map((f) => f.field);
    const summary = payload.fields
      .map(
        (f) =>
          `${f.field}: ${formatValue(f.currentValue)} → ${formatValue(f.proposedValue)}`,
      )
      .join('; ');
    const report = this.reportRepository.create({
      schoolId,
      facilityId: ReportType.DATA_CHANGE_REQUEST,
      itemId: fieldNames.join(',').slice(0, 255),
      issueCategory: [ReportType.DATA_CHANGE_REQUEST],
      description: `Change requested: ${summary}\nReason: ${payload.reason}`,
      status: ReportStatus.PENDING,
      reportedBy: userId,
      attachments: [],
      type: ReportType.DATA_CHANGE_REQUEST,
      changeRequest: payload,
      assignedRole,
    });
    const saved = await this.reportRepository.save(report);
    await this.notifyAssignees(saved, assignedRole);
    return saved;
  }

  /**
   * Push a live notification to every active user of the assigned role.
   * Uses `EventsGateway.emitToUser` when the gateway provides it (see the
   * WS3.11 handoff); otherwise the report is still listed in Reports.
   */
  private async notifyAssignees(report: IssueReport, roleName: string) {
    const gateway = this.eventsGateway as
      | (EventsGateway & {
          emitToUser?: (
            userId: string,
            event: string,
            payload: unknown,
          ) => void;
        })
      | undefined;
    if (!gateway?.emitToUser) return;
    const assignees = await this.reportRepository.manager
      .createQueryBuilder(User, 'u')
      .innerJoin('u.role', 'r')
      .where('r.name = :roleName', { roleName })
      .andWhere('u.isActive = true')
      .select(['u.id'])
      .getMany();
    for (const u of assignees) {
      gateway.emitToUser(u.id, 'report:assigned', {
        reportId: report.id,
        schoolId: report.schoolId,
        type: report.type,
        fields: report.changeRequest?.fields.map((f) => f.field) ?? [],
      });
    }
  }

  async findAll(
    filters: {
      schoolId?: string;
      buildingId?: string;
      status?: ReportStatus;
      type?: ReportType;
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
      .leftJoin('report.reviewer', 'reviewer')
      .addSelect([
        'reviewer.id',
        'reviewer.firstName',
        'reviewer.lastName',
        'reviewer.email',
      ])
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
    if (filters.type)
      qb.andWhere('report.type = :type', { type: filters.type });
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
      relations: ['school', 'building', 'reporter', 'reviewer'],
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
    actor?: {
      id?: string;
      role?: { name?: string; permissions?: string[] } | null;
    },
    note?: string,
  ): Promise<IssueReport> {
    const report = await this.findOne(id, scope);
    if (
      actor &&
      !canTriage(actor) &&
      report.type !== ReportType.DATA_CHANGE_REQUEST
    ) {
      throw new ForbiddenException(
        'Only report managers can change the status of issue reports.',
      );
    }
    applyStatus(report, status);
    // Every review is recorded: who, when and (optionally) why.
    report.reviewNote = note?.trim() ? note.trim() : null;
    report.reviewedAt = new Date();
    report.reviewedById = actor?.id ?? null;
    // Set the relation too: a loaded `reviewer` would otherwise win on save.
    report.reviewer = actor?.id ? ({ id: actor.id } as User) : null;
    const saved = await this.reportRepository.save(report);
    this.rescore(saved.schoolId);

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

    const { schoolId } = report;
    await this.reportRepository.remove(report);
    this.rescore(schoolId);
  }
}

/**
 * Status transition with a consistent resolution date: entering SOLVED stamps
 * `resolvedAt` (a re-solve gets a fresh date), leaving SOLVED clears it — a
 * reopened report used to keep its old date and skew resolution times.
 */
export function applyStatus(
  report: { status: ReportStatus; resolvedAt?: Date | null },
  status: ReportStatus,
): void {
  const wasSolved =
    report.status === ReportStatus.SOLVED && !!report.resolvedAt;
  report.status = status;
  if (status === ReportStatus.SOLVED) {
    if (!wasSolved) report.resolvedAt = new Date();
  } else {
    report.resolvedAt = null;
  }
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v as string | number | boolean);
}

/** MANAGE_REPORTS (or super admin) may triage every report type. */
function canTriage(actor: {
  role?: { name?: string; permissions?: string[] } | null;
}): boolean {
  const name = (actor.role?.name ?? '').toLowerCase().replace(/\s+/g, '_');
  return (
    name === 'super_admin' ||
    (actor.role?.permissions ?? []).includes(Permission.MANAGE_REPORTS)
  );
}
