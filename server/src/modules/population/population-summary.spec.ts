import { summarisePopulation } from './population-summary';

describe('summarisePopulation', () => {
  it('aggregates only schools with population data', () => {
    const s = summarisePopulation(
      [
        {
          population2km: 1000,
          populationDensityPerKm2: 80,
          studentToSchoolRatio: 0.2,
          school: { province: 'East' },
        },
        {
          population2km: '3000',
          populationDensityPerKm2: '240',
          studentToSchoolRatio: '0.1',
          school: { province: 'East' },
        },
        {
          population2km: null,
          populationDensityPerKm2: null,
          school: { province: 'West' },
        },
      ],
      5,
    );
    expect(s.totalSchools).toBe(5);
    expect(s.schoolsWithData).toBe(2);
    expect(s.totalPopulation2km).toBe(4000);
    expect(s.avgDensityPerKm2).toBe(160);
    expect(s.avgStudentsPerResident).toBe(0.15);
    expect(s.provinces).toEqual([
      {
        province: 'East',
        schools: 2,
        totalPopulation2km: 4000,
        avgDensityPerKm2: 160,
      },
    ]);
  });

  it('returns nulls, not zeros, when there is no data', () => {
    const s = summarisePopulation([], 3);
    expect(s.avgDensityPerKm2).toBeNull();
    expect(s.avgStudentsPerResident).toBeNull();
    expect(s.schoolsWithData).toBe(0);
  });
});
