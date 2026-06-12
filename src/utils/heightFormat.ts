import { HEIGHT_MAX_INCHES, HEIGHT_MIN_INCHES } from '../constants/options';

export function normalizeHeightInches(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(HEIGHT_MAX_INCHES, Math.max(HEIGHT_MIN_INCHES, Math.round(parsed)));
}

export function normalizeHeightRange(minInches: number, maxInches: number): { min: number; max: number } {
  const min = normalizeHeightInches(minInches, HEIGHT_MIN_INCHES);
  const max = normalizeHeightInches(maxInches, HEIGHT_MAX_INCHES);
  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
  };
}

export function formatHeightInches(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${feet}'${rem}"`;
}

export function inchesToFeetInches(totalInches: number): { feet: string; inches: string } {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet: String(feet), inches: String(inches) };
}

export function parseFeetInchesFields(feetStr: string, inchesStr: string): number | null {
  const feetTrim = feetStr.trim();
  const inchesTrim = inchesStr.trim();

  if (!feetTrim || !/^\d+$/.test(feetTrim)) return null;
  if (inchesTrim && !/^\d+$/.test(inchesTrim)) return null;

  const feet = parseInt(feetTrim, 10);
  const inchPart = inchesTrim ? parseInt(inchesTrim, 10) : 0;

  if (feet < 0 || inchPart < 0 || inchPart >= 12) return null;

  return feet * 12 + inchPart;
}

export function validateFeetInchesFields(feetStr: string, inchesStr: string): string | null {
  const feetTrim = feetStr.trim();
  const inchesTrim = inchesStr.trim();

  if (!feetTrim) return 'Enter feet';
  if (!/^\d+$/.test(feetTrim)) return 'Feet must be a whole number';
  if (inchesTrim && !/^\d+$/.test(inchesTrim)) return 'Inches must be a whole number';

  const inchPart = inchesTrim ? parseInt(inchesTrim, 10) : 0;
  if (inchPart >= 12) return 'Inches must be 0–11';

  const total = parseFeetInchesFields(feetStr, inchesStr);
  if (total === null) return 'Enter a valid height';

  return validateHeightInches(total);
}

/** @deprecated Prefer separate feet/inches fields */
export function parseHeightInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const ftInMatch = trimmed.match(/^(\d+)\s*(?:[''′]|ft\.?)?\s*(\d{1,2})?\s*(?:["″]|in\.?)?\s*$/i);
  if (ftInMatch) {
    const feet = parseInt(ftInMatch[1], 10);
    const inchPart = ftInMatch[2] ? parseInt(ftInMatch[2], 10) : 0;
    if (inchPart >= 12 || feet < 0) return null;
    return feet * 12 + inchPart;
  }

  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  return null;
}

export function validateHeightInches(inches: number | null): string | null {
  if (inches === null) {
    return `Enter feet and inches (${formatHeightInches(66)} example)`;
  }
  if (inches < HEIGHT_MIN_INCHES || inches > HEIGHT_MAX_INCHES) {
    return `Height must be ${formatHeightInches(HEIGHT_MIN_INCHES)} – ${formatHeightInches(HEIGHT_MAX_INCHES)}`;
  }
  return null;
}
