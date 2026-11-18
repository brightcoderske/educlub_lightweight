const test = require("node:test");
const assert = require("node:assert/strict");

// Competitions service over a fake database: `answer(sql, params)` returns the
// rows for each query, and every query is recorded.
function serviceWith(answer) {
  const calls = [];
  const configPath = require.resolve("../src/config");
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      query: async (sql, params = []) => {
        calls.push({ sql, params });
        return { rows: answer(sql, params) || [] };
      },
    },
  };
  delete require.cache[require.resolve("../src/services/competitions.service")];
  return { service: require("../src/services/competitions.service"), calls };
}

const form = {
  name: "Spelling Bee",
  competition_type: "quiz",
  start_date: "2026-11-20",
  end_date: "2026-11-30",
  price_amount: 500,
  is_featured: true,
};

test("a school admin or teacher creates a free competition for their own school", async () => {
  for (const role of ["school_admin", "teacher"]) {
    const { service, calls } = serviceWith(() => [{ id: 1 }]);
    await service.createCompetition(form, { role, schoolId: 4, userId: 9 });
    const insert = calls.find((call) => /INSERT INTO competitions/.test(call.sql));
    const [, , , , , , , , price, , featured, , createdBy, schoolId] = insert.params;
    assert.equal(schoolId, 4, `${role}: the competition is the school's`);
    assert.equal(price, 0, `${role}: school competitions are free`);
    assert.equal(featured, false, `${role}: not in eduClub's featured list`);
    assert.equal(createdBy, 9);
  }
});

test("the system administrator creates eduClub competitions for every school", async () => {
  const { service, calls } = serviceWith(() => [{ id: 1 }]);
  await service.createCompetition(form, { role: "system_admin", userId: 1 });
  const insert = calls.find((call) => /INSERT INTO competitions/.test(call.sql));
  assert.equal(insert.params[13], null, "no school: open to all");
  assert.equal(insert.params[8], 500, "the price is kept");
});

test("learners cannot create competitions", async () => {
  const { service } = serviceWith(() => []);
  await assert.rejects(service.createCompetition(form, { role: "learner" }), /cannot manage/);
});

test("school staff edit only their own school's competitions", async () => {
  const rowsFor = (competition) => (sql) =>
    /SELECT \* FROM competitions/.test(sql) ? [competition] : [{ id: 1 }];
  const teacher = { role: "teacher", schoolId: 4 };

  const own = serviceWith(rowsFor({ id: 1, school_id: 4 }));
  await own.service.updateCompetition(1, form, teacher);
  assert.ok(own.calls.some((call) => /UPDATE competitions/.test(call.sql)));

  const eduClub = serviceWith(rowsFor({ id: 1, school_id: null }));
  await assert.rejects(eduClub.service.updateCompetition(1, form, teacher), /managed by eduClub/);

  const other = serviceWith(rowsFor({ id: 1, school_id: 7 }));
  await assert.rejects(other.service.updateCompetition(1, form, teacher), /another school/);
});

test("school staff list eduClub's competitions and their own school's only", async () => {
  const { service, calls } = serviceWith(() => []);
  await service.listCompetitions({ role: "school_admin", schoolId: 4 });
  assert.match(calls[0].sql, /c\.school_id IS NULL OR c\.school_id = \$1/);
  assert.deepEqual(calls[0].params, [4]);

  const admin = serviceWith(() => []);
  await admin.service.listCompetitions({ role: "system_admin" });
  assert.doesNotMatch(
    admin.calls[0].sql,
    /c\.school_id IS NULL OR/,
    "the system administrator sees all",
  );
});

test("a learner sees and enters only eduClub's and their own school's competitions", async () => {
  const learner = { id: 11, school_id: 4, grade: "Grade 5" };
  const listing = serviceWith((sql) => (/FROM learners/.test(sql) ? [learner] : []));
  await listing.service.listCompetitionsForLearner(99);
  const list = listing.calls.find((call) => /FROM competitions c/.test(call.sql));
  assert.match(list.sql, /c\.school_id IS NULL OR c\.school_id = \$2/);
  assert.deepEqual(list.params, [11, 4]);
  // An ended competition stays only for those who took part.
  assert.match(list.sql, /c\.end_date >= CURRENT_DATE OR ce\.status = 'enrolled'/);

  const enrolling = serviceWith((sql) => {
    if (/FROM learners/.test(sql)) return [learner];
    if (/FROM competitions c/.test(sql)) return [{ id: 5, school_id: 7, price_amount: 0 }];
    return [];
  });
  await assert.rejects(
    enrolling.service.enrollOrStartPayment(5, { userId: 99 }),
    /not open for enrolment/,
  );
});
