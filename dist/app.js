import { committees, schedule } from "./data/schedule.js";
import {
  GENERAL_TAB,
  PANEL_ALL,
  PANEL_TAB,
  allRecordsForPanelGroup,
  allRecordsForTab,
  daysBetween,
  firstDateForPanelGroup,
  firstDateForTab,
  formatDay,
  formatLongDate,
  formatMonth,
  formatShortDate,
  getCommitteeState,
  getDepartments,
  getGeneralAgenda,
  getIstanbulToday,
  getPanelGroups,
  getProgress,
  isISODate,
  recordsForPanelGroup,
  recordsForTab,
  selectCommittee,
} from "./lib/tracker.js";

const params = new URLSearchParams(window.location.search);
const requestedDate = params.get("date");
const today = isISODate(requestedDate) ? requestedDate : getIstanbulToday();
const committee = selectCommittee(committees, today);
const committeeState = getCommitteeState(committee, today);
const departments = getDepartments(schedule, committee.id);
const panelGroups = getPanelGroups(schedule, committee.id);
const tabs = [
  GENERAL_TAB,
  ...(panelGroups.length ? [PANEL_TAB] : []),
  ...departments,
];

const elements = {
  todayLabel: document.querySelector("#today-label"),
  committeeCode: document.querySelector("#committee-code"),
  statusBadge: document.querySelector("#status-badge"),
  committeeTitle: document.querySelector("#committee-title"),
  committeeMessage: document.querySelector("#committee-message"),
  dateDay: document.querySelector("#date-day"),
  dateMonth: document.querySelector("#date-month"),
  dateRange: document.querySelector("#date-range"),
  progressValue: document.querySelector("#progress-value"),
  progressTrack: document.querySelector("#progress-track"),
  progressFill: document.querySelector("#progress-fill"),
  departmentTotal: document.querySelector("#department-total"),
  departmentTabs: document.querySelector("#department-tabs"),
  timelinePanel: document.querySelector("#timeline-panel"),
  timelineKicker: document.querySelector("#timeline-kicker"),
  timelineTitle: document.querySelector("#timeline-title"),
  timelineDescription: document.querySelector("#timeline-description"),
  resultCount: document.querySelector("#result-count"),
  panelSubtabsShell: document.querySelector("#panel-subtabs-shell"),
  panelSubtabs: document.querySelector("#panel-subtabs"),
  timeline: document.querySelector("#timeline"),
};

let selectedTab = GENERAL_TAB;
let selectedPanelGroup = PANEL_ALL;

function statusContent() {
  if (committeeState === "upcoming") {
    const remaining = daysBetween(today, committee.startDate);
    return {
      label: "Yakında",
      message: `${remaining} gün sonra başlıyor. Şimdilik ders başlıklarını ve önemli tarihleri inceleyebilirsin.`,
    };
  }

  if (committeeState === "completed" && committee.nextStartDate) {
    const remaining = daysBetween(today, committee.nextStartDate);
    return {
      label: "Tamamlandı",
      message:
        remaining > 0
          ? `Sıradaki komite ${remaining} gün sonra, ${formatShortDate(committee.nextStartDate)} tarihinde başlıyor.`
          : `Sıradaki komite ${formatShortDate(committee.nextStartDate)} tarihinde başlıyor.`,
    };
  }

  if (committeeState === "completed") {
    return {
      label: "Tamamlandı",
      message: "Dönem 1 kapsamındaki takip edilen son komite tamamlandı.",
    };
  }

  return {
    label: "Devam ediyor",
    message: "İşlenen konuları ve yaklaşan önemli tarihleri aşağıda güncel olarak takip edebilirsin.",
  };
}

function renderHeader() {
  const progress = getProgress(committee, today);
  const status = statusContent();

  elements.todayLabel.textContent = `Bugün · ${formatLongDate(today)}`;
  elements.committeeCode.textContent = `${committee.id} Komitesi`;
  elements.statusBadge.textContent = status.label;
  elements.statusBadge.dataset.state = committeeState;
  elements.committeeTitle.textContent = committee.title;
  elements.committeeMessage.textContent = status.message;
  elements.dateDay.textContent = formatDay(today);
  elements.dateMonth.textContent = formatMonth(today);
  elements.dateRange.textContent = `${formatShortDate(committee.startDate)} — ${formatShortDate(committee.endDate)}`;
  elements.progressValue.textContent = `%${progress}`;
  elements.progressTrack.setAttribute("aria-valuenow", String(progress));
  elements.progressFill.style.width = `${progress}%`;
}

