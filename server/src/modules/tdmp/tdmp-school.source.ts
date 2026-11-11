import { Injectable, Logger } from '@nestjs/common';
import { TdmpConfig } from './tdmp.config';
import {
  TdmpApiClient,
  TdmpRequestError,
  TdmpUnavailableError,
} from './tdmp-api.client';
import type { TdmpSchoolBundle } from './tdmp-school.mapper';
import type { TdmpInfrastructure, TdmpSchool, TdmpTeacher } from './tdmp.types';

/** Most staff a school's teacher list may page through. */
const MAX_STAFF = 2000;

/** Reads school data from TDMP with the partner API key. */
@Injectable()
export class TdmpSchoolSource {
  private readonly logger = new Logger(TdmpSchoolSource.name);

  constructor(
    private readonly config: TdmpConfig,
    private readonly api: TdmpApiClient,
  ) {}

  /** Every school RTB GIS should show (TDMP_SCHOOL_FILTER applied). */
  listSchools(): AsyncGenerator<TdmpSchool> {
    return this.api.paginate<TdmpSchool>('/schools', this.config.schoolFilter);
  }

  /** The canonical school record, or null when TDMP does not know the code. */
  async school(schoolCode: string): Promise<TdmpSchool | null> {
    try {
      const res = await this.api.get<{ data: TdmpSchool }>(
        `/schools/${encodeURIComponent(schoolCode)}`,
      );
      return res?.data ?? null;
    } catch (err) {
      if (err instanceof TdmpRequestError && err.status === 404) return null;
      throw err;
    }
  }

  /**
   * School record plus infrastructure, student gender split and teachers.
   * Only the school record is required; the extras are skipped (and keep
   * their stored values) when TDMP refuses or fails them.
   */
  async bundle(schoolCode: string): Promise<TdmpSchoolBundle | null> {
    const school = await this.school(schoolCode);
    if (!school) return null;
    const code = school.schoolCode;
    const [infrastructure, students, teachers] = await Promise.all([
      this.optional('infrastructure', code, () =>
        this.api
          .get<{
            data: TdmpInfrastructure;
          }>(`/school-infrastructure/${encodeURIComponent(code)}`)
          .then((r) => r?.data ?? null),
      ),
      this.optional('students', code, async () => {
        const [male, female] = await Promise.all([
          this.api.count('/students', { schoolCode: code, gender: 'male' }),
          this.api.count('/students', { schoolCode: code, gender: 'female' }),
        ]);
        return { male, female };
      }),
      this.optional('teachers', code, () =>
        this.staff(code, { staffCategory: 'teachers' }),
      ),
    ]);
    return { school, infrastructure, students, teachers };
  }

  /** A school's staff list (compact TDMP shape, no NIN / banking data). */
  async staff(
    schoolCode: string,
    filter: Record<string, string> = {},
  ): Promise<TdmpTeacher[]> {
    const out: TdmpTeacher[] = [];
    for await (const t of this.api.paginate<TdmpTeacher>('/teachers', {
      ...filter,
      schoolCode,
    })) {
      out.push(t);
      if (out.length >= MAX_STAFF) break;
    }
    return out;
  }

  private async optional<T>(
    what: string,
    code: string,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof TdmpUnavailableError) throw err;
      this.logger.warn(
        `TDMP ${what} for ${code} skipped: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
