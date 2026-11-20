const DAY_MS = 86_400_000;

export const GENERAL_TAB = "__general__";
export const PANEL_TAB = "__panels__";
export const PANEL_ALL = "__all_panels__";

export function parseISODate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function daysBetween(from, to) {
  return Math.round((parseISODate(to) - parseISODate(from)) / DAY_MS);
}

export function getIstanbulToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  return parseISODate(value).toISOString().slice(0, 10) === value;
}

export function selectCommittee(committees, today) {
  const started = committees.filter((committee) => committee.startDate <= today);
  return started.at(-1) ?? committees[0];
}

export function getCommitteeState(committee, today) {
  if (today < committee.startDate) return "upcoming";
  if (today <= committee.endDate) return "active";
  return "completed";
}

export function getProgress(committee, today) {
  if (today < committee.startDate) return 0;
  if (today > committee.endDate) return 100;
  const totalDays = daysBetween(committee.startDate, committee.endDate) + 1;
  const elapsedDays = daysBetween(committee.startDate, today) + 1;
  return Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)));
}

export function getCommitteeRecords(schedule, committeeId) {
  return schedule.filter((record) => record.committeeId === committeeId);
}

export function getDepartments(schedule, committeeId) {
  return [...new Set(
    getCommitteeRecords(schedule, committeeId)
      .filter(
        (record) =>
          record.type === "course" &&
          !record.isPanel &&
          record.department &&
          record.department !== "Ders Kurulu",
      )
      .map((record) => record.department),
  )].sort((a, b) => a.localeCompare(b, "tr"));
}

export function getGeneralAgenda(schedule, committeeId, today) {
  const records = getCommitteeRecords(schedule, committeeId).filter(
    (record) => record.type !== "course" && !record.isPanel,
  );

  return {
    upcoming: records
      .filter((record) => record.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date)),
    past: records
      .filter((record) => record.date < today)
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function recordsForTab(schedule, committeeId, tab, today) {
  return getCommitteeRecords(schedule, committeeId).filter((record) => {
    if (record.date > today) return false;
    if (tab === GENERAL_TAB) return record.type !== "course" && !record.isPanel;
    if (tab === PANEL_TAB) return record.isPanel;
    return (
      !record.isPanel &&
      record.type === "course" &&
      record.department === tab
    );
  });
}

export function allRecordsForTab(schedule, committeeId, tab) {
  return getCommitteeRecords(schedule, committeeId).filter((record) => {
    if (tab === GENERAL_TAB) return record.type !== "course" && !record.isPanel;
    if (tab === PANEL_TAB) return record.isPanel;
    return (
      !record.isPanel &&
      record.type === "course" &&
      record.department === tab
    );
  });
}

export function firstDateForTab(schedule, committeeId, tab) {
  return allRecordsForTab(schedule, committeeId, tab)[0]?.date ?? null;
}

export function getPanelGroups(schedule, committeeId) {
  return [...new Set(
    getCommitteeRecords(schedule, committeeId)
      .filter((record) => record.isPanel && record.panelGroup)
      .map((record) => record.panelGroup),
  )];
}

export function recordsForPanelGroup(schedule, committeeId, group, today) {
  return getCommitteeRecords(schedule, committeeId).filter((record) => {
    if (!record.isPanel || record.date > today) return false;
    return group === PANEL_ALL || record.panelGroup === group;
  });
}

export function allRecordsForPanelGroup(schedule, committeeId, group) {
  return getCommitteeRecords(schedule, committeeId).filter((record) => {
    if (!record.isPanel) return false;
    return group === PANEL_ALL || record.panelGroup === group;
  });
}

export function firstDateForPanelGroup(schedule, committeeId, group) {
  return allRecordsForPanelGroup(schedule, committeeId, group)[0]?.date ?? null;
}

export function formatLongDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseISODate(value));
}

export function formatShortDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(parseISODate(value));
}

export function formatDay(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "UTC",
    day: "2-digit",
  }).format(parseISODate(value));
}

export function formatMonth(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "UTC",
    month: "short",
  })
    .format(parseISODate(value))
    .replace(".", "");
}
