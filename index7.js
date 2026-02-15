// Body heat map integration for workout tab
const audioCtor = window.AudioContext || window.webkitAudioContext;
const SOUND_EFFECTS_KEY = "planner_sound_effects";
const loadSoundEffects = ()=>{
  try{
    const raw = localStorage.getItem(SOUND_EFFECTS_KEY);
    if(raw === null) return location.protocol === "file:" ? false : true;
    return raw !== "false";
  }catch(e){
    return location.protocol === "file:" ? false : true;
  }
};
const isSoundEffectsEnabled = ()=>{
  if(typeof window.soundEffectsEnabled === "boolean") return window.soundEffectsEnabled;
  return loadSoundEffects();
};
let lastSoundEffectsState = isSoundEffectsEnabled();
let sharedAudioCtx = null;
let audioDisabled = !audioCtor;
let audioUnlocked = false;
const unlockAudio = ()=>{ audioUnlocked = true; };
document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });
const syncSoundEffectsState = ()=>{
  const enabled = isSoundEffectsEnabled();
  if(enabled && !lastSoundEffectsState && audioCtor) audioDisabled = false;
  if(!enabled && sharedAudioCtx){
    try{ sharedAudioCtx.close(); }catch(e){}
    sharedAudioCtx = null;
  }
  lastSoundEffectsState = enabled;
  return enabled;
};
const getAudioContext = ()=>{
  const enabled = syncSoundEffectsState();
  if(!enabled || audioDisabled || !audioUnlocked) return null;
  if(sharedAudioCtx && sharedAudioCtx.state !== "closed") return sharedAudioCtx;
  try{
    sharedAudioCtx = new audioCtor();
  }catch(e){
    audioDisabled = true;
    sharedAudioCtx = null;
    return null;
  }
  if(sharedAudioCtx.state === "suspended"){
    sharedAudioCtx.resume().catch(()=>{
      audioDisabled = true;
      try{ sharedAudioCtx.close(); }catch(e){}
      sharedAudioCtx = null;
    });
  }
  return sharedAudioCtx;
};
let localWakeLock = null;
let localWakeLockCount = 0;
const WAKE_LOCK_KEY = "planner_wake_lock_enabled";
const loadWakeLockEnabled = ()=>{
  try{
    const raw = localStorage.getItem(WAKE_LOCK_KEY);
    if(raw === null) return true;
    return raw !== "false";
  }catch(e){
    return true;
  }
};
let localWakeEnabled = loadWakeLockEnabled();
const setLocalWakeEnabled = (val)=>{
  localWakeEnabled = !!val;
  if(!localWakeEnabled) localWakeRelease();
};
const localNotify = (title, body, tag)=>{
  if(typeof Notification === "undefined") return;
  const fire = ()=>{
    try{
      new Notification(title, { body, tag, renotify: false });
    }catch(e){}
  };
  if(Notification.permission === "granted"){
    fire();
  }else if(Notification.permission !== "denied"){
    try{
      Notification.requestPermission().then(p=>{ if(p === "granted") fire(); });
    }catch(e){}
  }
};
const localWakeAcquire = async ()=>{
  if(!localWakeEnabled) return false;
  if(!("wakeLock" in navigator)) return false;
  localWakeLockCount += 1;
  if(localWakeLock) return true;
  try{
    localWakeLock = await navigator.wakeLock.request("screen");
    localWakeLock.addEventListener("release", ()=>{ localWakeLock = null; });
    return true;
  }catch(e){
    localWakeLockCount = Math.max(0, localWakeLockCount - 1);
    localWakeLock = null;
    return false;
  }
};
const localWakeRelease = ()=>{
  localWakeLockCount = Math.max(0, localWakeLockCount - 1);
  if(localWakeLockCount === 0 && localWakeLock){
    try{ localWakeLock.release(); }catch(e){}
    localWakeLock = null;
  }
};
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState === "visible" && localWakeEnabled && localWakeLockCount > 0 && !localWakeLock){
    localWakeAcquire();
  }
});
window.addEventListener("storage", (event)=>{
  if(event.key === WAKE_LOCK_KEY){
    setLocalWakeEnabled(event.newValue !== "false");
  }
});
if(typeof window.plannerNotify !== "function") window.plannerNotify = localNotify;
if(typeof window.plannerWakeLockAcquire !== "function") window.plannerWakeLockAcquire = localWakeAcquire;
if(typeof window.plannerWakeLockRelease !== "function") window.plannerWakeLockRelease = localWakeRelease;
(function initHeatMapModule(){
  const LOG_KEY = "workout-graph-log-v1";
  const WINDOW_DAYS = 7;

  const typeToMuscles = {
    head: ["Head"],
    chest: ["Chest"],
    back: ["Back"],
    abs: ["Abs"],
    arms_shoulders: ["Shoulders","Arms","Wrists"],
    legs_calfs: ["Legs","Calves","Glutes"],
    push: ["Chest","Shoulders","Wrists"], // leave arms for dedicated arms/shoulders type
    pull: ["Back","Arms","Wrists"]
  };

  function init(){
    const svg = document.getElementById("workout-heat-svg");
    const refreshBtn = document.getElementById("heat-refresh");
    const resetBtn = document.getElementById("heat-reset");
    const flipBtn = document.getElementById("heat-flip");
    const focusNote = document.getElementById("heat-focus-note");
    const summary = document.getElementById("heat-summary");
    if(!svg) return false;

    const regions = Array.from(svg.querySelectorAll(".muscle-region"));
    const frontSide = svg.querySelector('[data-side="front"]');
    const backSide = svg.querySelector('[data-side="back"]');
    let currentSide = "front";

    const setSide = (side="front")=>{
      currentSide = side === "back" ? "back" : "front";
      frontSide?.classList.toggle("active", currentSide === "front");
      backSide?.classList.toggle("active", currentSide === "back");
      if(flipBtn){
        flipBtn.textContent = currentSide === "front" ? "Flip to back" : "Flip to front";
        flipBtn.setAttribute("aria-pressed", currentSide === "back" ? "true" : "false");
        flipBtn.dataset.side = currentSide;
      }
    };
    setSide("front");

  function lastNDates(n){
    const days = [];
    for(let i=n-1;i>=0;i--){
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0,10));
    }
    return days;
  }

  function loadLogs(){
    try{
      const raw = JSON.parse(localStorage.getItem(LOG_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }

  function intensityFromCount(count){
    if(count <= 0) return 0;
    if(count === 1) return 1; // light: 1 day
    if(count === 2) return 2; // medium: 2 days
    return 3; // heavy: 3+ days
  }

  function applyIntensity(muscle, level){
    regions.filter(r=>r.dataset.muscle === muscle).forEach(r=>{
      r.dataset.intensity = level;
      const cls = (r.getAttribute("class") || "").replace(/intensity-\d/g,"").replace(/\s+/g," ").trim();
      r.setAttribute("class", `${cls ? cls+" " : ""}intensity-${level}`);
    });
  }

  function resetMap(){
    regions.forEach(r=>{
      r.dataset.intensity = 0;
      const cls = (r.getAttribute("class") || "").replace(/intensity-\d/g,"").replace(/\s+/g," ").trim();
      r.setAttribute("class", `${cls ? cls+" " : ""}intensity-0`);
    });
    if(summary) summary.textContent = "No logged workouts in this week.";
    if(focusNote) focusNote.textContent = "Focus types: none logged yet.";
  }

  function currentWeekSet(){
    const today = new Date();
    const day = (today.getDay()+6)%7; // Monday start
    const start = new Date(today);
    start.setDate(start.getDate() - day);
    start.setHours(0,0,0,0);
    const set = new Set();
    for(let i=0;i<7;i++){
      const d = new Date(start);
      d.setDate(start.getDate()+i);
      set.add(d.toISOString().slice(0,10));
    }
    return set;
  }

  function refreshFromLogs(){
    resetMap();
    const data = loadLogs();
    const DAY = 86400000;
    const dayKeyToMs = (key)=>{
      // key is expected to be "YYYY-MM-DD" that was produced by toISOString().slice(0,10)
      if(typeof key !== "string") return null;
      const t = Date.parse(`${key}T00:00:00Z`);
      return Number.isNaN(t) ? null : t;
    };
    const todayKey = new Date().toISOString().slice(0,10);
    const todayMs = dayKeyToMs(todayKey);
    const dow = new Date(todayMs).getUTCDay(); // 0=Sun
    const weekStartMs = todayMs - dow*DAY;
    const weekEndMs = weekStartMs + 7*DAY;
    const inThisWeek = (dateStr)=>{
      const ts = dayKeyToMs(dateStr);
      return ts !== null && ts >= weekStartMs && ts < weekEndMs;
    };

    const muscles = {};
    let entriesUsed = 0;
    const typesSeen = new Set();
    data.forEach(entry=>{
      if(!entry?.date || !inThisWeek(entry.date)) return;
      const pickedTypes = Array.isArray(entry.types) && entry.types.length
        ? entry.types
        : typeof entry.types === "string"
          ? entry.types.split(/[,\s]+/).filter(Boolean)
          : Object.keys(typeToMuscles).filter(t=>entry[t]);
      let hasType = false;
      pickedTypes.forEach(type=>{
        if(!typeToMuscles[type]) return;
        hasType = true;
        typesSeen.add(type);
        typeToMuscles[type].forEach(m=>{
          muscles[m] = (muscles[m]||0) + 1;
        });
      });
      if(hasType) entriesUsed += 1;
    });
    Object.keys(muscles).forEach(m=>{
      applyIntensity(m, intensityFromCount(muscles[m]));
    });
    if(summary){
      summary.textContent = entriesUsed ? `${entriesUsed} logged sessions this week.` : "No logged workouts in this week.";
    }
    if(focusNote){
      const labels = Array.from(typesSeen).map(t=> t.replace(/_/g," ")).join(", ");
      focusNote.textContent = typesSeen.size ? `Focus types: ${labels}` : "Focus types: none logged yet.";
    }
  }

    refreshBtn?.addEventListener("click", refreshFromLogs);
    resetBtn?.addEventListener("click", resetMap);
    flipBtn?.addEventListener("click", ()=>setSide(currentSide === "front" ? "back" : "front"));
    refreshFromLogs();
    window.refreshWorkoutHeatMap = refreshFromLogs;
    window.addEventListener("workout-log-updated", refreshFromLogs);
    return true;
  }

  // Ensure DOM is ready before querying SVG, retry once if needed
  const start = ()=>{
    if(init()) return;
    setTimeout(init, 300);
  };
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  }else{
    start();
  }
})();

