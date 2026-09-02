export function academicPeriodKey(record) {
  return JSON.stringify([String(record.academic_year || ""), record.term || ""]);
}

export function academicPeriodOptions(records) {
  return [
    ...new Map(
      records.map((record) => [
        academicPeriodKey(record),
        {
          key: academicPeriodKey(record),
          label:
            [record.academic_year, record.term].filter(Boolean).join(" · ") || "Unassigned period",
        },
      ])
    ).values(),
  ].sort((a, b) => b.label.localeCompare(a.label, undefined, { numeric: true }));
}

export function filterAcademicPeriod(records, period) {
  return period === "all"
    ? records
    : records.filter((record) => academicPeriodKey(record) === period);
}

// Historical allocations remain visible; only current work needs the extra
// learning overview requests used by the home page's due/continue panels.
export function currentLearningAllocations(allocations, currentTerm) {
  return [
    ...new Map(
      allocations
        .filter(
          (allocation) =>
            ["active", "in_progress"].includes(allocation.status) &&
            (!allocation.term ||
              (currentTerm &&
                allocation.term === currentTerm.name &&
                Number(allocation.academic_year) === Number(currentTerm.academic_year)))
        )
        .map((allocation) => [allocation.course_id, allocation])
    ).values(),
  ];
}
