/**
 * Static ruku counts for generateStaticParams() — Quran ruku data is immutable.
 * Sourced from GET /api/rukus (max rankInChapter per sura, min/max rankInJuz per juz).
 */

/** Sura number → number of rukus (ranks always 1..N). */
export const RUKU_COUNTS_BY_SURA: Record<number, number> = {
  1: 1, 2: 40, 3: 20, 4: 24, 5: 16, 6: 20, 7: 24, 8: 10, 9: 16, 10: 11,
  11: 10, 12: 12, 13: 6, 14: 7, 15: 6, 16: 16, 17: 12, 18: 12, 19: 6, 20: 8,
  21: 7, 22: 10, 23: 6, 24: 9, 25: 6, 26: 11, 27: 7, 28: 8, 29: 7, 30: 6,
  31: 3, 32: 3, 33: 9, 34: 6, 35: 5, 36: 5, 37: 5, 38: 5, 39: 8, 40: 9,
  41: 6, 42: 5, 43: 7, 44: 3, 45: 4, 46: 4, 47: 4, 48: 4, 49: 2, 50: 3,
  51: 3, 52: 2, 53: 3, 54: 3, 55: 3, 56: 3, 57: 4, 58: 3, 59: 3, 60: 2,
  61: 2, 62: 2, 63: 2, 64: 2, 65: 2, 66: 2, 67: 2, 68: 2, 69: 2, 70: 2,
  71: 2, 72: 2, 73: 2, 74: 2, 75: 2, 76: 2, 77: 2, 78: 2, 79: 2, 80: 1,
  81: 1, 82: 1, 83: 1, 84: 1, 85: 1, 86: 1, 87: 1, 88: 1, 89: 1, 90: 1,
  91: 1, 92: 1, 93: 1, 94: 1, 95: 1, 96: 1, 97: 1, 98: 1, 99: 1, 100: 1,
  101: 1, 102: 1, 103: 1, 104: 1, 105: 1, 106: 1, 107: 1, 108: 1, 109: 1,
  110: 1, 111: 1, 112: 1, 113: 1, 114: 1,
};

/** Juz number → { min, max } rankInJuz range. Juz 1 starts at 0 (al-Fātiḥah); all others start at 1. */
export const RUKU_RANGES_BY_JUZ: Record<number, { min: number; max: number }> = {
  1: { min: 0, max: 16 }, 2: { min: 1, max: 16 }, 3: { min: 1, max: 17 },
  4: { min: 1, max: 14 }, 5: { min: 1, max: 17 }, 6: { min: 1, max: 14 },
  7: { min: 1, max: 19 }, 8: { min: 1, max: 17 }, 9: { min: 1, max: 18 },
  10: { min: 1, max: 17 }, 11: { min: 1, max: 16 }, 12: { min: 1, max: 16 },
  13: { min: 1, max: 19 }, 14: { min: 1, max: 22 }, 15: { min: 1, max: 21 },
  16: { min: 1, max: 17 }, 17: { min: 1, max: 17 }, 18: { min: 1, max: 17 },
  19: { min: 1, max: 19 }, 20: { min: 1, max: 15 }, 21: { min: 1, max: 18 },
  22: { min: 1, max: 18 }, 23: { min: 1, max: 17 }, 24: { min: 1, max: 19 },
  25: { min: 1, max: 20 }, 26: { min: 1, max: 18 }, 27: { min: 1, max: 20 },
  28: { min: 1, max: 20 }, 29: { min: 1, max: 22 }, 30: { min: 1, max: 39 },
};
