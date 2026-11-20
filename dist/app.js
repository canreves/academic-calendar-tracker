import { committees, schedule } from "./data/schedule.js";
import {
  GENERAL_TAB,
  allRecordsForTab,
  daysBetween,
  firstDateForTab,
  formatDay,
  formatLongDate,
  formatMonth,
  formatShortDate,
  getCommitteeState,
  getDepartments,
  getIstanbulToday,
  getProgress,
  isISODate,
  recordsForTab,
  selectCommittee,
} from "./lib/tracker.js";

const params = new URLSearchParams(window.location.search);
const requestedDate = params.get("date");
const today = isISODate(requestedDate) ? requestedDate : getIstanbulToday();
const committee = selectCommittee(committees, today);
const committeeState = getCommitteeState(committee, today);
const departments = getDepartments(schedule, committee.id);
const tabs = [GENERAL_TAB, ...departments];

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
  timeline: document.querySelector("#timeline"),
};

let selectedTab = GENERAL_TAB;

function statusContent() {
  if (committeeState === "upcoming") {
    const remaining = daysBetween(today, committee.startDate);
    return {
      label: "Yakında",
      message: `${remaining} gün sonra başlıyor. Şimdilik komitenin ders başlıklarını inceleyebilirsin.`,
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
    message: "Bugünün tarihi dahil, işlenen tüm konular aşağıda güncel olarak listeleniyor.",
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
  return tab === GENERAL_TAB ? "Genel" : tab;
}

function tabDescription(tab) {
  if (tab === GENERAL_TAB) {
    return "Sınavlar, tatiller, törenler ve serbest çalışma günleri.";
  }
  return `${tab} kapsamında bugüne kadar işlenen konular.`;
}

function renderTabs() {
  elements.departmentTabs.replaceChildren();
  elements.departmentTotal.textContent = `${departments.length} bölüm`;

  tabs.forEach((tab, index) => {
    const count = recordsForTab(schedule, committee.id, tab, today).length;
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
    badge.setAttribute("aria-label", `${count} işlenmiş kayıt`);
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
  selectedTab = tab;
  for (const button of elements.departmentTabs.querySelectorAll("[role='tab']")) {
    const selected = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
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

function createRecordCard(record) {
  const article = document.createElement("article");
  article.className = "timeline-item";
  article.dataset.type = record.type;

  const marker = document.createElement("span");
  marker.className = "timeline-marker";
  marker.setAttribute("aria-hidden", "true");

  const card = document.createElement("div");
  card.className = "lesson-card";

  const date = document.createElement("time");
  date.className = "lesson-date";
  date.dateTime = record.date;
  date.textContent = formatLongDate(record.date);

  if (record.type !== "course") {
    const kind = document.createElement("span");
    kind.className = "event-kind";
    kind.textContent = eventLabel(record.type);
    card.append(kind);
  }

  const title = document.createElement("h3");
  title.textContent = record.topic;
  card.append(date, title);

  if (record.type === "course") {
    const lecturer = document.createElement("p");
    lecturer.className = "lecturer";
    lecturer.innerHTML = `<span aria-hidden="true">ÖÜ</span><strong>${escapeHTML(record.lecturer || "Belirtilmemiş")}</strong>`;
    card.append(lecturer);
  }

  article.append(marker, card);
  return article;
}

function escapeHTML(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function renderTimeline() {
  const records = recordsForTab(schedule, committee.id, selectedTab, today);
  const allRecords = allRecordsForTab(schedule, committee.id, selectedTab);

  elements.timelineKicker.textContent = `${committee.id} · ${tabName(selectedTab)}`;
  elements.timelineTitle.textContent = tabName(selectedTab);
  elements.timelineDescription.textContent = tabDescription(selectedTab);
  elements.resultCount.textContent = records.length ? `${records.length} kayıt` : "Henüz kayıt yok";
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
    const firstDate = firstDateForTab(schedule, committee.id, selectedTab);
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
