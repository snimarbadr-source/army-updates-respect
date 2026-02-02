/* Army Ops Update (Full Version)
  - الذكاء الاصطناعي في توزيع الوحدات (فصل تلقائي)
  - تأثير التلميح البصري (Placeholder) أثناء السحب
  - تنسيق التقرير النهائي حسب طلب سنمار
*/

"use strict";

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = "army_ops_update_v3_final";

const LANES = [
  { id: "heli", title: "وحدات هيلي" },
  { id: "great_ocean", title: "وحدات نقاط قريت اوشن" },
  { id: "sandy", title: "وحدات نقاط ساندي" },
  { id: "paleto", title: "وحدات نقاط شلال بوليتو" },
];

/* ---------- 1. معالجة النص المستخرج (الفصل الذكي) ---------- */
function processInputToUnits(rawText) {
  if (!rawText) return [];
  
  // استبدال الفواصل العربية والإنجليزية بمسافات لتوحيد المعالجة
  let cleanText = rawText.replace(/،/g, ' ').replace(/,/g, ' ');
  
  // التقسيم بناءً على: (مسافة واحدة أو أكثر) أو (سطر جديد)
  // هذا يضمن فصل الأكواد سواء كانت بالطول أو بالعرض
  return cleanText
    .split(/\s+/) 
    .map(s => s.trim())
    .filter(s => s.length > 0); 
}

function addExtractedLinesToLane(laneId) {
  const ta = $("#extractedList");
  const raw = ta?.value || "";
  const unitCodes = processInputToUnits(raw);
  
  if (unitCodes.length === 0) {
    toast("يرجى إدخال أكواد صحيحة", "تنبيه");
    return;
  }

  // إضافة كل كود كبطاقة مستقلة
  unitCodes.forEach(code => {
    state.lanes[laneId].push({ id: uid(), text: code });
  });

  saveState();
  renderBoard();
  refreshFinalText(true);
  playSuccessEffect(laneId);
  toast(`تم توزيع ${unitCodes.length} وحدة بشكل منفصل`, "نجاح");
  ta.value = ""; // مسح المربع بعد التوزيع لراحة المستخدم
}

/* ---------- 2. نظام السحب المتطور (المعاينة قبل الإفلات) ---------- */
let dragging = { cardId: null, fromLane: null };
const placeholder = document.createElement("div");
placeholder.className = "unit-placeholder";

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

    body.addEventListener("dragover", (e) => {
      e.preventDefault();
      body.classList.add("drag-over");
      const afterElement = getDragAfterElement(body, e.clientY);
      if (afterElement == null) body.appendChild(placeholder);
      else body.insertBefore(placeholder, afterElement);
    });

    body.addEventListener("drop", (e) => {
      e.preventDefault();
      body.classList.remove("drag-over");
      if (dragging.cardId) {
        const dropIndex = [...body.children].indexOf(placeholder);
        moveCardToPosition(dragging.cardId, dragging.fromLane, lane.id, dropIndex);
      }
      placeholder.remove();
    });

    state.lanes[lane.id].forEach(card => body.appendChild(renderCard(lane.id, card)));
    laneEl.appendChild(body);
    board.appendChild(laneEl);
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.unitCard:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
    else return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function moveCardToPosition(id, from, to, newIdx) {
  const fromLane = state.lanes[from];
  const toLane = state.lanes[to];
  const oldIdx = fromLane.findIndex(c => c.id === id);
  if (oldIdx === -1) return;
  const [card] = fromLane.splice(oldIdx, 1);
  if (newIdx === -1) toLane.push(card); else toLane.splice(newIdx, 0, card);
  saveState(); renderBoard(); refreshFinalText(true);
  playSuccessEffect(to);
}

/* ---------- 3. بناء التقرير النهائي (التنسيق المطلوب) ---------- */
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

