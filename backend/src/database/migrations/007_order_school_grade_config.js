module.exports = {
  async up(client) {
    // 006 normalised grades_config with jsonb_agg(DISTINCT ...), which sorts
    // lexically: "Grade 1", "Grade 10", "Grade 11", "Grade 12", "Grade 2".
    // The dropdown renders in stored order, so restore numeric order.
    await client.query(`
      UPDATE schools s
      SET grades_config = ordered.grades,
          updated_at = NOW()
      FROM (
        SELECT id,
               jsonb_agg(value ORDER BY (regexp_replace(value, '[^0-9]', '', 'g'))::integer) AS grades
        FROM schools, jsonb_array_elements_text(COALESCE(grades_config, '[]'::jsonb)) AS value
        WHERE value ~ '^Grade [0-9]{1,2}$'
        GROUP BY id
      ) ordered
      WHERE ordered.id = s.id
        AND s.grades_config IS DISTINCT FROM ordered.grades;
    `);
  },
};
