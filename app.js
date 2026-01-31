/* 
  Army Ops Update (Static)
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
  // English time only (no date)
  const d = new Date();
  // Example: 12:34 PM
  return d.toLocaleTimeString("en-US", {
    // "numeric" avoids leading zero (e.g., 1:05 PM)
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function normalizeTimeString(value) {
  const v = (value || "").trim();
  if (!v) return "";
  // Older versions stored date+time like: 01/15/2026, 12:34:56 PM
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

  // remove common labels / separators from OCR outputs
  s = s
    .replace(/^[\-•\u2022\u25CF\u25A0\u25AA\u25E6]+\s*/g, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s{2,}/g, " ");

  // strip Arabic labels if they appear in the line
  s = s
    .replace(/\bالاسم\s*[:：]\s*/g, "")
    .replace(/\bالكود\s*[:：]\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

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
  // don't overwrite while the user is editing the box
  if (!force && document.activeElement === ta) return;
  // avoid flicker if already identical
  if (!force && ta.value === next) return;
  ta.value = next;
  _lastAutoFinal = next;
}

/* ---------- Extracted list -> board ---------- */
function highlightLane(laneId) {
  const laneEl = document.querySelector(`.lane[data-lane-id="${laneId}"]`);
  if (!laneEl) return;
  laneEl.classList.add("laneFlash");
  try {
    laneEl.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    laneEl.scrollIntoView();
  }
  setTimeout(() => laneEl.classList.remove("laneFlash"), 1100);
}

function addExtractedLinesToLane(laneId) {
  const ta = $("#extractedList");
  const raw = ta?.value || "";
  const lines = cleanLines(raw).map(normalizeExtractLine).filter(Boolean);
  if (!lines.length) {
    toast("لا يوجد سطور لإضافتها.", "تنبيه");
    return;
  }
  // add in reverse so the first line ends up on top
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
  if (!line) {
    toast("حدد سطر داخل مربع النص أولاً.", "تنبيه");
    return;
  }
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
      heli: [
        { id: uid(), text: "وحدة 1" },
        { id: uid(), text: "وحدة 2" },
      ],
      great_ocean: [],
      sandy: [],
      paleto: [],
    },
    ui: {
      lastSelectedCardId: null,
      extractedList: "",
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // basic shape validation
    if (!parsed || typeof parsed !== "object") return defaultState();
    if (!parsed.lanes) return defaultState();
    // ensure lanes exist
    for (const lane of LANES) {
      if (!Array.isArray(parsed.lanes[lane.id])) parsed.lanes[lane.id] = [];
    }
    if (!parsed.form) parsed.form = defaultState().form;

    if (!parsed.ui || typeof parsed.ui !== "object") parsed.ui = defaultState().ui;
    if (typeof parsed.ui.extractedList !== "string") parsed.ui.extractedList = "";
    if (!parsed.ui) parsed.ui = defaultState().ui;
    if (typeof parsed.ui.extractedList !== "string") parsed.ui.extractedList = "";

    // migrate older stored timestamps -> time-only
    parsed.form.recvTime = normalizeTimeString(parsed.form.recvTime);
    parsed.form.handoverTime = normalizeTimeString(parsed.form.handoverTime);

    return parsed;
  } catch {
    return defaultState();
  }
}

