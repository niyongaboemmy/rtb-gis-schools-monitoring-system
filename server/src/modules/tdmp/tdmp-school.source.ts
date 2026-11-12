import { Injectable } from '@nestjs/common';
import { TdmpConfig } from './tdmp.config';
import { TdmpApiClient, TdmpRequestError } from './tdmp-api.client';
import type { TdmpBand } from './tdmp-school.mapper';
import type { TdmpListMeta, TdmpSchool } from './tdmp.types';

/** The full school list plus what TDMP says about its freshness. */
export interface TdmpSchoolSweep {
  rows: TdmpSchool[];
  meta: TdmpListMeta;
}

/**
 * Reads school data from TDMP with the partner API key. List-first: one sweep
 * of the school list carries everything the sync needs except the year
 * established and GPS, which come from the per-school detail.
 */
@Injectable()
export class TdmpSchoolSource {
  constructor(
    private readonly config: TdmpConfig,
    private readonly api: TdmpApiClient,
  ) {}

  /** `meta` of the filtered list (1-row page): freshness and total. */
  async probe(): Promise<TdmpListMeta> {
    const res = await this.api.page<TdmpSchool>('/schools', {
      ...this.config.schoolFilter,
      page: 1,
      limit: 1,
    });
    return res?.meta ?? {};
  }

  /** Every school RTB GIS should show (TDMP_SCHOOL_FILTER applied). */
  async sweep(): Promise<TdmpSchoolSweep> {
    const limit = this.config.pageSize;
    const rows: TdmpSchool[] = [];
    let meta: TdmpListMeta = {};
    for (let page = 1; page <= 1000; page++) {
      const res = await this.api.page<TdmpSchool>('/schools', {
        ...this.config.schoolFilter,
        page,
        limit,
      });
      if (page === 1) meta = res?.meta ?? {};
      const data = Array.isArray(res?.data) ? res.data : [];
      rows.push(...data);
      const total = res?.meta?.page?.total;
      if (data.length < limit) break;
      if (typeof total === 'number' && rows.length >= total) break;
    }
    return { rows, meta };
  }

  /**
   * School code → TSS / VTC. TDMP only exposes the band as a filter, so each
   * band is swept for its codes. Codes in neither sweep are absent.
   */
  async bands(): Promise<Map<string, TdmpBand>> {
    const out = new Map<string, TdmpBand>();
    for (const band of ['TSS', 'VTC'] as const) {
      for await (const s of this.api.paginate<TdmpSchool>('/schools', {
        ...this.config.schoolFilter,
        categoryBand: band,
      }))
        if (s?.schoolCode) out.set(String(s.schoolCode).trim(), band);
    }
    return out;
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
}