function tabName(tab) {
  if (tab === GENERAL_TAB) return "Genel";
  if (tab === PANEL_TAB) return "Panel Dersler";
  return tab;
}

function tabDescription(tab) {
  if (tab === GENERAL_TAB) {
    return "Aktif komitedeki sınav, tatil, tören, serbest çalışma ve duyurular.";
  }
  if (tab === PANEL_TAB) {
    return "Akademik programda maviyle işaretlenen panel dersleri.";
  }
  return `${tab} kapsamında bugüne kadar işlenen konular.`;
}

function renderTabs() {
  elements.departmentTabs.replaceChildren();
  elements.departmentTotal.textContent = `${departments.length} bölüm`;

  tabs.forEach((tab, index) => {
    const count =
      tab === GENERAL_TAB
        ? getGeneralAgenda(schedule, committee.id, today).upcoming.length
        : recordsForTab(schedule, committee.id, tab, today).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab-button";
    button.id = `tab-${index}`;
    button.dataset.tab = tab;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", "timeline-panel");
    button.setAttribute("aria-selected", String(tab === selectedTab));
    button.tabIndex = tab === selectedTab ? 0 : -1;

    const name = document.createElement("span");
    name.textContent = tabName(tab);
    const badge = document.createElement("span");
    badge.className = "tab-count";
    badge.textContent = String(count);
    badge.setAttribute(
      "aria-label",
      tab === GENERAL_TAB
        ? `${count} yaklaşan kayıt`
        : `${count} işlenmiş kayıt`,
    );
    button.append(name, badge);
    button.addEventListener("click", () => selectTab(tab));
    button.addEventListener("keydown", handleTabKeydown);
    elements.departmentTabs.append(button);
  });
}

function handleTabKeydown(event) {
  const current = tabs.indexOf(event.currentTarget.dataset.tab);
  let next = current;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (current + 1) % tabs.length;
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = tabs.length - 1;
  if (next === current) return;
  event.preventDefault();
  selectTab(tabs[next]);
  elements.departmentTabs.querySelector(`[data-tab="${CSS.escape(tabs[next])}"]`)?.focus();
}

function selectTab(tab) {
  if (tab === PANEL_TAB && selectedTab !== PANEL_TAB) {
    selectedPanelGroup = PANEL_ALL;
  }
  selectedTab = tab;
  for (const button of elements.departmentTabs.querySelectorAll("[role='tab']")) {
    const selected = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  renderTimeline();
}

function panelGroupName(group) {
  return group === PANEL_ALL ? "Tümü" : group;
}

function renderPanelSubtabs() {
  const visible = selectedTab === PANEL_TAB;
  elements.panelSubtabsShell.hidden = !visible;
  elements.panelSubtabs.replaceChildren();
  if (!visible) return;

  const groups = [PANEL_ALL, ...panelGroups];
  groups.forEach((group, index) => {
    const count = recordsForPanelGroup(
      schedule,
      committee.id,
      group,
      today,
    ).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "panel-subtab";
    button.id = `panel-tab-${index}`;
    button.dataset.panelGroup = group;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", "timeline-panel");
    button.setAttribute("aria-selected", String(group === selectedPanelGroup));
    button.tabIndex = group === selectedPanelGroup ? 0 : -1;

    const name = document.createElement("span");
    name.textContent = panelGroupName(group);
    const badge = document.createElement("span");
    badge.className = "panel-subtab-count";
    badge.textContent = String(count);
    badge.setAttribute("aria-label", `${count} işlenmiş panel kaydı`);
    button.append(name, badge);
    button.addEventListener("click", () => selectPanelGroup(group));
    button.addEventListener("keydown", handlePanelTabKeydown);
    elements.panelSubtabs.append(button);
  });
}

function handlePanelTabKeydown(event) {
  const groups = [PANEL_ALL, ...panelGroups];
  const current = groups.indexOf(event.currentTarget.dataset.panelGroup);
  let next = current;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    next = (current + 1) % groups.length;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    next = (current - 1 + groups.length) % groups.length;
  }
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = groups.length - 1;
  if (next === current) return;
  event.preventDefault();
  selectPanelGroup(groups[next]);
  elements.panelSubtabs
    .querySelector(`[data-panel-group="${CSS.escape(groups[next])}"]`)
    ?.focus();
}

