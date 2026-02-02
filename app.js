"use strict";

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = "army_ops_update_v3";

const LANES = [
  { id: "heli", title: "وحدات هيلي" },
  { id: "great_ocean", title: "وحدات نقاط قريت اوشن" },
  { id: "sandy", title: "وحدات نقاط ساندي" },
  { id: "paleto", title: "وحدات نقاط شلال بوليتو" },
];

/* ---------- التحسين المطلوب: تفكيك النصوص عند الإضافة ---------- */
function processInputToLines(rawText) {
  // هذا السطر يقوم بتحويل الفواصل (,) إلى أسطر جديدة ليتم معاملة كل كود كوحدة منفصلة
  return rawText
    .replace(/,/g, '\n') 
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

function addExtractedLinesToLane(laneId) {
  const ta = $("#extractedList");
  const raw = ta?.value || "";
  // تعديل: الآن سيفهم أن الكود بعد الفاصلة هو وحدة جديدة
  const lines = processInputToLines(raw).map(normalizeExtractLine).filter(Boolean);
  
  if (!lines.length) { toast("لا يوجد أكواد لإضافتها.", "تنبيه"); return; }
  
  for (let i = lines.length - 1; i >= 0; i--) {
    state.lanes[laneId].unshift({ id: uid(), text: lines[i] });
  }
  saveState();
  renderBoard();
  refreshFinalText(true);
  toast(`تمت إضافة ${lines.length} وحدة منفصلة.`, "نجاح");
}

/* ---------- دالة بناء التقرير: الأكواد تحت الاسم مباشرة ---------- */
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
    
    lines.push(`| ${lane.title} |`); // العنوان في سطر
    if (codesString) {
      lines.push(codesString); // الأكواد تحتها مباشرة في سطر جديد
    } else {
      lines.push("-"); // إذا كانت فارغة
    }
    lines.push(""); // سطر فارغ للفصل بين الأقسام
  }

  lines.push("الملاحظات :");
  lines.push((f.notes || "").trim() || "-");
  lines.push("");
  lines.push(`وقت الاستلام : ${(f.recvTime || "").trim()}`);
  lines.push(`وقت التسليم : ${(f.handoverTime || "").trim()}`);
  lines.push(`تم التسليم إلى : ${(f.handoverTo || "").trim()}`);

  return lines.join("\n");
}

/* ---------- باقي الوظائف الأساسية (بدون تغيير لضمان السحب والإفلات) ---------- */
function uid() { return (crypto?.randomUUID?.() || ("u_" + Math.random().toString(16).slice(2) + Date.now().toString(16))); }
function nowEnglish() { return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }); }
function normalizeTimeString(v) { 
  const m = (v || "").match(/(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  return m ? `${m[1]}${m[2] ? " " + m[2].toUpperCase() : ""}` : v;
}
function dashList(t) { const a = (t || "").split("\n").map(s => s.trim()).filter(Boolean); return a.join(" - "); }
function normalizeExtractLine(s) { return s.replace(/^[\-•\u2022]+\s*/g, "").trim(); }

function defaultState() {
  return {
    form: { opsName: "", opsDeputy: "", leaders: "", officers: "", ncos: "", periodOfficer: "", notes: "", recvTime: "", handoverTime: "", handoverTo: "" },
    lanes: { heli: [], great_ocean: [], sandy: [], paleto: [] },
    ui: { extractedList: "" }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    for (const lane of LANES) { if (!Array.isArray(parsed.lanes[lane.id])) parsed.lanes[lane.id] = []; }
    return parsed;
  } catch { return defaultState(); }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
let state = loadState();

function renderBoard() {
  const board = $("#board"); if (!board) return;
  board.innerHTML = "";
  for (const lane of LANES) {
    const laneEl = document.createElement("div");
    laneEl.className = "lane";
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

let dragging = { cardId: null, fromLane: null };
function renderCard(laneId, card) {
  const el = document.createElement("div");
  el.className = "unitCard";
  el.innerHTML = `<div class="dragHandle" draggable="true"><div class="dots"></div></div>
                  <div class="unitMain"><input class="unitInput" value="${card.text}"></div>
                  <button class="iconBtn danger">×</button>`;
  
  const input = el.querySelector(".unitInput");
  input.oninput = () => { card.text = input.value; saveState(); refreshFinalText(); };
  
  const handle = el.querySelector(".dragHandle");
  handle.ondragstart = () => { dragging = { cardId: card.id, fromLane: laneId }; };
  
  el.querySelector(".danger").onclick = () => { 
    state.lanes[laneId] = state.lanes[laneId].filter(c => c.id !== card.id);
    saveState(); renderBoard(); refreshFinalText(true);
  };
  return el;
}

function moveCard(id, from, to) {
  if (from === to) return;
  const idx = state.lanes[from].findIndex(c => c.id === id);
  const [card] = state.lanes[from].splice(idx, 1);
  state.lanes[to].unshift(card);
  saveState(); renderBoard(); refreshFinalText(true);
}

function refreshFinalText(force = false) {
  const ta = $("#finalText");
  if (ta && (force || document.activeElement !== ta)) ta.value = buildReportText();
}

function bindUI() {
  $("#opsName").oninput = (e) => { state.form.opsName = e.target.value; saveState(); refreshFinalText(); };
  $("#opsDeputy").oninput = (e) => { state.form.opsDeputy = e.target.value; saveState(); refreshFinalText(); };
  $("#leaders").oninput = (e) => { state.form.leaders = e.target.value; saveState(); refreshFinalText(); };
  $("#officers").oninput = (e) => { state.form.officers = e.target.value; saveState(); refreshFinalText(); };
  $("#ncos").oninput = (e) => { state.form.ncos = e.target.value; saveState(); refreshFinalText(); };
  $("#periodOfficer").oninput = (e) => { state.form.periodOfficer = e.target.value; saveState(); refreshFinalText(); };
  $("#notes").oninput = (e) => { state.form.notes = e.target.value; saveState(); refreshFinalText(); };
  
  $("#btnStart").onclick = () => { state.form.recvTime = nowEnglish(); renderAll(); };
  $("#btnEnd").onclick = () => { state.form.handoverTime = nowEnglish(); renderAll(); };
  $("#btnCopyReport").onclick = async () => { await navigator.clipboard.writeText($("#finalText").value); toast("تم النسخ!"); };
  $("#btnReset").onclick = () => { if(confirm("حذف الكل؟")){ state = defaultState(); saveState(); renderAll(); } };
  $("#btnAddUnit").onclick = () => { state.lanes.heli.unshift({id: uid(), text: ""}); renderBoard(); };
  $("#btnAddExtracted").onclick = () => addExtractedLinesToLane("great_ocean");
}

function renderAll() {
  $("#opsName").value = state.form.opsName;
  $("#opsDeputy").value = state.form.opsDeputy;
  $("#leaders").value = state.form.leaders;
  $("#officers").value = state.form.officers;
  $("#ncos").value = state.form.ncos;
  $("#periodOfficer").value = state.form.periodOfficer;
  $("#notes").value = state.form.notes;
  $("#recvTime").value = state.form.recvTime;
  $("#handoverTime").value = state.form.handoverTime;
  renderBoard();
  refreshFinalText(true);
}

function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); }

document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  renderAll();
  setTimeout(() => $("#intro")?.remove(), 3000);
});
