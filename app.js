/* Army Ops Update (Static)
  - Single form + 4-lane drag & drop board
  - Cinematic intro (4s)
  - Copy report + localStorage persistence
*/

"use strict";

const $ = (sel) => document.querySelector(sel);

// bump key to avoid UI mismatches with older stored state
const STORAGE_KEY = "army_ops_update_v3";

const LANES = [
  { id: "heli", title: "وحدات هيلي" },
  { id: "great_ocean", title: "وحدات نقاط قريت اوشن" },
  { id: "sandy", title: "وحدات نقاط ساندي" },
  { id: "paleto", title: "وحدات نقاط شلال بوليتو" },
];

function uid() {
  return (crypto?.randomUUID?.() || ("u_" + Math.random().toString(16).slice(2) + Date.now().toString(16)));
}

function nowEnglish() {
  const d = new Date();
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function normalizeTimeString(value) {
  const v = (value || "").trim();
  if (!v) return "";
  const m = v.match(/(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!m) return v;
  const hhmm = m[1];
  const ampm = m[2] ? ` ${m[2].toUpperCase()}` : "";
  return `${hhmm}${ampm}`.trim();
}

function dashList(text) {
  const arr = cleanLines(text);
  return arr.length ? arr.join(" - ") : "";
}

function cleanLines(text) {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeExtractLine(line) {
  let s = (line || "").trim();
  if (!s) return "";
  s = s.replace(/^[\-•\u2022\u25CF\u25A0\u25AA\u25E6]+\s*/g, "").replace(/\s*\|\s*/g, " ").replace(/\s{2,}/g, " ");
  s = s.replace(/\bالاسم\s*[:：]\s*/g, "").replace(/\bالكود\s*[:：]\s*/g, "").replace(/\s{2,}/g, " ").trim();
  return s;
}

function getSelectedLineFromTextarea(ta) {
  if (!ta) return "";
  const text = ta.value || "";
  const pos = ta.selectionStart ?? 0;
  const start = text.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  const end = text.indexOf("\n", pos);
  return text.substring(start, end === -1 ? text.length : end).trim();
}

function toast(msg, emphasis) {
  const el = $("#toast");
  if (!el) return;
  el.innerHTML = emphasis ? `<b>${emphasis}</b> — ${msg}` : msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2300);
}

/* ---------- Live preview (final report box) ---------- */
let _lastAutoFinal = "";
function refreshFinalText(force = false) {
  const ta = $("#finalText");
  if (!ta) return;
  const next = buildReportText();
  if (!force && document.activeElement === ta) return;
  if (!force && ta.value === next) return;
  ta.value = next;
  _lastAutoFinal = next;
}

function highlightLane(laneId) {
  const laneEl = document.querySelector(`.lane[data-lane-id="${laneId}"]`);
  if (!laneEl) return;
  laneEl.classList.add("laneFlash");
  try { laneEl.scrollIntoView({ behavior: "smooth", block: "center" }); } catch { laneEl.scrollIntoView(); }
  setTimeout(() => laneEl.classList.remove("laneFlash"), 1100);
}

function addExtractedLinesToLane(laneId) {
  const ta = $("#extractedList");
  const raw = ta?.value || "";
  const lines = cleanLines(raw).map(normalizeExtractLine).filter(Boolean);
  if (!lines.length) { toast("لا يوجد سطور لإضافتها.", "تنبيه"); return; }
  for (let i = lines.length - 1; i >= 0; i--) {
    state.lanes[laneId].unshift({ id: uid(), text: lines[i] });
  }
  saveState();
  renderBoard();
  refreshFinalText(true);
  highlightLane(laneId);
  toast(`تمت إضافة ${lines.length} عنصر.`, "إضافة");
}

function addSelectedLineToLane(laneId) {
  const ta = $("#extractedList");
  const line = normalizeExtractLine(getSelectedLineFromTextarea(ta));
  if (!line) { toast("حدد سطر داخل مربع النص أولاً.", "تنبيه"); return; }
  state.lanes[laneId].unshift({ id: uid(), text: line });
  saveState();
  renderBoard();
  refreshFinalText(true);
  highlightLane(laneId);
  toast("تمت إضافة السطر المحدد.", "إضافة");
}

function defaultState() {
  return {
    form: {
      opsName: "",
      opsDeputy: "",
      leaders: "",
      officers: "",
      ncos: "",
      periodOfficer: "",
      notes: "",
      recvTime: "",
      handoverTime: "",
      handoverTo: "",
    },
    lanes: {
      heli: [],
      great_ocean: [],
      sandy: [],
      paleto: [],
    },
    ui: { lastSelectedCardId: null, extractedList: "" },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.lanes) return defaultState();
    for (const lane of LANES) {
      if (!Array.isArray(parsed.lanes[lane.id])) parsed.lanes[lane.id] = [];
    }
    if (!parsed.form) parsed.form = defaultState().form;
    if (!parsed.ui) parsed.ui = defaultState().ui;
    parsed.form.recvTime = normalizeTimeString(parsed.form.recvTime);
    parsed.form.handoverTime = normalizeTimeString(parsed.form.handoverTime);
    return parsed;
  } catch { return defaultState(); }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

let state = loadState();

function setupIntro() {
  const intro = $("#intro");
  if (!intro) return;
  const hide = () => {
    intro.style.opacity = "0";
    setTimeout(() => (intro.style.display = "none"), 350);
  };
  intro.style.display = "flex";
  setTimeout(hide, 4000);
  intro.addEventListener("click", hide);
}

function bindForm() {
  const map = [
    ["opsName", "opsName"], ["opsDeputy", "opsDeputy"], ["leaders", "leaders"],
    ["officers", "officers"], ["ncos", "ncos"], ["periodOfficer", "periodOfficer"],
    ["notes", "notes"], ["recvTime", "recvTime"], ["handoverTime", "handoverTime"], ["handoverTo", "handoverTo"]
  ];
  for (const [id, key] of map) {
    const el = $("#" + id);
    if (!el) continue;
    el.value = state.form[key] ?? "";
    el.addEventListener("input", () => {
      state.form[key] = el.value;
      saveState();
      refreshFinalText();
    });
  }
  $("#btnStart")?.addEventListener("click", () => {
    const t = nowEnglish(); state.form.recvTime = t; $("#recvTime").value = t;
    saveState(); refreshFinalText(true); toast("تم تسجيل وقت الاستلام.", "بدء استلام");
  });
  $("#btnEnd")?.addEventListener("click", () => {
    const t = nowEnglish(); state.form.handoverTime = t; $("#handoverTime").value = t;
    saveState(); refreshFinalText(true); toast("تم تسجيل وقت التسليم.", "إنهاء استلام");
  });
}

let dragging = { cardId: null, fromLane: null };

function renderBoard() {
  const board = $("#board");
  if (!board) return;
  board.innerHTML = "";
  for (const lane of LANES) {
    const laneEl = document.createElement("div");
    laneEl.className = "lane";
    laneEl.dataset.laneId = lane.id;
    const head = document.createElement("div");
    head.className = "laneHeader";
    head.innerHTML = `<div class="laneTitle">${lane.title}</div><div class="laneHeaderRight"><div class="laneCount">${state.lanes[lane.id].length}</div></div>`;
    const body = document.createElement("div");
    body.className = "laneBody";
    body.dataset.laneId = lane.id;
    body.addEventListener("dragover", (e) => { e.preventDefault(); body.classList.add("dragOver"); });
    body.addEventListener("dragleave", () => body.classList.remove("dragOver"));
    body.addEventListener("drop", (e) => {
      e.preventDefault(); body.classList.remove("dragOver");
      if (dragging.cardId) moveCard(dragging.cardId, dragging.fromLane, lane.id);
    });
    for (const card of state.lanes[lane.id]) { body.appendChild(renderCard(lane.id, card)); }
    laneEl.appendChild(head);
    laneEl.appendChild(body);
    board.appendChild(laneEl);
  }
}

function renderCard(laneId, card) {
  const el = document.createElement("div");
  el.className = "unitCard";
  const handle = document.createElement("div");
  handle.className = "dragHandle";
  handle.setAttribute("draggable", "true");
  handle.innerHTML = `<div class="dots"></div>`;
  handle.addEventListener("dragstart", (e) => {
    dragging = { cardId: card.id, fromLane: laneId };
    e.dataTransfer.setData("text/plain", card.id);
  });
  const main = document.createElement("div");
  main.className = "unitMain";
  const input = document.createElement("input");
  input.className = "unitInput";
  input.value = card.text || "";
  input.addEventListener("input", () => { card.text = input.value; saveState(); refreshFinalText(); });
  main.appendChild(input);
  const delBtn = document.createElement("button");
  delBtn.className = "iconBtn danger";
  delBtn.textContent = "×";
  delBtn.onclick = () => { removeCard(card.id); toast("تم حذف الوحدة.", "حذف"); };
  el.appendChild(handle);
  el.appendChild(main);
  el.appendChild(delBtn);
  return el;
}

function findCard(cardId) {
  for (const lane of LANES) {
    const idx = state.lanes[lane.id].findIndex(c => c.id === cardId);
    if (idx !== -1) return { laneId: lane.id, idx, card: state.lanes[lane.id][idx] };
  }
}

function moveCard(cardId, fromLane, toLane) {
  if (fromLane === toLane) return;
  const found = findCard(cardId);
  if (!found) return;
  state.lanes[fromLane].splice(found.idx, 1);
  state.lanes[toLane].unshift(found.card);
  saveState(); renderBoard(); refreshFinalText(true);
}

function removeCard(cardId) {
  const found = findCard(cardId);
  if (found) { state.lanes[found.laneId].splice(found.idx, 1); saveState(); renderBoard(); refreshFinalText(true); }
}

function addUnit() {
  const card = { id: uid(), text: "" };
  state.lanes.heli.unshift(card);
  saveState(); renderBoard(); refreshFinalText(true);
}

function bindExtracted() {
  const ta = $("#extractedList");
  if (!ta) return;
  ta.value = state.ui.extractedList || "";
  ta.addEventListener("input", () => { state.ui.extractedList = ta.value; saveState(); });
  $("#btnAddExtracted")?.addEventListener("click", () => addExtractedLinesToLane("great_ocean"));
  $("#btnAddSelected")?.addEventListener("click", () => addSelectedLineToLane("great_ocean"));
}

/* ---------- التعديل النهائي المطلوب هنا ---------- */
function buildReportText() {
  const f = state.form;
  const lines = [];

  // 1. الرأسية (الاسم للجانب)
  lines.push(`اسم العمليات : ${(f.opsName || "").trim()}`);
  lines.push(`نائب العمليات : ${(f.opsDeputy || "").trim()}`);
  lines.push("");

  // 2. الرتب (تحت بعضها كما في طلبك)
  lines.push(`قيادات : ${dashList(f.leaders) || "-"}`);
  lines.push(`ضباط : ${dashList(f.officers) || "-"}`);
  lines.push(`ضباط صف : ${dashList(f.ncos) || "-"}`);
  lines.push("");

  // 3. المسؤول
  lines.push(`مسؤول الفتره : ${dashList(f.periodOfficer) || "-"}`);
  lines.push("");

  // 4. التوزيع (اسم النقطة سطر، والأكواد سطر جديد)
  lines.push("توزيع الوحدات :");
  lines.push("");

  for (const lane of LANES) {
    const units = state.lanes[lane.id].map(c => (c.text || "").trim()).filter(Boolean);
    const codesString = units.join(", ");
    
    lines.push(`| ${lane.title} |`); // عنوان القسم في سطر
    if (codesString) {
      lines.push(""); // مسافة بسيطة قبل الأكواد
      lines.push(codesString); // الأكواد في سطر جديد
    }
    lines.push(""); // سطر فارغ بين كل قسم
  }

  // 5. الملاحظات والوقت
  lines.push("الملاحظات :");
  lines.push((f.notes || "").trim());
  lines.push("");
  lines.push(`وقت الاستلام : ${(f.recvTime || "").trim()}`);
  lines.push(`وقت التسليم : ${(f.handoverTime || "").trim()}`);
  lines.push(`تم التسليم إلى : ${(f.handoverTo || "").trim()}`);

  return lines.join("\n");
}

async function copyReport() {
  const ta = $("#finalText");
  const text = ta.value || buildReportText();
  await navigator.clipboard.writeText(text);
  toast("تم نسخ التقرير للحافظة.", "نسخ");
}

function resetAll() {
  if (!confirm("متأكد؟ سيتم حذف البيانات وإعادة الضبط.")) return;
  state = defaultState(); saveState(); bindForm(); renderBoard(); refreshFinalText(true);
}

function bindUI() {
  $("#btnAddUnit")?.addEventListener("click", addUnit);
  $("#btnCopyReport")?.addEventListener("click", copyReport);
  $("#btnReset")?.addEventListener("click", resetAll);
}

document.addEventListener("DOMContentLoaded", () => {
  setupIntro(); bindForm(); bindUI(); bindExtracted(); renderBoard(); refreshFinalText(true);
});
