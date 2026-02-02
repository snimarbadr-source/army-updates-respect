"use strict";

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = "army_ops_update_v3";

const LANES = [
  { id: "heli", title: "وحدات هيلي" },
  { id: "great_ocean", title: "وحدات نقاط قريت اوشن" },
  { id: "sandy", title: "وحدات نقاط ساندي" },
  { id: "paleto", title: "وحدات نقاط شلال بوليتو" },
];

/* ---------- 1. نظام السحب المتطور (Placeholder) ---------- */
let dragging = { cardId: null, fromLane: null };
let placeholder = document.createElement("div");
placeholder.className = "unit-placeholder"; // سنعرف شكله في الـ CSS بالأسفل

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
    body.dataset.laneId = lane.id;

    // --- أحداث السحب الحساسة للمكان ---
    body.ondragover = (e) => {
      e.preventDefault();
      body.classList.add("drag-over");
      
      // إظهار مكان الوحدة قبل الإفلات
      const afterElement = getDragAfterElement(body, e.clientY);
      if (afterElement == null) {
        body.appendChild(placeholder);
      } else {
        body.insertBefore(placeholder, afterElement);
      }
    };

    body.ondragleave = () => {
      body.classList.remove("drag-over");
      // لا نحذف الـ placeholder هنا ليبقى التلميح موجوداً طالما السحب مستمر
    };

    body.ondrop = (e) => {
      e.preventDefault();
      body.classList.remove("drag-over");
      placeholder.remove(); // حذف التلميح بعد الإفلات
      if (dragging.cardId) {
        moveCardAtPosition(dragging.cardId, dragging.fromLane, lane.id, placeholder);
      }
    };

    state.lanes[lane.id].forEach(card => body.appendChild(renderCard(lane.id, card)));
    laneEl.appendChild(body);
    board.appendChild(laneEl);
  }
}

// دالة لتحديد الترتيب (أين ستوضع الوحدة بالضبط)
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.unitCard:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* ---------- 2. تحريك الوحدة لمكانها الجديد ---------- */
function moveCardAtPosition(id, from, to, placeholderEl) {
  const fromLane = state.lanes[from];
  const toLane = state.lanes[to];
  const cardIdx = fromLane.findIndex(c => c.id === id);
  if (cardIdx === -1) return;

  const [card] = fromLane.splice(cardIdx, 1);
  
  // تحديد موضع الإنزال بناءً على مكان الـ Placeholder
  const body = document.querySelector(`.laneBody[data-lane-id="${to}"]`);
  const children = [...body.querySelectorAll('.unitCard')];
  const dropIdx = children.indexOf(placeholderEl);

  if (dropIdx === -1) toLane.push(card);
  else toLane.splice(dropIdx, 0, card);

  saveState();
  renderBoard();
  refreshFinalText(true);
  playSuccessEffect(to);
}

/* ---------- 3. التنسيق البصري (CSS التفاعلي) ---------- */
const style = document.createElement('style');
style.innerHTML = `
  .unit-placeholder {
    height: 40px;
    background: rgba(216, 178, 74, 0.2);
    border: 2px dashed var(--gold);
    border-radius: 8px;
    margin: 5px 0;
    pointer-events: none;
    transition: all 0.2s ease;
  }
  .laneBody.drag-over {
    background: rgba(216, 178, 74, 0.05) !important;
  }
  .unitCard.dragging {
    opacity: 0.3;
    transform: scale(0.95);
    border: 1px solid var(--gold);
  }
`;
document.head.appendChild(style);

/* ---------- 4. رسم البطاقة وتجهيز السحب ---------- */
function renderCard(laneId, card) {
  const el = document.createElement("div");
  el.className = "unitCard";
  el.draggable = true;
  el.innerHTML = `
    <div class="unitMain"><input class="unitInput" value="${card.text}"></div>
    <div class="unitBtns">
      <button class="iconBtn move-fast">⇄</button>
      <button class="iconBtn danger">×</button>
    </div>
  `;

  el.ondragstart = () => {
    dragging = { cardId: card.id, fromLane: laneId };
    el.classList.add("dragging");
    // إنشاء حجم الـ placeholder ليطابق حجم الكرت المسحوب
    placeholder.style.height = el.offsetHeight + "px";
  };

  el.ondragend = () => {
    el.classList.remove("dragging");
    placeholder.remove();
  };

  // ربط الأزرار والمدخلات
  const input = el.querySelector(".unitInput");
  input.oninput = () => { card.text = input.value; saveState(); refreshFinalText(); };
  el.querySelector(".move-fast").onclick = () => openQuickMove(card.id, laneId);
  el.querySelector(".danger").onclick = () => { 
    state.lanes[laneId] = state.lanes[laneId].filter(c => c.id !== card.id);
    saveState(); renderBoard(); refreshFinalText(true);
  };
  
  return el;
}

/* ---------- 5. بناء التقرير النهائي (تنسيق سنمار) ---------- */
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

  LANES.forEach(lane => {
    const units = state.lanes[lane.id].map(c => (c.text || "").trim()).filter(Boolean);
    lines.push(`| ${lane.title} |`);
    lines.push(units.join(", ") || "-");
    lines.push("");
  });

  lines.push("الملاحظات :");
  lines.push((f.notes || "").trim() || "-");
  lines.push("");
  lines.push(`وقت الاستلام : ${(f.recvTime || "").trim()}`);
  lines.push(`وقت التسليم : ${(f.handoverTime || "").trim()}`);
  lines.push(`تم التسليم إلى : ${(f.handoverTo || "").trim()}`);

  return lines.join("\n");
}

/* ---------- بقية وظائف النظام ---------- */
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

function playSuccessEffect(laneId) {
  const el = document.querySelector(`.lane[data-lane-id="${laneId}"]`);
  if (el) {
    el.classList.add("lane-active-effect");
    setTimeout(() => el.classList.remove("lane-active-effect"), 600);
  }
}

function refreshFinalText(force = false) {
  const ta = $("#finalText");
  if (ta && (force || document.activeElement !== ta)) ta.value = buildReportText();
}

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
      moveCardAtPosition(cardId, currentLaneId, lane.id, null);
      overlay.classList.remove("show");
    };
    grid.appendChild(btn);
  });
  overlay.classList.add("show");
}

function bindUI() {
  const fields = ["opsName", "opsDeputy", "leaders", "officers", "ncos", "periodOfficer", "notes", "handoverTo"];
  fields.forEach(f => {
    const el = $("#" + f);
    if (el) el.oninput = (e) => { state.form[f] = e.target.value; saveState(); refreshFinalText(); };
  });

  $("#btnStart").onclick = () => { state.form.recvTime = nowEnglish(); renderAll(); };
  $("#btnEnd").onclick = () => { state.form.handoverTime = nowEnglish(); renderAll(); };
  $("#btnCopyReport").onclick = async () => { await navigator.clipboard.writeText($("#finalText").value); toast("تم النسخ!"); };
  $("#btnReset").onclick = () => { if(confirm("إعادة ضبط؟")){ state = defaultState(); saveState(); renderAll(); } };
  $("#btnAddUnit").onclick = () => { state.lanes.heli.unshift({id: uid(), text: ""}); renderBoard(); };
  $("#btnAddExtracted").onclick = () => {
    const raw = $("#extractedList").value;
    const lines = raw.replace(/,/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
    lines.forEach(l => state.lanes.heli.push({id: uid(), text: l}));
    saveState(); renderBoard(); refreshFinalText(true);
  };
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
  bindUI(); renderAll();
  setTimeout(() => $("#intro")?.remove(), 3000);
});
