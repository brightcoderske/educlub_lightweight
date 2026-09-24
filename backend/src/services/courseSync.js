/**
 * How a template row is recognised in a school course.
 *
 * Sync used to know a school module only by its template_module_id. Courses
 * built by hand, or loaded from the SQL imports and pointed at a template
 * afterwards, carry no such link - so nothing matched, every template module
 * was inserted as new, and a second press produced a third copy. The copies
 * took fresh ids while grades, submissions and progress stayed attached to the
 * originals, so learners appeared to lose their work.
 *
 * Matching therefore falls back to the title and then the position, and the
 * caller writes the link back when it finds one, so the first sync repairs the
 * course for good. A school row can be claimed only once, so two template rows
 * can never collapse onto the same one.
 */

function normalizeTitle(value) {
  return String(value === null || value === undefined ? "" : value)
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .join(" ");
}

function claimRow(templateRow, candidates, linkColumn) {
  const free = (row) => !row.__claimed;
  const take = (row, matchedBy) => {
    row.__claimed = true;
    return { row, matchedBy };
  };

  const linked = candidates.find(
    (row) => free(row) && Number(row[linkColumn]) === Number(templateRow.id),
  );
  if (linked) return take(linked, "link");

  const byTitle = candidates.find(
    (row) =>
      free(row) &&
      !row[linkColumn] &&
      normalizeTitle(row.title) === normalizeTitle(templateRow.title),
  );
  if (byTitle) return take(byTitle, "title");

  const byPosition = candidates.find(
    (row) =>
      free(row) &&
      !row[linkColumn] &&
      Number(row.position) === Number(templateRow.position),
  );
  if (byPosition) return take(byPosition, "position");

  return null;
}

/**
 * JSON columns arrive parsed from MySQL and as text from PostgreSQL, and a
 * template row holds whatever the generator wrote. Both sides are parsed before
 * comparing, or every sync rewrites every activity and nothing below means
 * anything.
 */
function canonicalJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function sameValue(left, right) {
  const leftEmpty = left === null || left === undefined;
  const rightEmpty = right === null || right === undefined;
  if (leftEmpty || rightEmpty) return leftEmpty && rightEmpty;

  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() === new Date(right).getTime();
  }
  if (typeof left === "boolean" || typeof right === "boolean") {
    return Boolean(Number(left)) === Boolean(Number(right));
  }
  if (typeof left === "object" || typeof right === "object") {
    return (
      JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right))
    );
  }
  return String(left) === String(right);
}

/** The fields that decide whether a row is worth rewriting at all. */
function differingFields(schoolRow, templateRow, fields) {
  return fields.filter((field) => !sameValue(schoolRow[field], templateRow[field]));
}

// Position is deliberately absent from both lists. A school may reorder its own
// modules and activities, and a sync that reimposed the template order would
// undo that silently every time a single word changed.
const MODULE_FIELDS = [
  "title",
  "description",
  "learning_outcomes",
  "is_published",
  "unlock_at",
];

const ACTIVITY_FIELDS = [
  "title",
  "activity_type",
  "content",
  "points",
  "is_required",
  "availability_mode",
  "completion_rule",
  "pass_score",
  "is_published",
];

const isArchived = (row) => row.archived_at !== null && row.archived_at !== undefined;


/**
 * The position a new row can take without colliding with one already there.
 *
 * The template position is used when it is free, so a course that matches its
 * template keeps the template ordering. Otherwise the row goes to the end,
 * because a school module already sitting in that slot was put there
 * deliberately.
 */
function freePosition(rows, preferred) {
  const wanted = Number(preferred);
  const taken = rows.some((row) => Number(row.position) === wanted);
  if (!taken) return wanted;
  const highest = rows.reduce(
    (max, row) => Math.max(max, Number(row.position) || 0),
    0,
  );
  return highest + 1;
}
module.exports = {
  normalizeTitle,
  freePosition,
  claimRow,
  canonicalJson,
  sameValue,
  differingFields,
  isArchived,
  MODULE_FIELDS,
  ACTIVITY_FIELDS,
};
