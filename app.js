"use strict";

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = "army_ops_update_v3";

const LANES = [
  { id: "heli", title: "وحدات هيلي" },
  { id: "great_ocean", title: "وحدات نقاط قريت اوشن" },
  { id: "sandy", title: "وحدات نقاط ساندي" },
  { id: "paleto", title: "وحدات نقاط شلال بوليتو" },
];

/* ---------- 1. معالجة النصوص المستخرجة ---------- */
function processInputToLines(rawText) {
  // فصل الأكواد سواء كانت بفاصلة أو سطر جديد
  return rawText
    .replace(/,/g, '\n') 
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

function addExtractedLinesToLane(laneId) {
  const ta = $("#extractedList");
  const raw = ta?.value || "";
  const lines = processInputToLines(raw).filter(Boolean);
  
  if (!lines.length) { toast("لا يوجد أكواد لإضافتها.", "تنبيه"); return; }
  
  lines.forEach(line => {
    state.lanes[laneId].push({ id: uid(), text: line });
  });
  
  saveState();
  renderBoard();
  refreshFinalText(true);
  playPulseEffect(laneId); // تأثير بصري
  toast(`تمت إضافة ${lines.length} وحدة.`, "نجاح");
}

/* ---------- 2. بناء التقرير النهائي (تنسيق سنمار) ---------- */
function buildReportText() {
  const f = state.form;
  const lines = [];

  lines.push(`اسم العمليات : ${(f.opsName || "").trim()}`);
  lines.push(`نائب العمليات : ${(f.opsDeputy || "").trim()}`);
  lines.push("");

  lines.push(`قيادات : ${dashList(f.leaders) || "-"}`);
  lines.push(`ضباط : ${dashList(f.officers) || "-"}`);
  lines.push(`ضباط صف : ${dashList(f.ncos) || "-"}`);
  lines.push("");
  lines.push(`مسؤول الفتره : ${dashList(f.periodOfficer) || "-"}`);
  lines.push("");

  lines.push("توزيع الوحدات :");
  lines.push("");

  for (const lane of LANES) {
    const units = state.lanes[lane.id].map(c => (c.text || "").trim()).filter(Boolean);
    const codesString = units.join(", ");
    
    lines.push(`| ${lane.title} |`); 
    lines.push(codesString || "-"); 
    lines.push(""); 
  }

  lines.push("الملاحظات :");
  lines.push((f.notes || "").trim() || "-");
  lines.push("");
  lines.push(`وقت الاستلام : ${(f.recvTime || "").trim()}`);
  lines.push(`وقت التسليم : ${(f.handoverTime || "").trim()}`);
  lines.push(`تم التسليم إلى : ${(f.handoverTo || "").trim()}`);

  return lines.join("\n");
}

/* ---------- 3. السحب والإفلات مع التأثير البصري ---------- */
function playPulseEffect(laneId) {
  const el = document.querySelector(`.lane[data-lane-id="${laneId}"]`);
  if (el) {
    el.style.boxShadow = "0 0 20px var(--gold)";
    el.style.transition = "box-shadow 0.3s ease";
    setTimeout(() => { el.style.boxShadow = "none"; }, 500);
  }
}

function moveCard(id, from, to) {
  if (from === to) return;
  const idx = state.lanes[from].findIndex(c => c.id === id);
  if (idx === -1) return;
  const [card] = state.lanes[from].splice(idx, 1);
  state.lanes[to].unshift(card);
  saveState();
  renderBoard();
  refreshFinalText(true);
  playPulseEffect(to); // تشغيل التنبيه البصري
}

/* ---------- 4. زر الاختصار (القائمة السريعة) ---------- */
function openQuickMove(cardId, currentLaneId) {
  const overlay = $("#sheetOverlay");
  const grid = $("#sheetGrid");
  if (!overlay || !grid) return;

  grid.innerHTML = "";
  LANES.forEach(lane => {
    const btn = document.createElement("button");
    btn.className = "primary";
    btn.textContent = lane.title;
    btn.onclick = () => {
      moveCard(cardId, currentLaneId, lane.id);
      overlay.classList.remove("show");
    };
    grid.appendChild(btn);
  });
  overlay.classList.add("show");
}

/* ---------- 5. رسم اللوحة والوحدات ---------- */
function renderCard(laneId, card) {
  const el = document.createElement("div");
  el.className = "unitCard";
  el.innerHTML = `
    <div class="dragHandle" draggable="true"><div class="dots"></div></div>
    <div class="unitMain"><input class="unitInput" value="${card.text}"></div>
    <div class="unitBtns">
      <button class="iconBtn move-fast" title="نقل سريع">⇄</button>
      <button class="iconBtn danger">×</button>
    </div>
  `;
  
  const input = el.querySelector(".unitInput");
  input.oninput = () => { card.text = input.value; saveState(); refreshFinalText(); };
  
  const handle = el.querySelector(".dragHandle");
  handle.ondragstart = () => { dragging = { cardId: card.id, fromLane: laneId }; };
  
  el.querySelector(".move-fast").onclick = () => openQuickMove(card.id, laneId);
  
  el.querySelector(".danger").onclick = () => { 
    state.lanes[laneId] = state.lanes[laneId].filter(c => c.id !== card.id);
    saveState(); renderBoard(); refreshFinalText(true);
  };
  return el;
}

function renderBoard() {
  const board = $("#board"); if (!board) return;
  board.innerHTML = "";
  for (const lane of LANES) {
    const laneEl = document.createElement("div");
    laneEl.className = "lane";
    laneEl.dataset.laneId = lane.id;
    laneEl.innerHTML = `<div class="laneHeader"><div class="laneTitle">${lane.title}</div><div class="laneCount">${state.lanes[lane.id].length}</div></div>`;
    const body = document.createElement("div");
    body.className = "laneBody";
    body.addEventListener("dragover", (e) => e.preventDefault());
    body.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragging.cardId) moveCard(dragging.cardId, dragging.fromLane, lane.id);
    });
    for (const card of state.lanes[lane.id]) { body.appendChild(renderCard(lane.id, card)); }
    laneEl.appendChild(body);
    board.appendChild(laneEl);
  }
}