/* ---------- Extracted list helpers ---------- */
function normalizeLine(line) {
  let s = (line || "").trim();
  if (!s) return "";

  // Remove common labels that appear in OCR outputs
  s = s
    .replace(/^(?:الاسم\s*:?\s*)/i, "")
    .replace(/^(?:الكود\s*:?\s*)/i, "")
    .replace(/اسم\s*:?\s*/g, "")
    .replace(/كود\s*:?\s*/g, "");

  // Convert "name | code" => "name code"
  s = s.replace(/\s*\|\s*/g, " ");

  // Trim extra symbols
  s = s.replace(/^[-•]+\s*/, "");

  // Collapse spaces
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function extractedToCards(text) {
  const lines = cleanLines(text).map(normalizeLine).filter(Boolean);
  // de-duplicate while preserving order
  const seen = new Set();
  const out = [];
  for (const l of lines) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

function getCurrentLineFromTextarea(textarea) {
  const v = textarea.value || "";
  const pos = textarea.selectionStart ?? 0;
  const start = v.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  const end = v.indexOf("\n", pos);
  const line = v.slice(start, end === -1 ? v.length : end);
  return line;
}

function flashAndScrollToGreatOcean() {
  const laneEl = document.querySelector('.lane[data-lane-id="great_ocean"]');
  if (!laneEl) return;
  laneEl.scrollIntoView({ behavior: "smooth", block: "center" });
  laneEl.classList.add("pulse");
  setTimeout(() => laneEl.classList.remove("pulse"), 650);
}

/* ---------- Final text preview ---------- */
let lastAutoFinal = "";

function updateFinalText(force = false) {
  const ta = $("#finalText");
  if (!ta) return;
  const next = buildReportText();
  const active = document.activeElement === ta;
  if (force || (!active && (ta.value === "" || ta.value === lastAutoFinal))) {
    ta.value = next;
    lastAutoFinal = next;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

let state = loadState();

/* ---------- Intro ---------- */
function setupIntro() {
  const intro = $("#intro");
  const introCard = $("#introCard");
  if (!intro || !introCard) return;

  const hide = () => {
    intro.style.opacity = "0";
    intro.style.transition = "opacity .35s ease";
    setTimeout(() => (intro.style.display = "none"), 350);
  };

  // Always show on load, auto-hide after 4s
  intro.style.display = "flex";
  setTimeout(hide, 4000);

  intro.addEventListener("click", hide);
  introCard.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "Escape") hide();
  });
}

/* ---------- Form bindings ---------- */
function bindForm() {
  const map = [
    ["opsName", "opsName"],
    ["opsDeputy", "opsDeputy"],
    ["leaders", "leaders"],
    ["officers", "officers"],
    ["ncos", "ncos"],
    ["periodOfficer", "periodOfficer"],
    ["notes", "notes"],
    ["recvTime", "recvTime"],
    ["handoverTime", "handoverTime"],
    ["handoverTo", "handoverTo"],
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
    const t = nowEnglish();
    state.form.recvTime = t;
    $("#recvTime").value = t;
    saveState();
    refreshFinalText(true);
    toast("تم تسجيل وقت الاستلام.", "بدء استلام");
  });

  $("#btnEnd")?.addEventListener("click", () => {
    const t = nowEnglish();
    state.form.handoverTime = t;
    $("#handoverTime").value = t;
    saveState();
    refreshFinalText(true);
    toast("تم تسجيل وقت التسليم.", "إنهاء استلام");
  });
}

/* ---------- Board rendering ---------- */
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

    const title = document.createElement("div");
    title.className = "laneTitle";
    title.textContent = lane.title;

    const right = document.createElement("div");
    right.className = "laneHeaderRight";

    const count = document.createElement("div");
    count.className = "laneCount";
    count.textContent = `${state.lanes[lane.id].length}`;

    const menu = document.createElement("div");
    menu.className = "laneMenu";
    menu.textContent = "···";

    right.appendChild(count);
    right.appendChild(menu);

    head.appendChild(title);
    head.appendChild(right);

    const body = document.createElement("div");
    body.className = "laneBody";
    body.dataset.laneId = lane.id;

    // DnD events
    body.addEventListener("dragover", (e) => {
      e.preventDefault();
      body.classList.add("dragOver");
    });
    body.addEventListener("dragleave", () => body.classList.remove("dragOver"));
    body.addEventListener("drop", (e) => {
      e.preventDefault();
      body.classList.remove("dragOver");
      const toLaneId = body.dataset.laneId;
      if (!dragging.cardId || !dragging.fromLane || !toLaneId) return;
      moveCard(dragging.cardId, dragging.fromLane, toLaneId);
      dragging = { cardId: null, fromLane: null };
    });

    for (const card of state.lanes[lane.id]) {
      body.appendChild(renderCard(lane.id, card));
    }

    laneEl.appendChild(head);
    laneEl.appendChild(body);
    board.appendChild(laneEl);
  }
}