function selectPanelGroup(group) {
  selectedPanelGroup = group;
  renderTimeline();
}

function eventLabel(type) {
  return {
    exam: "Sınav",
    holiday: "Tatil",
    ceremony: "Tören",
    study: "Serbest çalışma",
    event: "Duyuru",
  }[type] ?? "Ders";
}

function createRecordCard(record, { isNext = false, isPast = false } = {}) {
  const article = document.createElement("article");
  article.className = "timeline-item";
  article.dataset.type = record.isPanel ? "panel" : record.type;
  article.classList.toggle("is-next", isNext);
  article.classList.toggle("is-past", isPast);

  const marker = document.createElement("span");
  marker.className = "timeline-marker";
  marker.setAttribute("aria-hidden", "true");

  const card = document.createElement("div");
  card.className = "lesson-card";

  if (isNext) {
    const nextLabel = document.createElement("span");
    nextLabel.className = "next-event-label";
    nextLabel.textContent = "Sıradaki";
    card.append(nextLabel);
  }

  const date = document.createElement("time");
  date.className = "lesson-date";
  date.dateTime = record.date;
  date.textContent = formatLongDate(record.date);

  if (record.isPanel) {
    const source = document.createElement("span");
    source.className = "panel-source";
    source.textContent = record.department || record.panelGroup;
    card.append(source);
  } else if (record.type !== "course") {
    const kind = document.createElement("span");
    kind.className = "event-kind";
    kind.textContent = eventLabel(record.type);
    card.append(kind);
  }

  const title = document.createElement("h3");
  title.textContent = record.topic;
  card.append(date, title);

  if (record.type === "course" || record.isPanel) {
    const lecturer = document.createElement("p");
    lecturer.className = "lecturer";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = record.isPanel ? "P" : "ÖÜ";
    const name = document.createElement("strong");
    name.textContent = record.lecturer || "Belirtilmemiş";
    lecturer.append(icon, name);
    card.append(lecturer);
  }

  if (record.details) {
    const details = document.createElement("p");
    details.className = "panel-details";
    details.textContent = record.details;
    card.append(details);
  }

  article.append(marker, card);
  return article;
}

function createAgendaEmptyState(hasPastRecords) {
  const empty = document.createElement("div");
  empty.className = "empty-state agenda-empty-state";

  const icon = document.createElement("span");
  icon.className = "empty-icon";
  icon.textContent = "✓";
  icon.setAttribute("aria-hidden", "true");

  const title = document.createElement("h3");
  title.textContent = "Bu komitede yaklaşan etkinlik yok";

  const copy = document.createElement("p");
  copy.textContent = hasPastRecords
    ? "Tamamlanan etkinlikleri aşağıdaki Geçmiş bölümünden inceleyebilirsin."
    : "Bu komite için kaynak programda genel etkinlik kaydı bulunmuyor.";

  empty.append(icon, title, copy);
  return empty;
}

function createAgendaList(records, options = {}) {
  const list = document.createElement("div");
  list.className = "agenda-list";
  if (options.isPast) list.classList.add("agenda-list--past");

  records.forEach((record, index) => {
    list.append(
      createRecordCard(record, {
        isNext: Boolean(options.markFirstAsNext && index === 0),
        isPast: Boolean(options.isPast),
      }),
    );
  });

  return list;
}

