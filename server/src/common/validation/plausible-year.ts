import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

export const MIN_PLAUSIBLE_YEAR = 1900;

/**
 * A whole calendar year from 1900 to the CURRENT year (evaluated at request
 * time, so it never freezes at build time). Rejects future years: a build year
 * of 2099 used to produce a negative age that scored as brand-new stock.
 */
export function IsPlausibleYear(
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isPlausibleYear',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= MIN_PLAUSIBLE_YEAR &&
          value <= new Date().getFullYear(),
        defaultMessage: buildMessage(
          (each) =>
            `${each}$property must be a whole year between ${MIN_PLAUSIBLE_YEAR} and the current year`,
          options,
        ),
      },
    },
    options,
  );
}
