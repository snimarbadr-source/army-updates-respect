/* تحديث مركز العمليات - النسخة العسكرية الاحترافية (سنمار V6)
  المميزات الجديدة:
  - أنيميشن "نبض الرادار" و "مسح الليزر" بجانب العناوين.
  - إصلاح زر إضافة وحدة (+) وتوزيع الأكواد المنفصل.
  - تأثير Placeholder ومعاينة عند السحب.
  - نظام إخفاء الانترو الذكي.
*/

"use strict";

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = "army_ops_final_v6";

const LANES = [
  { id: "heli", title: "وحدات هيلي" },
  { id: "great_ocean", title: "وحدات نقاط قريت اوشن" },
  { id: "sandy", title: "وحدات نقاط ساندي" },
  { id: "paleto", title: "وحدات نقاط شلال بوليتو" },
];

/* ---------- 1. نظام البيانات ---------- */
let state = loadState();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : { 
    form: { opsName: "", opsDeputy: "", leaders: "", officers: "", ncos: "", periodOfficer: "", notes: "", handoverTo: "", recvTime: "", handoverTime: "" }, 
    lanes: { heli: [], great_ocean: [], sandy: [], paleto: [] } 
  };
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

/* ---------- 2. إضافة الوحدات (فصل ذكي) ---------- */
function addUnit() {
  state.lanes.heli.unshift({ id: uid(), text: "" });
  saveState(); renderBoard(); refreshFinalText(true);
  toast("تمت إضافة وحدة فارغة", "إضافة");
}

function processInputToUnits(rawText) {
  if (!rawText) return [];
  let cleanText = rawText.replace(/،/g, ' ').replace(/,/g, ' ');
  return cleanText.split(/\s+/).map(s => s.trim()).filter(s => s.length > 0);
}

function addExtractedLinesToLane(laneId) {
  const ta = $("#extractedList");
  const unitCodes = processInputToUnits(ta?.value || "");
  if (!unitCodes.length) { toast("لا توجد أكواد!", "تنبيه"); return; }
  unitCodes.forEach(code => state.lanes[laneId].push({ id: uid(), text: code }));
  saveState(); renderBoard(); refreshFinalText(true);
  playSuccessEffect(laneId);
  ta.value = ""; 
  toast(`تم توزيع ${unitCodes.length} وحدة`, "توزيع");
}

/* ---------- 3. السحب والإفلات ومعاينة الموقع ---------- */
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
    // إضافة أيقونة الرادار المتحركة بجانب العنوان
    laneEl.innerHTML = `
      <div class="laneHeader">
        <div class="radar-container"><div class="radar-dot"></div><div class="radar-pulse"></div></div>
        <div class="laneTitle">${lane.title}</div>
        <div class="laneCount">${state.lanes[lane.id].length}</div>
      </div>
    `;
    
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
  const fromLane = state.lanes[from], toLane = state.lanes[to];
  const oldIdx = fromLane.findIndex(c => c.id === id);
  if (oldIdx === -1) return;
  const [card] = fromLane.splice(oldIdx, 1);
  if (newIdx === -1) toLane.push(card); else toLane.splice(newIdx, 0, card);
  saveState(); renderBoard(); refreshFinalText(true);
  playSuccessEffect(to);
}

/* ---------- 4. التقرير والواجهة ---------- */
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

function buildReportText() {
  const f = state.form;
  const lines = [`اسم العمليات : ${(f.opsName || "").trim()}`, `نائب العمليات : ${(f.opsDeputy || "").trim()}`, "", `قيادات : ${dashList(f.leaders) || "-"}`, `ضباط : ${dashList(f.officers) || "-"}`, `ضباط صف : ${dashList(f.ncos) || "-"}`, "", `مسؤول الفتره : ${dashList(f.periodOfficer) || "-"}`, "", "توزيع الوحدات :", ""];
  LANES.forEach(lane => {
    const units = state.lanes[lane.id].map(c => (c.text || "").trim()).filter(Boolean);
    lines.push(`| ${lane.title} |`);
    lines.push(units.join(", ") || "-");
    lines.push("");
  });
  lines.push("الملاحظات :", (f.notes || "").trim() || "-", "", `وقت الاستلام : ${(f.recvTime || "").trim()}`, `وقت التسليم : ${(f.handoverTime || "").trim()}`, `تم التسليم إلى : ${(f.handoverTo || "").trim()}`);
  return lines.join("\n");
}

