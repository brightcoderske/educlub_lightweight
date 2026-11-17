/**
 * Learners already at the school whose names look like the one being typed, so
 * nobody is added twice by accident. It is a prompt, never a block: two real
 * learners can share a name. Only the school's own learners are passed in.
 */

const words = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9']+/)
    .filter(Boolean);

// True when `a` becomes `b` with at most one letter added, removed or changed.
function withinOneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else {
      edits += 1;
      if (edits > 1) return false;
      if (a.length > b.length) i += 1;
      else if (b.length > a.length) j += 1;
      else {
        i += 1;
        j += 1;
      }
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// A typed word matches a name word it starts (they are still typing) or, from
// four letters on, one a single slip away ("Wanjiro" and "Wanjiru").
function matches(typed, word) {
  return word.startsWith(typed) || (typed.length >= 4 && withinOneEdit(typed, word));
}

/**
 * The learners whose names share the most words with `typedNames` (the first,
 * second and third name as typed), best first. `sameName` marks a learner
 * whose name has exactly the typed words, in any order.
 */
export function similarLearners(learners, typedNames, limit = 6) {
  const typed = typedNames.flatMap(words).filter((word) => word.length >= 2);
  if (!typed.length) return [];

  return (learners || [])
    .map((learner) => {
      const nameWords = words(learner.full_name);
      const hits = typed.filter((word) => nameWords.some((name) => matches(word, name))).length;
      const sameName =
        hits === typed.length &&
        nameWords.length === typed.length &&
        typed.every((word) => nameWords.includes(word));
      return { learner, hits, sameName };
    })
    .filter((entry) => entry.hits > 0)
    .sort(
      (a, b) =>
        Number(b.sameName) - Number(a.sameName) ||
        b.hits - a.hits ||
        String(a.learner.full_name).localeCompare(String(b.learner.full_name))
    )
    .slice(0, limit);
}
