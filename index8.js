(function initDayDragReorder(){
  const ORDER_KEY = "planner_day_order";
  const DEFAULT_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const panel = document.getElementById("panel-planner");
  if(!panel) return;

  let dragDay = null;
  let order = loadOrder();
  let suppressObserver = false;
  let pendingWire = false;
  let observedTarget = null;
  const captureOpts = { capture:true };

  function loadOrder(){
    try{
      const raw = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
      if(Array.isArray(raw)) return raw;
    }catch(e){}
    return [...DEFAULT_ORDER];
  }

  function saveOrder(next){
    try{ localStorage.setItem(ORDER_KEY, JSON.stringify(next || [])); }catch(e){}
  }

  function currentCards(){
    const grid = panel.querySelector(".grid");
    return grid ? Array.from(grid.querySelectorAll(".card[data-day]")) : [];
  }

  function normalizeOrder(cards){
    const daysInDom = cards.map(c=>c.dataset.day).filter(Boolean);
    const next = order.filter(day=>daysInDom.includes(day));
    daysInDom.forEach(day=>{ if(!next.includes(day)) next.push(day); });
    return next.length ? next : [...DEFAULT_ORDER];
  }

  function updateToggleButton(){
    const toggleBtn = document.getElementById("toggle-days");
    if(!toggleBtn) return;
    const cards = currentCards();
    const allCollapsed = cards.length ? cards.every(card=>card.classList.contains("collapsed")) : false;
    toggleBtn.textContent = allCollapsed ? "Expand all" : "Collapse all";
    toggleBtn.setAttribute("aria-pressed", allCollapsed ? "true" : "false");
  }

  function applyDomOrder(){
    const cards = currentCards();
    if(!cards.length) return;
    const grid = cards[0].parentElement;
    if(!grid) return;
    const map = new Map(cards.map(c=>[c.dataset.day, c]));
    const normalized = normalizeOrder(cards);
    // Skip work if nothing changed
    const domOrder = cards.map(c=>c.dataset.day);
    if(normalized.length === domOrder.length && normalized.every((day, idx)=> day === domOrder[idx])) return;
    order = normalized;
    suppressObserver = true;
    order.forEach(day=>{
      const node = map.get(day);
      if(node) grid.appendChild(node);
    });
    suppressObserver = false;
    updateToggleButton();
  }

  function reorderDays(fromDay, toDay){
    if(!fromDay || !toDay || fromDay === toDay) return;
    const cards = currentCards();
    order = normalizeOrder(cards);
    const fromIdx = order.indexOf(fromDay);
    const toIdx = order.indexOf(toDay);
    if(fromIdx === -1 || toIdx === -1) return;
    order.splice(fromIdx,1);
    order.splice(toIdx,0,fromDay);
    saveOrder(order);
    applyDomOrder();
  }

  function onDragStart(e){
    if(!e.currentTarget?.dataset.day) return;
    e.stopImmediatePropagation();
    const card = e.currentTarget;
    dragDay = card.dataset.day;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragDay || "");
    card.classList.add("day-dragging");
  }

  function onDragOver(e){
    if(!dragDay) return;
    e.stopImmediatePropagation();
    if(!dragDay) return;
    e.preventDefault();
    const card = e.currentTarget;
    if(card.dataset.day === dragDay) return;
    card.classList.add("day-drop-target");
  }

  function clearDragStyles(){
    currentCards().forEach(c=>{
      c.classList.remove("day-drop-target","day-dragging");
    });
  }

  function onDragLeave(e){
    e.stopImmediatePropagation();
    e.currentTarget.classList.remove("day-drop-target");
  }

  function onDrop(e){
    e.stopImmediatePropagation();
    e.preventDefault();
    const targetDay = e.currentTarget.dataset.day;
    const sourceDay = dragDay || e.dataTransfer.getData("text/plain");
    e.currentTarget.classList.remove("day-drop-target");
    if(sourceDay && targetDay) reorderDays(sourceDay, targetDay);
  }

  function onDragEnd(){
    if(!dragDay) return;
    dragDay = null;
    clearDragStyles();
  }

  function bindCard(card){
    if(card.__dayReorderBound) return;
    card.__dayReorderBound = true;
    card.setAttribute("draggable","true");
    card.classList.add("day-draggable");
    card.addEventListener("dragstart", onDragStart, captureOpts);
    card.addEventListener("dragover", onDragOver, captureOpts);
    card.addEventListener("dragleave", onDragLeave, captureOpts);
    card.addEventListener("drop", onDrop, captureOpts);
    card.addEventListener("dragend", onDragEnd, captureOpts);
  }

  function attachObserver(){
    const grid = panel.querySelector(".grid");
    if(!grid || observedTarget === grid) return;
    observer.disconnect();
    observedTarget = grid;
    observer.observe(grid, { childList:true });
  }

  const observer = new MutationObserver(()=> scheduleWire());

  function scheduleWire(){
    if(pendingWire || suppressObserver) return;
    pendingWire = true;
    requestAnimationFrame(()=>{
      pendingWire = false;
      wirePlanner();
    });
  }

  function wirePlanner(){
    attachObserver();
    currentCards().forEach(bindCard);
    applyDomOrder();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", wirePlanner);
  }else{
    wirePlanner();
  }
})();