function createAgendaHistory(records) {
  const details = document.createElement("details");
  details.className = "agenda-history";

  const summary = document.createElement("summary");
  const heading = document.createElement("span");
  heading.className = "agenda-history-heading";

  const title = document.createElement("strong");
  title.textContent = "Geçmiş";
  const description = document.createElement("small");
  description.textContent = "Geride kalan önemli tarihler";
  heading.append(title, description);

  const meta = document.createElement("span");
  meta.className = "agenda-history-meta";
  const count = document.createElement("span");
  count.textContent = `${records.length} kayıt`;
  const closedAction = document.createElement("span");
  closedAction.className = "history-action history-action--closed";
  closedAction.textContent = "Göster";
  const openAction = document.createElement("span");
  openAction.className = "history-action history-action--open";
  openAction.textContent = "Gizle";
  meta.append(count, closedAction, openAction);

  summary.append(heading, meta);
  details.append(summary, createAgendaList(records, { isPast: true }));
  return details;
}

function renderGeneralTimeline() {
  const { upcoming, past } = getGeneralAgenda(schedule, committee.id, today);

  elements.resultCount.textContent = upcoming.length
    ? `${upcoming.length} yaklaşan`
    : "Yaklaşan kayıt yok";
  elements.timeline.replaceChildren();

  const section = document.createElement("section");
  section.className = "agenda-section";
  section.setAttribute("aria-labelledby", "upcoming-events-title");

  const heading = document.createElement("div");
  heading.className = "agenda-section-heading";
  const title = document.createElement("h3");
  title.id = "upcoming-events-title";
  title.textContent = "Yaklaşanlar";
  const copy = document.createElement("p");
  copy.textContent = "Bugün ve sonrasındaki önemli tarihler";
  heading.append(title, copy);

  section.append(heading);
  section.append(
    upcoming.length
      ? createAgendaList(upcoming, { markFirstAsNext: true })
      : createAgendaEmptyState(past.length > 0),
  );
  elements.timeline.append(section);

  if (past.length) {
    elements.timeline.append(createAgendaHistory(past));
  }
}

function renderTimeline() {
  const generalView = selectedTab === GENERAL_TAB;
  const panelView = selectedTab === PANEL_TAB;
  const records = generalView
    ? []
    : panelView
      ? recordsForPanelGroup(
          schedule,
          committee.id,
          selectedPanelGroup,
          today,
        )
      : recordsForTab(schedule, committee.id, selectedTab, today);
  const allRecords = generalView
    ? []
    : panelView
      ? allRecordsForPanelGroup(schedule, committee.id, selectedPanelGroup)
      : allRecordsForTab(schedule, committee.id, selectedTab);

  renderPanelSubtabs();

  elements.timelineKicker.textContent = panelView
    ? `${committee.id} · ${panelGroupName(selectedPanelGroup)}`
    : `${committee.id} · ${tabName(selectedTab)}`;
  elements.timelineTitle.textContent = tabName(selectedTab);
  elements.timelineDescription.textContent =
    panelView && selectedPanelGroup !== PANEL_ALL
      ? `Panel dersleri içinde ${selectedPanelGroup} alanındaki konular.`
      : tabDescription(selectedTab);

  if (generalView) {
    renderGeneralTimeline();
    return;
  }

  elements.resultCount.textContent = records.length
    ? `${records.length} kayıt`
    : "Henüz kayıt yok";
  elements.timeline.replaceChildren();

  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("span");
    icon.className = "empty-icon";
    icon.textContent = "–";
    icon.setAttribute("aria-hidden", "true");
    const title = document.createElement("h3");
    title.textContent = "Henüz işlenmedi";
    const copy = document.createElement("p");
    const firstDate = panelView
      ? firstDateForPanelGroup(schedule, committee.id, selectedPanelGroup)
      : firstDateForTab(schedule, committee.id, selectedTab);
    copy.textContent = firstDate
      ? `İlk kayıt ${formatLongDate(firstDate)} tarihinde.`
      : "Bu komite için kaynak programda kayıt bulunmuyor.";
    empty.append(icon, title, copy);
    elements.timeline.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  records.forEach((record) => fragment.append(createRecordCard(record)));
  elements.timeline.append(fragment);

  if (records.length < allRecords.length) {
    const note = document.createElement("p");
    note.className = "future-note";
    note.textContent = "Gelecek oturumlar tarihleri geldikçe bu akışa eklenecek.";
    elements.timeline.append(note);
  }
}

renderHeader();
renderTabs();
renderTimeline();
