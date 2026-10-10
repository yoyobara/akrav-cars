/**
 * Insurance coverage, as plain data — no database, so the request sheet can
 * use the same rule for its hint that the server enforces.
 *
 * Someone is covered on a car when its policy covers any driver, when they are
 * named on it, or when their temporary insurance windows together leave no gap
 * in the window they want the car for.
 */

export type CoverWindow = { startAt: Date; endAt: Date };

export type Coverage = {
  /** Covered at any time: the policy covers anyone, or names this person. */
  permanent: boolean;
  /** Temporary insurance not yet revoked, in any order. */
  temporary: CoverWindow[];
};

/**
 * The first instant in [from, to) nobody insured this person for, or null
 * when the whole window is covered. Adjacent windows (one ending at 12:00, the
 * next starting at 12:00) count as continuous.
 */
export function coverageGap(coverage: Coverage, from: Date, to: Date): Date | null {
  if (coverage.permanent) return null;

  const windows = [...coverage.temporary].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  let reached = from.getTime();

  for (const w of windows) {
    if (reached >= to.getTime()) break;
    if (w.startAt.getTime() > reached) break;
    reached = Math.max(reached, w.endAt.getTime());
  }

  return reached >= to.getTime() ? null : new Date(reached);
}

export function isCovered(coverage: Coverage, from: Date, to: Date): boolean {
  return coverageGap(coverage, from, to) === null;
}

/**
 * How long temporary insurance keeps someone covered from `at`, following
 * back-to-back windows — for "insured until 12:00". Null when they are not
 * temporarily covered at `at` (or are permanently covered, and it never ends).
 */
export function temporaryCoverUntil(coverage: Coverage, at: Date): Date | null {
  if (coverage.permanent) return null;
  const far = new Date(8.64e15);
  const gap = coverageGap(coverage, at, far);
  return gap && gap > at ? gap : null;
}
