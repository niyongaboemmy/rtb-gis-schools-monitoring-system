/**
 * schoolsStore.ts
 *
 * Centralised Zustand store for the schools list and facility definitions.
 * Components consume this store instead of making their own API calls, so
 * the data is fetched once and reused everywhere (SchoolsList, SchoolReporting, etc.)
 */
import { create } from 'zustand';
import { api } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface School {
  id: string;
  code: string;
  name: string;
  type: string;
  province: string;
  district: string;
  sector?: string;
  priorityLevel: string;
  kmzStatus: string;
  status?: string;
  overallScore?: number;
  tifFilePath?: string;
  kmz2dFilePath?: string;
}

export interface FacilityItem {
  id: string;
  label: string;
  issueCategories?: string[];
}

export interface FacilityDefinition {
  facilityId: string;
  title: string;
  items: FacilityItem[];
}

export interface SchoolsMeta {
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export interface SchoolsFilters {
  search: string;
  province: string;
  district: string;
  priority: string;
  type: string;
  page: number;
  limit: number;
}

// ─── Store State ─────────────────────────────────────────────────────────────

interface SchoolsState {
  // Schools list (paginated/filtered — for SchoolsList page)
  schools: School[];
  meta: SchoolsMeta;
  filters: SchoolsFilters;
  schoolsLoading: boolean;
  schoolsError: string | null;

  // All schools (full unfiltered list — for dropdowns, analytics, cross-school views)
  allSchools: School[];
  allSchoolsLoaded: boolean;
  allSchoolsLoading: boolean;

  // Facility definitions (global lookup table)
  facilities: FacilityDefinition[];
  facilitiesLoaded: boolean;
  facilitiesLoading: boolean;

  // Actions
  fetchSchools: (overrideFilters?: Partial<SchoolsFilters>) => Promise<void>;
  setFilters: (filters: Partial<SchoolsFilters>) => void;
  resetFilters: () => void;
  invalidateSchools: () => void;

  fetchAllSchools: () => Promise<void>;
  fetchFacilities: () => Promise<void>;
}

// ─── Default Values ──────────────────────────────────────────────────────────

const DEFAULT_FILTERS: SchoolsFilters = {
  search: '',
  province: '',
  district: '',
  priority: '',
  type: '',
  page: 1,
  limit: 50,
};

const DEFAULT_META: SchoolsMeta = {
  total: 0,
  totalPages: 1,
  page: 1,
  limit: 50,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useSchoolsStore = create<SchoolsState>((set, get) => ({
  // Schools list
  schools: [],
  meta: DEFAULT_META,
  filters: DEFAULT_FILTERS,
  schoolsLoading: false,
  schoolsError: null,

  // All schools (full unfiltered)
  allSchools: [],
  allSchoolsLoaded: false,
  allSchoolsLoading: false,

  // Facilities
  facilities: [],
  facilitiesLoaded: false,
  facilitiesLoading: false,

  // ── Actions ──────────────────────────────────────────────────────────────

  setFilters: (partialFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...partialFilters },
    }));
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS });
  },

  invalidateSchools: () => {
    set({ schools: [], meta: DEFAULT_META });
  },

  fetchSchools: async (overrideFilters) => {
    const state = get();
    const merged = { ...state.filters, ...overrideFilters };

    set({ schoolsLoading: true, schoolsError: null });

    try {
      const query = new URLSearchParams({
        page: merged.page.toString(),
        limit: merged.limit.toString(),
      });

      if (merged.search) query.append('search', merged.search);
      if (merged.province) query.append('province', merged.province);
      if (merged.district) query.append('district', merged.district);
      if (merged.priority) query.append('priority', merged.priority);
      if (merged.type) query.append('type', merged.type);

      const res = await api.get(`/schools?${query.toString()}`);

      const schools: School[] = res.data.data || [];
      const meta: SchoolsMeta = res.data.meta
        ? {
            total: res.data.meta.total ?? res.data.total ?? 0,
            totalPages: res.data.meta.totalPages ?? 1,
            page: merged.page,
            limit: merged.limit,
          }
        : { total: res.data.total ?? schools.length, totalPages: 1, page: 1, limit: merged.limit };

      set({ schools, meta, schoolsLoading: false, filters: merged });
    } catch (err: any) {
      console.error('[schoolsStore] fetchSchools error:', err);
      set({ schoolsLoading: false, schoolsError: err?.message ?? 'Failed to load schools' });
    }
  },

  fetchAllSchools: async () => {
    const { allSchoolsLoaded, allSchoolsLoading } = get();
    if (allSchoolsLoaded || allSchoolsLoading) return;

    set({ allSchoolsLoading: true });
    try {
      const firstRes = await api.get('/schools?page=1&limit=1000');
      const firstBatch: School[] = firstRes.data.data || [];
      const totalPages: number = firstRes.data.meta?.totalPages ?? 1;

      if (totalPages <= 1) {
        set({ allSchools: firstBatch, allSchoolsLoaded: true, allSchoolsLoading: false });
        return;
      }

      const remaining = Array.from({ length: totalPages - 1 }, (_, i) =>
        api.get(`/schools?page=${i + 2}&limit=1000`).then((r) => r.data.data || [])
      );
      const batches = await Promise.all(remaining);
      set({
        allSchools: [...firstBatch, ...batches.flat()],
        allSchoolsLoaded: true,
        allSchoolsLoading: false,
      });
    } catch (err: any) {
      set({ allSchoolsLoading: false });
      console.error('[schoolsStore] fetchAllSchools error:', err);
    }
  },

  fetchFacilities: async () => {
    const { facilitiesLoaded, facilitiesLoading } = get();
    if (facilitiesLoaded || facilitiesLoading) return;

    set({ facilitiesLoading: true });
    try {
      const res = await api.get('/schools/facilities');
      set({
        facilities: res.data || [],
        facilitiesLoaded: true,
        facilitiesLoading: false,
      });
    } catch (err) {
      set({ facilitiesLoading: false });
      console.error('[schoolsStore] fetchFacilities error:', err);
    }
  },
}));