function renderCard(laneId, card) {
  const el = document.createElement("div");
  el.className = "unitCard";
  el.dataset.cardId = card.id;
  el.dataset.laneId = laneId;

  const handle = document.createElement("div");
  handle.className = "dragHandle";
  handle.setAttribute("draggable", "true");
  handle.title = "سحب";
  const dots = document.createElement("div");
  dots.className = "dots";
  handle.appendChild(dots);

  handle.addEventListener("dragstart", (e) => {
    dragging = { cardId: card.id, fromLane: laneId };
    e.dataTransfer?.setData("text/plain", card.id);
    e.dataTransfer?.setDragImage(el, 20, 20);
  });

  const main = document.createElement("div");
  main.className = "unitMain";

  const input = document.createElement("input");
  input.className = "unitInput";
  input.type = "text";
  input.placeholder = "اسم الوحدة...";
  input.value = card.text || "";
  input.addEventListener("input", () => {
    card.text = input.value;
    saveState();
    refreshFinalText();
  });

  main.appendChild(input);

  const btns = document.createElement("div");
  btns.className = "unitBtns";

  const moveBtn = document.createElement("button");
  moveBtn.className = "iconBtn";
  moveBtn.type = "button";
  moveBtn.title = "نقل";
  moveBtn.textContent = "⇄";
  moveBtn.addEventListener("click", () => openMoveSheet(card.id));

  const delBtn = document.createElement("button");
  delBtn.className = "iconBtn danger";
  delBtn.type = "button";
  delBtn.title = "حذف";
  delBtn.textContent = "×";
  delBtn.addEventListener("click", () => {
    removeCard(card.id);
    toast("تم حذف الوحدة.", "حذف");
  });

  btns.appendChild(moveBtn);
  btns.appendChild(delBtn);

  // quick select for mobile: tap card background (not input)
  el.addEventListener("click", (e) => {
    const isInput = e.target === input;
    const isBtn = e.target === delBtn || e.target === moveBtn;
    if (isInput || isBtn) return;
    openMoveSheet(card.id);
  });

  el.appendChild(handle);
  el.appendChild(main);
  el.appendChild(btns);
  return el;
}

function findCard(cardId) {
  for (const lane of LANES) {
    const arr = state.lanes[lane.id];
    const idx = arr.findIndex((c) => c.id === cardId);
    if (idx !== -1) return { laneId: lane.id, idx, card: arr[idx] };
  }
  return null;
}

function moveCard(cardId, fromLane, toLane) {
  if (fromLane === toLane) return;
  const fromArr = state.lanes[fromLane];
  const toArr = state.lanes[toLane];
  if (!fromArr || !toArr) return;
  const idx = fromArr.findIndex((c) => c.id === cardId);
  if (idx === -1) return;
  const [card] = fromArr.splice(idx, 1);
  toArr.unshift(card);
  saveState();
  renderBoard();
  refreshFinalText(true);
  toast("تم نقل الوحدة.", "نقل");
}

function removeCard(cardId) {
  const found = findCard(cardId);
  if (!found) return;
  state.lanes[found.laneId].splice(found.idx, 1);
  saveState();
  renderBoard();
  refreshFinalText(true);
}

function addUnit() {
  const card = { id: uid(), text: "" };
  state.lanes.heli.unshift(card);
  saveState();
  renderBoard();
  refreshFinalText(true);
  // focus new input
  requestAnimationFrame(() => {
    document.querySelector(`[data-card-id="${card.id}"] .unitInput`)?.focus();
  });
  toast("تمت إضافة وحدة جديدة في وحدات الهلي.", "إضافة");
}

