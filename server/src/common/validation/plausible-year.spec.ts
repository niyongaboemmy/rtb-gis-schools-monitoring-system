import { validateSync } from 'class-validator';
import { IsPlausibleYear } from './plausible-year';

class Dto {
  @IsPlausibleYear()
  year: unknown;
}
const ok = (year: unknown) => {
  const d = new Dto();
  d.year = year;
  return validateSync(d).length === 0;
};

describe('IsPlausibleYear', () => {
  const cy = new Date().getFullYear();
  it('accepts whole years from 1900 to the current year', () => {
    expect(ok(1900)).toBe(true);
    expect(ok(cy)).toBe(true);
  });
  it('rejects future, ancient, fractional and non-numeric years', () => {
    expect(ok(cy + 1)).toBe(false);
    expect(ok(1899)).toBe(false);
    expect(ok(2000.5)).toBe(false);
    expect(ok('2000')).toBe(false);
  });
});
