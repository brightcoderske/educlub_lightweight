const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// The service with its database and notifications replaced, so the routing
// rules can be checked without a database.
function loadService({ thread, teachers = [] }) {
  const sent = [];
  const queries = [];
  const fakeQuery = async (sql, params = []) => {
    queries.push({ sql, params });
    if (/FROM feedback_threads ft[\s\S]*learner_user_id/.test(sql)) return { rows: [thread] };
    if (/course_teacher_assignments[\s\S]*teacher\.school_id/.test(sql)) return { rows: teachers };
    if (/INSERT INTO feedback_messages/.test(sql)) return { rows: [{ id: 1, sender_role: "learner" }] };
    return { rows: [], rowCount: 1 };
  };
  const stub = (relative, exports) => {
    const id = require.resolve(path.join(__dirname, "../src", relative));
    require.cache[id] = { id, filename: id, loaded: true, exports };
  };
  const servicePath = require.resolve("../src/services/feedback.service");
  delete require.cache[servicePath];
  stub("config/index.js", { query: fakeQuery });
  stub("services/notifications.service.js", {
    notifyRole: async (role, notification) => sent.push({ role, ...notification }),
    notifyUser: async (userId, notification) => sent.push({ userId, ...notification }),
  });
  const service = require("../src/services/feedback.service");
  return { service, sent, queries };
}

const learner = { userId: 40, role: "learner", schoolId: 2 };

test("a school learner's message goes to their school admin and their own teachers, not eduClub", async () => {
  const { service, sent } = loadService({
    thread: { id: 9, school_id: 2, learner_id: 15, independent: 0 },
    teachers: [{ teacher_user_id: 6 }],
  });
  await service.addLearnerMessage(learner, "Please help");
  assert.deepEqual(sent.map((n) => n.role || `user ${n.userId}`).sort(), ["school_admin", "user 6"]);
  assert.equal(sent.find((n) => n.role === "school_admin").school_id, 2);
  assert.ok(!sent.some((n) => n.role === "system_admin"));
});

test("an independent learner, whose school has no staff, still reaches eduClub", async () => {
  const { service, sent } = loadService({ thread: { id: 9, school_id: 3, learner_id: 15, independent: 1 } });
  await service.addLearnerMessage(learner, "Please help");
  assert.deepEqual(sent.map((n) => n.role), ["system_admin"]);
});

test("staff only ever see their own school's conversations; eduClub only independent ones", async () => {
  const system = loadService({ thread: null });
  await system.service.listThreads({ userId: 1, role: "system_admin" });
  assert.match(system.queries.at(-1).sql, /is_independent_school = true/);

  const teacher = loadService({ thread: null });
  await teacher.service.listThreads({ userId: 6, role: "teacher", schoolId: 2 });
  const { sql, params } = teacher.queries.at(-1);
  assert.match(sql, /ft\.school_id = \?|ft\.school_id = \$1/);
  assert.match(sql, /NOT \(ft\.school_id IS NULL OR EXISTS/);
  assert.match(sql, /cta\.teacher_user_id/);
  assert.deepEqual(params, [2, 6]);
});
