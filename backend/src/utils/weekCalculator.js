/**
 * Week Calculator Utility
 * Calculates weeks based on term dates
 * Week 1: From term start day to Sunday
 * Week 2: Monday to Sunday
 * Last week: Ends on term end date
 */

/**
 * Calculate weeks for a term
 * @param {Date} startDate - Term start date
 * @param {Date} endDate - Term end date
 * @returns {Array} Array of week objects with week_number, start_date, end_date
 */
function calculateWeeks(startDate, endDate) {
  const weeks = [];
  let currentDate = new Date(startDate);
  let weekNumber = 1;

  // Week 1: From start date to Sunday
  const firstWeekEnd = new Date(currentDate);
  firstWeekEnd.setDate(currentDate.getDate() + (7 - currentDate.getDay()));

  // Ensure first week end doesn't exceed term end
  if (firstWeekEnd > endDate) {
    weeks.push({
      week_number: weekNumber,
      start_date: formatDate(currentDate),
      end_date: formatDate(endDate)
    });
    return weeks;
  }

  weeks.push({
    week_number: weekNumber,
    start_date: formatDate(currentDate),
    end_date: formatDate(firstWeekEnd)
  });

  // Move to Monday of next week
  currentDate = new Date(firstWeekEnd);
  currentDate.setDate(currentDate.getDate() + 1);
  weekNumber++;

  // Subsequent weeks: Monday to Sunday
  while (currentDate <= endDate) {
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(currentDate.getDate() + 6);

    if (weekEnd > endDate) {
      weeks.push({
        week_number: weekNumber,
        start_date: formatDate(currentDate),
        end_date: formatDate(endDate)
      });
      break;
    }

    weeks.push({
      week_number: weekNumber,
      start_date: formatDate(currentDate),
      end_date: formatDate(weekEnd)
    });

    // Move to next Monday
    currentDate = new Date(weekEnd);
    currentDate.setDate(currentDate.getDate() + 1);
    weekNumber++;
  }

  return weeks;
}

/**
 * Get current week number for a term
 * @param {Date} startDate - Term start date
 * @param {Date} endDate - Term end date
 * @param {Date} currentDate - Current date (defaults to today)
 * @returns {Number|null} Current week number or null if outside term
 */
function getCurrentWeekNumber(startDate, endDate, currentDate = new Date()) {
  if (currentDate < startDate || currentDate > endDate) {
    return null;
  }

  const weeks = calculateWeeks(startDate, endDate);
  
  for (const week of weeks) {
    const weekStart = new Date(week.start_date);
    const weekEnd = new Date(week.end_date);
    weekEnd.setHours(23, 59, 59, 999);

    if (currentDate >= weekStart && currentDate <= weekEnd) {
      return week.week_number;
    }
  }

  return null;
}

/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {String} Formatted date string
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse date string to Date object
 * @param {String} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} Date object
 */
function parseDate(dateString) {
  if (dateString instanceof Date) {
    return new Date(
      dateString.getFullYear(),
      dateString.getMonth(),
      dateString.getDate()
    );
  }

  const match = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return new Date(dateString);
}

module.exports = {
  calculateWeeks,
  getCurrentWeekNumber,
  formatDate,
  parseDate,
};
