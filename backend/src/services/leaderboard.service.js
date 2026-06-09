const { query } = require('../config');

// Generate weekly leaderboard for a specific category (quiz, typing, active_course)
async function generateWeeklyLeaderboard(weekNumber, term, academicYear, category, schoolId = null) {
  let queryText = `
    SELECT wm.*, l.full_name, l.grade, l.stream, s.name as school_name
    FROM weekly_marks wm
    JOIN learners l ON wm.learner_id = l.id
    JOIN schools s ON l.school_id = s.id
    WHERE wm.week_number = $1 AND wm.term = $2 AND wm.academic_year = $3
  `;
  
  const params = [weekNumber, term, academicYear];
  let paramIndex = 4;

  if (schoolId) {
    queryText += ` AND l.school_id = $${paramIndex}`;
    params.push(schoolId);
    paramIndex++;
  }

  // Order by the specific category score
  switch (category) {
    case 'quiz':
      queryText += ' ORDER BY wm.quiz_score DESC NULLS LAST';
      break;
    case 'typing':
      queryText += ' ORDER BY wm.typing_score DESC NULLS LAST';
      break;
    case 'active_course':
      queryText += ' ORDER BY wm.active_course_score DESC NULLS LAST';
      break;
    default:
      queryText += ' ORDER BY wm.quiz_score DESC NULLS LAST';
  }

  const result = await query(queryText, params);
  const leaderboard = result.rows;

  // Cache the leaderboard
  await query(
    `INSERT INTO weekly_leaderboards (week_number, term, academic_year, category, leaderboard_data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (week_number, term, academic_year, category)
     DO UPDATE SET leaderboard_data = $5, created_at = NOW()`,
    [weekNumber, term, academicYear, category, JSON.stringify(leaderboard)]
  );

  return leaderboard;
}

// Get cached leaderboard for a specific week and category
async function getCachedLeaderboard(weekNumber, term, academicYear, category) {
  const result = await query(
    `SELECT leaderboard_data FROM weekly_leaderboards
     WHERE week_number = $1 AND term = $2 AND academic_year = $3 AND category = $4`,
    [weekNumber, term, academicYear, category]
  );
  
  if (result.rows.length > 0) {
    return result.rows[0].leaderboard_data;
  }
  return null;
}

// Get learner's position in leaderboard
async function getLearnerPosition(learnerId, weekNumber, term, academicYear, category) {
  const leaderboard = await getCachedLeaderboard(weekNumber, term, academicYear, category);
  
  if (!leaderboard) {
    // Generate if not cached
    const learnerResult = await query(
      `SELECT school_id FROM learners WHERE id = $1`,
      [learnerId]
    );
    const learner = learnerResult.rows[0];
    await generateWeeklyLeaderboard(weekNumber, term, academicYear, category, learner.school_id);
    const newLeaderboard = await getCachedLeaderboard(weekNumber, term, academicYear, category);
    const position = newLeaderboard.findIndex(item => item.learner_id === learnerId);
    return position + 1;
  }

  const position = leaderboard.findIndex(item => item.learner_id === learnerId);
  return position + 1;
}

// Get learner's performance trend (improvement/drop over weeks)
async function getLearnerTrend(learnerId, term, academicYear, category) {
  const result = await query(
    `SELECT week_number, quiz_score, typing_score, active_course_score
     FROM weekly_marks
     WHERE learner_id = $1 AND term = $2 AND academic_year = $3
     ORDER BY week_number`,
    [learnerId, term, academicYear]
  );

  const marks = result.rows;
  const trend = [];

  for (let i = 1; i < marks.length; i++) {
    const previous = marks[i - 1];
    const current = marks[i];
    
    let scoreChange = 0;
    switch (category) {
      case 'quiz':
        scoreChange = current.quiz_score - previous.quiz_score;
        break;
      case 'typing':
        scoreChange = current.typing_score - previous.typing_score;
        break;
      case 'active_course':
        scoreChange = current.active_course_score - previous.active_course_score;
        break;
    }

    trend.push({
      week: current.week_number,
      previous_week: previous.week_number,
      score_change: scoreChange,
      improvement: scoreChange > 0,
      drop: scoreChange < 0,
      stable: scoreChange === 0
    });
  }

  return trend;
}

// Get top performers for a category across multiple weeks
async function getTopPerformers(term, academicYear, category, schoolId = null, limit = 10) {
  let queryText = `
    SELECT wm.learner_id, l.full_name, l.grade, l.stream, s.name as school_name,
           AVG(CASE 
             WHEN $4 = 'quiz' THEN wm.quiz_score
             WHEN $4 = 'typing' THEN wm.typing_score
             WHEN $4 = 'active_course' THEN wm.active_course_score
           END) as avg_score,
           COUNT(*) as weeks_participated
    FROM weekly_marks wm
    JOIN learners l ON wm.learner_id = l.id
    JOIN schools s ON l.school_id = s.id
    WHERE wm.term = $1 AND wm.academic_year = $2
  `;
  
  const params = [term, academicYear, category];
  let paramIndex = 3;

  if (schoolId) {
    queryText += ` AND l.school_id = $${paramIndex}`;
    params.push(schoolId);
    paramIndex++;
  }

  queryText += `
    GROUP BY wm.learner_id, l.full_name, l.grade, l.stream, s.name
    ORDER BY avg_score DESC
    LIMIT $${paramIndex}
  `;
  params.push(limit);

  const result = await query(queryText, params);
  return result.rows;
}

// Get weekly leaderboards for all categories
async function getAllWeeklyLeaderboards(weekNumber, term, academicYear, schoolId = null) {
  const categories = ['quiz', 'typing', 'active_course'];
  const leaderboards = {};

  for (const category of categories) {
    leaderboards[category] = await generateWeeklyLeaderboard(weekNumber, term, academicYear, category, schoolId);
  }

  return leaderboards;
}

// Get learner's weekly performance summary
async function getLearnerWeeklySummary(learnerId, term, academicYear) {
  const result = await query(
    `SELECT week_number, quiz_score, typing_score, active_course_score,
            active_course_modules_completed, active_course_modules_total
     FROM weekly_marks
     WHERE learner_id = $1 AND term = $2 AND academic_year = $3
     ORDER BY week_number`,
    [learnerId, term, academicYear]
  );

  return result.rows;
}

module.exports = {
  generateWeeklyLeaderboard,
  getCachedLeaderboard,
  getLearnerPosition,
  getLearnerTrend,
  getTopPerformers,
  getAllWeeklyLeaderboards,
  getLearnerWeeklySummary,
};
