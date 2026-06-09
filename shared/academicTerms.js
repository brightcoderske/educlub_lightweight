/**
 * Academic Terms Constants and Helpers
 */

const TERM_NAMES = {
  TERM_1: 'Term 1',
  TERM_2: 'Term 2',
  TERM_3: 'Term 3',
};

const GRADES = [
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];

const STREAMS = [
  'Science',
  'Arts',
  'Commerce',
  'Technical',
  'General',
];

function getTermName(termNumber) {
  const termMap = {
    1: TERM_NAMES.TERM_1,
    2: TERM_NAMES.TERM_2,
    3: TERM_NAMES.TERM_3,
  };
  return termMap[termNumber] || `Term ${termNumber}`;
}

function getNextTerm(currentTerm) {
  const termNumber = parseInt(currentTerm.replace('Term ', ''));
  if (termNumber < 3) {
    return getTermName(termNumber + 1);
  }
  return null; // End of academic year
}

function getNextGrade(currentGrade) {
  const gradeNumber = parseInt(currentGrade.replace('Grade ', ''));
  if (gradeNumber < 12) {
    return `Grade ${gradeNumber + 1}`;
  }
  return null; // Graduated
}

function getAcademicYearRange(year) {
  return `${year}-${year + 1}`;
}

function isValidGrade(grade) {
  return GRADES.includes(grade);
}

function isValidStream(stream) {
  return STREAMS.includes(stream);
}

function isValidTerm(term) {
  return Object.values(TERM_NAMES).includes(term);
}

module.exports = {
  TERM_NAMES,
  GRADES,
  STREAMS,
  getTermName,
  getNextTerm,
  getNextGrade,
  getAcademicYearRange,
  isValidGrade,
  isValidStream,
  isValidTerm,
};
