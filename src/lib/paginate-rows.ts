/**
 * Which lines of an invoice go on which A4 page — from the height every line ACTUALLY rendered at.
 *
 * Until 2026-10-03 the paging frame measured one row (the first) and assumed every row was that
 * tall. A line whose description wraps is taller than one that does not, so the assumption was wrong
 * whenever the lines differed: a tall first line made each page look roomier than it was, the page
 * was given more lines than fit, and the ones past its bottom edge were cut off — on no page at all,
 * on screen, in the PDF and on paper, while the total still counted them (lines 22–25 of a 45-line
 * invoice, found by the Print work, decision 0202). A short first line made the opposite mistake:
 * pages of one line each.
 *
 * Here every line brings its own measured height, so a page is given exactly the lines that fit it.
 * Every line lands on exactly one page, in order. The rules the frame had are kept:
 *  - pages without the summary are filled to the brim;
 *  - the last page carries the summary (totals, notes) beside the lines that still fit with it;
 *  - the summary is never alone on a page: at least one line goes with it — unless the last line and
 *    the summary do not fit on one page together (a line of hundreds of characters beside a long
 *    summary), when the summary takes a page of its own rather than either being cut;
 *  - a table shorter than nine rows is padded with blank rows to nine (the native look), but only
 *    with as many as still fit — padding never pushes the page past its bottom.
 *
 * Pure arithmetic, so it is tested without a browser (paginate-rows.test.ts); the browser half —
 * that the heights handed in are the heights the page draws — is scripts/checks/run-paged-rows-check.mjs.
 */
export type PageSlice = {
  /** Index of the page's first line in the invoice's items. */
  start: number;
  /** How many lines the page carries. */
  count: number;
  /** Whether this is the last page, which carries the summary. */
  summary: boolean;
  /** Rows the page's table draws: its lines plus the blank rows that still fit, up to `minRows`. */
  padRows: number;
};

export type PageRoom = {
  /** Height of every line's row, in sheet px, in the invoice's order. */
  rowHeights: number[];
  /** Height of a blank padding row, in sheet px. */
  blankRowHeight: number;
  /** Room for rows on a page WITHOUT the summary: the page's usable height minus everything but rows. */
  roomWithoutSummary: number;
  /** Room for rows on the LAST page: the same, minus the summary as well. */
  roomWithSummary: number;
  /** The table's native minimum, reached with blank rows where they fit. */
  minRows?: number;
};

// Heights come from layout as fractions of a pixel; a sum that lands a hair over the room because of
// how the fractions add up is still a row that fits.
const EPS = 0.01;

export function paginateRows({ rowHeights, blankRowHeight, roomWithoutSummary, roomWithSummary, minRows = 9 }: PageRoom): PageSlice[] {
  const n = rowHeights.length;
  const pad = (start: number, count: number, room: number): number => {
    let used = 0;
    for (let k = start; k < start + count; k++) used += rowHeights[k];
    let rows = count;
    while (rows < minRows && blankRowHeight > 0 && used + blankRowHeight <= room + EPS) {
      used += blankRowHeight;
      rows++;
    }
    return rows;
  };

  if (n === 0) return [{ start: 0, count: 0, summary: true, padRows: pad(0, 0, roomWithSummary) }];

  // rest[i] = height of lines i..n-1
  const rest = new Array<number>(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) rest[i] = rest[i + 1] + rowHeights[i];

  // Whether the last line can keep the summary company. Nearly always; when it cannot, the summary
  // gets a page of its own, because a summary cut at the page's bottom is a total nobody can read.
  const lastFitsBesideSummary = rowHeights[n - 1] <= roomWithSummary + EPS;
  const pages: PageSlice[] = [];
  let i = 0;
  while (i < n) {
    // Everything left fits beside the summary. Last page.
    if (rest[i] <= roomWithSummary + EPS) {
      pages.push({ start: i, count: n - i, summary: true, padRows: pad(i, n - i, roomWithSummary) });
      return pages;
    }
    // A page without the summary, filled with as many lines as fit — never the last line when it can
    // go with the summary, so the summary is not left alone.
    const bound = lastFitsBesideSummary ? n - 1 : n;
    let take = 0;
    let used = 0;
    while (i + take < bound && used + rowHeights[i + take] <= roomWithoutSummary + EPS) {
      used += rowHeights[i + take];
      take++;
    }
    // A single line taller than a whole page cannot be split across two: it gets a page of its own,
    // and that page cuts it at the bottom. Nothing a person types into one line comes near — it takes
    // well over 1,000 characters, and the longest line stored in production on 2026-10-03 is 746,
    // which the browser check renders on one page in full.
    if (take === 0) take = 1;
    pages.push({ start: i, count: take, summary: false, padRows: pad(i, take, roomWithoutSummary) });
    i += take;
  }
  // Every line is placed and the last could not go with the summary: the summary's own page.
  pages.push({ start: n, count: 0, summary: true, padRows: pad(n, 0, roomWithSummary) });
  return pages;
}
