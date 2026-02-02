/* Army Ops Update (Static)
  - Single form + 4-lane drag & drop board
  - Cinematic intro (4s)
  - Copy report + localStorage persistence
*/

"use strict";

const $ = (sel) => document.querySelector(sel);

// مفتاح التخزين المحلي
const STORAGE_KEY = "army_ops_update_v3";

// تعريف اللوحات (تأكد أن ID يطابق الموجود في HTML)
const LANES = [
  { id: "free", title: "حره" },
  { id: "heli", title: "هيلي" },
  { id: "great_ocean", title: "نقطة قريت اوشن" },
  { id: "sandy", title: "نقطة ساندي" },
  { id: "paleto", title: "نقطة شلال بوليتو" },
  { id: "hq", title: "المقر" }
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
  // افتراضياً تذهب لأول لوحة (حره)
  const newUnit = { id: uid(), code, laneId: "free" };
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

/* ---------- Render (لوحات التوزيع) ---------- */

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
      // السحب والإفلات
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", unit.id);
        el.classList.add("dragging");
      });
      el.addEventListener("dragend", () => el.classList.remove("dragging"));
      
      // النقر للموبايل
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

/* النتيجة النهائية - الأكواد بالعرض */
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

  // عرض الأكواد بالعرض مفصولة بفاصلة لكل لوحة
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
    const tmp = document.createElement("textarea");
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    tmp.remove();
    toast("تم نسخ التقرير للحافظة.", "نسخ");
  }
}

function resetAll() {
  if (!confirm("متأكد؟ سيتم حذف البيانات وإعادة الضبط.")) return;
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

  // تفعيل مناطق الإفلات
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
  $("#sheetOverlay").classList.add("show");
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
