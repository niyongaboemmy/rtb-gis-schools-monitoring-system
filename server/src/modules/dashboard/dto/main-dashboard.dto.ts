// Lightweight DTOs for the main dashboard payload
export interface InfrastructureMetrics {
  healthIndex: number;
  ageScore: number;
  maintenanceDue: boolean;
  capacityUtilization: number;
}

export interface MapSummary {
  areaKm2: number;
  featureCount: number;
}

export interface FacilitiesSummary {
  classrooms: number;
  labs: number;
  dormitories: number;
}

export interface UtilitiesSummary {
  waterAvailability: boolean;
  powerReliability: number;
}

export interface MainDashboardDto {
  timestamp: string;
  data: {
    infrastructure: InfrastructureMetrics;
    gis: MapSummary;
    facilities: FacilitiesSummary;
    utilities: UtilitiesSummary;
  };
}
