"use strict";

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = "army_ops_update_v3";

const LANES = [
  { id: "heli", title: "وحدات هيلي" },
  { id: "great_ocean", title: "وحدات نقاط قريت اوشن" },
  { id: "sandy", title: "وحدات نقاط ساندي" },
  { id: "paleto", title: "وحدات نقاط شلال بوليتو" },
];

/* ---------- 1. معالجة النصوص المنفصلة ---------- */
function processInputToLines(rawText) {
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
  
  if (!lines.length) { toast("لا يوجد أكواد!", "تنبيه"); return; }
  
  lines.forEach(line => {
    state.lanes[laneId].push({ id: uid(), text: line });
  });
  
  saveState();
  renderBoard();
  refreshFinalText(true);
  playSuccessEffect(laneId); 
}

/* ---------- 2. التأثيرات البصرية (توهج وانزلاق) ---------- */
function playSuccessEffect(laneId) {
  const el = document.querySelector(`.lane[data-lane-id="${laneId}"]`);
  if (!el) return;
  
  // تأثير الوميض الذهبي
  el.classList.add("lane-active-effect");
  setTimeout(() => el.classList.remove("lane-active-effect"), 600);
}

// إضافة CSS للتأثيرات برمجياً لضمان عملها
const style = document.createElement('style');
style.innerHTML = `
  .lane-active-effect {
    box-shadow: 0 0 25px var(--gold) !important;
    border-color: var(--gold) !important;
    transform: scale(1.02);
    transition: all 0.3s ease;
  }
  .unitCard {
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
  .unitCard.dragging {
    opacity: 0.5;
    transform: scale(0.9);
  }
  .laneBody.drag-over {
    background: rgba(216, 178, 74, 0.1);
    border-radius: 8px;
  }
`;
document.head.appendChild(style);

/* ---------- 3. السحب والإفلات المطور ---------- */
let dragging = { cardId: null, fromLane: null };

function moveCard(id, from, to) {
  if (from === to) return;
  const idx = state.lanes[from].findIndex(c => c.id === id);
  if (idx === -1) return;
  
  const [card] = state.lanes[from].splice(idx, 1);
  state.lanes[to].unshift(card);
  
  saveState();
  renderBoard();
  refreshFinalText(true);
  playSuccessEffect(to); // تأثير عند وصول الوحدة
}

/* ---------- 4. بناء التقرير النهائي (تنسيق سنمار) ---------- */
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

/* ---------- 5. رسم العناصر مع أزرار الاختصار ---------- */
function renderCard(laneId, card) {
  const el = document.createElement("div");
  el.className = "unitCard";
  el.draggable = true; // جعل الكرت نفسه قابل للسحب
  
  el.innerHTML = `
    <div class="unitMain"><input class="unitInput" value="${card.text}"></div>
    <div class="unitBtns">
      <button class="iconBtn move-fast" title="نقل سريع">⇄</button>
      <button class="iconBtn danger">×</button>
    </div>
  `;
  
  // أحداث السحب
  el.ondragstart = () => { 
    dragging = { cardId: card.id, fromLane: laneId };
    el.classList.add("dragging");
  };
  el.ondragend = () => el.classList.remove("dragging");

  const input = el.querySelector(".unitInput");
  input.oninput = () => { card.text = input.value; saveState(); refreshFinalText(); };
  
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
    laneEl.innerHTML = `
      <div class="laneHeader">
        <div class="laneTitle">${lane.title}</div>
        <div class="laneCount">${state.lanes[lane.id].length}</div>
      </div>
    `;
    
    const body = document.createElement("div");
    body.className = "laneBody";
    
    // تأثيرات أثناء السحب فوق اللوحة
    body.ondragover = (e) => { e.preventDefault(); body.classList.add("drag-over"); };
    body.ondragleave = () => body.classList.remove("drag-over");
    
    body.ondrop = (e) => {
      e.preventDefault();
      body.classList.remove("drag-over");
      if (dragging.cardId) moveCard(dragging.cardId, dragging.fromLane, lane.id);
    };
    
    state.lanes[lane.id].forEach(card => body.appendChild(renderCard(lane.id, card)));
    laneEl.appendChild(body);
    board.appendChild(laneEl);
  }
}

/* ---------- 6. القائمة السريعة (الاختصارات) ---------- */
function openQuickMove(cardId, currentLaneId) {
  const overlay = $("#sheetOverlay");
  const grid = $("#sheetGrid");
  if (!overlay || !grid) return;

  grid.innerHTML = "";
  LANES.forEach(lane => {
    const btn = document.createElement("button");
    btn.className = lane.id === currentLaneId ? "secondary" : "primary";
    btn.textContent = lane.title;
    btn.onclick = () => {
      moveCard(cardId, currentLaneId, lane.id);
      overlay.classList.remove("show");
    };
    grid.appendChild(btn);
  });
  overlay.classList.add("show");
}

/* ---------- وظائف النظام الأساسية ---------- */
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
  $("#btnCopyReport").onclick = async () => { 
    await navigator.clipboard.writeText($("#finalText").value); 
    toast("تم النسخ بنجاح!"); 
  };
  $("#btnReset").onclick = () => { if(confirm("إعادة ضبط الكل؟")){ state = defaultState(); saveState(); renderAll(); } };
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

function toast(m) { 
  const t = $("#toast"); 
  if(t){ t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); } 
}

document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  renderAll();
  setTimeout(() => $("#intro")?.remove(), 3500);
});
