import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { School } from '../../modules/schools/entities/school.entity';
import { SchoolBuilding } from '../../modules/schools/entities/school-building.entity';
import { SchoolFacilitySurvey } from '../../modules/schools/entities/school-facility-survey.entity';
import { resolveAccessScope, schoolMatchesScope } from './access-scope';
import {
  NATIONAL_ONLY_KEY,
  SCOPED_RESOURCE_KEY,
  ScopedResourceConfig,
} from './scope.decorator';

/**
 * Per-resource geographic authorization for routes decorated with
 * `@ScopedResource()`. Undecorated routes pass straight through, as does every
 * request while `SCOPE_ENFORCEMENT` is off or the caller is national.
 *
 * `via` lets the decorated param be an id of a related record (a building or a
 * survey) rather than the school itself — the guard resolves it to a schoolId
 * first. Uses the global `DataSource` so no feature module has to wire repos.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const nationalOnly = this.reflector.getAllAndOverride<boolean>(
      NATIONAL_ONLY_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    const cfg = this.reflector.getAllAndOverride<ScopedResourceConfig>(
      SCOPED_RESOURCE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!cfg && !nationalOnly) return true;

    const req = ctx.switchToHttp().getRequest();
    const scope = resolveAccessScope(req.user);
    if (!scope.enforced || scope.isNational) return true;

    if (nationalOnly) {
      throw new ForbiddenException(
        'This action is available to national-scope users only.',
      );
    }
    if (!cfg) return true;

    const bag = cfg.from === 'query' ? req.query : req.params;
    const rawId = bag?.[cfg.param];
    // No id on this request → nothing to check; let the handler deal with it.
    if (!rawId || typeof rawId !== 'string') return true;

    let schoolId: string | undefined = rawId;
    if (cfg.via === 'building') {
      const b = await this.dataSource
        .getRepository(SchoolBuilding)
        .findOne({ where: { id: rawId }, select: ['id', 'schoolId'] });
      schoolId = b?.schoolId;
    } else if (cfg.via === 'survey') {
      const sv = await this.dataSource
        .getRepository(SchoolFacilitySurvey)
        .findOne({ where: { id: rawId }, select: ['id', 'schoolId'] });
      schoolId = sv?.schoolId;
    }
    // Unresolvable id → let the handler return its own 404.
    if (!schoolId) return true;

    const school = await this.dataSource.getRepository(School).findOne({
      where: { id: schoolId },
      select: ['id', 'province', 'district', 'sector'],
    });
    if (!school) return true;

    if (!schoolMatchesScope(school, scope)) {
      throw new ForbiddenException('This school is outside your access scope.');
    }
    return true;
  }
}
