/**
 * Golden dataset (WS1.2): six schools with HAND-CALCULATED expected results.
 *
 * Model (scoring.constants.ts): School Condition Score =
 *   round(0.35·infra + 0.25·age + 0.10·access + 0.10·population
 *         + 0.15·facilityCompliance + 0.05·resolution)
 * Condition map: good 100, fair 70, poor 30, critical 10.
 * Age bands (avg years): ≤10→95, ≤20→80, ≤30→60, ≤40→45, ≤50→30, ≤60→20, >60→10.
 * Demand ratio (school-age pop within 2 km ÷ capacity): ≥5→10, ≥3→30, ≥2→50, ≥1→70, <1→100.
 * Compliance: compliant 100, partial 50, non-compliant 0 (mean over survey rows).
 * Resolution: resolved ÷ all reports × 100; no reports → 50.
 * Missing data → neutral 50 (with a data-gap flag).
 * Priority: critical <35, high <55, medium <75, low ≥75.
 * Urgency months: <35→0, <45→3, <55→6, <65→12, <75→18, else 36.
 *
 * Years are relative to the current year (CY) so the fixture never ages.
 * Every component value is chosen so the weighted sum is not on a .5 boundary.
 */
import { BuildingCondition } from '../../schools/entities/school-building.entity';
import { ComplianceLevel } from '../../schools/entities/school-facility-survey.entity';
import { ReportStatus } from '../../reports/entities/issue-report.entity';
import { PriorityLevel } from '../entities/decision-assessment.entity';

export const CY = new Date().getFullYear();

export interface GoldenSchool {
  key: string;
  school: Record<string, unknown>;
  population: { schoolAgePopulation2km: number } | null;
  surveys: ComplianceLevel[];
  reports: ReportStatus[];
  expected: {
    components: {
      infrastructure: number;
      buildingAge: number;
      accessibility: number;
      population: number;
      facilityCompliance: number;
      resolution: number;
    };
    overallScore: number;
    priority: PriorityLevel;
    urgencyMonths: number;
    dataGaps: {
      infrastructure: boolean;
      buildingAge: boolean;
      accessibility: boolean;
      population: boolean;
      facilityCompliance: boolean;
      resolution: boolean;
    };
    metrics: {
      totalStudents: number;
      totalCapacity: number;
      capacityUtilisation: number | null;
      totalTeachers: number;
      totalStaff: number;
      studentToTeacherRatio: number | null;
      avgBuildingAge: number | null;
      totalLandArea: number | null;
      usedLandPct: number | null;
    };
  };
}

const b = (condition: BuildingCondition, age: number) => ({
  condition,
  yearBuilt: CY - age,
});

const NO_GAPS = {
  infrastructure: false,
  buildingAge: false,
  accessibility: false,
  population: false,
  facilityCompliance: false,
  resolution: false,
};

