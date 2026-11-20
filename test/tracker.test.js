import test from "node:test";
import assert from "node:assert/strict";

import { committees, schedule } from "../dist/data/schedule.js";
import {
  GENERAL_TAB,
  firstDateForTab,
  getCommitteeState,
  getDepartments,
  getProgress,
  recordsForTab,
  selectCommittee,
} from "../dist/lib/tracker.js";

test("the generated data contains only 1002-1004", () => {
  assert.deepEqual(
    [...new Set(schedule.map((record) => record.committeeId))],
    ["1002", "1003", "1004"],
  );
  assert.equal(schedule.some((record) => record.topic.includes("1001")), false);
});

test("every schedule record satisfies the public data contract", () => {
  const ids = new Set();
  for (const record of schedule) {
    assert.match(record.id, /^100[2-4]-\d{4}-\d{2}-\d{2}-\d{3}$/);
    assert.equal(ids.has(record.id), false, `duplicate id: ${record.id}`);
    ids.add(record.id);
    assert.match(record.date, /^202[67]-\d{2}-\d{2}$/);
    assert.ok(record.topic.length > 0);
    assert.ok(["course", "exam", "holiday", "ceremony", "study", "event"].includes(record.type));
    if (record.type === "course") assert.ok(record.department.length > 0);
  }
});

test("20 November 2026 selects 1002 and includes the whole current day", () => {
  const selected = selectCommittee(committees, "2026-11-20");
  assert.equal(selected.id, "1002");
  assert.equal(getCommitteeState(selected, "2026-11-20"), "active");

  const commonCourses = recordsForTab(
    schedule,
    "1002",
    "Ortak Dersler",
    "2026-11-20",
  );
  assert.ok(commonCourses.some((record) => record.date === "2026-11-20"));
  assert.equal(commonCourses.some((record) => record.date > "2026-11-20"), false);
});

test("committee selection keeps the last committee during breaks", () => {
  assert.equal(selectCommittee(committees, "2026-11-08").id, "1002");
  assert.equal(getCommitteeState(committees[0], "2026-11-08"), "upcoming");
  assert.equal(selectCommittee(committees, "2027-01-22").id, "1002");
  assert.equal(getCommitteeState(committees[0], "2027-01-22"), "completed");
  assert.equal(selectCommittee(committees, "2027-02-08").id, "1003");
  assert.equal(selectCommittee(committees, "2027-04-18").id, "1003");
  assert.equal(selectCommittee(committees, "2027-04-19").id, "1004");
  assert.equal(selectCommittee(committees, "2027-07-01").id, "1004");
});

test("calendar progress is bounded and reaches 100 after the final", () => {
  const committee = committees[0];
  assert.equal(getProgress(committee, "2026-11-08"), 0);
  assert.ok(getProgress(committee, "2026-11-20") > 0);
  assert.ok(getProgress(committee, "2026-11-20") < 100);
  assert.equal(getProgress(committee, "2027-01-14"), 100);
});

test("all departments are visible before their first processed lesson", () => {
  const departments = getDepartments(schedule, "1004");
  assert.ok(departments.includes("Spor Hekimliği"));
  assert.equal(
    recordsForTab(schedule, "1004", "Spor Hekimliği", "2027-04-19").length,
    0,
  );
  assert.equal(firstDateForTab(schedule, "1004", "Spor Hekimliği"), "2027-06-08");
});

test("general tab contains events but not academic courses", () => {
  const records = recordsForTab(schedule, "1002", GENERAL_TAB, "2027-01-21");
  assert.ok(records.some((record) => record.type === "exam"));
  assert.ok(records.some((record) => record.type === "holiday"));
  assert.equal(records.some((record) => record.type === "course"), false);
});

test("multi-day holidays are expanded to their scheduled dates", () => {
  const ramadan = schedule.filter((record) => record.topic === "RAMAZAN BAYRAMI TATİLİ");
  const eid = schedule.filter((record) => record.topic === "KURBAN BAYRAMI TATİLİ");
  assert.equal(ramadan.length, 5);
  assert.deepEqual(ramadan.map((record) => record.date), [
    "2027-03-08",
    "2027-03-09",
    "2027-03-10",
    "2027-03-11",
    "2027-03-12",
  ]);
  assert.deepEqual(eid.map((record) => record.date), [
    "2027-05-17",
    "2027-05-18",
    "2027-05-19",
  ]);
});