/* ---------- 5. الأنيميشن العسكري (CSS Injection) ---------- */
const militaryStyle = document.createElement('style');
militaryStyle.innerHTML = `
  /* أنيميشن الرادار بجانب العناوين */
  .radar-container { position: relative; width: 20px; height: 20px; margin-left: 10px; display: flex; align-items: center; justify-content: center; }
  .radar-dot { width: 6px; height: 6px; background: var(--gold); border-radius: 50%; z-index: 2; }
  .radar-pulse { 
    position: absolute; width: 100%; height: 100%; border: 2px solid var(--gold); 
    border-radius: 50%; animation: radar-beam 2s infinite linear; opacity: 0; 
  }
  @keyframes radar-beam {
    0% { transform: scale(0.5); opacity: 1; }
    100% { transform: scale(2.5); opacity: 0; }
  }

  /* أنيميشن مسح الليزر على العنوان */
  .laneHeader { position: relative; overflow: hidden; }
  .laneHeader::after {
    content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(216, 178, 74, 0.2), transparent);
    animation: laser-scan 4s infinite;
  }
  @keyframes laser-scan {
    0% { left: -100%; }
    100% { left: 150%; }
  }

  .unit-placeholder { height: 44px; background: rgba(216, 178, 74, 0.1); border: 2px dashed var(--gold); border-radius: 8px; margin: 4px 0; }
  .lane-active-effect { box-shadow: 0 0 20px var(--gold) !important; transition: 0.3s; }
  .unitCard.dragging { opacity: 0.1; }
`;
document.head.appendChild(militaryStyle);

/* ---------- 6. ربط الـ UI والتشغيل ---------- */
function bindUI() {
  const fields = ["opsName", "opsDeputy", "leaders", "officers", "ncos", "periodOfficer", "notes", "handoverTo"];
  fields.forEach(f => { if ($("#" + f)) $("#" + f).oninput = (e) => { state.form[f] = e.target.value; saveState(); refreshFinalText(); }; });
  
  $("#btnAddUnit")?.addEventListener("click", addUnit);
  $("#btnStart")?.addEventListener("click", () => { state.form.recvTime = nowEnglish(); renderAll(); });
  $("#btnEnd")?.addEventListener("click", () => { state.form.handoverTime = nowEnglish(); renderAll(); });
  $("#btnCopyReport")?.addEventListener("click", async () => { await navigator.clipboard.writeText($("#finalText").value); toast("تم نسخ التقرير!"); });
  $("#btnAddExtracted")?.addEventListener("click", () => addExtractedLinesToLane("great_ocean"));
  $("#sheetClose")?.addEventListener("click", () => $("#sheetOverlay").classList.remove("show"));
  $("#btnReset")?.addEventListener("click", () => { if(confirm("حذف البيانات؟")){ localStorage.removeItem(STORAGE_KEY); location.reload(); }});
}

function renderAll() {
  const fields = ["opsName", "opsDeputy", "leaders", "officers", "ncos", "periodOfficer", "notes", "handoverTo", "recvTime", "handoverTime"];
  fields.forEach(f => { if ($("#" + f)) $("#" + f).value = state.form[f] || ""; });
  renderBoard(); refreshFinalText(true);
}

function openQuickMove(cardId, currentLaneId) {
  const overlay = $("#sheetOverlay"), grid = $("#sheetGrid");
  grid.innerHTML = "";
  LANES.forEach(lane => {
    const btn = document.createElement("button"); btn.className = "primary"; btn.textContent = lane.title;
    btn.onclick = () => { moveCardToPosition(cardId, currentLaneId, lane.id, -1); overlay.classList.remove("show"); };
    grid.appendChild(btn);
  });
  overlay.classList.add("show");
}

function uid() { return (crypto?.randomUUID?.() || ("u_" + Math.random().toString(16).slice(2) + Date.now().toString(16))); }
function nowEnglish() { return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }); }
function dashList(t) { return (t || "").split("\n").map(s => s.trim()).filter(Boolean).join(" - "); }
function toast(m) { const t = $("#toast"); if(t){ t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); } }
function playSuccessEffect(laneId) {
  const el = document.querySelector(`.lane[data-lane-id="${laneId}"]`);
  if (el) { el.classList.add("lane-active-effect"); setTimeout(() => el.classList.remove("lane-active-effect"), 600); }
}
function refreshFinalText(force = false) {
  const ta = $("#finalText"); if (ta && (force || document.activeElement !== ta)) ta.value = buildReportText();
}

document.addEventListener("DOMContentLoaded", () => {
  bindUI(); renderAll();
  const intro = $("#intro");
  if (intro) {
    setTimeout(() => { intro.style.opacity = "0"; setTimeout(() => intro.remove(), 800); }, 3000);
    intro.onclick = () => intro.remove();
  }
});
