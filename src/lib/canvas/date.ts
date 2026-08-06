const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** e.g. "'26 8 6" — mimics a 90s film camera's digital date stamp. */
export function formatClassicLed(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2);
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `'${yy} ${m} ${d}`;
}

/** e.g. "AUG 06 2026" */
export function formatMinimal(date: Date): string {
  const month = MONTHS[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  return `${month} ${day} ${date.getFullYear()}`;
}
