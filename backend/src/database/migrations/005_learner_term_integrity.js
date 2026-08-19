module.exports = {
  async up(client) {
    // Learner term strings used to be written straight from the client, so some
    // rows carry terms that were never created: a hardcoded "Term 1" from the
    // add-learner form, a stray "2", an empty string. Course allocations are
    // validated against the active term on write, so the learner's most recent
    // allocation is the authoritative record of where they actually sit.
    await client.query(`
      UPDATE learners l
      SET term = alloc.term,
          academic_year = alloc.academic_year,
          updated_at = NOW()
      FROM (
        SELECT DISTINCT ON (a.learner_id)
               a.learner_id, a.term, a.academic_year
        FROM course_allocations a
        WHERE a.term IS NOT NULL
        ORDER BY a.learner_id, a.allocated_at DESC
      ) alloc
      WHERE alloc.learner_id = l.id
        AND l.term IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM terms t WHERE t.name = l.term);
    `);

    // Anything still unmatched has no allocation to derive a term from. Clear it
    // rather than guess: term is nullable and already null for unplaced
    // learners, so this states "not placed" instead of inventing a placement.
    await client.query(`
      UPDATE learners l
      SET term = NULL,
          academic_year = NULL,
          updated_at = NOW()
      WHERE l.term IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM terms t WHERE t.name = l.term);
    `);
  },
};