// Quick countdown timer for Pomodoro panel
(function initCountdownTimer(){
  const shell = document.getElementById("countdown-shell");
  if(!shell) return;
  const popout = document.getElementById("countdown-popout");
  const popoutToggle = document.getElementById("countdown-popout-toggle");
  const railToggle = document.getElementById("countdown-rail-toggle");
  const enableToggle = document.getElementById("countdown-enable-toggle");
  const popoutPanel = document.getElementById("countdown-popout-panel");
  const popoutState = document.getElementById("countdown-popout-state");
  const popoutCheck = document.getElementById("countdown-popout-check");
  const openTabBtn = document.getElementById("countdown-open-tab");
  const stack = document.getElementById("countdown-stack");
  const stackNav = document.getElementById("countdown-stack-nav");
  const stackTitle = document.getElementById("countdown-stack-title");
  const stackCounter = document.getElementById("countdown-stack-counter");
  const POPOUT_KEY = "planner_countdown_popout";
  const display = document.getElementById("countdown-display");
  const statusEl = document.getElementById("countdown-status");
  const minInput = document.getElementById("countdown-min");
  const secInput = document.getElementById("countdown-sec");
  const progress = document.getElementById("countdown-progress");
  const startBtn = document.getElementById("countdown-start");
  const addBtn = document.getElementById("countdown-add");
  const subBtn = document.getElementById("countdown-sub");
  const resetBtn = document.getElementById("countdown-reset");
  const autoBox = document.getElementById("countdown-auto");
  const bufferToggle = document.getElementById("countdown-buffer-toggle");
  const presets = Array.from(shell.querySelectorAll("[data-preset]"));
  const laundryShell = document.getElementById("laundry-shell");
  const stackPanels = stack ? Array.from(stack.querySelectorAll("[data-stack-panel]")) : [];
  const stackButtons = stack ? Array.from(stack.querySelectorAll("[data-stack-dir]")) : [];
  const laundryStackPanel = stack?.querySelector("[data-stack-panel=\"laundry\"]") || null;
  const laundryHome = laundryStackPanel || laundryShell?.parentElement || null;
  const laundryHomeNext = laundryShell?.nextSibling || null;
  const DEFAULT_BUFFER_DELAY = 10;
  const EXERCISE_BUFFER_DELAY = 5;
  const EXERCISE_PRESET = 1800;
  const THREE_MIN_BEEP_PRESET = 2700;
  const COUNTDOWN_STATE_KEY = "planner_countdown_state_v1";
  const COUNTDOWN_CHANNEL = "planner_countdown_sync";
  const ENABLE_KEY = "planner_quicktools_enabled";
  const STACK_KEY = "planner_quicktools_panel";
  const stackLabels = {
    micro: "Micro focus timer",
    laundry: "Laundry timer",
    shortcuts: "Shortcuts & Tips"
  };
  const instanceId = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    ? crypto.randomUUID()
    : `cd-${Math.random().toString(36).slice(2)}`;
  let bc = null;
  try{
    bc = new BroadcastChannel(COUNTDOWN_CHANNEL);
  }catch(e){
    bc = null;
  }
  let lastStateStamp = 0;
  let isApplyingRemote = false;

  let popoutOpen = true;
  let quickToolsEnabled = true;
  const loadPopoutPref = ()=>{
    try{
      const raw = localStorage.getItem(POPOUT_KEY);
      if(raw === "false") return false;
      if(raw === "true") return true;
    }catch(e){}
    return true;
  };
  const loadQuickToolsEnabled = ()=>{
    try{
      const raw = localStorage.getItem(ENABLE_KEY);
      if(raw === "false") return false;
      if(raw === "true") return true;
    }catch(e){}
    return true;
  };
  const syncLaundryPlacement = (open)=>{
    if(laundryStackPanel) return;
    if(!laundryShell || !laundryHome || !popoutPanel) return;
    if(open){
      if(laundryShell.parentElement !== popoutPanel){
        popoutPanel.appendChild(laundryShell);
      }
    } else if(laundryShell.parentElement !== laundryHome){
      if(laundryHomeNext && laundryHomeNext.parentElement === laundryHome){
        laundryHome.insertBefore(laundryShell, laundryHomeNext);
      } else {
        laundryHome.appendChild(laundryShell);
      }
    }
  };
  const setPopoutOpen = (next, persist=true)=>{
    popoutOpen = !!next;
    const visible = quickToolsEnabled && popoutOpen;
    if(popout) popout.dataset.open = visible ? "true" : "false";
    if(popoutToggle) popoutToggle.setAttribute("aria-pressed", visible ? "true" : "false");
    if(railToggle){
      railToggle.setAttribute("aria-pressed", visible ? "true" : "false");
      railToggle.classList.toggle("is-on", visible);
    }
    if(popoutPanel) popoutPanel.setAttribute("aria-hidden", visible ? "false" : "true");
    if(popoutState) popoutState.textContent = visible ? "On" : "Off";
    if(popoutCheck) popoutCheck.style.opacity = visible ? "1" : "0";
    syncLaundryPlacement(visible);
    if(persist){
      try{ localStorage.setItem(POPOUT_KEY, popoutOpen ? "true" : "false"); }catch(e){}
    }
  };
  const setQuickToolsEnabled = (next, persist=true)=>{
    quickToolsEnabled = !!next;
    if(popout) popout.dataset.enabled = quickToolsEnabled ? "true" : "false";
    if(popoutToggle) popoutToggle.disabled = !quickToolsEnabled;
    if(railToggle){
      railToggle.disabled = !quickToolsEnabled;
      railToggle.setAttribute("aria-disabled", quickToolsEnabled ? "false" : "true");
    }
    if(openTabBtn){
      openTabBtn.disabled = !quickToolsEnabled;
      openTabBtn.setAttribute("aria-disabled", quickToolsEnabled ? "false" : "true");
    }
    if(enableToggle){
      enableToggle.classList.toggle("is-on", quickToolsEnabled);
      enableToggle.setAttribute("aria-pressed", quickToolsEnabled ? "true" : "false");
      enableToggle.setAttribute("aria-label", quickToolsEnabled ? "Disable quick tools" : "Enable quick tools");
    }
    setPopoutOpen(popoutOpen, false);
    if(persist){
      try{ localStorage.setItem(ENABLE_KEY, quickToolsEnabled ? "true" : "false"); }catch(e){}
    }
  };
  popoutOpen = loadPopoutPref();
  quickToolsEnabled = loadQuickToolsEnabled();
  setQuickToolsEnabled(quickToolsEnabled, false);
  setPopoutOpen(popoutOpen, false);
  popoutToggle?.addEventListener("click", ()=>{
    if(!quickToolsEnabled) return;
    setPopoutOpen(!popoutOpen);
  });
  railToggle?.addEventListener("click", ()=>{
    if(!quickToolsEnabled) return;
    setPopoutOpen(!popoutOpen);
  });
  enableToggle?.addEventListener("click", ()=> setQuickToolsEnabled(!quickToolsEnabled));
  const loadStackIndex = ()=>{
    if(!stackPanels.length) return 0;
    try{
      const stored = localStorage.getItem(STACK_KEY);
      if(!stored) return 0;
      const idx = stackPanels.findIndex(panel => panel.dataset.stackPanel === stored);
      return idx >= 0 ? idx : 0;
    }catch(e){
      return 0;
    }
  };
  let stackIndex = loadStackIndex();
  const setStackIndex = (next, persist=true)=>{
    if(!stackPanels.length) return;
    const total = stackPanels.length;
    stackIndex = (next + total) % total;
    const activePanel = stackPanels[stackIndex];
    const activeId = activePanel?.dataset.stackPanel || "";
    stackPanels.forEach((panel, idx)=>{
      const isActive = idx === stackIndex;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
      panel.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
    if(stackTitle){
      stackTitle.textContent = stackLabels[activeId] || "Quick tools";
    }
    if(stackCounter){
      stackCounter.textContent = `${stackIndex + 1} / ${total}`;
    }
    if(stack){
      stack.dataset.active = activeId;
    }
    if(persist){
      try{ localStorage.setItem(STACK_KEY, activeId); }catch(e){}
    }
  };
  stackButtons.forEach(btn=>{
    const dir = Number(btn.dataset.stackDir || 0) || 0;
    if(!dir) return;
    btn.addEventListener("click", ()=> setStackIndex(stackIndex + dir));
  });
  setStackIndex(stackIndex, false);
  const enableDrag = (target, handles, storageKey, options = {})=>{
    if(!target) return;
    const list = (Array.isArray(handles) ? handles : [handles]).filter(Boolean);
    if(!list.length) return;
    target.classList.add("draggable-panel");
    const bounds = options.bounds || "window";
    const loadStored = ()=>{
      try{
        const raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
        if(Number.isFinite(raw.x) && Number.isFinite(raw.y)){
          target.style.setProperty("--drag-x", `${raw.x}px`);
          target.style.setProperty("--drag-y", `${raw.y}px`);
        }
      }catch(e){}
    };
    const saveStored = (x, y)=>{
      try{ localStorage.setItem(storageKey, JSON.stringify({ x, y })); }catch(e){}
    };
    loadStored();
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startDrag = { x: 0, y: 0 };
    let startRect = null;
    const clamp = (val, min, max)=> Math.min(Math.max(val, min), max);
    const getStartDrag = ()=>{
      const rawX = parseFloat(getComputedStyle(target).getPropertyValue("--drag-x")) || 0;
      const rawY = parseFloat(getComputedStyle(target).getPropertyValue("--drag-y")) || 0;
      return { x: rawX, y: rawY };
    };
    const onPointerDown = (e)=>{
      if(e.button !== 0) return;
      if(e.target.closest("button, input, textarea, select, a")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startDrag = getStartDrag();
      startRect = target.getBoundingClientRect();
      target.classList.add("dragging");
      list.forEach(handle=> handle.classList.add("drag-handle"));
      if(typeof e.target.setPointerCapture === "function"){
        try{ e.target.setPointerCapture(e.pointerId); }catch(err){}
      }
      e.preventDefault();
    };
    const onPointerMove = (e)=>{
      if(!dragging || !startRect) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const rawX = startDrag.x + dx;
      const rawY = startDrag.y + dy;
      if(bounds === "free"){
        target.style.setProperty("--drag-x", `${rawX}px`);
        target.style.setProperty("--drag-y", `${rawY}px`);
        return;
      }
      const pad = 12;
      const minX = pad - startRect.left;
      const maxX = window.innerWidth - pad - startRect.right;
      const minY = pad - startRect.top;
      const maxY = window.innerHeight - pad - startRect.bottom;
      const nextX = clamp(rawX, minX, maxX);
      const nextY = clamp(rawY, minY, maxY);
      target.style.setProperty("--drag-x", `${nextX}px`);
      target.style.setProperty("--drag-y", `${nextY}px`);
    };
    const onPointerUp = ()=>{
      if(!dragging) return;
      dragging = false;
      target.classList.remove("dragging");
      const pos = getStartDrag();
      saveStored(pos.x, pos.y);
    };
    list.forEach(handle=>{
      handle.classList.add("drag-handle");
      handle.addEventListener("pointerdown", onPointerDown);
    });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };
  const popoutHandles = [
    stackNav,
    ...(popoutPanel ? Array.from(popoutPanel.querySelectorAll(".countdown-head")) : [])
  ];
  enableDrag(popoutPanel, popoutHandles, "planner_countdown_drag_v1", { bounds: "free" });
  openTabBtn?.addEventListener("click", ()=>{
    if(!quickToolsEnabled) return;
    const width = 420;
    const height = 640;
    const left = Math.max(0, Math.round((window.screen?.width || width) / 2 - width / 2));
    const top = Math.max(0, Math.round((window.screen?.height || height) / 2 - height / 2));
    const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    const win = window.open("micro-timer.html", "micro-timer-window", features);
    if(win){
      win.focus();
      try{ win.opener = null; }catch(e){}
    }else if(typeof showToast === "function"){
      showToast("Pop-up blocked. Allow pop-ups to open the timer window.", "warn");
    }
  });

  const state = {
    total: 300,
    remaining: 300,
    running: false,
    timerId: null,
    endAt: null,
    habitWarnArmed: false,
    habitWarnFired: false,
    bufferEnabled: true,
    bufferDelay: DEFAULT_BUFFER_DELAY,
    pendingRestart: null,
    bufferTimerId: null,
    bufferStore: null,
    exerciseMode: false,
    threeMinuteChime: false,
    lastChimeBucket: 0,
    ownerId: instanceId
  };

  const syncThreeMinuteChime = ()=>{
    state.threeMinuteChime = state.total === THREE_MIN_BEEP_PRESET;
    if(!state.threeMinuteChime){
      state.lastChimeBucket = 0;
    }
  };

  const syncBufferToggle = ()=>{
    if(!bufferToggle) return;
    bufferToggle.setAttribute("aria-pressed", state.bufferEnabled ? "true" : "false");
    const label = state.exerciseMode
      ? `${state.bufferDelay}s break locked`
      : `${state.bufferDelay}s break ${state.bufferEnabled ? "on" : "off"}`;
    bufferToggle.textContent = label;
  };
  const setExerciseMode = (enabled)=>{
    state.exerciseMode = !!enabled;
    state.bufferDelay = state.exerciseMode ? EXERCISE_BUFFER_DELAY : DEFAULT_BUFFER_DELAY;
    if(state.exerciseMode) state.bufferEnabled = true;
    syncBufferToggle();
  };

  const clampDuration = (sec)=>Math.min(60*240, Math.max(10, Math.round(sec||0)));
  const fmt = (sec)=>{
    const m = Math.floor(sec/60);
    const s = sec % 60;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };

  const snapshotState = (statusText = statusEl?.textContent || "Ready", statusMode = statusEl?.dataset.state || "idle")=>{
    const remaining = state.running && state.endAt
      ? Math.max(0, Math.round((state.endAt - Date.now())/1000))
      : state.remaining;
    return {
      total: state.total,
      remaining,
      running: !!state.running,
      endAt: state.running && state.endAt ? state.endAt : null,
      bufferEnabled: state.bufferEnabled,
      bufferDelay: state.bufferDelay,
      exerciseMode: state.exerciseMode,
      threeMinuteChime: state.threeMinuteChime,
      lastChimeBucket: state.lastChimeBucket,
      habitWarnArmed: state.habitWarnArmed,
      habitWarnFired: state.habitWarnFired,
      autoRestart: !!autoBox?.checked,
      statusText,
      statusMode,
      ownerId: state.ownerId || instanceId,
      updatedAt: Date.now(),
      source: instanceId
    };
  };

  const persistState = (statusText, statusMode, force=false)=>{
    if(isApplyingRemote && !force) return;
    const snap = snapshotState(statusText, statusMode);
    lastStateStamp = snap.updatedAt;
    try{ localStorage.setItem(COUNTDOWN_STATE_KEY, JSON.stringify(snap)); }catch(e){}
    if(bc){
      try{ bc.postMessage({ type:"countdown-state", payload: snap }); }catch(e){}
    }
  };

  const applySnapshot = (snap)=>{
    if(!snap || typeof snap !== "object") return;
    if(snap.source && snap.source === instanceId) return;
    const updatedAt = snap.updatedAt || 0;
    if(lastStateStamp && updatedAt && updatedAt <= lastStateStamp) return;
    lastStateStamp = updatedAt;
    isApplyingRemote = true;
    setExerciseMode(!!snap.exerciseMode);
    state.bufferEnabled = !!snap.bufferEnabled;
    state.bufferDelay = snap.bufferDelay || state.bufferDelay;
    syncBufferToggle();
    state.total = clampDuration(snap.total || state.total);
    const nextRemaining = snap.running && snap.endAt
      ? Math.max(0, Math.round((snap.endAt - Date.now())/1000))
      : Math.max(0, Math.round(Number(snap.remaining ?? state.remaining ?? 0)));
    state.remaining = nextRemaining;
    state.endAt = snap.endAt || (snap.running ? Date.now() + nextRemaining*1000 : null);
    state.running = !!snap.running && state.remaining > 0;
    state.habitWarnArmed = !!snap.habitWarnArmed;
    state.habitWarnFired = !!snap.habitWarnFired && state.habitWarnArmed;
    state.threeMinuteChime = !!snap.threeMinuteChime;
    state.lastChimeBucket = snap.lastChimeBucket || 0;
    state.ownerId = snap.ownerId || state.ownerId || instanceId;
    if(autoBox) autoBox.checked = !!snap.autoRestart;
    if(minInput) minInput.value = String(Math.floor(state.total/60));
    if(secInput) secInput.value = String(state.total%60);
    clearInterval(state.timerId);
    clearPendingRestart();
    if(state.running){
      startBtn.textContent = "Pause";
      updateUI(snap.statusText || "Counting", snap.statusMode || "active");
      tick();
      state.timerId = setInterval(tick, 250);
    }else{
      const label = state.remaining <= 0 ? "Restart" : (state.remaining < state.total ? "Resume" : "Start");
      startBtn.textContent = label;
      updateUI(snap.statusText || (state.remaining <= 0 ? "Done" : "Ready"), snap.statusMode || (state.remaining <= 0 ? "done" : "idle"));
    }
    isApplyingRemote = false;
  };

  const loadSavedState = ()=>{
    try{
      const raw = localStorage.getItem(COUNTDOWN_STATE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  };
  window.__plannerRestoreMicro = ()=> {
    const snap = loadSavedState();
    if(snap) applySnapshot(snap);
  };

  const requestStateFromPeers = ()=>{
    if(!bc) return;
    try{
      bc.postMessage({ type:"countdown-request", source: instanceId });
    }catch(e){}
  };

  const applyInputs = (shouldPersist=true)=>{
    const mins = Math.max(0, Number(minInput?.value || 0));
    const secs = Math.max(0, Number(secInput?.value || 0));
    const total = clampDuration(mins*60 + secs);
    state.total = total;
    state.remaining = total;
    state.habitWarnArmed = total === EXERCISE_PRESET;
    state.habitWarnFired = false;
    state.lastChimeBucket = 0;
    syncThreeMinuteChime();
    updateUI("Ready","idle");
    state.ownerId = instanceId;
    if(shouldPersist) persistState("Ready","idle");
  };

  const setStatus = (text, mode="active")=>{
    if(statusEl){
      statusEl.textContent = text;
      statusEl.dataset.state = mode;
    }
  };

  const updateUI = (statusText, mode="active")=>{
    if(display) display.textContent = fmt(state.remaining);
    if(progress){
      const pct = state.total ? Math.max(0, Math.min(100, (state.remaining/state.total)*100)) : 0;
      progress.style.width = `${pct}%`;
    }
    setStatus(statusText, mode);
  };

  const chime = ()=>{
    try{
      const ctx = getAudioContext();
      if(!ctx || ctx.state !== "running") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.25);
    }catch(e){}
  };

  const loudChime = ()=>{
    try{
      const ctx = getAudioContext();
      if(!ctx || ctx.state !== "running") return;
      const blast = (freq, offset)=>{
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + offset);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + offset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.55);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.6);
      };
      blast(920, 0);
      blast(760, 0.6);
      blast(1040, 1.2);
    }catch(e){}
  };

  const restartCue = ()=>{
    try{
      const ctx = getAudioContext();
      if(!ctx || ctx.state !== "running") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.95);
    }catch(e){}
  };

  const clearPendingRestart = ()=>{
    if(state.pendingRestart){ clearTimeout(state.pendingRestart); state.pendingRestart = null; }
    if(state.bufferTimerId){ clearInterval(state.bufferTimerId); state.bufferTimerId = null; }
    state.bufferStore = null;
  };

  const finish = ()=>{
    clearInterval(state.timerId);
    clearPendingRestart();
    const now = Date.now();
    const isOwner = !state.ownerId || state.ownerId === instanceId || (state.endAt && (now - state.endAt) > 1500);
    if(!state.ownerId) state.ownerId = instanceId;
    state.running = false;
    state.remaining = 0;
    state.timerId = null;
    startBtn.textContent = "Restart";
    updateUI("Done","done");
    if(isOwner){
      (state.exerciseMode ? loudChime : chime)();
      try{
        const utter = new SpeechSynthesisUtterance("Your drill is over.");
        utter.rate = 1.05;
        speechSynthesis.speak(utter);
      }catch(e){}
      if(typeof showToast === "function") showToast("Countdown finished!");
    }
    persistState("Done","done");
    if(!autoBox?.checked && typeof window.plannerWakeLockRelease === "function"){
      window.plannerWakeLockRelease();
    }
    if(autoBox?.checked && isOwner){
      state.remaining = state.total;
      state.lastChimeBucket = 0;
      if(state.bufferEnabled || state.exerciseMode){
        let bufferRemaining = state.bufferDelay;
        const showBuffer = ()=>{
          if(display) display.textContent = fmt(bufferRemaining);
          if(progress){
            const pct = Math.max(0, Math.min(100, (bufferRemaining/state.bufferDelay)*100));
            progress.style.width = `${pct}%`;
          }
          setStatus(`Restarting in ${bufferRemaining}s`,"idle");
          startBtn.textContent = `Wait ${bufferRemaining}s`;
        };
        showBuffer();
        state.bufferTimerId = setInterval(()=>{
          bufferRemaining -= 1;
          if(bufferRemaining <= 0){
            clearPendingRestart();
            restartCue();
            start();
          }else{
            showBuffer();
          }
        }, 1000);
      }else{
        setTimeout(start, 300);
      }
    }
  };

  const tick = ()=>{
    const left = Math.max(0, Math.round((state.endAt - Date.now())/1000));
    state.remaining = left;
    if(state.habitWarnArmed && !state.habitWarnFired && state.remaining <= 300){
      state.habitWarnFired = true;
      const msg = "Your habit study is over. Please restart it if you enabled that feature.";
      try{
        const utter = new SpeechSynthesisUtterance(msg);
        speechSynthesis.speak(utter);
      }catch(e){}
      if(typeof showToast === "function") showToast(msg, "warn");
    }
    updateUI("Counting","active");
    if(state.threeMinuteChime && state.remaining > 0){
      const elapsed = Math.max(0, state.total - state.remaining);
      const bucket = Math.floor(elapsed / 180);
      if(bucket > 0 && bucket !== state.lastChimeBucket){
        state.lastChimeBucket = bucket;
        chime();
      }
    }
    if(left <= 0) finish();
  };

  const start = ()=>{
    if(state.running) return;
    if(state.remaining <= 0 || state.total <= 0){
      applyInputs();
    }
    if(state.remaining >= state.total){
      state.lastChimeBucket = 0;
    }
    state.ownerId = instanceId;
    clearPendingRestart();
    state.running = true;
    state.endAt = Date.now() + state.remaining*1000;
    startBtn.textContent = "Pause";
    updateUI("Counting","active");
    const mins = Math.max(1, Math.round(state.remaining / 60));
    if(typeof window.plannerNotify === "function"){
      const resumed = state.remaining < state.total;
      const body = resumed
        ? `Micro focus timer resumed with ${mins} minutes remaining.`
        : `Micro focus timer started for ${mins} minutes.`;
      window.plannerNotify("Micro Timer", body, "micro-timer-start");
    }
    if(typeof window.plannerWakeLockAcquire === "function"){
      window.plannerWakeLockAcquire();
    }
    tick();
    state.timerId = setInterval(tick, 250);
    persistState("Counting","active");
  };

  const pause = ()=>{
    if(!state.running) return;
    state.ownerId = instanceId;
    state.running = false;
    clearInterval(state.timerId);
    state.timerId = null;
    state.remaining = Math.max(0, Math.round((state.endAt - Date.now())/1000));
    startBtn.textContent = "Resume";
    updateUI("Paused","idle");
    persistState("Paused","idle");
    if(typeof window.plannerWakeLockRelease === "function"){
      window.plannerWakeLockRelease();
    }
  };

  const reset = ()=>{
    clearInterval(state.timerId);
    clearPendingRestart();
    state.timerId = null;
    state.running = false;
    state.habitWarnFired = false;
    state.habitWarnArmed = state.total === EXERCISE_PRESET;
    state.remaining = state.total;
    applyInputs();
    startBtn.textContent = "Start";
    updateUI("Ready","idle");
    if(typeof window.plannerWakeLockRelease === "function"){
      window.plannerWakeLockRelease();
    }
  };

  const addMinute = ()=>{
    state.remaining = clampDuration(state.remaining + 60);
    state.total = Math.max(state.total, state.remaining);
    state.ownerId = instanceId;
    state.habitWarnArmed = state.habitWarnArmed || state.total === EXERCISE_PRESET;
    syncThreeMinuteChime();
    if(state.running){
      state.endAt = Date.now() + state.remaining*1000;
      updateUI("Counting","active");
      startBtn.textContent = "Pause";
      persistState("Counting","active");
    }else{
      updateUI("Ready","idle");
      startBtn.textContent = "Start";
      persistState("Ready","idle");
    }
  };
  const subFive = ()=>{
    state.remaining = clampDuration(state.remaining - 300);
    state.total = Math.max(state.total, state.remaining);
    state.ownerId = instanceId;
    state.habitWarnArmed = state.habitWarnArmed || state.total === EXERCISE_PRESET;
    syncThreeMinuteChime();
    if(minInput) minInput.value = String(Math.floor(state.remaining/60));
    if(secInput) secInput.value = String(state.remaining%60);
    if(state.running){
      state.endAt = Date.now() + state.remaining*1000;
      updateUI("Counting","active");
      startBtn.textContent = "Pause";
      persistState("Counting","active");
    }else{
      updateUI("Ready","idle");
      startBtn.textContent = "Start";
      persistState("Ready","idle");
    }
  };

  startBtn?.addEventListener("click", ()=> state.running ? pause() : start());
  resetBtn?.addEventListener("click", reset);
  addBtn?.addEventListener("click", addMinute);
  subBtn?.addEventListener("click", subFive);
  bufferToggle?.addEventListener("click", ()=>{
    if(state.exerciseMode){
      state.bufferEnabled = true;
      syncBufferToggle();
      persistState(statusEl?.textContent || "Ready", statusEl?.dataset.state || "idle");
      return;
    }
    state.bufferEnabled = !state.bufferEnabled;
    if(!state.bufferEnabled) clearPendingRestart();
    syncBufferToggle();
    state.ownerId = instanceId;
    persistState(statusEl?.textContent || "Ready", statusEl?.dataset.state || "idle");
  });
  syncBufferToggle();
  presets.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const val = clampDuration(Number(btn.dataset.preset || 300));
      setExerciseMode(val === EXERCISE_PRESET);
      state.total = val;
      state.remaining = val;
      state.ownerId = instanceId;
      if(minInput) minInput.value = String(Math.floor(val/60));
      if(secInput) secInput.value = String(val%60);
      startBtn.textContent = "Start";
      state.habitWarnArmed = val === EXERCISE_PRESET;
      state.habitWarnFired = false;
      state.lastChimeBucket = 0;
      syncThreeMinuteChime();
      updateUI("Ready","idle");
      persistState("Ready","idle");
    });
  });
  const handleManualChange = ()=>{
    setExerciseMode(false);
    applyInputs();
  };
  [minInput, secInput].forEach(inp=>{
    inp?.addEventListener("change", handleManualChange);
    inp?.addEventListener("input", ()=>{ if(state.running) pause(); });
  });
  autoBox?.addEventListener("change", ()=>{
    if(!autoBox.checked) clearPendingRestart();
    state.ownerId = instanceId;
    persistState(statusEl?.textContent || "Ready", statusEl?.dataset.state || "idle");
  });

  if(bc){
    bc.addEventListener("message", (event)=>{
      const msg = event?.data;
      if(!msg || typeof msg !== "object") return;
      if(msg.type === "countdown-state"){
        applySnapshot(msg.payload);
      }else if(msg.type === "countdown-request"){
        if(msg.source && msg.source === instanceId) return;
        persistState(statusEl?.textContent || "Ready", statusEl?.dataset.state || "idle", true);
      }
    });
  }
  window.addEventListener("storage", (e)=>{
    if(e.key !== COUNTDOWN_STATE_KEY) return;
    if(!e.newValue) return;
    try{
      applySnapshot(JSON.parse(e.newValue));
    }catch(err){}
  });

  const saved = loadSavedState();
  if(saved){
    applySnapshot(saved);
  }else{
    applyInputs(false);
  }
  requestStateFromPeers();
})();

