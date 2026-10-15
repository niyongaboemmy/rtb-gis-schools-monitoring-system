import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolViewerState } from './entities/school-viewer-state.entity';
import { UpdateViewerStateDto } from './dto/viewer-state.dto';

export interface ViewerStateResponse {
  home: Record<string, unknown> | null;
  buildingPins: Record<string, unknown>;
  annotations: unknown[];
  measures: unknown[];
  /** false until the first save — lets the client run its one-time import. */
  exists: boolean;
  updatedAt: Date | null;
}

@Injectable()
export class ViewerStateService {
  constructor(
    @InjectRepository(SchoolViewerState)
    private readonly repo: Repository<SchoolViewerState>,
  ) {}

  async get(schoolId: string): Promise<ViewerStateResponse> {
    const row = await this.repo.findOne({ where: { schoolId } });
    return {
      home: row?.home ?? null,
      buildingPins: row?.buildingPins ?? {},
      annotations: row?.annotations ?? [],
      measures: row?.measures ?? [],
      exists: !!row,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  /** Merges home / buildingPins; omitted fields keep their stored value. */
  async update(
    schoolId: string,
    dto: UpdateViewerStateDto,
    userId: string | null,
  ): Promise<ViewerStateResponse> {
    const row =
      (await this.repo.findOne({ where: { schoolId } })) ??
      this.repo.create({
        schoolId,
        home: null,
        buildingPins: {},
        annotations: [],
        measures: [],
      });
    if (dto.home !== undefined) row.home = dto.home;
    if (dto.buildingPins !== undefined) row.buildingPins = dto.buildingPins;
    // Measures and notes now live in `site_features` (WS5.2); the old fields
    // are only read once by SiteFeaturesService.importLegacy and never written.
    row.updatedBy = userId;
    await this.repo.save(row);
    return this.get(schoolId);
  }
}