/* ---------- Move Sheet ---------- */
function openMoveSheet(cardId) {
  const overlay = $("#sheetOverlay");
  const grid = $("#sheetGrid");
  if (!overlay || !grid) return;
  const found = findCard(cardId);
  if (!found) return;

  state.ui.lastSelectedCardId = cardId;
  saveState();

  grid.innerHTML = "";
  for (const lane of LANES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "primary";
    b.textContent = lane.title;
    b.addEventListener("click", () => {
      moveCard(cardId, found.laneId, lane.id);
      closeMoveSheet();
    });
    grid.appendChild(b);
  }

  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
}

function closeMoveSheet() {
  const overlay = $("#sheetOverlay");
  if (!overlay) return;
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden", "true");
}

function bindSheet() {
  $("#sheetClose")?.addEventListener("click", closeMoveSheet);
  $("#sheetOverlay")?.addEventListener("click", (e) => {
    if (e.target?.id === "sheetOverlay") closeMoveSheet();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMoveSheet();
  });
}

/* ---------- Extracted box bindings ---------- */
function bindExtracted() {
  const ta = $("#extractedList");
  if (!ta) return;
  ta.value = state.ui.extractedList || "";
  ta.addEventListener("input", () => {
    state.ui.extractedList = ta.value;
    saveState();
  });

  // User request: "إضافة الكل إلى اللوحة" should move directly to Great Ocean
  $("#btnAddExtracted")?.addEventListener("click", () => addExtractedLinesToLane("great_ocean"));
  $("#btnAddSelected")?.addEventListener("click", () => addSelectedLineToLane("great_ocean"));
}

/* ---------- Report ---------- */
function buildReportText() {
  const f = state.form;

  const lines = [];
  // Match the requested copy format
  lines.push(`اسم العمليات : ${(f.opsName || "").trim()}`);
  lines.push(`نائب العمليات : ${(f.opsDeputy || "").trim()}`);
  lines.push("");

  lines.push("قيادات");
  lines.push(dashList(f.leaders));
  lines.push("ضباط");
  lines.push(dashList(f.officers));
  lines.push("");

  lines.push("ضباط صف");
  lines.push(dashList(f.ncos));
  lines.push("");

  lines.push("مسؤول الفتره");
  lines.push(dashList(f.periodOfficer));
  lines.push("");

  lines.push("توزيع الوحدات :");
  lines.push("");

  for (const lane of LANES) {
    const arr = state.lanes[lane.id];
    const names = arr.map((c) => (c.text || "").trim()).filter(Boolean);
    lines.push(`| ${lane.title} |`);
    if (names.length) {
      for (const n of names) lines.push(n);
    }
    lines.push("");
  }

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
  const text = (ta?.value || "").trim() ? ta.value : buildReportText();
  try {
    await navigator.clipboard.writeText(text);
    toast("تم نسخ التقرير للحافظة.", "نسخ");
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove();
    toast("تم نسخ التقرير للحافظة.", "نسخ");
  }
}

/* ---------- Reset ---------- */
function resetAll() {
  const ok = confirm("متأكد؟ سيتم حذف البيانات المحفوظة وإعادة الضبط.");
  if (!ok) return;
  state = defaultState();
  saveState();
  bindForm(); // re-fill
  renderBoard();
  toast("تمت إعادة التعيين.", "Reset");
}

/* ---------- Bind UI ---------- */
function bindUI() {
  $("#btnAddUnit")?.addEventListener("click", addUnit);
  $("#btnCopyReport")?.addEventListener("click", copyReport);
  $("#btnReset")?.addEventListener("click", resetAll);
}

/* ---------- Init ---------- */
function init() {
  setupIntro();
  bindForm();
  bindUI();
  bindSheet();
  bindExtracted();
  renderBoard();
  refreshFinalText(true);
}

document.addEventListener("DOMContentLoaded", init);