// Laundry countdown timer (90 minute preset)
(function initLaundryTimer(){
  const shell = document.getElementById("laundry-shell");
  if(!shell) return;
  const display = document.getElementById("laundry-display");
  const statusEl = document.getElementById("laundry-status");
  const startBtn = document.getElementById("laundry-start");
  const addBtn = document.getElementById("laundry-add");
  const subBtn = document.getElementById("laundry-sub");
  const resetBtn = document.getElementById("laundry-reset");

  const state = { total:5400, remaining:5400, running:false, timerId:null, endAt:null, oneMinuteWarned:false, updatedAt:0 };
  const LAUNDRY_STATE_KEY = "planner_laundry_state_v1";
  const clampDuration = (sec)=>Math.min(60*240, Math.max(60, Math.round(sec||0)));
  const fmt = (sec)=>{
    const m = Math.floor(sec/60);
    const s = sec % 60;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };
  const setStatus = (text, mode="active")=>{
    if(statusEl){ statusEl.textContent = text; statusEl.dataset.state = mode; }
  };
  const updateUI = (label, mode="active")=>{
    if(display) display.textContent = fmt(state.remaining);
    setStatus(label, mode);
  };
  const persistState = (label, mode="active")=>{
    state.updatedAt = Date.now();
    try{ localStorage.setItem(LAUNDRY_STATE_KEY, JSON.stringify({
      total: state.total,
      remaining: state.remaining,
      running: state.running,
      endAt: state.running ? state.endAt : null,
      oneMinuteWarned: state.oneMinuteWarned,
      label,
      mode,
      updatedAt: state.updatedAt
    })); }catch(e){}
  };
  const loadState = ()=>{
    try{
      const raw = localStorage.getItem(LAUNDRY_STATE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  };
  const applyState = (snap)=>{
    if(!snap) return;
    state.total = snap.total || state.total;
    state.remaining = Math.max(0, Math.round(snap.remaining || state.remaining));
    state.oneMinuteWarned = !!snap.oneMinuteWarned;
    if(snap.running && snap.endAt){
      state.running = true;
      state.endAt = snap.endAt;
      startBtn.textContent = "Pause";
      tick();
      state.timerId = setInterval(tick, 500);
    }else{
      state.running = false;
      state.endAt = null;
      startBtn.textContent = "Start";
      updateUI(snap.label || "Ready", snap.mode || "idle");
    }
  };
  const chime = ()=>{
    try{
      const ctx = getAudioContext();
      if(!ctx || ctx.state !== "running") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1);
    }catch(e){}
  };
  const finish = ()=>{
    clearInterval(state.timerId);
    state.running = false;
    state.timerId = null;
    state.remaining = 0;
    startBtn.textContent = "Restart";
    updateUI("Done","done");
    chime();
    if(typeof showToast === "function") showToast("Laundry timer finished â€” switch loads!", "warn");
    persistState("Done","done");
    if(typeof window.plannerWakeLockRelease === "function"){
      window.plannerWakeLockRelease();
    }
  };
  const tick = ()=>{
    state.remaining = Math.max(0, Math.round((state.endAt - Date.now())/1000));
    if(state.remaining <= 60 && !state.oneMinuteWarned){
      state.oneMinuteWarned = true;
      const msg = "You have one minute left. Go check your laundry immediately.";
      if(typeof showToast === "function") showToast(msg, "warn");
      try{
        const utter = new SpeechSynthesisUtterance(msg);
        utter.rate = 1.05;
        speechSynthesis.speak(utter);
      }catch(e){}
    }
    updateUI("Counting","active");
    if(state.remaining <= 0) finish();
  };
  const start = ()=>{
    if(state.running) return;
    if(state.remaining <= 0) state.remaining = state.total;
    state.oneMinuteWarned = state.remaining <= 60 ? state.oneMinuteWarned : false;
    state.running = true;
    state.endAt = Date.now() + state.remaining*1000;
    startBtn.textContent = "Pause";
    updateUI("Counting","active");
    const mins = Math.max(1, Math.round(state.remaining / 60));
    if(typeof window.plannerNotify === "function"){
      const resumed = state.remaining < state.total;
      const body = resumed
        ? `Laundry timer resumed with ${mins} minutes remaining.`
        : `Laundry timer started for ${mins} minutes.`;
      window.plannerNotify("Laundry Timer", body, "laundry-timer-start");
    }
    if(typeof window.plannerWakeLockAcquire === "function"){
      window.plannerWakeLockAcquire();
    }
    tick();
    state.timerId = setInterval(tick, 500);
    persistState("Counting","active");
  };
  const pause = ()=>{
    if(!state.running) return;
    state.running = false;
    clearInterval(state.timerId);
    state.timerId = null;
    state.remaining = Math.max(0, Math.round((state.endAt - Date.now())/1000));
    startBtn.textContent = "Resume";
    updateUI("Paused","idle");
    if(typeof window.plannerWakeLockRelease === "function"){
      window.plannerWakeLockRelease();
    }
    persistState("Paused","idle");
  };
  const reset = ()=>{
    clearInterval(state.timerId);
    state.running = false;
    state.timerId = null;
    state.remaining = state.total;
    state.oneMinuteWarned = false;
    startBtn.textContent = "Start";
    updateUI("Ready","idle");
    if(typeof window.plannerWakeLockRelease === "function"){
      window.plannerWakeLockRelease();
    }
    persistState("Ready","idle");
  };
  const addFive = ()=>{
    state.remaining = clampDuration(state.remaining + 300);
    state.total = Math.max(state.total, state.remaining);
    state.oneMinuteWarned = state.remaining <= 60 ? state.oneMinuteWarned : false;
    if(state.running){
      state.endAt = Date.now() + state.remaining*1000;
      updateUI("Counting","active");
      startBtn.textContent = "Pause";
    }else{
      updateUI("Ready","idle");
    }
  };
  const subFive = ()=>{
    state.remaining = clampDuration(state.remaining - 300);
    state.total = Math.max(state.total, state.remaining);
    state.oneMinuteWarned = state.remaining <= 60 ? state.oneMinuteWarned : false;
    if(state.running){
      state.endAt = Date.now() + state.remaining*1000;
      startBtn.textContent = "Pause";
      updateUI("Counting","active");
    }else{
      updateUI("Ready","idle");
    }
  };

  startBtn?.addEventListener("click", ()=> state.running ? pause() : start());
  resetBtn?.addEventListener("click", reset);
  addBtn?.addEventListener("click", addFive);
  subBtn?.addEventListener("click", subFive);

  const saved = loadState();
  if(saved) applyState(saved);
  else updateUI("Ready","idle");
  window.__plannerRestoreLaundry = ()=> applyState(loadState());
})();


