/**
 * Calculate weeks between two dates
 */

function calculateWeeks(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.ceil(diffDays / 7);
}

function generateWeeks(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const weeks = [];
  
  let currentWeekStart = new Date(start);
  let weekNumber = 1;

  while (currentWeekStart < end) {
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

    // Don't go beyond the end date
    if (currentWeekEnd > end) {
      currentWeekEnd = new Date(end);
    }

    weeks.push({
      week_number: weekNumber,
      start_date: currentWeekStart.toISOString(),
      end_date: currentWeekEnd.toISOString(),
    });

    currentWeekStart = new Date(currentWeekEnd);
    currentWeekStart.setDate(currentWeekStart.getDate() + 1);
    weekNumber++;
  }

  return weeks;
}

function getCurrentWeek(weeks) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  for (const week of weeks) {
    const weekStart = week.start_date.split('T')[0];
    const weekEnd = week.end_date.split('T')[0];

    if (today >= weekStart && today <= weekEnd) {
      return week;
    }
  }

  return null;
}

module.exports = {
  calculateWeeks,
  generateWeeks,
  getCurrentWeek,
};