export const GOLDEN: GoldenSchool[] = [
  {
    // G1 — healthy school.
    // infra = 100 (3 × good); age 5 y → 95; access 90; demand 200/400 = 0.5 → 100;
    // compliance (100+100)/2 = 100; resolution 4/4 = 100.
    // 0.35·100 + 0.25·95 + 0.1·90 + 0.1·100 + 0.15·100 + 0.05·100
    //   = 35 + 23.75 + 9 + 10 + 15 + 5 = 97.75 → 98 → LOW, 36 months.
    key: 'G1',
    school: {
      id: 'g1',
      name: 'Golden 1',
      buildings: [
        b(BuildingCondition.GOOD, 5),
        b(BuildingCondition.GOOD, 5),
        b(BuildingCondition.GOOD, 5),
      ],
      roadStatusPercentage: 90,
      educationPrograms: [{ totalStudents: 300, capacity: 400 }],
      maleTeachers: 8,
      femaleTeachers: 7,
      usedLandArea: 3,
      unusedLandArea: 1,
    },
    population: { schoolAgePopulation2km: 200 },
    surveys: [ComplianceLevel.COMPLIANT, ComplianceLevel.COMPLIANT],
    reports: [
      ReportStatus.SOLVED,
      ReportStatus.SOLVED,
      ReportStatus.SOLVED,
      ReportStatus.SOLVED,
    ],
    expected: {
      components: {
        infrastructure: 100,
        buildingAge: 95,
        accessibility: 90,
        population: 100,
        facilityCompliance: 100,
        resolution: 100,
      },
      overallScore: 98,
      priority: PriorityLevel.LOW,
      urgencyMonths: 36,
      dataGaps: NO_GAPS,
      metrics: {
        totalStudents: 300,
        totalCapacity: 400,
        capacityUtilisation: 75, // 300/400 = 75.0 %
        totalTeachers: 15, // 8 + 7
        totalStaff: 15,
        studentToTeacherRatio: 20, // 300/15
        avgBuildingAge: 5,
        totalLandArea: 4, // 3 + 1 ha
        usedLandPct: 75, // 3/4
      },
    },
  },
  {
    // G2 — mixed condition.
    // infra = round((100+70+30)/3) = round(66.67) = 67;
    // ages 15, 25, 35 → mean 25 → 60; access 60; demand 900/400 = 2.25 → 50;
    // compliance (100+50+0)/3 = 50; resolution 1/4 = 25.
    // 0.35·67 + 0.25·60 + 0.1·60 + 0.1·50 + 0.15·50 + 0.05·25
    //   = 23.45 + 15 + 6 + 5 + 7.5 + 1.25 = 58.2 → 58 → MEDIUM, 12 months.
    key: 'G2',
    school: {
      id: 'g2',
      name: 'Golden 2',
      buildings: [
        b(BuildingCondition.GOOD, 15),
        b(BuildingCondition.FAIR, 25),
        b(BuildingCondition.POOR, 35),
      ],
      roadStatusPercentage: 60,
      educationPrograms: [
        { totalStudents: 200, capacity: 200 },
        { totalStudents: 180, capacity: 200 },
      ],
      maleTeachers: 10,
      femaleTeachers: 6,
      maleAdminStaff: 2,
      femaleAdminStaff: 1,
      maleSupportStaff: 3,
      femaleSupportStaff: 2,
      usedLandArea: 2.5,
      unusedLandArea: 1.5,
    },
    population: { schoolAgePopulation2km: 900 },
    surveys: [
      ComplianceLevel.COMPLIANT,
      ComplianceLevel.PARTIAL,
      ComplianceLevel.NON_COMPLIANT,
    ],
    reports: [
      ReportStatus.SOLVED,
      ReportStatus.NEED_INTERVENTION,
      ReportStatus.NEED_INTERVENTION,
      ReportStatus.FAILED,
    ],
    expected: {
      components: {
        infrastructure: 67,
        buildingAge: 60,
        accessibility: 60,
        population: 50,
        facilityCompliance: 50,
        resolution: 25,
      },
      overallScore: 58,
      priority: PriorityLevel.MEDIUM,
      urgencyMonths: 12,
      dataGaps: NO_GAPS,
      metrics: {
        totalStudents: 380,
        totalCapacity: 400,
        capacityUtilisation: 95, // 380/400
        totalTeachers: 16,
        totalStaff: 24, // 16 + 3 admin + 5 support
        studentToTeacherRatio: 23.8, // 380/16 = 23.75 → 23.8
        avgBuildingAge: 25,
        totalLandArea: 4,
        usedLandPct: 62.5, // 2.5/4
      },
    },
  },
  {
    // G3 — critical school.
    // infra = (10+30)/2 = 20; ages 65, 55 → mean 60 → 20; access 10;
    // capacity unknown → catchment = enrolment 280; demand 2000/280 = 7.1 → 10;
    // compliance 0; resolution 0/5 = 0.
    // 0.35·20 + 0.25·20 + 0.1·10 + 0.1·10 + 0 + 0 = 7 + 5 + 1 + 1 = 14 → CRITICAL, 0 months.
    key: 'G3',
    school: {
      id: 'g3',
      name: 'Golden 3',
      buildings: [
        b(BuildingCondition.CRITICAL, 65),
        b(BuildingCondition.POOR, 55),
      ],
      roadStatusPercentage: 10,
      educationPrograms: [],
      totalStudents: 280,
      totalTeachers: 7,
    },
    population: { schoolAgePopulation2km: 2000 },
    surveys: [ComplianceLevel.NON_COMPLIANT, ComplianceLevel.NON_COMPLIANT],
    reports: [
      ReportStatus.NEED_INTERVENTION,
      ReportStatus.NEED_INTERVENTION,
      ReportStatus.PENDING,
      ReportStatus.PENDING,
      ReportStatus.FAILED,
    ],
    expected: {
      components: {
        infrastructure: 20,
        buildingAge: 20,
        accessibility: 10,
        population: 10,
        facilityCompliance: 0,
        resolution: 0,
      },
      overallScore: 14,
      priority: PriorityLevel.CRITICAL,
      urgencyMonths: 0,
      dataGaps: NO_GAPS,
      metrics: {
        totalStudents: 280,
        totalCapacity: 0,
        capacityUtilisation: null, // no capacity on file
        totalTeachers: 7, // totalTeachers column (no gender breakdown)
        totalStaff: 7,
        studentToTeacherRatio: 40, // 280/7
        avgBuildingAge: 60,
        totalLandArea: null,
        usedLandPct: null,
      },
    },
  },
  {
    // G4 — no data at all: every component is the neutral 50.
    // 0.35·50 + 0.25·50 + 0.1·50 + 0.1·50 + 0.15·50 + 0.05·50 = 50 → HIGH, 6 months.
    key: 'G4',
    school: {
      id: 'g4',
      name: 'Golden 4',
      buildings: [],
      roadStatusPercentage: null,
      educationPrograms: [],
    },
    population: null,
    surveys: [],
    reports: [],
    expected: {
      components: {
        infrastructure: 50,
        buildingAge: 50,
        accessibility: 50,
        population: 50,
        facilityCompliance: 50,
        resolution: 50,
      },
      overallScore: 50,
      priority: PriorityLevel.HIGH,
      urgencyMonths: 6,
      dataGaps: {
        infrastructure: true,
        buildingAge: true,
        accessibility: true,
        population: true,
        facilityCompliance: true,
        resolution: true,
      },
      metrics: {
        totalStudents: 0,
        totalCapacity: 0,
        capacityUtilisation: null,
        totalTeachers: 0,
        totalStaff: 0,
        studentToTeacherRatio: null,
        avgBuildingAge: null,
        totalLandArea: null,
        usedLandPct: null,
      },
    },
  },
  {
    // G5 — only a placeholder building (condition 'fair', nothing else) → not
    // assessed → infra neutral 50 (gap). Age falls back to establishedYear:
    // 45 years → 30. access 70; capacity unknown → catchment = enrolment 350;
    // demand 350/350 = 1.0 → 70; compliance partial → 50; resolution 1/2 = 50.
    // 0.35·50 + 0.25·30 + 0.1·70 + 0.1·70 + 0.15·50 + 0.05·50
    //   = 17.5 + 7.5 + 7 + 7 + 7.5 + 2.5 = 49 → HIGH, 6 months.
    key: 'G5',
    school: {
      id: 'g5',
      name: 'Golden 5',
      buildings: [{ condition: BuildingCondition.FAIR }],
      establishedYear: CY - 45,
      roadStatusPercentage: 70,
      educationPrograms: [],
      totalStudents: 350,
      maleTeachers: 5,
      femaleTeachers: 5,
      usedLandArea: 1.2,
    },
    population: { schoolAgePopulation2km: 350 },
    surveys: [ComplianceLevel.PARTIAL],
    reports: [ReportStatus.SOLVED, ReportStatus.PENDING],
    expected: {
      components: {
        infrastructure: 50,
        buildingAge: 30,
        accessibility: 70,
        population: 70,
        facilityCompliance: 50,
        resolution: 50,
      },
      overallScore: 49,
      priority: PriorityLevel.HIGH,
      urgencyMonths: 6,
      dataGaps: { ...NO_GAPS, infrastructure: true },
      metrics: {
        totalStudents: 350,
        totalCapacity: 0,
        capacityUtilisation: null,
        totalTeachers: 10,
        totalStaff: 10,
        studentToTeacherRatio: 35,
        avgBuildingAge: null, // placeholder has no build year
        totalLandArea: 1.2, // unused unknown → treated as 0
        usedLandPct: 100,
      },
    },
  },
  {
    // G6 — over capacity, no surveys and no reports (two neutral 50s).
    // infra = round((100+100+70)/3) = 90; ages 12 → 80; access 95;
    // demand 1200/600 = 2.0 → 50; compliance 50 (gap); resolution 50 (gap).
    // 0.35·90 + 0.25·80 + 0.1·95 + 0.1·50 + 0.15·50 + 0.05·50
    //   = 31.5 + 20 + 9.5 + 5 + 7.5 + 2.5 = 76 → LOW, 36 months.
    key: 'G6',
    school: {
      id: 'g6',
      name: 'Golden 6',
      buildings: [
        b(BuildingCondition.GOOD, 12),
        b(BuildingCondition.GOOD, 12),
        b(BuildingCondition.FAIR, 12),
      ],
      roadStatusPercentage: 95,
      educationPrograms: [{ totalStudents: 750, capacity: 600 }],
      totalTeachers: 25,
    },
    population: { schoolAgePopulation2km: 1200 },
    surveys: [],
    reports: [],
    expected: {
      components: {
        infrastructure: 90,
        buildingAge: 80,
        accessibility: 95,
        population: 50,
        facilityCompliance: 50,
        resolution: 50,
      },
      overallScore: 76,
      priority: PriorityLevel.LOW,
      urgencyMonths: 36,
      dataGaps: { ...NO_GAPS, facilityCompliance: true, resolution: true },
      metrics: {
        totalStudents: 750,
        totalCapacity: 600,
        capacityUtilisation: 125, // 750/600
        totalTeachers: 25,
        totalStaff: 25,
        studentToTeacherRatio: 30,
        avgBuildingAge: 12,
        totalLandArea: null,
        usedLandPct: null,
      },
    },
  },
];

/**
 * Expected national aggregates over the six golden schools (all active):
 *  - average School Condition Score = (98+58+14+50+49+76)/6 = 345/6 = 57.5
 *  - priority counts: critical 1 (G3), high 2 (G4, G5), medium 1 (G2), low 2 (G1, G6)
 *  - capacity utilisation over schools with capacity > 0 (G1, G2, G6):
 *      (300+380+750) / (400+400+600) = 1430/1400 = 102.14 → 102 %
 *  - infrastructure data gaps 2 (G4, G5); population data gaps 1 (G4)
 */
export const GOLDEN_NATIONAL = {
  avgScore: 57.5,
  byPriority: { critical: 1, high: 2, medium: 1, low: 2 },
  capacityUtilisation: 102,
  infraGaps: 2,
  popGaps: 1,
};
