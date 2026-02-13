/* تحديث مركز عمليات الجيش - الإصدار 2.0
   - نظام توزيع الوحدات العسكرية
   - Sandy State Army Military Unit
*/

"use strict";

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = "army_ops_v2_complete";

// النقاط المحدثة - 7 نقاط
const LANES = [
  { id: "hotel_top", title: "نقاط وحدات اعلى الاوتيل" },
  { id: "paleto", title: "نقاط وحدات بوليتو" },
  { id: "los", title: "نقاط وحدات لوس" },
  { id: "sandy", title: "نقاط وحدات ساندي" },
  { id: "electric", title: "نقاط وحدات الكهرب" },
  { id: "crabside", title: "نقاط وحدات ثغرة قرابسيد" },
  { id: "lake", title: "نقاط وحدات ثغرة البحيرة" }
];

/* ---------- 1. إدارة البيانات ---------- */
let state = loadState();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  
  // الحالة الافتراضية
  const initialState = {
    form: { 
      opsName: "", 
      opsDeputy: "", 
      leaders: "", 
      officers: "", 
      ncos: "", 
      periodOfficer: "", 
      notes: "", 
      handoverTo: "", 
      recvTime: "", 
      handoverTime: "" 
    },
    lanes: {}
  };
  LANES.forEach(l => initialState.lanes[l.id] = []);
  return initialState;
}

function saveState() { 
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); 
}

/* ---------- 2. التوزيع والوحدات ---------- */
function addUnit() {
  const firstLane = LANES[0].id;
  state.lanes[firstLane].unshift({ id: uid(), text: "" });
  saveState(); 
  renderBoard(); 
  refreshFinalText(true);
  toast("تمت إضافة وحدة فارغة");
}

function processInputToUnits(rawText) {
  if (!rawText) return [];
  let cleanText = rawText.replace(/،/g, ' ').replace(/,/g, ' ');
  return cleanText.split(/\s+/).map(s => s.trim()).filter(s => s.length > 0);
}

function addExtractedLinesToLane(laneId) {
  const ta = $("#extractedList");
  const unitCodes = processInputToUnits(ta?.value || "");
  if (!unitCodes.length) return;
  unitCodes.forEach(code => state.lanes[laneId].push({ id: uid(), text: code }));
  saveState(); 
  renderBoard(); 
  refreshFinalText(true);
  playSuccessEffect(laneId);
  ta.value = ""; 
  toast(`تم توزيع ${unitCodes.length} وحدة`);
}

/* ---------- 3. السحب والإفلات واللوحة ---------- */
let dragging = { cardId: null, fromLane: null };
const placeholder = document.createElement("div");
placeholder.className = "unit-placeholder";
placeholder.style.cssText = "height: 44px; background: rgba(212, 175, 55, 0.1); border: 2px dashed #d4af37; border-radius: 8px; margin: 5px 0;";

function renderBoard() {
  const board = $("#board"); 
  if (!board) return;
  board.innerHTML = "";
  
  for (const lane of LANES) {
    const laneEl = document.createElement("div");
    laneEl.className = "lane";
    laneEl.dataset.laneId = lane.id;
    laneEl.innerHTML = `
      <div class="lane-header">
        <div class="lane-title">
          <div class="lane-radar"></div>
          <span>${lane.title}</span>
        </div>
        <div class="lane-count">${state.lanes[lane.id]?.length || 0}</div>
      </div>
    `;
    
    const body = document.createElement("div");
    body.className = "lane-body";
    body.dataset.laneId = lane.id;

    body.addEventListener("dragover", (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(body, e.clientY);
      if (afterElement == null) body.appendChild(placeholder);
      else body.insertBefore(placeholder, afterElement);
    });

    body.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragging.cardId) {
        const dropIndex = [...body.children].indexOf(placeholder);
        moveCardToPosition(dragging.cardId, dragging.fromLane, lane.id, dropIndex);
      }
      placeholder.remove();
    });

    (state.lanes[lane.id] || []).forEach(card => body.appendChild(renderCard(lane.id, card)));
    laneEl.appendChild(body);
    board.appendChild(laneEl);
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.unit-card:not(.dragging)')];
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
  if (newIdx === -1) toLane.push(card); 
  else toLane.splice(newIdx, 0, card);
  saveState(); 
  renderBoard(); 
  refreshFinalText(true);
  playSuccessEffect(to);
}

/* ---------- 4. التقرير والبطاقات ---------- */
function renderCard(laneId, card) {
  const el = document.createElement("div");
  el.className = "unit-card";
  el.draggable = true;
  el.innerHTML = `
    <input class="unit-input" value="${card.text}">
    <div class="unit-actions">
      <button class="icon-btn" data-action="move">⇄</button>
      <button class="icon-btn" data-action="delete">×</button>
    </div>`;
  
  el.addEventListener("dragstart", () => {
    dragging = { cardId: card.id, fromLane: laneId };
    el.classList.add("dragging");
    placeholder.style.height = el.offsetHeight + "px";
  });
  
  el.addEventListener("dragend", () => { 
    el.classList.remove("dragging"); 
    placeholder.remove(); 
  });
  
  el.querySelector(".unit-input").oninput = (e) => { 
    card.text = e.target.value; 
    saveState(); 
    refreshFinalText(); 
  };
  
  el.querySelector('[data-action="move"]').onclick = () => openQuickMove(card.id, laneId);
  el.querySelector('[data-action="delete"]').onclick = () => { 
    state.lanes[laneId] = state.lanes[laneId].filter(c => c.id !== card.id);
    saveState(); 
    renderBoard(); 
    refreshFinalText(true);
    toast("تم حذف الوحدة");
  };
  
  return el;
}