/* ---------- وظائف أساسية ---------- */
let dragging = { cardId: null, fromLane: null };
function uid() { return (crypto?.randomUUID?.() || ("u_" + Math.random().toString(16).slice(2) + Date.now().toString(16))); }
function nowEnglish() { return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }); }
function dashList(t) { return (t || "").split("\n").map(s => s.trim()).filter(Boolean).join(" - "); }

function defaultState() {
  return {
    form: { opsName: "", opsDeputy: "", leaders: "", officers: "", ncos: "", periodOfficer: "", notes: "", recvTime: "", handoverTime: "", handoverTo: "" },
    lanes: { heli: [], great_ocean: [], sandy: [], paleto: [] }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultState();
  } catch { return defaultState(); }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
let state = loadState();

function refreshFinalText(force = false) {
  const ta = $("#finalText");
  if (ta && (force || document.activeElement !== ta)) ta.value = buildReportText();
}

function bindUI() {
  const fields = ["opsName", "opsDeputy", "leaders", "officers", "ncos", "periodOfficer", "notes", "handoverTo"];
  fields.forEach(f => {
    const el = $("#" + f);
    if (el) el.oninput = (e) => { state.form[f] = e.target.value; saveState(); refreshFinalText(); };
  });

  $("#btnStart").onclick = () => { state.form.recvTime = nowEnglish(); renderAll(); };
  $("#btnEnd").onclick = () => { state.form.handoverTime = nowEnglish(); renderAll(); };
  $("#btnCopyReport").onclick = async () => { await navigator.clipboard.writeText($("#finalText").value); toast("تم نسخ التقرير!"); };
  $("#btnReset").onclick = () => { if(confirm("حذف الكل؟")){ state = defaultState(); saveState(); renderAll(); } };
  $("#btnAddUnit").onclick = () => { state.lanes.heli.unshift({id: uid(), text: ""}); renderBoard(); };
  $("#btnAddExtracted").onclick = () => addExtractedLinesToLane("great_ocean");
  $("#sheetClose").onclick = () => $("#sheetOverlay").classList.remove("show");
}

function renderAll() {
  const fields = ["opsName", "opsDeputy", "leaders", "officers", "ncos", "periodOfficer", "notes", "handoverTo", "recvTime", "handoverTime"];
  fields.forEach(f => { if ($("#" + f)) $("#" + f).value = state.form[f] || ""; });
  renderBoard();
  refreshFinalText(true);
}

function toast(m) { const t = $("#toast"); if(t){ t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); } }

document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  renderAll();
  setTimeout(() => $("#intro")?.remove(), 3500);
});
