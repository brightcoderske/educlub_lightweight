import {
  academicPeriodKey,
  academicPeriodOptions,
  filterAcademicPeriod,
  currentLearningAllocations,
} from "../lib/academicHistory";

const allocations = [
  { id: 1, course_id: 1, term: "Term 2", academic_year: 2025, status: "completed" },
  { id: 2, course_id: 2, term: "Term 2", academic_year: 2025, status: "active" },
  { id: 3, course_id: 3, term: "Term 2", academic_year: 2026, status: "active" },
  { id: 4, course_id: 3, term: "Term 2", academic_year: 2026, status: "in_progress" },
];

test("all terms includes old and completed courses and filters distinguish identical names in different years", () => {
  expect(filterAcademicPeriod(allocations, "all")).toEqual(allocations);
  expect(academicPeriodOptions(allocations).map((item) => item.label)).toEqual([
    "2026 · Term 2",
    "2025 · Term 2",
  ]);
  expect(filterAcademicPeriod(allocations, academicPeriodKey(allocations[0]))).toEqual(
    allocations.slice(0, 2)
  );
});

test("the dashboard requests one overview per current course without loading the historical catalogue", () => {
  const current = currentLearningAllocations(allocations, { name: "Term 2", academic_year: 2026 });
  expect(current.map((item) => item.course_id)).toEqual([3]);
  expect(currentLearningAllocations(allocations, null)).toEqual([]);
  const selfPaced = { id: 5, course_id: 5, status: "active", term: null };
  expect(currentLearningAllocations([...allocations, selfPaced], null)).toEqual([selfPaced]);
});
