const test = require("node:test");
const assert = require("node:assert/strict");

const {
  columnDefinition,
  withoutColumnCheck,
  dropColumnCheckStatement,
} = require("../scripts/mysql-migration/columnChecks");

// What MariaDB 11 prints for the feedback table imported from the old server.
const CREATE_TABLE = [
  "CREATE TABLE `feedback_messages` (",
  "  `id` int(11) NOT NULL AUTO_INCREMENT,",
  "  `thread_id` int(11) DEFAULT NULL,",
  "  `sender_role` varchar(50) NOT NULL CHECK (`sender_role` in ('system_admin','learner')),",
  "  `message` text NOT NULL,",
  "  PRIMARY KEY (`id`)",
  ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
].join("\n");

test("finds the column's own line, without its trailing comma", () => {
  assert.equal(
    columnDefinition(CREATE_TABLE, "sender_role"),
    "`sender_role` varchar(50) NOT NULL CHECK (`sender_role` in ('system_admin','learner'))",
  );
  assert.equal(columnDefinition(CREATE_TABLE, "missing"), null);
});

test("removes only the CHECK and keeps the rest of the column", () => {
  assert.equal(
    withoutColumnCheck("`sender_role` varchar(50) NOT NULL CHECK (`sender_role` in ('a','b'))"),
    "`sender_role` varchar(50) NOT NULL",
  );
  assert.equal(
    withoutColumnCheck("`n` int(11) NOT NULL CHECK (`n` > 0) COMMENT 'count'"),
    "`n` int(11) NOT NULL COMMENT 'count'",
  );
  assert.equal(withoutColumnCheck("`m` text NOT NULL"), "`m` text NOT NULL");
});

test("a bracket inside a quoted value does not end the CHECK early", () => {
  assert.equal(
    withoutColumnCheck("`s` varchar(9) DEFAULT 'x' CHECK (`s` in (')', '(('))"),
    "`s` varchar(9) DEFAULT 'x'",
  );
});

test("builds the statement that drops a column-level CHECK on MariaDB", () => {
  assert.equal(
    dropColumnCheckStatement("feedback_messages", CREATE_TABLE, "sender_role"),
    "ALTER TABLE `feedback_messages` MODIFY COLUMN `sender_role` varchar(50) NOT NULL",
  );
  assert.throws(() => dropColumnCheckStatement("feedback_messages", CREATE_TABLE, "nope"), /not found/);
});
