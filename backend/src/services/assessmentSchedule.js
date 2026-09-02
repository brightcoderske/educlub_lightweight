// Select the latest matching term once, then join its week without LATERAL or
// grouping the assessment row. Both MySQL and MariaDB support this form.
function assessmentScheduleJoins(alias) {
  return `LEFT JOIN terms schedule ON schedule.id = (
    SELECT t.id
    FROM terms t
    JOIN academic_years ay ON ay.id = t.academic_year_id
    WHERE t.name = ${alias}.term AND ay.year = ${alias}.academic_year
    ORDER BY t.is_active DESC, t.id DESC
    LIMIT 1
  )
  LEFT JOIN term_weeks schedule_week
    ON schedule_week.term_id = schedule.id
   AND schedule_week.week_number = ${alias}.week_number`;
}

const assessmentScheduleColumns = `schedule.start_date AS term_start_date,
  schedule.end_date AS term_end_date,
  schedule_week.start_date AS week_start_date,
  schedule_week.end_date AS week_end_date`;

module.exports = { assessmentScheduleJoins, assessmentScheduleColumns };
