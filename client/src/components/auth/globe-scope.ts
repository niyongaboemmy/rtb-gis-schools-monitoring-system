/**
 * The platform's scope on the sign-in globe: Rwanda and its TVET schools.
 * Shared by the globe (camera, spotlight) and the survey drone.
 */
export type LonLat = [number, number];

/** Middle of Rwanda — the camera's anchor for the country overview. */
export const RWANDA_CENTER: LonLat = [29.88, -1.95];
/** Camera zoom: Rwanda filling the lens, and a single-school close-up. */
export const ZOOM_RWANDA = 40;
export const ZOOM_SCHOOL = 90;

/**
 * Sample TVET schools in Rwanda — the same sample set the app seeds
 * (server/src/modules/seed/seed.service.ts), at their seeded coordinates.
 */
export const RWANDA_SCHOOLS: { name: string; short: string; district: string; at: LonLat }[] = [
  { name: "Kigali Technical Secondary School", short: "Kigali TSS", district: "Gasabo", at: [30.1089, -1.9354] },
  { name: "Nyamirama Vocational Training Center", short: "Nyamirama VTC", district: "Kayonza", at: [30.0619, -1.9441] },
  { name: "Byumba Technical Secondary School", short: "Byumba TSS", district: "Gicumbi", at: [30.067, -1.5761] },
  { name: "Huye Technical Secondary School", short: "Huye TSS", district: "Huye", at: [29.74, -2.596] },
  { name: "Rubavu Technical Secondary School", short: "Rubavu TSS", district: "Rubavu", at: [29.346, -1.6775] },
  { name: "Kicukiro VTC", short: "Kicukiro VTC", district: "Kicukiro", at: [30.0852, -1.9769] },
  { name: "Rwamagana Integrated Polytechnic", short: "Rwamagana Polytechnic", district: "Rwamagana", at: [30.4352, -1.9487] },
  { name: "Musanze TSS", short: "Musanze TSS", district: "Musanze", at: [29.6348, -1.5014] },
];
