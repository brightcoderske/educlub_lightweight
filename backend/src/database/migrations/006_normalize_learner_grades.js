module.exports = {
  async up(client) {
    // Grades arrived from two places in two shapes: the Add Learner dropdown
    // wrote "Grade 7", while spreadsheet uploads stored whatever the operator
    // typed, usually a bare "7". The same class therefore existed as several
    // distinct strings, splitting every grade filter, grouping and report.
    //
    // Canonical form is "Grade N" for N in 1..12. Bare numbers and mixed casing
    // fold into it; anything outside that range is cleared rather than kept as a
    // phantom grade, matching normalizeGrade() in src/utils/grade.js.
    await client.query(`
      UPDATE learners
      SET grade = 'Grade ' || (regexp_match(btrim(grade), '^(?:[Gg][Rr][Aa][Dd][Ee]\\s*)?(\\d{1,2})$'))[1],
          updated_at = NOW()
      WHERE grade IS NOT NULL
        AND btrim(grade) <> ''
        AND btrim(grade) ~* '^(?:grade\\s*)?\\d{1,2}$'
        AND (regexp_match(btrim(grade), '^(?:[Gg][Rr][Aa][Dd][Ee]\\s*)?(\\d{1,2})$'))[1]::integer BETWEEN 1 AND 12
        AND grade <> 'Grade ' || (regexp_match(btrim(grade), '^(?:[Gg][Rr][Aa][Dd][Ee]\\s*)?(\\d{1,2})$'))[1];
    `);

    // Empty strings behave like a real value in filters and dropdowns while
    // meaning "unset". Store the absence explicitly instead.
    await client.query(`
      UPDATE learners
      SET grade = NULL, updated_at = NOW()
      WHERE grade IS NOT NULL AND btrim(grade) = '';
    `);

    // Same treatment for the queued promotion target.
    await client.query(`
      UPDATE learners
      SET next_grade = 'Grade ' || (regexp_match(btrim(next_grade), '^(?:[Gg][Rr][Aa][Dd][Ee]\\s*)?(\\d{1,2})$'))[1],
          updated_at = NOW()
      WHERE next_grade IS NOT NULL
        AND btrim(next_grade) <> ''
        AND btrim(next_grade) ~* '^(?:grade\\s*)?\\d{1,2}$'
        AND (regexp_match(btrim(next_grade), '^(?:[Gg][Rr][Aa][Dd][Ee]\\s*)?(\\d{1,2})$'))[1]::integer BETWEEN 1 AND 12
        AND next_grade <> 'Grade ' || (regexp_match(btrim(next_grade), '^(?:[Gg][Rr][Aa][Dd][Ee]\\s*)?(\\d{1,2})$'))[1];
    `);

    await client.query(`
      UPDATE learners
      SET next_grade = NULL, updated_at = NOW()
      WHERE next_grade IS NOT NULL AND btrim(next_grade) = '';
    `);

    // Schools that configured their own grade list get the same canonical form,
    // otherwise their dropdown keeps offering the old shape and reintroduces it.
    await client.query(`
      UPDATE schools s
      SET grades_config = normalised.grades,
          updated_at = NOW()
      FROM (
        SELECT id,
               COALESCE(
                 jsonb_agg(DISTINCT 'Grade ' || (regexp_match(btrim(value), '^(?:[Gg][Rr][Aa][Dd][Ee]\\s*)?(\\d{1,2})$'))[1])
                   FILTER (
                     WHERE btrim(value) ~* '^(?:grade\\s*)?\\d{1,2}$'
                       AND (regexp_match(btrim(value), '^(?:[Gg][Rr][Aa][Dd][Ee]\\s*)?(\\d{1,2})$'))[1]::integer BETWEEN 1 AND 12
                   ),
                 '[]'::jsonb
               ) AS grades
        FROM schools, jsonb_array_elements_text(COALESCE(grades_config, '[]'::jsonb)) AS value
        GROUP BY id
      ) normalised
      WHERE normalised.id = s.id
        AND s.grades_config IS DISTINCT FROM normalised.grades
        AND jsonb_array_length(COALESCE(s.grades_config, '[]'::jsonb)) > 0;
    `);
  },
};