/* ---------- 4. وظائف واجهة المستخدم ---------- */
function renderCard(laneId, card) {
  const el = document.createElement("div");
  el.className = "unitCard";
  el.draggable = true;
  el.innerHTML = `
    <div class="unitMain"><input class="unitInput" value="${card.text}"></div>
    <div class="unitBtns">
      <button class="iconBtn move-fast">⇄</button>
      <button class="iconBtn danger">×</button>
    </div>`;

  el.addEventListener("dragstart", () => {
    dragging = { cardId: card.id, fromLane: laneId };
    el.classList.add("dragging");
    placeholder.style.height = el.offsetHeight + "px";
  });
  el.addEventListener("dragend", () => { el.classList.remove("dragging"); placeholder.remove(); });
  
  el.querySelector(".unitInput").oninput = (e) => { card.text = e.target.value; saveState(); refreshFinalText(); };
  el.querySelector(".move-fast").onclick = () => openQuickMove(card.id, laneId);
  el.querySelector(".danger").onclick = () => { 
    state.lanes[laneId] = state.lanes[laneId].filter(c => c.id !== card.id);
    saveState(); renderBoard(); refreshFinalText(true);
  };
  return el;
}

function playSuccessEffect(laneId) {
  const el = document.querySelector(`.lane[data-lane-id="${laneId}"]`);
  if (el) { el.classList.add("lane-active-effect"); setTimeout(() => el.classList.remove("lane-active-effect"), 600); }
}

function uid() { return (crypto?.randomUUID?.() || ("u_" + Math.random().toString(16).slice(2) + Date.now().toString(16))); }
function nowEnglish() { return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }); }
function dashList(t) { return (t || "").split("\n").map(s => s.trim()).filter(Boolean).join(" - "); }

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : { form: {}, lanes: { heli: [], great_ocean: [], sandy: [], paleto: [] } };
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
  $("#btnCopyReport").onclick = async () => { await navigator.clipboard.writeText($("#finalText").value); toast("تم النسخ!"); };
  $("#btnAddExtracted").onclick = () => addExtractedLinesToLane("great_ocean");
  $("#sheetClose").onclick = () => $("#sheetOverlay").classList.remove("show");
  $("#btnReset").onclick = () => { if(confirm("حذف كل البيانات؟")){ state = loadState(); localStorage.clear(); location.reload(); }};
}

function renderAll() {
  const fields = ["opsName", "opsDeputy", "leaders", "officers", "ncos", "periodOfficer", "notes", "handoverTo", "recvTime", "handoverTime"];
  fields.forEach(f => { if ($("#" + f)) $("#" + f).value = state.form[f] || ""; });
  renderBoard(); refreshFinalText(true);
}

function openQuickMove(cardId, currentLaneId) {
  const overlay = $("#sheetOverlay");
  const grid = $("#sheetGrid");
  grid.innerHTML = "";
  LANES.forEach(lane => {
    const btn = document.createElement("button");
    btn.className = "primary"; btn.textContent = lane.title;
    btn.onclick = () => { moveCardToPosition(cardId, currentLaneId, lane.id, -1); overlay.classList.remove("show"); };
    grid.appendChild(btn);
  });
  overlay.classList.add("show");
}

function toast(m) { const t = $("#toast"); if(t){ t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); } }

// حقن التنسيقات الإضافية للـ Placeholder والتأثيرات
const style = document.createElement('style');
style.innerHTML = `
  .unit-placeholder { height: 44px; background: rgba(216, 178, 74, 0.15); border: 2px dashed var(--gold); border-radius: 8px; margin: 4px 0; pointer-events: none; }
  .unitCard.dragging { opacity: 0.2; transform: scale(0.98); }
  .laneBody.drag-over { background: rgba(216, 178, 74, 0.03); border-radius: 0 0 12px 12px; }
  .lane-active-effect { box-shadow: 0 0 20px var(--gold) !important; transition: box-shadow 0.3s ease; }
`;
document.head.appendChild(style);

document.addEventListener("DOMContentLoaded", () => {
  bindUI(); renderAll();
  setTimeout(() => $("#intro")?.remove(), 3000);
});
