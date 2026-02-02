/* Army Ops Update (Static)
  - Single form + 4-lane drag & drop board
  - Cinematic intro (4s)
  - Copy report + localStorage persistence
*/

"use strict";

const $ = (sel) => document.querySelector(sel);

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

/* ---------- State ---------- */
let state = defaultState();

function defaultState() {
  return {
    form: {
      opsName: "",
      deputyName: "",
      leaders: "",
      officers: "",
      nco: "",
      periodManager: "",
      notes: "",
      handoverStartTime: "",
      handoverTime: "",
      handoverTo: "",
    },
    units: []
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = { ...defaultState(), ...parsed };
    } catch (e) { console.error("Load state failed", e); }
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateFinalReport();
}

/* ---------- Logic ---------- */

function addUnit() {
  const codeInput = $("#unitCodeInput");
  const code = codeInput.value.trim();
  if (!code) return;
  const newUnit = { id: uid(), code, laneId: "heli" };
  state.units.push(newUnit);
  codeInput.value = "";
  saveState();
  renderBoard();
}

function removeUnit(id) {
  state.units = state.units.filter(u => u.id !== id);
  saveState();
  renderBoard();
}

function moveUnit(unitId, newLaneId) {
  const u = state.units.find(x => x.id === unitId);
  if (u) {
    u.laneId = newLaneId;
    saveState();
    renderBoard();
  }
}

/* ---------- Render ---------- */

function renderBoard() {
  LANES.forEach(lane => {
    const container = $(`#lane-${lane.id}`);
    if (!container) return;
    container.innerHTML = "";
    const unitsInLane = state.units.filter(u => u.laneId === lane.id);
    unitsInLane.forEach(unit => {
      const el = document.createElement("div");
      el.className = "unit-card";
      el.draggable = true;
      el.innerHTML = `
        <span>${unit.code}</span>
        <button class="delete-btn" onclick="removeUnit('${unit.id}')">×</button>
      `;
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", unit.id);
        el.classList.add("dragging");
      });
      el.addEventListener("dragend", () => el.classList.remove("dragging"));
      
      el.addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-btn")) return;
        showMoveSheet(unit.id);
      });

      container.appendChild(el);
    });
  });
}

function updateFinalReport() {
  const ta = $("#finalText");
  if (ta) ta.value = buildReportText();
}

// الدالة المسؤولة عن بناء النص النهائي
function buildReportText() {
  const f = state.form;
  let lines = [];

  lines.push(`اسم العمليات : ${(f.opsName || "").trim()}`);
  lines.push(`نائب العمليات : ${(f.deputyName || "").trim()}`);
  lines.push(``);
  lines.push(`قيادات : ${(f.leaders || "").trim() || "-"}`);
  lines.push(`ضباط : ${(f.officers || "").trim() || "-"}`);
  lines.push(`ضباط صف : ${(f.nco || "").trim() || "-"}`);
  lines.push(``);
  lines.push(`مسؤول الفتره : ${(f.periodManager || "").trim()}`);
  lines.push(``);
  lines.push(`توزيع الوحدات :`);
  lines.push(``);

  // التعديل: هنا يتم جمع الأكواد في سطر واحد مفصولة بفاصلة
  LANES.forEach(lane => {
    const unitsInLane = state.units.filter(u => u.laneId === lane.id);
    const codesText = unitsInLane.map(u => u.code).join(", ");
    lines.push(`| ${lane.title} | ${codesText || "-"}`);
  });

  lines.push(``);
  lines.push(`الملاحظات : ${(f.notes || "").trim()}`);
  lines.push(``);
  lines.push(`وقت الاستلام : ${(f.handoverStartTime || "").trim()}`);
  lines.push(`وقت التسليم : ${(f.handoverTime || "").trim()}`);
  lines.push(`تم التسليم : ${(f.handoverTo || "").trim()}`);

  return lines.join("\n");
}

/* ---------- Handlers ---------- */

function bindForm() {
  const fields = [
    "opsName", "deputyName", "leaders", "officers", "nco",
    "periodManager", "notes", "handoverStartTime", "handoverTime", "handoverTo"
  ];
  fields.forEach(fid => {
    const el = $(`#${fid}`);
    if (!el) return;
    el.value = state.form[fid] || "";
    el.addEventListener("input", () => {
      state.form[fid] = el.value;
      saveState();
    });
  });
}

async function copyReport() {
  const ta = $("#finalText");
  const text = (ta?.value || "").trim() ? ta.value : buildReportText();
  try {
    await navigator.clipboard.writeText(text);
    toast("تم نسخ التقرير للحافظة.", "نسخ");
  } catch {
    const taBox = document.createElement("textarea");
    taBox.value = text;
    document.body.appendChild(taBox);
    taBox.select();
    document.execCommand("copy");
    taBox.remove();
    toast("تم نسخ التقرير للحافظة.", "نسخ");
  }
}

function resetAll() {
  const ok = confirm("متأكد؟ سيتم حذف البيانات المحفوظة وإعادة الضبط.");
  if (!ok) return;
  state = defaultState();
  saveState();
  bindForm();
  renderBoard();
  toast("تمت إعادة التعيين.", "Reset");
}

function bindUI() {
  $("#btnAddUnit")?.addEventListener("click", addUnit);
  $("#btnCopyReport")?.addEventListener("click", copyReport);
  $("#btnReset")?.addEventListener("click", resetAll);
  
  $("#btnStart")?.addEventListener("click", () => {
    const el = $("#handoverStartTime");
    if (el) { el.value = nowEnglish(); state.form.handoverStartTime = el.value; saveState(); }
  });
  $("#btnEnd")?.addEventListener("click", () => {
    const el = $("#handoverTime");
    if (el) { el.value = nowEnglish(); state.form.handoverTime = el.value; saveState(); }
  });

  LANES.forEach(lane => {
    const zone = $(`#lane-${lane.id}`);
    zone?.addEventListener("dragover", (e) => e.preventDefault());
    zone?.addEventListener("drop", (e) => {
      e.preventDefault();
      const unitId = e.dataTransfer.getData("text/plain");
      moveUnit(unitId, lane.id);
    });
  });
}

/* ---------- Mobile Sheet ---------- */
let activeUnitId = null;
function showMoveSheet(id) {
  activeUnitId = id;
  const sheet = $("#sheetOverlay");
  sheet.classList.add("show");
}
function hideMoveSheet() {
  $("#sheetOverlay").classList.remove("show");
  activeUnitId = null;
}

function setupSheet() {
  const list = $(".sheetList");
  if (!list) return;
  LANES.forEach(lane => {
    const btn = document.createElement("button");
    btn.textContent = lane.title;
    btn.onclick = () => {
      if (activeUnitId) moveUnit(activeUnitId, lane.id);
      hideMoveSheet();
    };
    list.appendChild(btn);
  });
  $("#sheetClose")?.addEventListener("click", hideMoveSheet);
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  bindForm();
  bindUI();
  setupSheet();
  renderBoard();
  updateFinalReport();

  setTimeout(() => {
    const intro = $("#intro");
    if (intro) {
      intro.style.opacity = "0";
      setTimeout(() => intro.remove(), 1000);
    }
  }, 3500);
});

function toast(msg, title = "") {
  const t = $("#toast");
  if (!t) return;
  t.innerHTML = `<strong>${title}</strong> ${msg}`;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
