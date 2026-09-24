/**
 * The terms a class can be moved into, for the Graduate dialog.
 *
 * The dialog used to list bare term names - "Term 1" once for every academic year
 * that has one - beside a separate year picker, so nothing stopped a term and a
 * year that do not go together. Each option here is one real term, year included,
 * and choosing it decides both.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Dates arrive as "2027-01-05", or with a time on the end; only the day matters.
const dayOf = (value) => String(value ?? "").slice(0, 10);

function localToday(now = new Date()) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2027-01-05" -> "5 Jan 2027" */
export function formatDay(value) {
  const [year, month, day] = dayOf(value).split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * Regular terms that are running or still to come, earliest first. A term that has
 * finished is somewhere a class is moved from, not to.
 */
export function promotionTermOptions(academicTerms, now = new Date()) {
  const today = localToday(now);

  return (academicTerms || [])
    .filter(
      (term) =>
        (term.term_type || "regular") === "regular" &&
        term.academic_year &&
        dayOf(term.end_date) >= today
    )
    .sort((a, b) => dayOf(a.start_date).localeCompare(dayOf(b.start_date)))
    .map((term) => {
      const startDate = dayOf(term.start_date);
      const endDate = dayOf(term.end_date);
      const isCurrent = startDate <= today && today <= endDate;
      return {
        value: `${term.academic_year}|${term.name}`,
        name: term.name,
        academicYear: term.academic_year,
        startDate,
        endDate,
        isCurrent,
        label: `${term.name} ${term.academic_year}${isCurrent ? " (current)" : ""}`,
        dates: `${formatDay(startDate)} to ${formatDay(endDate)}`,
      };
    });
}

/** The first term that has not started yet: where a class normally goes next. */
export function suggestedNextTerm(options, now = new Date()) {
  const today = localToday(now);
  return options.find((option) => option.startDate > today) || null;
}