function buildReportText() {
  const f = state.form;
  const lines = [
    `اسم العمليات : ${(f.opsName || "").trim()}`,
    `نائب العمليات : ${(f.opsDeputy || "").trim()}`,
    "",
    `قيادات : ${dashList(f.leaders) || "-"}`,
    `ضباط : ${dashList(f.officers) || "-"}`,
    `ضباط صف : ${dashList(f.ncos) || "-"}`,
    "",
    `مسؤول الفتره : ${dashList(f.periodOfficer) || "-"}`,
    "",
    "توزيع الوحدات :",
    ""
  ];

  LANES.forEach(lane => {
    const units = (state.lanes[lane.id] || []).map(c => (c.text || "").trim()).filter(Boolean);
    lines.push(`| ${lane.title} |`);
    lines.push(units.join(", ") || "-");
    lines.push("");
  });

  lines.push(
    "الملاحظات :", 
    (f.notes || "").trim() || "-", 
    "", 
    `وقت الاستلام : ${(f.recvTime || "").trim()}`, 
    `وقت التسليم : ${(f.handoverTime || "").trim()}`, 
    `تم التسليم إلى : ${(f.handoverTo || "").trim()}`
  );
  
  return lines.join("\n");
}

/* ---------- 5. ربط الـ UI والتشغيل ---------- */
function bindUI() {
  const fields = ["opsName", "opsDeputy", "leaders", "officers", "ncos", "periodOfficer", "notes", "handoverTo"];
  fields.forEach(f => { 
    const el = $("#" + f);
    if (el) el.oninput = (e) => { 
      state.form[f] = e.target.value; 
      saveState(); 
      refreshFinalText(); 
    }; 
  });
  
  $("#btnAddUnit")?.addEventListener("click", addUnit);
  $("#btnStart")?.addEventListener("click", () => { 
    state.form.recvTime = nowEnglish(); 
    renderAll(); 
    toast("تم تسجيل وقت الاستلام");
  });
  $("#btnEnd")?.addEventListener("click", () => { 
    state.form.handoverTime = nowEnglish(); 
    renderAll(); 
    toast("تم تسجيل وقت التسليم");
  });
  $("#btnCopyReport")?.addEventListener("click", async () => { 
    const text = $("#finalText").value;
    await navigator.clipboard.writeText(text); 
    toast("تم نسخ التقرير!");
  });
  $("#btnAddExtracted")?.addEventListener("click", () => addExtractedLinesToLane("hotel_top"));
  $("#sheetClose")?.addEventListener("click", () => $("#sheetOverlay").classList.remove("show"));
  $("#btnReset")?.addEventListener("click", () => { 
    if(confirm("هل أنت متأكد من إعادة الضبط؟ سيتم حذف جميع البيانات.")){ 
      localStorage.removeItem(STORAGE_KEY); 
      location.reload(); 
    }
  });
}

function renderAll() {
  const fields = ["opsName", "opsDeputy", "leaders", "officers", "ncos", "periodOfficer", "notes", "handoverTo", "recvTime", "handoverTime"];
  fields.forEach(f => { 
    const el = $("#" + f);
    if (el) el.value = state.form[f] || ""; 
  });
  renderBoard(); 
  refreshFinalText(true);
}

function openQuickMove(cardId, currentLaneId) {
  const overlay = $("#sheetOverlay");
  const grid = $("#sheetGrid");
  grid.innerHTML = "";
  
  LANES.forEach(lane => {
    const btn = document.createElement("button"); 
    btn.className = "btn btn-primary"; 
    btn.innerHTML = `<span>${lane.title}</span>`;
    btn.onclick = () => { 
      moveCardToPosition(cardId, currentLaneId, lane.id, -1); 
      overlay.classList.remove("show"); 
    };
    grid.appendChild(btn);
  });
  
  overlay.classList.add("show");
}

/* المساعدات */
function uid() { 
  return (crypto?.randomUUID?.() || ("u_" + Math.random().toString(16).slice(2) + Date.now().toString(16))); 
}

function nowEnglish() { 
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }); 
}

function dashList(t) { 
  return (t || "").split("\n").map(s => s.trim()).filter(Boolean).join(" - "); 
}

function toast(m) { 
  const t = $("#toast"); 
  if(t){ 
    t.textContent = m; 
    t.classList.add("show"); 
    setTimeout(() => t.classList.remove("show"), 2500); 
  } 
}

function playSuccessEffect(laneId) {
  const el = document.querySelector(`.lane[data-lane-id="${laneId}"]`);
  if (el) { 
    el.style.boxShadow = "0 0 40px rgba(212, 175, 55, 0.5)";
    setTimeout(() => el.style.boxShadow = "", 600); 
  }
}

function refreshFinalText(force = false) {
  const ta = $("#finalText"); 
  if (ta && (force || document.activeElement !== ta)) ta.value = buildReportText();
}

// تشغيل التطبيق
document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  renderAll();
});
