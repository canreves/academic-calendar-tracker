import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { committees, schedule } from "../dist/data/schedule.js";
import {
  GENERAL_TAB,
  PANEL_ALL,
  PANEL_TAB,
  firstDateForTab,
  getCommitteeState,
  getDepartments,
  getGeneralAgenda,
  getPanelGroups,
  getProgress,
  recordsForPanelGroup,
  recordsForTab,
  selectCommittee,
} from "../dist/lib/tracker.js";

test("the interface uses the Cerrahpaşa identity", () => {
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /Cerrahpaşa Tıp · Dönem 1/);
  assert.match(html, /class="brand-symbol"/);
  assert.match(html, /class="brand-serpent"/);
  assert.doesNotMatch(html, /İstanbul Tıp/);
});

test("the generated data contains only 1002-1004", () => {
  assert.equal(schedule.length, 366);
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
    assert.equal(typeof record.isPanel, "boolean");
    assert.ok(["course", "exam", "holiday", "ceremony", "study", "event"].includes(record.type));
    if (record.type === "course") assert.ok(record.department.length > 0);
    if (record.isPanel) assert.ok(record.panelGroup.length > 0);
  }
});

test("20 November 2026 selects 1002 and excludes future lessons", () => {
  const selected = selectCommittee(committees, "2026-11-20");
  assert.equal(selected.id, "1002");
  assert.equal(getCommitteeState(selected, "2026-11-20"), "active");

  const biology = recordsForTab(
    schedule,
    "1002",
    "Tıbbi Biyoloji",
    "2026-11-20",
  );
  assert.ok(biology.some((record) => record.date === "2026-11-19"));
  assert.equal(biology.some((record) => record.date > "2026-11-20"), false);
});

test("common courses and every elective series are removed", () => {
  assert.equal(
    schedule.some((record) =>
      ["Ortak Dersler", "Seçmeli Ders"].includes(record.department),
    ),
    false,
  );
  assert.equal(
    schedule.some((record) => record.topic.toLocaleLowerCase("tr").includes("seçmeli")),
    false,
  );
  assert.equal(
    schedule.some((record) =>
      ["Güzel Sanatlar I", "İletişim Becerileri", "Yapay Zekâ"].includes(record.topic),
    ),
    false,
  );
});

test("biochemistry is normalized to a single department", () => {
  assert.equal(schedule.some((record) => record.department === "Biyokimya"), false);
  assert.ok(schedule.some((record) => record.department === "Tıbbi Biyokimya"));

  const panelBiochemistry = recordsForPanelGroup(
    schedule,
    "1002",
    "Tıbbi Biyokimya",
    "2027-01-01",
  );
  assert.equal(panelBiochemistry.length, 1);
  assert.match(panelBiochemistry[0].topic, /Ölçüm Güvenilirliği/);
  assert.equal(
    recordsForTab(schedule, "1002", "Tıbbi Biyokimya", "2027-01-21").some(
      (record) => /Ölçüm Güvenilirliği/.test(record.topic),
    ),
    false,
  );
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

test("general tab contains processed events but not academic courses", () => {
  const records = recordsForTab(schedule, "1002", GENERAL_TAB, "2027-01-21");
  assert.ok(records.some((record) => record.type === "exam"));
  assert.ok(records.some((record) => record.type === "holiday"));
  assert.equal(records.some((record) => record.type === "course"), false);
  assert.equal(records.some((record) => record.isPanel), false);
});

test("general agenda exposes upcoming events without revealing future lessons", () => {
  const agenda = getGeneralAgenda(schedule, "1002", "2026-11-20");

  assert.equal(agenda.upcoming.length, 18);
  assert.equal(agenda.upcoming[0].date, "2026-12-09");
  assert.equal(agenda.past.length, 0);
  assert.ok(agenda.upcoming.some((record) => record.type === "exam"));
  assert.ok(agenda.upcoming.some((record) => record.type === "ceremony"));
  assert.equal(agenda.upcoming.some((record) => record.type === "course"), false);
  assert.equal(agenda.upcoming.some((record) => record.committeeId !== "1002"), false);

  const futureBiology = recordsForTab(
    schedule,
    "1002",
    "Tıbbi Biyoloji",
    "2026-11-20",
  );
  assert.equal(futureBiology.some((record) => record.date > "2026-11-20"), false);
});

test("general agenda treats today as upcoming and sorts the past newest-first", () => {
  const onExamDay = getGeneralAgenda(schedule, "1002", "2026-12-11");
  assert.equal(onExamDay.upcoming[0].date, "2026-12-11");
  assert.equal(onExamDay.upcoming[0].type, "exam");
  assert.deepEqual(
    onExamDay.past.map((record) => record.date),
    ["2026-12-10", "2026-12-09"],
  );

  const completed = getGeneralAgenda(schedule, "1002", "2027-01-22");
  assert.equal(completed.upcoming.length, 0);
  assert.equal(completed.past.length, 18);
  assert.equal(completed.past[0].date, "2027-01-21");
});

test("panel lessons are grouped in first-appearance order", () => {
  assert.equal(recordsForTab(schedule, "1002", PANEL_TAB, "2027-01-21").length, 18);
  assert.equal(recordsForTab(schedule, "1003", PANEL_TAB, "2027-04-16").length, 13);
  assert.equal(recordsForTab(schedule, "1004", PANEL_TAB, "2027-06-14").length, 0);
  assert.deepEqual(getPanelGroups(schedule, "1004"), []);
  assert.deepEqual(getPanelGroups(schedule, "1002"), [
    "Göğüs Cerrahisi",
    "Tıp Eğitimi",
    "Tıbbi Biyoloji",
    "Halk Sağlığı",
    "Histoloji ve Embriyoloji",
    "Pediatri",
    "Biyoistatistik ve Tıp Bilişimi",
    "Tıp Tarihi ve Etik",
    "Tıbbi Biyokimya",
  ]);
  assert.equal(
    recordsForPanelGroup(schedule, "1002", PANEL_ALL, "2027-01-21").length,
    18,
  );
});

test("the standalone scientific project panel has its own group", () => {
  const records = recordsForPanelGroup(
    schedule,
    "1003",
    "Bilimsel Proje Paneli",
    "2027-04-16",
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].topic, "Bilimsel Proje Paneli");
  assert.match(records[0].lecturer, /Moderatör/);
  assert.match(records[0].details, /Konuşmacılar/);
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
