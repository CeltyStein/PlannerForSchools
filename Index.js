(function(){
  const dayOrder = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const PLANNER_DAY_ORDER_KEY = "planner_day_order";
  const PLANNER_DAY_LABELS_KEY = "planner_day_labels";
  function getUpcomingSunday(){
    const d = new Date();
    const day = d.getDay();
    const offset = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + offset);
    d.setHours(23,59,0,0);
    return d;
  }
  function getStoredCalendarEvents(){
    try{
      const raw = localStorage.getItem("planner-calendar-events");
      return raw ? JSON.parse(raw) : [];
    }catch(e){
      return [];
    }
  }
  const moodOptions = [
    { emoji: "??", label: "Grateful" },
    { emoji: "??", label: "Calm" },
    { emoji: "??", label: "Tired" },
    { emoji: "??", label: "Overwhelmed" },
    { emoji: "??", label: "Confident" },
    { emoji: "??", label: "Centered" },
    { emoji: "??", label: "Playful" }
  ];
  const buttonSelector = "button, .tab";
  let plannerDayOrder = [...dayOrder];
  let plannerDayLabels = {};
  let dragPayload = null;
  let audioCtx = null;
  const audioCtor = window.AudioContext || window.webkitAudioContext;
  const SOUND_EFFECTS_KEY = "planner_sound_effects";
  const GLOW_HUE_KEY = "planner_glow_hue";
  const DEFAULT_GLOW_HUE = "#ef4444"; // default red glow
  const PULSE_PREF_KEY = "planner_pulse_glow";
  const WAKE_LOCK_KEY = "planner_wake_lock_enabled";
  let wakeLockEnabled = true;
  const loadWakeLockEnabled = ()=>{
    try{
      const raw = localStorage.getItem(WAKE_LOCK_KEY);
      if(raw === null) return true;
      return raw !== "false";
    }catch(e){
      return true;
    }
  };
  const saveWakeLockEnabled = (val)=>{
    try{ localStorage.setItem(WAKE_LOCK_KEY, val ? "true" : "false"); }catch(e){}
  };
  let wakeLock = null;
  let wakeLockCount = 0;
  const canNotify = ()=> typeof Notification !== "undefined";
  const sendPlannerNotification = (title, body, tag)=>{
    if(!canNotify()) return;
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
  const requestPlannerWakeLock = async ()=>{
    if(!wakeLockEnabled) return false;
    if(!("wakeLock" in navigator)) return false;
    wakeLockCount += 1;
    if(wakeLock) return true;
    try{
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", ()=>{ wakeLock = null; });
      return true;
    }catch(e){
      wakeLockCount = Math.max(0, wakeLockCount - 1);
      wakeLock = null;
      return false;
    }
  };
  const releasePlannerWakeLock = ()=>{
    wakeLockCount = Math.max(0, wakeLockCount - 1);
    if(wakeLockCount === 0 && wakeLock){
      try{ wakeLock.release(); }catch(e){}
      wakeLock = null;
    }
  };
  const setWakeLockEnabled = (val)=>{
    wakeLockEnabled = !!val;
    saveWakeLockEnabled(wakeLockEnabled);
    window.plannerWakeLockEnabled = wakeLockEnabled;
    if(!wakeLockEnabled) releasePlannerWakeLock();
  };
  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "visible" && wakeLockEnabled && wakeLockCount > 0 && !wakeLock){
      requestPlannerWakeLock();
    }
  });
  wakeLockEnabled = loadWakeLockEnabled();
  window.plannerWakeLockEnabled = wakeLockEnabled;
  window.plannerNotify = window.plannerNotify || sendPlannerNotification;
  window.plannerWakeLockAcquire = window.plannerWakeLockAcquire || requestPlannerWakeLock;
  window.plannerWakeLockRelease = window.plannerWakeLockRelease || releasePlannerWakeLock;
  const loadSoundEffects = ()=>{
    try{
      const raw = localStorage.getItem(SOUND_EFFECTS_KEY);
      if(raw === null) return location.protocol === "file:" ? false : true;
      return raw !== "false";
    }catch(e){
      return location.protocol === "file:" ? false : true;
    }
  };
  const saveSoundEffects = (val)=>{
    try{ localStorage.setItem(SOUND_EFFECTS_KEY, val ? "true" : "false"); }catch(e){}
  };
  const normalizeHex = (value)=>{
    if(!value) return "";
    let hex = String(value).trim();
    if(!hex) return "";
    if(hex[0] !== "#") hex = `#${hex}`;
    if(/^#[0-9a-f]{3}$/i.test(hex)){
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    if(!/^#[0-9a-f]{6}$/i.test(hex)) return "";
    return hex.toLowerCase();
  };
  const hexToRgb = (hex)=>{
    const clean = normalizeHex(hex);
    if(!clean) return null;
    const num = parseInt(clean.slice(1), 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  };
  const rgbToHex = ({ r, g, b })=>{
    const toHex = (val)=> Math.max(0, Math.min(255, val)).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };
  const mixColors = (baseHex, mixHex, weight = 0.2)=>{
    const base = hexToRgb(baseHex);
    const mix = hexToRgb(mixHex);
    if(!base || !mix) return normalizeHex(baseHex) || DEFAULT_GLOW_HUE;
    const w = Math.max(0, Math.min(1, weight));
    const blend = {
      r: Math.round(base.r * (1 - w) + mix.r * w),
      g: Math.round(base.g * (1 - w) + mix.g * w),
      b: Math.round(base.b * (1 - w) + mix.b * w)
    };
    return rgbToHex(blend);
  };
  const applyGlowHue = (hex)=>{
    const base = normalizeHex(hex) || DEFAULT_GLOW_HUE;
    const accent2 = mixColors(base, "#ffffff", 0.2);
    const baseRgb = hexToRgb(base);
    const accent2Rgb = hexToRgb(accent2);
    const targets = [document.documentElement, document.body].filter(Boolean);
    targets.forEach((el)=>{
      el.style.setProperty("--accent", base);
      el.style.setProperty("--accent-2", accent2);
      if(baseRgb){
        el.style.setProperty("--accent-rgb", `${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}`);
      }
      if(accent2Rgb){
        el.style.setProperty("--accent-2-rgb", `${accent2Rgb.r}, ${accent2Rgb.g}, ${accent2Rgb.b}`);
      }
    });
  };
  const applyPulseGlow = (prefs)=>{
    const root = document.documentElement;
    const strength = Math.max(0.2, Math.min(1, Number(prefs?.strength ?? 0.55)));
    const brightness = Math.max(0.2, Math.min(1, Number(prefs?.brightness ?? 0.9)));
    const speed = Math.max(2, Math.min(12, Number(prefs?.speed ?? 5.2)));
    root.style.setProperty("--pulse-glow-base", `rgba(var(--accent-rgb),${strength})`);
    root.style.setProperty("--pulse-glow-peak", `rgba(var(--accent-rgb),${brightness})`);
    root.style.setProperty("--pulse-glow-speed", `${speed}s`);
  };
  const loadPulsePrefs = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem(PULSE_PREF_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    }catch(e){
      return {};
    }
  };
  const savePulsePrefs = (prefs)=>{
    try{ localStorage.setItem(PULSE_PREF_KEY, JSON.stringify(prefs||{})); }catch(e){}
  };
  const initGlowHueControls = ()=>{
    const picker = document.getElementById("glow-hue-picker");
    const resetBtn = document.getElementById("glow-hue-reset");
    let stored = "";
    try{ stored = localStorage.getItem(GLOW_HUE_KEY) || ""; }catch(e){}
    const initial = normalizeHex(stored) || DEFAULT_GLOW_HUE;
    applyGlowHue(initial);
    if(picker) picker.value = initial;
    picker?.addEventListener("input", (e)=>{
      const next = normalizeHex(e.target.value) || DEFAULT_GLOW_HUE;
      applyGlowHue(next);
      try{ localStorage.setItem(GLOW_HUE_KEY, next); }catch(err){}
    });
    resetBtn?.addEventListener("click", ()=>{
      applyGlowHue(DEFAULT_GLOW_HUE);
      if(picker) picker.value = DEFAULT_GLOW_HUE;
      try{ localStorage.removeItem(GLOW_HUE_KEY); }catch(err){}
    });
  };
  const initPulseControls = ()=>{
    const speedInput = document.getElementById("pulse-speed");
    const brightnessInput = document.getElementById("pulse-brightness");
    const strengthInput = document.getElementById("pulse-strength");
    const resetBtn = document.getElementById("pulse-reset");
    const prefs = loadPulsePrefs();
    if(speedInput) speedInput.value = String(prefs.speed ?? 5.2);
    if(brightnessInput) brightnessInput.value = String(prefs.brightness ?? 0.9);
    if(strengthInput) strengthInput.value = String(prefs.strength ?? 0.55);
    applyPulseGlow(prefs);
    const persist = ()=>{
      const next = {
        speed: Number(speedInput?.value || 5.2),
        brightness: Number(brightnessInput?.value || 0.9),
        strength: Number(strengthInput?.value || 0.55)
      };
      savePulsePrefs(next);
      applyPulseGlow(next);
    };
    speedInput?.addEventListener("input", persist);
    brightnessInput?.addEventListener("input", persist);
    strengthInput?.addEventListener("input", persist);
    resetBtn?.addEventListener("click", ()=>{
      const defaults = { speed: 5.2, brightness: 0.9, strength: 0.55 };
      if(speedInput) speedInput.value = String(defaults.speed);
      if(brightnessInput) brightnessInput.value = String(defaults.brightness);
      if(strengthInput) strengthInput.value = String(defaults.strength);
      savePulsePrefs(defaults);
      applyPulseGlow(defaults);
    });
    window.addEventListener("storage", (event)=>{
      if(event.key === PULSE_PREF_KEY){
        const next = loadPulsePrefs();
        if(speedInput) speedInput.value = String(next.speed ?? 5.2);
        if(brightnessInput) brightnessInput.value = String(next.brightness ?? 0.9);
        if(strengthInput) strengthInput.value = String(next.strength ?? 0.55);
        applyPulseGlow(next);
      }
    });
  };
  let soundEffectsEnabled = loadSoundEffects();
  window.soundEffectsEnabled = soundEffectsEnabled;
  let audioDisabled = !audioCtor;
  let audioUnlocked = false;
  const unlockAudio = ()=>{ audioUnlocked = true; };
  document.addEventListener("pointerdown", unlockAudio, { once: true });
  document.addEventListener("keydown", unlockAudio, { once: true });
  const setSoundEffectsEnabled = (val)=>{
    soundEffectsEnabled = !!val;
    window.soundEffectsEnabled = soundEffectsEnabled;
    saveSoundEffects(soundEffectsEnabled);
    if(soundEffectsEnabled && audioCtor) audioDisabled = false;
    if(!soundEffectsEnabled && audioCtx){
      try{ audioCtx.close(); }catch(e){}
      audioCtx = null;
    }
  };
  const soundEffectsToggle = document.getElementById("sound-effects-toggle");
  if(soundEffectsToggle){
    soundEffectsToggle.checked = soundEffectsEnabled;
    soundEffectsToggle.addEventListener("change", ()=> setSoundEffectsEnabled(soundEffectsToggle.checked));
  }
  initGlowHueControls();
  initPulseControls();
  const confettiWrapper = document.getElementById("confetti-wrapper");
  const celebrationOverlay = document.getElementById("celebration-overlay");
  const celebrationTitle = document.getElementById("celebration-title");
  const celebrationText = document.getElementById("celebration-text");
  const celebrationClose = document.getElementById("celebration-close");
  const confettiColors = ["#a855f7","#f59e0b","#10b981","#3b82f6","#ec4899"];
  const fallbackClassEvents = [
    { title:"Knowledge Check: CompTIA Linux+ and LPIC-1 Pre-Assessment Quiz [25/FA CSC-121-OL01]", start:"2025-10-19T00:00:00.000Z", end:"2025-10-19T23:59:00.000Z", allDay:true, description:"Pre-assessment quiz for Linux+ and LPIC-1." },
    { title:"Lab 9-1: Digital Forensics Analysis and Validation [25/FA CIS-602-OL01]", start:"2025-10-19T00:00:00.000Z", end:"2025-10-19T23:59:00.000Z", allDay:true, description:"Digital forensics lab." },
    { title:"Linux Chapter One Discussion Post [25/FA CSC-121-OL01]", start:"2025-10-19T00:00:00.000Z", end:"2025-10-19T23:59:00.000Z", allDay:true, description:"Initial post Friday, replies Sunday." },
    { title:"Module 9 Discussion [25/FA CIS-602-OL01]", start:"2025-10-19T00:00:00.000Z", end:"2025-10-19T23:59:00.000Z", allDay:true, description:"Data-hiding techniques discussion." },
    { title:"Module 9 Quiz [25/FA CIS-602-OL01]", start:"2025-10-19T00:00:00.000Z", end:"2025-10-19T23:59:00.000Z", allDay:true, description:"Weekly module quiz." },
    { title:"Quiz: Chapter 01 Introduction to Linux [25/FA CSC-121-OL01]", start:"2025-10-19T00:00:00.000Z", end:"2025-10-19T23:59:00.000Z", allDay:true, description:"Linux chapter 1 quiz." },
    { title:"Simulation 1-1: Overview of Linux [25/FA CSC-121-OL01]", start:"2025-10-19T00:00:00.000Z", end:"2025-10-19T23:59:00.000Z", allDay:true, description:"Hands-on Linux simulation." }
  ];
  function ensureAudio(){
    if(audioDisabled || !audioUnlocked || !soundEffectsEnabled) return null;
    if(audioCtx && audioCtx.state !== "closed") return audioCtx;
    try{
      audioCtx = new audioCtor();
      audioCtx.onstatechange = ()=>{
        if(audioCtx && audioCtx.state === "closed") audioCtx = null;
      };
    }catch(e){
      audioDisabled = true;
      audioCtx = null;
    }
    if(audioCtx && audioCtx.state === "suspended"){
      audioCtx.resume().catch(()=>{
        audioDisabled = true;
        try{ audioCtx.close(); }catch(e){}
        audioCtx = null;
      });
    }
    return audioCtx;
  }
  function playClickTone(){
    const ctx = ensureAudio();
    if(!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(540, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }
  function launchConfetti(){
    if(!confettiWrapper) return;
    const pieces = 24;
    for(let i=0;i<pieces;i++){
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      const delay = Math.random() * 0.4;
      const left = Math.random() * 100;
      const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      piece.style.left = `${left}%`;
      piece.style.background = color;
      piece.style.animationDuration = `${1.4 + Math.random()}s`;
      piece.style.animationDelay = `${delay}s`;
      confettiWrapper.append(piece);
      piece.addEventListener("animationend", ()=> piece.remove());
    }
  }
  // Hide the streak celebration overlay.
  function hideCelebration(){
    if(!celebrationOverlay) return;
    celebrationOverlay.classList.add("hidden");
  }
  // Show the streak celebration overlay with custom text.
  function showCelebration(title, text){
    if(!celebrationOverlay) return;
    if(celebrationTitle) celebrationTitle.textContent = title;
    if(celebrationText) celebrationText.textContent = text;
    celebrationOverlay.classList.remove("hidden");
    clearTimeout(celebrationTimer);
    celebrationTimer = setTimeout(()=> hideCelebration(), 3800);
    launchConfetti();
  }
  celebrationClose?.addEventListener("click", hideCelebration);
  celebrationOverlay?.addEventListener("click", e=>{ if(e.target === celebrationOverlay) hideCelebration(); });
  function animateButton(el){
    if(!el) return;
    el.classList.add("btn-press");
    setTimeout(()=>el.classList.remove("btn-press"),180);
  }
  document.addEventListener("click", evt=>{
    const btn = evt.target.closest(buttonSelector);
    if(!btn) return;
    animateButton(btn);
    playClickTone();
  });

  const sample = {
    Monday: [
      "6 AM: Wake, shower, breakfast",
      "7-9 AM: Finish Essays (Pomodoro cycles)",
      "9-12 PM: Polish Essays (Pomodoro cycles)",
      "12 PM: Lunch + Coursera",
      "1-5 PM: Finish essays and discussion posts",
      "5-6 PM: Dinner",
      "6-7 PM: Quizzes/Labs (Pomodoro w/ breaks)",
      "7-7:30 PM: Emails",
      "8 PM: Night routine and sleep"
    ],
    Tuesday: [
      "6 AM: Wake, shower, breakfast",
      "7-9 AM: Chill Skills",
      "10-11 AM: Martial arts",
      "11-12 PM: Chill Skills",
      "12 PM: Lunch",
      "1-5 PM: Relax (Manga, Anime)",
      "5-6 PM: Dinner",
      "6-7 PM: Free",
      "7-8:30 PM: Emails (7:30-8)",
      "8:30-9 PM: Night Routine",
      "9-11 PM: Sleep"
    ],
    Wednesday: [
      "6 AM: Wake, shower, breakfast",
      "7-9 AM: Relax",
      "11-12 PM: Work",
      "12 PM: Lunch (Spanish/Japanese)",
      "1-5 PM: Work",
      "5-6 PM: Dinner + rehab stretch",
      "7-8:30 PM: Gym (weights/conditioning)",
      "8:30-9 PM: Night Routine",
      "9-11 PM: Sleep"
    ],
    Thursday: [
      "6 AM: Wake, shower, breakfast",
      "7-9 AM: Make Discussion replies",
      "10-11 AM: Martial arts",
      "11-12 PM: Do Extra Labs",
      "12 PM: Lunch",
      "1-5 PM: Study the textbooks",
      "5-6 PM: Dinner",
      "7-8:30 PM: Gym (weights/conditioning)",
      "8:30-9 PM: Shower + Night Routine + Sleep",
      "9-11 PM: Sleep"
    ],
    Friday: [
      "6 AM: Wake, shower, breakfast",
      "7-9 AM: Study the textbooks",
      "9-12 PM: Make a self-study guide based on discussion post, essays, etc.",
      "1-5 PM: Textbook Study (Pomodoro cycles)",
      "5-6 PM: Dinner",
      "6-7 PM: Gym (weights)",
      "7-8:30 PM: Jiu-Jitsu",
      "8:30-9 PM: Night Routine",
      "9-11 PM: Sleep"
    ],
    Saturday: [
      "6 AM: Wake, shower, breakfast",
      "7-9 AM: Me Time Skills",
      "10-11 AM: Martial arts",
      "11-12 PM: Textbook Studies (Pomodoro)",
      "12 PM: Lunch",
      "1-5 PM: Textbook Studies (Pomodoro cycles)",
      "5-6 PM: Dinner",
      "6-7 PM: Textbook Studies",
      "7-8:30 PM: Textbook Studies",
      "8:30-9 PM: Night Routine",
      "9-11 PM: Sleep"
    ],
    Sunday: [
      "6 AM: Wake, shower, breakfast",
      "7-9 AM: Textbook Studies (Pomodoro)",
      "12 PM: Lunch",
      "1-5 PM: Textbook Studies (Pomodoro)",
      "5-6 PM: Dinner",
      "6-7 PM: Free",
      "7-8:30 PM: Plan next week",
      "8:30-9 PM: Night Routine",
      "9-11 PM: Sleep"
    ]
  };
   const HABIT_CATEGORIES = [
    { id: "study", label: "?? Study/Work", emoji: "??" },
    { id: "exercise", label: "??? Exercise", emoji: "???" },
    { id: "meals", label: "?? Meals", emoji: "??" },
    { id: "admin", label: "?? Morning/Admin", emoji: "??" },
    { id: "free", label: "?? Free/Breaks", emoji: "??" },
    { id: "night", label: "?? Night", emoji: "??" },
    { id: "none", label: "?? None", emoji: "??" },
  ];
  const defaultHabits = [
    { name: "Spanish/French", cat: "study", type:"normal", target:7 },
    { name: "Stretch", cat: "exercise", type:"normal", target:7 },
    { name: "Stretching", cat: "exercise", type:"normal", target:7 },
    { name: "Break ideas", cat: "exercise", type:"normal", target:7 },
    { name: "Guitar/Violin", cat: "study", type:"normal", target:7 },
    { name: "Calligraphy/Shorthand", cat: "study", type:"normal", target:7 },
    { name: "Japanese", cat: "study", type:"normal", target:7 },
    { name: "Technique", cat: "study", type:"normal", target:7 },
    { name: "Sewing", cat: "study", type:"normal", target:7 },
    { name: "Coding", cat: "study", type:"normal", target:7 },
    { name: "Night routine", cat: "night", type:"normal", target:7 },
  ];
  const blankWeek = () => [false,false,false,false,false,false,false];
  const habitCatById = (id) => HABIT_CATEGORIES.find(c => c.id === id) || HABIT_CATEGORIES[HABIT_CATEGORIES.length-1];
  const habitCatFromLabel = (label="")=>{
    const lc = label.trim().toLowerCase();
    return HABIT_CATEGORIES.find(c=>c.id===lc || c.label.toLowerCase()===lc || c.emoji===label.trim()) || HABIT_CATEGORIES[HABIT_CATEGORIES.length-1];
  };
  const createHabitId = (name="habit")=>{
    const safe = String(name||"habit").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "habit";
    return `habit-${safe}-${Date.now().toString(36)}-${Math.floor(Math.random()*9000)+1000}`;
  };
  const normalizeHabit = (h={}) => {
    const type = ["weekly","monthly","normal"].includes(h.type) ? h.type : "normal";
    const target = Math.max(1, Math.min(7, Number(h.target)||7));
    return {
      id: h.id || createHabitId(h.name),
      name: h.name || "New habit",
      cat: habitCatById(h.cat || "none").id,
      type,
      target,
      weeklyLog: h.weeklyLog && typeof h.weeklyLog==="object" ? h.weeklyLog : {},
      monthlyLog: h.monthlyLog && typeof h.monthlyLog==="object" ? h.monthlyLog : {},
      days: Array.from({length:7}, (_,i)=> !!(h.days && h.days[i]))
    };
  };
  const defaultRoadmap = [
    { id:"phase-goals", title:"Big Picture Calisthenics Goals", range:"Skill checklist", focus:["Front lever & back lever progressions","Full planche or strong straddle planche","90° hold + handstand pushups","One-arm pullup progressions","Maltese / Iron Cross basics","Human flag and static holds","Backflip and freestyle flow"], checkpoints:[] },
    { id:"phase-1", title:"Phase 1 - Foundation & Habit", range:"0-8 weeks", focus:["Everyday Warmup + Night Stretch most days","Strength 3x/week (chest/back, legs/abs/traps, arms/shoulder/wrist)","Skill practice 4-6x/week with low volume quality reps","Fix wrist/shoulder issues before pushing difficulty"], checkpoints:["30-60s comfortable wall handstand","8-10 clean dips and pullups","Controlled dragon flag negatives to halfway","No persistent wrist/shoulder pain for 2-3 weeks"] },
    { id:"phase-2", title:"Phase 2 - Skill Families", range:"2-6 months", focus:["Pull skills on Mon + Fri","Push skills on Tue + Fri","Inversions/handstands on Wed + Thu","Protect technique by keeping fatigue low"], checkpoints:["5-10s tuck front/back lever holds","5-10s freestanding handstand","Controlled jump to backbend or flip progression"] },
    { id:"phase-3", title:"Phase 3 - Peak Skills & Freestyle", range:"6-18+ months", focus:["Test lever/planche holds weekly and film form","Build handstand pushups + one-arm pullups","Lock in safe backflip on proper surface","Keep heavy Saturday strength high"], checkpoints:["3-5s straddle front/back lever","3-5s straddle planche or strong pseudo planche pushups","Consistent backflip","Weighted pullups trending toward one-arm pullup","Visible recovery plan and film-ready form"] }
  ];
  const defaultSkills = [
    { id:"planche", title:"Planche", stages:["Tuck","Advanced Tuck","Straddle","Full"], level:0 },
    { id:"lever", title:"Front Lever", stages:["Tuck","Advanced Tuck","One-leg","Straddle","Full"], level:0 },
    { id:"backlever", title:"Back Lever", stages:["Tuck","Advanced Tuck","Straddle","Full"], level:0 },
    { id:"handstand", title:"Handstand", stages:["Wall hold","Wall away","Freestanding 5s","Freestanding 20s"], level:0 },
    { id:"pistol", title:"Pistol Squat", stages:["Assisted","Box","Full bodyweight","Weighted"], level:0 }
  ];
  const defaultRoutines = [
    {
      id:"push-day",
      title:"Push Day",
      category:"strength",
      tag:"Strength",
      items:[
        "Ring or bar dips 4x8",
        "Pseudo-planche pushups 4x10",
        "Handstand pushup (wall) 4x6",
        "Incline press or elevated pushups 4x12",
        "Lateral raises + triceps finisher"
      ]
    },
    {
      id:"pull-day",
      title:"Pull Day",
      category:"strength",
      tag:"Strength",
      items:[
        "Weighted or tempo pullups 4x6-8",
        "Front lever rows 4x8",
        "Chest-supported row 4x10",
        "Face pulls / band pull-aparts 3x20",
        "Dead hang or scap hangs 3x30-60s"
      ]
    },
    {
      id:"leg-day",
      title:"Leg Day",
      category:"strength",
      tag:"Strength",
      items:[
        "Pistol squats 3x8 each",
        "Bulgarian split squats 4x12",
        "Nordic curls 3x6",
        "Calf raises 4x20",
        "Wall sit 3x60s"
      ]
    },
    {
      id:"core-blaster",
      title:"Core Blaster",
      category:"core",
      tag:"Core",
      items:[
        "Hollow hold 4x30s",
        "Dragon flag negatives 3x5",
        "Hanging leg raise 4x10",
        "L-sit or tuck L-sit 5x15s",
        "Side plank 3x45s/side"
      ]
    },
    {
      id:"skill-session",
      title:"Skill Session",
      category:"skills",
      tag:"Skills",
      items:[
        "Handstand line + balance drills 10 min",
        "Planche leans (tuck/adv tuck) 5x20s",
        "Front lever tuck holds/rows 5x10s",
        "Back lever tuck holds 4x10s",
        "Freestyle flow or combos 10 min"
      ]
    },
    {
      id:"ankle-rehab",
      title:"Ankle Rehab",
      category:"recovery",
      tag:"Recovery",
      items:[
        "Tib raises 3x20",
        "Banded eversion/inversion 3x15",
        "Single-leg calf raises 4x20",
        "Balance board or single-leg balance 3x45s",
        "Light stretch + ice/heat 5-10 min"
      ]
    },
    {
      id:"technique-saturday",
      title:"Technique Saturday",
      category:"skills",
      tag:"Skills",
      items:[
        "Front lever practice",
        "Planche leans + tuck planche",
        "Handstand balance & entries",
        "Ring muscle-up drills",
        "Freestyle calisthenics flow"
      ]
    }
  ];
  let routinesState = defaultRoutines.map(normalizeRoutine);
  let routineFilter = "all";

  // storage detection
  const hasStorage = (()=>{ try { const k="__t"; localStorage.setItem(k,"1"); localStorage.removeItem(k); return true; } catch(e){ return false; } })();
  const S_KEY="planner_v3_data"; const M_KEY="planner_v3_mood"; const E_KEY="planner_v3_edit";
  const J_KEY="planner_v3_journal"; const NOTES_KEY="planner_v3_notes";
  const WORKOUT_KEY="planner_v3_workout"; const ROADMAP_KEY="planner_v3_roadmap"; const SKILL_KEY="planner_v3_skills"; const COACH_KEY="planner_v3_coach";
  const ROUTINE_OPEN_KEY="planner_v3_routines_open"; const ROUTINE_FILTER_KEY="planner_v3_routines_filter";
  const EXERCISE_LIBRARY_PATH="exercise-library.html";
  const HABIT_HISTORY_KEY="planner_v3_habit_history"; const HABIT_HISTORY_RETENTION_DAYS=180;
  const STREAK_FREEZE_KEY="planner_v3_streak_freeze"; const STREAK_FREEZE_COST=50;
  const INTEGRATION_KEY="planner_v3_integrations";
  const CHORE_IMPORT_KEY="planner_chore_habits_v1";
  const CHORE_IMPORT_DONE_KEY="planner_chore_habits_imported_v1";
  const LEGACY_CHORE_KEY="planner_chores_text";
const REFLECTION_KEY="planner_v3_reflection";
const REFLECTION_LOG_KEY="planner_v3_reflection_log";
  const DANGER_BOSS_KEY="planner_danger_boss_done";
  const BOSS_REWARD_KEY="planner_boss_reward";
  const BRIEF_KEY="planner_brief_log";
  const BRIEF_PREF_KEY="planner_brief_prefs";
  const PLANNER_PAGE_KEY="planner_planner_page";
  const REPLIES_KEY="planner_discussion_replies";
  const STABILITY_KEY="planner_stability_state";
  const STABILITY_PREF_KEY="planner_stability_prefs";
  const CAL_KEY="planner-calendar-events";
  const DAILY_STREAK_KEY="planner_v3_daily_streak";
  const DAILY_STREAK_REWARD=15;
  const DAY_DRAG_KEY="planner_allow_day_drag";
  function loadPlannerDayOrder(){
    if(!hasStorage) return [...dayOrder];
    try{
      const raw = JSON.parse(localStorage.getItem(PLANNER_DAY_ORDER_KEY)||"[]");
      if(Array.isArray(raw)){
        const filtered = raw.filter(d=> dayOrder.includes(d));
        const missing = dayOrder.filter(d=> !filtered.includes(d));
        const merged = filtered.concat(missing);
        if(merged.length === dayOrder.length) return merged;
      }
    }catch(e){}
    return [...dayOrder];
  }
  function savePlannerDayOrder(order){
    if(!hasStorage) return;
    try{ localStorage.setItem(PLANNER_DAY_ORDER_KEY, JSON.stringify(order||[])); }catch(e){}
  }
  function loadPlannerDayLabels(){
    if(!hasStorage) return {};
    try{
      const raw = JSON.parse(localStorage.getItem(PLANNER_DAY_LABELS_KEY)||"{}");
      return raw && typeof raw === "object" ? raw : {};
    }catch(e){ return {}; }
  }
  function savePlannerDayLabels(labels){
    if(!hasStorage) return;
    try{ localStorage.setItem(PLANNER_DAY_LABELS_KEY, JSON.stringify(labels||{})); }catch(e){}
  }
  function loadDayDragAllowed(){
    if(!hasStorage) return false;
    try{
      const raw = localStorage.getItem(DAY_DRAG_KEY);
      return raw === "true";
    }catch(e){ return false; }
  }
  function saveDayDragAllowed(val){
    if(!hasStorage) return;
    try{ localStorage.setItem(DAY_DRAG_KEY, val ? "true" : "false"); }catch(e){}
  }
  const startOfWeek = (date)=>{
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun, 1=Mon
    const diff = day === 0 ? 6 : day - 1; // shift so Monday is start
    d.setDate(d.getDate() - diff);
    d.setHours(0,0,0,0);
    return d;
  };
  const normalizeTitle = (t)=>{
    const strip = (s)=> {
      if(!s) return "";
      const trimmed = String(s).trim();
      if(/^\[object\s.*\]$/i.test(trimmed)) return "";
      return trimmed;
    };
    if(typeof t === "string") return strip(t);
    if(t && typeof t === "object"){
      if(typeof t.textContent === "string" && t.textContent.trim()) return strip(t.textContent);
      if(typeof t.innerText === "string" && t.innerText.trim()) return strip(t.innerText);
      return "";
    }
    return strip(t);
  };
  const CAL_EVENT_COLORS = ["indigo","coral","emerald","violet","amber"];
  const BELT_TIERS = [
    { name:"Blue", min:0, color:"#3b82f6", glow:"rgba(59,130,246,.22)", token:"blue" },
    { name:"Purple", min:50, color:"#a855f7", glow:"rgba(168,85,247,.22)", token:"purple" },
    { name:"Brown", min:75, color:"#a16207", glow:"rgba(161,98,7,.22)", token:"brown" },
    { name:"Black", min:100, color:"#111827", glow:"rgba(15,23,42,.4)", token:"black" }
  ];
  const getBeltTier = (count)=>{
    let tier = BELT_TIERS[0];
    BELT_TIERS.forEach((item)=>{
      if(count >= item.min) tier = item;
    });
    return tier;
  };
    // EMBEDDED_ICS_START
  const EMBEDDED_ICS = {
    "public/user_fT4Z5zWdm6gMptBytUojradkeNK0POGgtVi2hrrp.ics": String.raw`BEGIN:VCALENDAR
VERSION:2.0
PRODID:icalendar-ruby
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Santiago Stein Calendar (Canvas)
X-WR-CALDESC:Calendar events for the user\, Santiago Stein
BEGIN:VEVENT
DTSTAMP:20251022T214800Z
UID:event-assignment-727858
DTSTART;VALUE=DATE;VALUE=DATE:20251024
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 8-1: Analyze Malicious Activity [25/FA CIS
 -616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727858
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251022T214800Z
UID:event-assignment-727859
DTSTART;VALUE=DATE;VALUE=DATE:20251024
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 8-2: Securing Computing Resources [25/FA C
 IS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727859
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251022T214800Z
UID:event-assignment-727860
DTSTART;VALUE=DATE;VALUE=DATE:20251024
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 8-3: Identifying Security Vulnerabilities 
 [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727860
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251022T214800Z
UID:event-assignment-727861
DTSTART;VALUE=DATE;VALUE=DATE:20251024
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 8-4: Monitoring Computing Resources [25/FA
  CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727861
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251022T214800Z
UID:event-assignment-727872
DTSTART;VALUE=DATE;VALUE=DATE:20251024
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Module 08 Infrastructure Threats and Security Monitoring [25/
 FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727872
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251022T214800Z
UID:event-assignment-727906
DTSTART;VALUE=DATE;VALUE=DATE:20251024
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 8-1: Email Threats and Defenses [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727906
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251022T214800Z
UID:event-assignment-727907
DTSTART;VALUE=DATE;VALUE=DATE:20251024
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 8-2: ARP Poisoning [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727907
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251020T060000Z
UID:event-assignment-737143
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Lab 10-1: Virtual Machine Forensics\, Live Acquisitions\, and Netwo
 rk Forensics [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=10&year=2025#assignment_737143
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251118T025400Z
UID:event-assignment-736862
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:For your discussion post\, please complete either the "Linux fo
 r Life" or "Reflection" activity found in the reading section of the modul
 e.\n\nYour initial post is due on Friday by 11:59 PM\, and your three repl
 ies are due by Sunday at 11:59 PM. Please review the rubric in the assignm
 ent for details on grading requirements.
SEQUENCE:0
SUMMARY:Linux Chapter Three Discussion Post [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=10&year=2025#assignment_736862
X-ALT-DESC;FMTTYPE=text/html:<p>For your discussion post\, please complete 
 either the "Linux for Life" or "Reflection" activity found in the reading 
 section of the module.</p>\n<p>Your initial post is due on Friday by 11:59
  PM\, and your three replies are due by Sunday at 11:59 PM. Please review 
 the rubric in the assignment for details on grading requirements.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251020T050000Z
UID:event-assignment-730824
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 3-1: Editing Files in Linux [25/FA CSC-121
 -OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=10&year=2025#assignment_730824
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T230400Z
UID:event-assignment-727862
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 9-1: Mitigation Techniques [25/FA CIS-616-
 OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727862
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T230400Z
UID:event-assignment-727863
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 9-2: Securing Enterprise Infrastructures [
 25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727863
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T230400Z
UID:event-assignment-727864
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 9-3: Enhancing Enterprise Security [25/FA 
 CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727864
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251028T165100Z
UID:event-assignment-737130
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:Class\,\n\nBe sure to read Module 10 Chapter before working thr
 ough the questions below:\n\n* What is the difference between a type 1 and
  type 2 hypervisor?\n\n* In your opinion\, why are virtual machines import
 ant when conducting forensic analysis?��\n\n* List some benefits after p
 roviding your opinion\n\n* Based on the reading\, describe in your own wor
 ds a few ways you can secure a network from cyber-attacks.\n\nYour main po
 st needs to contain a minimum of 2 complete paragraphs\, which is due Frid
 ay by midnight\, and your three reply minimum is due Sunday by midnight
SEQUENCE:0
SUMMARY:Module 10 Discussion [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=10&year=2025#assignment_737130
X-ALT-DESC;FMTTYPE=text/html:<p>Class\,</p>\n<p>Be sure to read Module 10 C
 hapter before working through the questions below:</p>\n<ul>\n<li>What is 
 the difference between a type 1 and type 2 hypervisor?</li>\n<li>In your o
 pinion\, why are virtual machines important when conducting forensic analy
 sis?&nbsp\;&nbsp\;\n<ul>\n<li>List some benefits after providing your opin
 ion</li>\n</ul>\n</li>\n<li>Based on the reading\, describe in your own wo
 rds a few ways you can secure a network from cyber-attacks.</li>\n</ul>\n<
 p>Your main post needs to contain a minimum of 2 complete paragraphs\, whi
 ch is due Friday by midnight\, and your three reply minimum is due Sunday 
 by midnight</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251020T060000Z
UID:event-assignment-737156
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Module 10 Quiz [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=10&year=2025#assignment_737156
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251020T050000Z
UID:event-assignment-730848
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Chapter 03 Exploring Linux Filesystems [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=10&year=2025#assignment_730848
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T230400Z
UID:event-assignment-727873
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Module 09 Infrastructure Security [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727873
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251020T050000Z
UID:event-assignment-730870
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 3-1: Navigate the Linux Filesystem [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=10&year=2025#assignment_730870
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T230400Z
UID:event-assignment-727908
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 9-1: Using GlassWire Firewall [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727908
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T230400Z
UID:event-assignment-727909
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 9-2: Using a VPN [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727909
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251018T164800Z
UID:event-assignment-727224
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:Critical Thinking Exercise: Automated Clinicians\n\nIt is the y
 ear 2024\, and robots are being introduced to handle the screening of pati
 ents at physicians' offices across the United States. The robots are human
  looking and are able to speak and understand English and Spanish. The rob
 ots are capable of performing basic nursing tasks\, such as taking a patie
 nt's vital signs. Upon arriving at a physician's office\, a patient would 
 meet with the robot to determine the patient's current conditions and symp
 toms and to review pertinent medical history from the patient's EHR. The r
 obot would form a preliminary diagnosis and suggest a course of action\, w
 hich could include additional tests\, medication\, referral to a specialis
 t\, or hospitalization. A human physician would then review the preliminar
 y diagnosis and suggested course of action. If necessary\, the physician w
 ould meet with the patient to confirm the robot's diagnosis and order any 
 additional work or medications that might be necessary. The robotic physic
 ian assistant can be made available 24 � 7 and can even be stationed at c
 onvenient locations\, such as shopping malls\, schools\, places of work\, 
 and college campuses. The goal of using of robotic physician assistants is
  to increase the number of patients that could be seen by a single physici
 an\, while also cutting patient wait time.\n\nYou are on the administrativ
 e staff of a large physician group that is among the first to introduce ro
 botic physician assistants. What sort of testing is necessary before the a
 utomated clinician can be certified as fit for use? What start-up issues m
 ight be expected? What would you do to make the use of a robotic physician
  assistant more acceptable to patients and to ensure patient care does not
  suffer?\n\nYour response needs to be a minimum of 2 complete paragraphs a
 nd must be submitted via microsoft word and is due Sunday by midnight.
SEQUENCE:0
SUMMARY:Week 10 Critical Thinking Assignment [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=10&year=2025#assignment_727224
X-ALT-DESC;FMTTYPE=text/html:<p><strong>Critical Thinking Exercise: Automat
 ed Clinicians</strong></p>\n<p>It is the year 2024\, and robots are being 
 introduced to handle the screening of patients at physicians' offices acro
 ss the United States. The robots are human looking and are able to speak a
 nd understand English and Spanish. The robots are capable of performing ba
 sic nursing tasks\, such as taking a patient's vital signs. Upon arriving 
 at a physician's office\, a patient would meet with the robot to determine
  the patient's current conditions and symptoms and to review pertinent med
 ical history from the patient's EHR. The robot would form a preliminary di
 agnosis and suggest a course of action\, which could include additional te
 sts\, medication\, referral to a specialist\, or hospitalization. A human 
 physician would then review the preliminary diagnosis and suggested course
  of action. If necessary\, the physician would meet with the patient to co
 nfirm the robot's diagnosis and order any additional work or medications t
 hat might be necessary. The robotic physician assistant can be made availa
 ble 24 � 7 and can even be stationed at convenient locations\, such as sh
 opping malls\, schools\, places of work\, and college campuses. The goal o
 f using of robotic physician assistants is to increase the number of patie
 nts that could be seen by a single physician\, while also cutting patient 
 wait time.</p>\n<p>You are on the administrative staff of a large physicia
 n group that is among the first to introduce robotic physician assistants.
  What sort of testing is necessary before the automated clinician can be c
 ertified as fit for use? What start-up issues might be expected? What woul
 d you do to make the use of a robotic physician assistant more acceptable 
 to patients and to ensure patient care does not suffer?</p>\n<p>Your respo
 nse needs to be a minimum of 2 complete paragraphs and must be submitted v
 ia microsoft word and is due Sunday by midnight.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251018T164800Z
UID:event-assignment-727217
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:Please be sure to read through Chapter 8 before answering the b
 elow questions in your own words:\n\n1. Your own original post that answer
 s the question below: (Due Friday midnight)�5pts\n\n* What is Artificial 
 Intelligence?\n\n* What is Machine learning?\n\n* Do you see the continuin
 g use of Artificial Intelligence to be a positive thing?� Why or Why Not?
 \n\n2. Reply to 2 classmates' posts. (Due Sunday midnight)�5pts\n\n�\n\n
 Rubric\n\nTo receive full credit\, your post and reply must be...\n\n* At 
 least three sentences in length (two paragraphs of at least 3 sentences ea
 ch for the initial post)\n\n* Written in complete\, grammatically correct 
 sentences\n\n* Free from spelling errors\n\n* An intelligent response
SEQUENCE:0
SUMMARY:Week 10 Discussion [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=10&year=2025#assignment_727217
X-ALT-DESC;FMTTYPE=text/html:<p>Please be sure to read through Chapter 8 be
 fore answering the below questions in your own words:</p><p><span>1. Your 
 own original post that answers the question below: (Due Friday midnight)&n
 bsp\;</span><strong>5pts</strong></p><ul><li>What is Artificial Intelligen
 ce?</li><li>What is Machine learning?</li><li>Do you see the continuing us
 e of Artificial Intelligence to be a positive thing?&nbsp\; Why or Why Not
 ?</li></ul><p><span>2. Reply to 2 classmates' posts. (Due Sunday midnight)
 </span><span>&nbsp\;</span><strong>5pts</strong></p><p>&nbsp\;</p><p><em><
 span>Rubric</span></em></p><p>To receive full credit\, your post and reply
  must be...</p><ul><li>At least three sentences in length (two paragraphs 
 of at least 3 sentences each for the initial post)</li><li>Written in comp
 lete\, grammatically correct sentences</li><li>Free from spelling errors</
 li><li>An intelligent response</li></ul>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251018T164800Z
UID:event-assignment-727199
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:please review chapter 8 reading before taking the quiz\, you ge
 t 2 attempts
SEQUENCE:0
SUMMARY:Week 10 Quiz [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=10&year=2025#assignment_727199
X-ALT-DESC;FMTTYPE=text/html:<p>please review chapter 8 reading before taki
 ng the quiz\, you get 2 attempts</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251017T050000Z
UID:event-assignment-777818
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:7-1: Configuring Networking Settings on a Windows Device [25/FA NET
 -790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=10&year=2025#assignment_777818
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251017T050000Z
UID:event-assignment-777815
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:7-1: Investigating Network Connection Settings [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=10&year=2025#assignment_777815
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251017T050000Z
UID:event-assignment-777816
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:7-2: Clearing DNS Cache [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=10&year=2025#assignment_777816
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251017T050000Z
UID:event-assignment-777817
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:7-2: Identify TCP IP Protocols and Port Numbers [25/FA NET-790-OL01
 ]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=10&year=2025#assignment_777817
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251030T200200Z
UID:event-assignment-765944
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:The Specialized Practical Role of the RSA Cryptosystem\n-------
 -----------------------------------------------\n\nChapter 7 introduces th
 e RSA cryptosystem\, stating that it was "for a long time the most popular
  asymmetric cryptographic scheme". However\, Section 7.1 clarifies that in
  practice\, RSA is "most often used for: encryption of small pieces of dat
 a\, especially for key transport\, [and] digital signatures". Drawing on i
 nformation from Sections 7.1 and 7.2\, discuss the implications of RSA's s
 pecialized practical uses.\n\nConsider the following in your response:\n\n
 * Based on Section 7.2\, the RSA encryption (y = xe mod n) and decryption 
 (x = yd mod n) operations involve "very long numbers\, usually 2048 bits o
 r more". How might the computational demands of operating with such large 
 numbers contribute to RSA being primarily used for "small pieces of data" 
 and "key transport" rather than for general bulk data encryption?\n\n* Giv
 en that RSA is also widely used for "digital signatures"\, how does this a
 pplication differ in its data processing needs compared to encrypting arbi
 trary messages\, and why might RSA be particularly well-suited for digital
  signing?\n\nYour initial post should be at least two paragraphs long\, wi
 th each containing four sentences. This is due by Friday at 11:59 PM. A mi
 nimum of three replies is due Sunday evening by 11:59 PM.\n\n�\n\nWorks C
 ited:\n\nPaar\, C.\, Pelzl\, J.\, & G�neysu\, T. (2024). Understanding cr
 yptography: From Established Symmetric and Asymmetric Ciphers to Post-Quan
 tum Algorithms. Springer.
SEQUENCE:0
SUMMARY:Chapter 7 Discussion [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=10&year=2025#assignment_765944
X-ALT-DESC;FMTTYPE=text/html:<div class="paragraph normal ng-star-inserted"
  data-start-index="224">\n<div class="paragraph normal ng-star-inserted" d
 ata-start-index="310">\n<h3 class="paragraph heading3 ng-star-inserted" da
 ta-start-index="242"><span class="ng-star-inserted" data-start-index="242"
 >The Specialized Practical Role of the RSA Cryptosystem</span></h3>\n<div 
 class="paragraph normal ng-star-inserted" data-start-index="335"><span cla
 ss="ng-star-inserted" data-start-index="342">Chapter 7 introduces the RSA 
 cryptosystem\, stating that it was "for a long time the most popular asymm
 etric cryptographic scheme"</span><span class="ng-star-inserted" data-star
 t-index="472">. However\, Section 7.1 clarifies that in practice\, RSA is 
 "most often used for: encryption of small pieces of data\, especially for 
 key transport\, [and] digital signatures"</span><span class="ng-star-inser
 ted" data-start-index="643">. </span><span class="ng-star-inserted" data-s
 tart-index="655">Drawing on information from Sections 7.1 and 7.2\, discus
 s the implications of RSA's specialized practical uses.</span></div>\n<div
  class="paragraph normal ng-star-inserted" data-start-index="766"><span cl
 ass="ng-star-inserted" data-start-index="766">Consider the following in yo
 ur response:</span></div>\n<ul style="list-style-type: disc\;">\n<li class
 ="paragraph normal ng-star-inserted" data-start-index="806"><span class="n
 g-star-inserted" data-start-index="806">Based on Section 7.2\, the RSA enc
 ryption (</span><code class="code ng-star-inserted" data-start-index="848"
 >y = xe mod n</code><span class="ng-star-inserted" data-start-index="860">
 ) and decryption (</span><code class="code ng-star-inserted" data-start-in
 dex="878">x = yd mod n</code><span class="ng-star-inserted" data-start-ind
 ex="890">) operations involve "very long numbers\, usually 2048 bits or mo
 re"</span><span class="ng-star-inserted" data-start-index="957">. How migh
 t the </span><strong class="ng-star-inserted" data-start-index="973">compu
 tational demands</strong><span class="ng-star-inserted" data-start-index="
 994"> of operating with such large numbers contribute to RSA being primari
 ly used for "small pieces of data" and "key transport" rather than for gen
 eral bulk data encryption?</span></li>\n<li class="paragraph normal ng-sta
 r-inserted" data-start-index="1163"><span class="ng-star-inserted" data-st
 art-index="1163">Given that RSA is also widely used for "digital signature
 s"</span><span class="ng-star-inserted" data-start-index="1222">\, how doe
 s this application differ in its data processing needs compared to encrypt
 ing arbitrary messages\, and why might RSA be particularly well-suited for
  digital signing?</span></li>\n</ul>\n</div>\n</div>\n<p><span class="ng-s
 tar-inserted">Your initial post should be at least two paragraphs long\, w
 ith each containing four sentences. This is due by Friday at 11:59 PM. A m
 inimum of three replies is due Sunday evening by 11:59 PM.</span></p>\n<p>
 &nbsp\;</p>\n<p>Works Cited:</p>\n<div>\n<p>Paar\, C.\, Pelzl\, J.\, &amp\
 ; G�neysu\, T. (2024). <i>Understanding cryptography: From Established Sy
 mmetric and Asymmetric Ciphers to Post-Quantum Algorithms</i>. Springer.</
 p>\n</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251020T050000Z
UID:event-assignment-766215
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 7 Quiz [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=10&year=2025#assignment_766215
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251017T050000Z
UID:event-assignment-777813
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:Complete the Chapter 7 quiz. You get 2 attempts on the quiz and
  the highest grade will be recorded.�\n\nLooking up the answers is cheati
 ng. Read through the resources in the module before taking it.�
SEQUENCE:0
SUMMARY:Chapter 7 Quiz [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=10&year=2025#assignment_777813
X-ALT-DESC;FMTTYPE=text/html:<p><span>Complete the Chapter 7 quiz. You get 
 2 attempts on the quiz and the highest grade will be recorded.&nbsp\;</spa
 n></p>\n<p><span>Looking up the answers is cheating. Read through the reso
 urces in the module before taking it.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T013200Z
UID:event-assignment-765945
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:Deconstructing RSA Key Generation\n----------------------------
 -----\n\nThe RSA cryptosystem\, while widely used\, relies on a meticulous
  key generation process that ensures its security and functionality. This 
 process involves several critical mathematical steps and parameters. Write
  an essay that elaborates on the key generation process for the RSA crypto
 system as described in Section 7.3.\n\nIn your essay\, be sure to:\n\n* Ex
 plain the purpose and significance of selecting two large prime numbers\, 
 p and q\, and how their product n forms the RSA modulus. Discuss briefly h
 ow the size of these primes (e.g.\, 1024 bits for p and q for a 2048-bit m
 odulus n) directly relates to the scheme's practical security against fact
 oring attacks.\n\n* Detail the calculation and role of Euler's totient fun
 ction\, ?(n) = (p-1)(q-1)\, within the key generation process.\n\n* Clari
 fy the critical condition gcd(e\, ?(n)) = 1 for choosing the public expon
 ent e\, and precisely why this condition is absolutely necessary to guaran
 tee the existence of the private exponent d.\n\n* Briefly mention how d is
  computed using the Extended Euclidean Algorithm to satisfy the modular in
 verse relationship d � e ? 1 mod ?(n)\, without needing to show the al
 gorithmic steps\n\nYour essay should draw directly from both the provided 
 source material and external sources. Cite your work appropriately to supp
 ort your arguments and offer detailed explanations of the cryptographic co
 ncepts involved.� The assignment should be at a minimum of three pages an
 d in APA format.\n\nSubmit your work as either a Word Document or a PDF. E
 nsure you follow the rubric.
SEQUENCE:0
SUMMARY:Chapter 7 Writing Assignment [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=10&year=2025#assignment_765945
X-ALT-DESC;FMTTYPE=text/html:<div class="paragraph normal ng-star-inserted"
  data-start-index="274">\n<h3 class="paragraph heading3 ng-star-inserted" 
 data-start-index="1504"><span class="ng-star-inserted" data-start-index="1
 504">Deconstructing RSA Key Generation</span></h3>\n<div class="paragraph 
 normal ng-star-inserted" data-start-index="1579"><span class="ng-star-inse
 rted" data-start-index="1586">The RSA cryptosystem\, while widely used\, r
 elies on a meticulous key generation process that ensures its security and
  functionality. This process involves several critical mathematical steps 
 and parameters</span><span class="ng-star-inserted" data-start-index="1791
 ">. </span><span class="ng-star-inserted" data-start-index="1803">Write an
  essay that elaborates on the </span><span class="ng-star-inserted">key ge
 neration process</span><span class="ng-star-inserted" data-start-index="18
 98"> for the RSA cryptosystem as described in Section 7.3.</span></div>\n<
 div class="paragraph normal ng-star-inserted" data-start-index="1579"><spa
 n class="ng-star-inserted" data-start-index="1898">In your essay\, be sure
  to:</span></div>\n<ul>\n<li class="paragraph normal ng-star-inserted" dat
 a-start-index="1979"><span class="ng-star-inserted" data-start-index="1979
 ">Explain the </span><span class="ng-star-inserted">purpose and significan
 ce</span><span class="ng-star-inserted" data-start-index="2015"> of select
 ing two large prime numbers\, </span><code class="code ng-star-inserted" d
 ata-start-index="2054">p</code><span class="ng-star-inserted" data-start-i
 ndex="2055"> and </span><code class="code ng-star-inserted" data-start-ind
 ex="2060">q</code><span class="ng-star-inserted" data-start-index="2061">\
 , and how their product </span><code class="code ng-star-inserted" data-st
 art-index="2085">n</code><span class="ng-star-inserted" data-start-index="
 2086"> forms the RSA modulus</span><span class="ng-star-inserted" data-sta
 rt-index="2108">. Discuss briefly how the size of these primes (e.g.\, 102
 4 bits for </span><code class="code ng-star-inserted" data-start-index="21
 76">p</code><span class="ng-star-inserted" data-start-index="2177"> and </
 span><code class="code ng-star-inserted" data-start-index="2182">q</code><
 span class="ng-star-inserted" data-start-index="2183"> for a 2048-bit modu
 lus </span><code class="code ng-star-inserted" data-start-index="2207">n</
 code><span class="ng-star-inserted" data-start-index="2208">) directly rel
 ates to the scheme's practical security against factoring attacks</span><s
 pan class="ng-star-inserted" data-start-index="2287">.</span></li>\n<li cl
 ass="paragraph normal ng-star-inserted" data-start-index="2288"><span clas
 s="ng-star-inserted" data-start-index="2288">Detail the calculation and ro
 le of </span><span class="ng-star-inserted">Euler's totient function\, ?(
 n) = (p-1)(q-1)</span><span class="ng-star-inserted" data-start-index="236
 6">\, within the key generation process</span><span class="ng-star-inserte
 d" data-start-index="2401">.</span></li>\n<li class="paragraph normal ng-s
 tar-inserted" data-start-index="2402"><span class="ng-star-inserted" data-
 start-index="2402">Clarify the </span><span class="ng-star-inserted">criti
 cal condition </span><span class="code ng-star-inserted">gcd(e\, ?(n)) = 
 1</span><span class="ng-star-inserted" data-start-index="2449"> for choosi
 ng the public exponent </span><code class="code ng-star-inserted" data-sta
 rt-index="2483">e</code><span class="ng-star-inserted" data-start-index="2
 484">\, and precisely why this condition is absolutely necessary to guaran
 tee the existence of the private exponent </span><code class="code ng-star
 -inserted" data-start-index="2594">d</code><span class="ng-star-inserted" 
 data-start-index="2595">.</span></li>\n<li class="paragraph normal ng-star
 -inserted" data-start-index="2596"><span class="ng-star-inserted" data-sta
 rt-index="2596">Briefly mention how </span><code class="code ng-star-inser
 ted" data-start-index="2616">d</code><span class="ng-star-inserted" data-s
 tart-index="2617"> is computed using the </span><span class="ng-star-inser
 ted">Extended Euclidean Algorithm</span><span class="ng-star-inserted" dat
 a-start-index="2668"> to satisfy the modular inverse relationship </span><
 code class="code ng-star-inserted" data-start-index="2713">d � e ? 1 mo
 d ?(n)</code><span class="ng-star-inserted" data-start-index="2731">\, wi
 thout needing to show the algorithmic steps</span></li>\n</ul>\n<div class
 ="paragraph heading3 ng-star-inserted" data-start-index="1545">\n<div clas
 s="paragraph normal ng-star-inserted" data-start-index="2811"><span class=
 "ng-star-inserted" data-start-index="2811">Your essay </span><span style="
 font-family: inherit\; font-size: 1rem\;">should draw directly from both t
 he provided source material and external sources. Cite your work appropria
 tely to support your arguments and offer detailed explanations of the cryp
 tographic concepts involved.&nbsp\; The assignment should be at a minimum 
 of three pages and in APA format.</span></div>\n</div>\n</div>\n<div class
 ="paragraph normal ng-star-inserted" data-start-index="274">Submit your wo
 rk as either a Word Document or a PDF. Ensure you follow the rubric.</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251027T122200Z
UID:event-assignment-727833
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:All discussions must be submitted every Sunday at 6:00 p.m. (th
 is includes original postings and replies) for attendance purposes.\n\nDis
 cussion posts should be a paragraph or more and should fully answer the qu
 estions provided. Please make your initial post by Friday and respond to a
 t least 2 other students by Sunday.\n\nThis week's questions:\n\n* Discuss
 ion: Pros and Cons of Using Honeypots.�\n\n* While there are clear advant
 ages of using honeypots and honeynets\, might there be any disadvantages o
 f using these tactics? Discuss the pros and cons of using honeypots and fo
 rm an opinion on whether the pros outweigh the cons. You may\, if desired\
 , use other sources to research this topic.\n\nPosting Criteria and Gradin
 g�\n\nInitial discussion post (8 sentences)\n\n60% of overall credit\n\n2
  replies to two other students (5 sentences each) 30% each\n\n30% of overa
 ll credit\n\nGrammar/spelling\n\n10% of overall credit\n\n�
SEQUENCE:0
SUMMARY:Discussion 9 [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727833
X-ALT-DESC;FMTTYPE=text/html:<header class="discussion-section clearfix">\n
 <div class="discussion-header-content right-of-avatar">\n<div class="pull-
 left">\n<p><span style="color: #e03e2d\;"><strong>All discussions must be 
 submitted every Sunday at 6:00 p.m. (this includes original postings and r
 eplies) for attendance purposes.</strong></span></p>\n</div>\n</div>\n</he
 ader>\n<div class="discussion-section message_wrapper">\n<div class="messa
 ge user_content enhanced" data-bind="message">\n<p>Discussion posts should
  be a paragraph or more and should fully answer the questions provided. Pl
 ease make your initial post by Friday and respond to at least 2 other stud
 ents by Sunday.</p>\n<p><strong>This week's questions:</strong></p>\n<ol>\
 n<li>Discussion: Pros and Cons of Using Honeypots.&nbsp\;\n<ol>\n<li>While
  there are clear advantages of using honeypots and honeynets\, might there
  be any disadvantages of using these tactics? Discuss the pros and cons of
  using honeypots and form an opinion on whether the pros outweigh the cons
 . You may\, if desired\, use other sources to research this topic.</li>\n<
 /ol>\n</li>\n</ol>\n<p><strong>Posting Criteria and Grading&nbsp\;</strong
 ><strong></strong></p>\n<table border="1">\n<tbody>\n<tr>\n<td>Initial dis
 cussion post (8 sentences)</td>\n<td>60% of overall credit</td>\n</tr>\n<t
 r>\n<td>2 replies to two other students (5 sentences each) 30% each</td>\n
 <td>30% of overall credit</td>\n</tr>\n<tr>\n<td>Grammar/spelling</td>\n<t
 d>10% of overall credit</td>\n</tr>\n</tbody>\n</table>\n<p>&nbsp\;</p>\n<
 /div>\n</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251118T022900Z
UID:event-assignment-736861
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:For your discussion post\, please complete either the "Linux fo
 r Life" or "Reflection" activity found in the reading section of the modul
 e.\n\nYour initial post is due on Friday by 11:59 PM\, and your three repl
 ies are due by Sunday at 11:59 PM. Please review the rubric in the assignm
 ent for details on grading requirements.
SEQUENCE:0
SUMMARY:Linux Chapter Two Discussion Post [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=10&year=2025#assignment_736861
X-ALT-DESC;FMTTYPE=text/html:<p>For your discussion post\, please complete 
 either the "Linux for Life" or "Reflection" activity found in the reading 
 section of the module.</p>\n<p>Your initial post is due on Friday by 11:59
  PM\, and your three replies are due by Sunday at 11:59 PM. Please review 
 the rubric in the assignment for details on grading requirements.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251020T050000Z
UID:event-assignment-730821
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 2-1: Introduction to Linux [25/FA CSC-121-
 OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=10&year=2025#assignment_730821
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251028T190300Z
UID:event-assignment-741497
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:Choose two of the provided essay prompts based on Chapter 10 of
  the Guide to Computer Forensics and Investigations. For each prompt you s
 elect\, write a comprehensive\, well-structured essay of at least one full
  page using APA format. Your response must be based on the information and
  concepts presented in the first chapter of the provided text. The use of 
 external sources is encouraged\; however\, please review the policy on usi
 ng AI in the syllabus for guidance. As a reminder\, your work will be auto
 matically checked for AI generation. Ensure that you use proper citations 
 for all works used\, including the textbook.\n\nSubmit your assignment in 
 a single file\, using either a Word (.doc \, .docx) or PDF format.\n\n*\n\
 nType 1 vs. Type 2 Hypervisors: Differentiate between Type 1 and Type 2 hy
 pervisors\, explaining how they are installed and function. Provide exampl
 es of each type (e.g.\, VMware vSphere vs. VirtualBox) and discuss why a f
 orensic examiner is more likely to encounter a Type 2 hypervisor on a susp
 ect's end-user device.\n\n*\n\nInvestigating Virtual Machines: Outline the
  standard procedure for conducting a forensic analysis of a virtual machin
 e found on a host computer. Your essay should cover imaging the host\, loc
 ating VM-related files (e.g.\, .vmdk\, .vbox\, .log)\, exporting those fil
 es\, and the different methods for analyzing the VM itself (mounting as a 
 drive\, live examination\, etc.).\n\n*\n\nThe Rationale for Live Acquisiti
 ons: Argue for the necessity of performing live acquisitions in modern dig
 ital forensics. Explain the concept of the "order of volatility" (OOV) and
  discuss why capturing volatile data like RAM and running processes is cri
 tical in cases involving active intrusions\, malware that exists only in m
 emory\, or encrypted systems.\n\n*\n\nFoundations of Network Forensics: De
 fine network forensics and explain its primary goals. Discuss the importan
 ce of establishing standard procedures for incident response and knowing a
  network's typical traffic patterns to spot anomalies. How does the "defen
 se in depth" (DiD) strategy help secure a network before an attack occurs\
 n\n*\n\nTools for Network Analysis: Describe the function of packet analyz
 ers like Wireshark and tcpdump in a network investigation. Explain what ki
 nd of information can be found by examining network logs and TCP headers. 
 Additionally\, explain the purpose of the Honeynet Project and how honeypo
 ts are used to study attacker methodologies.
SEQUENCE:0
SUMMARY:Module 10 Essay [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=10&year=2025#assignment_741497
X-ALT-DESC;FMTTYPE=text/html:<p>Choose two of the provided essay prompts ba
 sed on Chapter 10 of the Guide to Computer Forensics and Investigations. F
 or each prompt you select\, write a comprehensive\, well-structured essay 
 of at least one full page using APA format. Your response must be based on
  the information and concepts presented in the first chapter of the provid
 ed text. The use of external sources is encouraged\; however\, please revi
 ew the policy on using AI in the syllabus for guidance. <span>As a reminde
 r\, your work will be automatically checked for AI generation. Ensure that
  you use proper citations for all works used\, including the textbook.</sp
 an></p>\n<p>Submit your assignment in a single file\, using either a Word 
 (.doc \, .docx) or PDF format.</p>\n<ol style="list-style-type: decimal\;"
 >\n<li>\n<p><strong>Type 1 vs. Type 2 Hypervisors:</strong> Differentiate 
 between Type 1 and Type 2 hypervisors\, explaining how they are installed 
 and function. Provide examples of each type (e.g.\, VMware vSphere vs. Vir
 tualBox) and discuss why a forensic examiner is more likely to encounter a
  Type 2 hypervisor on a suspect's end-user device.</p>\n</li>\n<li>\n<p><s
 trong>Investigating Virtual Machines: </strong>Outline the standard proced
 ure for conducting a forensic analysis of a virtual machine found on a hos
 t computer. Your essay should cover imaging the host\, locating VM-related
  files (e.g.\, .vmdk\, .vbox\, .log)\, exporting those files\, and the dif
 ferent methods for analyzing the VM itself (mounting as a drive\, live exa
 mination\, etc.).</p>\n</li>\n<li>\n<p><strong>The Rationale for Live Acqu
 isitions:</strong> Argue for the necessity of performing live acquisitions
  in modern digital forensics. Explain the concept of the "order of volatil
 ity" (OOV) and discuss why capturing volatile data like RAM and running pr
 ocesses is critical in cases involving active intrusions\, malware that ex
 ists only in memory\, or encrypted systems.</p>\n</li>\n<li>\n<p><strong>F
 oundations of Network Forensics: </strong>Define network forensics and exp
 lain its primary goals. Discuss the importance of establishing standard pr
 ocedures for incident response and knowing a network's typical traffic pat
 terns to spot anomalies. How does the "defense in depth" (DiD) strategy he
 lp secure a network before an attack occurs</p>\n</li>\n<li>\n<p><strong>T
 ools for Network Analysis: </strong>Describe the function of packet analyz
 ers like Wireshark and tcpdump in a network investigation. Explain what ki
 nd of information can be found by examining network logs and TCP headers. 
 Additionally\, explain the purpose of the Honeynet Project and how honeypo
 ts are used to study attacker methodologies.</p>\n</li>\n</ol>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251020T050000Z
UID:event-assignment-730847
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Chapter 02 Linux Installation and Usage [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=10&year=2025#assignment_730847
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251020T050000Z
UID:event-assignment-730869
DTSTART;VALUE=DATE;VALUE=DATE:20251026
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 2-1: Install Fedora Workstation Linux on a VM [25/FA CSC
 -121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=10&year=2025#assignment_730869
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251001T050000Z
UID:event-assignment-727828
DTSTART;VALUE=DATE;VALUE=DATE:20251027
CLASS:PUBLIC
DESCRIPTION:Details about the Exam 1 (Mid-Term)\n\n* Covers Chapters 1- 8\n
 \n* 50 Questions (Questions may be in multiple-choice/ true false/ fill-in
 -the-blank format)\n\n* Possible grade: 100\n\n* Time limit: 70 minutes\n\
 n* Number of attempts: 2\n\nGood luck to all!
SEQUENCE:0
SUMMARY:Exam 1 (Mid-Term) [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=10&year=2025#assignment_727828
X-ALT-DESC;FMTTYPE=text/html:<p><strong><u>Details about the Exam 1 (Mid-Te
 rm)</u></strong></p>\n<ul>\n<li>Covers Chapters 1- 8</li>\n<li>50 Question
 s (Questions may be in multiple-choice/ true false/ fill-in-the-blank form
 at)</li>\n<li>Possible grade: 100</li>\n<li>Time limit: 70 minutes</li>\n<
 li>Number of attempts: 2</li>\n</ul>\n<p>Good luck to all!</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251027T060000Z
UID:event-assignment-737144
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Lab 11-1: E-mail and Social Media Investigations [25/FA CIS-602-OL0
 1]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737144
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251118T030900Z
UID:event-assignment-736863
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:For your discussion post\, please complete either the "Linux fo
 r Life" or "Reflection" activity found in the reading section of the modul
 e.\n\nYour initial post is due on Friday by 11:59 PM\, and your three repl
 ies are due by Sunday at 11:59 PM. Please review the rubric in the assignm
 ent for details on grading requirements.
SEQUENCE:0
SUMMARY:Linux Chapter Four Discussion Post [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_736863
X-ALT-DESC;FMTTYPE=text/html:<p>For your discussion post\, please complete 
 either the "Linux for Life" or "Reflection" activity found in the reading 
 section of the module.</p>\n<p>Your initial post is due on Friday by 11:59
  PM\, and your three replies are due by Sunday at 11:59 PM. Please review 
 the rubric in the assignment for details on grading requirements.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251027T050000Z
UID:event-assignment-737131
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:Class\,\n\nI want you to make sure you read through Module 11 b
 efore thinking about the hypothetical scenario below:\n\nYou are the newly
  hired Security Analyst at XYZ Corporation\, and your first task is to rev
 iew company email and social media security.� Your boss explained that vi
 a email\, some viruses in the past year have made it into the environment.
 � Your boss explains that most employees in the company don't seem to und
 erstand basic email precautions and seem to click on anything that comes t
 hrough their email.� Your boss also explains that the current email filte
 r is about five years old and hasn't been audited for a long time.� Emplo
 yees on company computers also use Social Media\, and your boss wants you 
 to think about what kind of policies should be enforced in the future rega
 rding social media policy.\n\nThere is no right or wrong answer to the abo
 ve scenario. Use what you know based on the Module 11 reading to answer th
 e prompt in your own words.�\n\nI want you to:\n\n* Explain what you woul
 d advise your boss to do over the first 90 days.\n\n* What kind of email p
 olicy would you enforce?\n\n* What kind of social media policy would you t
 ry to enforce?\n\nPlease create your main post with a minimum of two compl
 ete paragraphs due Friday by midnight\, and your three reply minimum is du
 e Sunday by midnight.
SEQUENCE:0
SUMMARY:Module 11 Discussion [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737131
X-ALT-DESC;FMTTYPE=text/html:<p>Class\,</p>\n<p>I want you to make sure you
  read through Module 11 before thinking about the hypothetical scenario be
 low:</p>\n<p><em>You are the newly hired Security Analyst at XYZ Corporati
 on\, and your first task is to review company email and social media secur
 ity.&nbsp\; Your boss explained that via email\, some viruses in the past 
 year have made it into the environment.&nbsp\; Your boss explains that mos
 t employees in the company don't seem to understand basic email precaution
 s and seem to click on anything that comes through their email.&nbsp\; You
 r boss also explains that the current email filter is about five years old
  and hasn't been audited for a long time.&nbsp\; Employees on company comp
 uters also use Social Media\, and your boss wants you to think about what 
 kind of policies should be enforced in the future regarding social media p
 olicy.</em></p>\n<p>There is no right or wrong answer to the above scenari
 o. Use what you know based on the Module 11 reading to answer the prompt i
 n your own words.&nbsp\;</p>\n<p>I want you to:</p>\n<ul>\n<li>Explain wha
 t you would advise your boss to do over the first 90 days.</li>\n<li>What 
 kind of email policy would you enforce?</li>\n<li>What kind of social medi
 a policy would you try to enforce?</li>\n</ul>\n<p>Please create your main
  post with a minimum of two complete paragraphs due Friday by midnight\, a
 nd your three reply minimum is due Sunday by midnight.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251027T060000Z
UID:event-assignment-737157
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Module 11 Quiz [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737157
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251029T184100Z
UID:event-assignment-727225
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:Class\,\n\nYour assignment this week is to research an article 
 online that discusses an employment issue that occurred with regards to so
 cial media.�\n\nExample:� You could find a something in the news about a
 n employee losing their job because of something they posted on social med
 ia.�\n\nYou will need to read the article and than summarize in your own 
 words what you learned from the article and its significance\, your summar
 y should be a minimum of 2 complete paragraphs submitted in a Microsoft Wo
 rd file and is due Sunday by midnight.
SEQUENCE:0
SUMMARY:Week 11 Critical Thinking Assignment [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=11&year=2025#assignment_727225
X-ALT-DESC;FMTTYPE=text/html:<p>Class\,</p>\n<p>Your assignment this week i
 s to research an article online that discusses an employment issue that oc
 curred with regards to social media.&nbsp\;</p>\n<p><strong>Example:</stro
 ng>&nbsp\; You could find a something in the news about an employee losing
  their job because of something they posted on social media.&nbsp\;</p>\n<
 p>You will need to read the article and than summarize in your own words w
 hat you learned from the article and its significance\, your summary shoul
 d be a minimum of 2 complete paragraphs submitted in a Microsoft Word file
  and is due Sunday by midnight.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251029T184100Z
UID:event-assignment-727218
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:Please be sure to read through Chapter 8 before answering the b
 elow questions in your own words:\n\n1. Your own original post that answer
 s the question below: (Due Friday midnight)�5pts\n\n* Please review pages
  9-3b\, which says "According to CareerBuilder\, 60 percent of employers u
 sed social media to research job candidates in 2016"\n\n* Do you feel that
  employers should have the right to make hiring decisions based on a candi
 dates social media?� Elaborate on your stance\n\n* What would you recomme
 nd a friend or family member do to safeguard their social media informatio
 n?\n\n* list strategies or social media best practices�\n\n* How do you f
 eel social media has affected a company's customer services practices?\n\n
 2. Reply to 2 classmates' posts. (Due Sunday midnight)�5pts\n\n�\n\nRubr
 ic\n\nTo receive full credit\, your post and reply must be...\n\n* At leas
 t three sentences in length (two paragraphs of at least 3 sentences each f
 or the initial post)\n\n* Written in complete\, grammatically correct sent
 ences\n\n* Free from spelling errors\n\n* An intelligent response
SEQUENCE:0
SUMMARY:Week 11 Discussion [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=11&year=2025#assignment_727218
X-ALT-DESC;FMTTYPE=text/html:<p>Please be sure to read through Chapter 8 be
 fore answering the below questions in your own words:</p><p><span>1. Your 
 own original post that answers the question below: (Due Friday midnight)&n
 bsp\;</span><strong>5pts</strong></p><ul><li>Please review pages 9-3b\, wh
 ich says "According to CareerBuilder\, 60 percent of employers used social
  media to research job candidates in 2016"<ul><li>Do you feel that employe
 rs should have the right to make hiring decisions based on a candidates so
 cial media?&nbsp\; Elaborate on your stance</li><li>What would you recomme
 nd a friend or family member do to safeguard their social media informatio
 n?<ul><li>list strategies or social media best practices&nbsp\;</li></ul><
 /li><li>How do you feel social media has affected a company's customer ser
 vices practices?</li></ul></li></ul><p><span>2. Reply to 2 classmates' pos
 ts. (Due Sunday midnight)</span><span>&nbsp\;</span><strong>5pts</strong><
 /p><p>&nbsp\;</p><p><em><span>Rubric</span></em></p><p>To receive full cre
 dit\, your post and reply must be...</p><ul><li>At least three sentences i
 n length (two paragraphs of at least 3 sentences each for the initial post
 )</li><li>Written in complete\, grammatically correct sentences</li><li>Fr
 ee from spelling errors</li><li>An intelligent response</li></ul>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251029T184100Z
UID:event-assignment-727198
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:please be sure to read through chapter 9 before taking the quiz
 \, you get 2 attempts
SEQUENCE:0
SUMMARY:Week 11 Quiz [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=11&year=2025#assignment_727198
X-ALT-DESC;FMTTYPE=text/html:<p>please be sure to read through chapter 9 be
 fore taking the quiz\, you get 2 attempts</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251023T210900Z
UID:event-assignment-781804
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:8-1: Using Google Cloud [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_781804
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251027T050000Z
UID:event-assignment-766216
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:The Practicality and Perils of Diffie-Hellman Key Exchange\n-
 ---------------------------------------------------------\n\nIn Section 8.
 1\, the source introduces the Diffie-Hellman Key Exchange (DHKE) as a fo
 undational asymmetric scheme designed to solve the key distribution proble
 m.\n\n. Explain how the Diffie-Hellman Key Exchange (DHKE) enables two
  parties to derive a common secret key by communicating over an insecure c
 hannel\, thereby addressing the key distribution problem in cryptography.\
 n\n. Discuss the fundamental mathematical properties-specifically\, th
 e nature of exponentiation in [LaTeX: \\mathbb{Z}_{p}^{*} ] (https://class
 es.iwcc.edu/equation_images/%255Cmathbb%257BZ%257D_%257Bp%257D%255E%257B*%
 257D%2520?scale=1)�as a one-way function and its commutative property-t
 hat make the DHKE protocol possible and secure in principle.\n\n. Beyond
  the inherent difficulty of the Discrete Logarithm Problem (DLP) itself\, 
 identify and explain a significant security vulnerability of the basic DHK
 E protocol that arises when the communication channel is not authenticated
 . Briefly mention how this vulnerability is typically addressed in practic
 e.\n\nYour initial post should be at least two paragraphs long\, with each
  containing four sentences. This is due by Friday at 11:59 PM. A minimum o
 f three replies is due Sunday evening by 11:59 PM.\n\n�\n\nWorks Cited:\n
 \nPaar\, C.\, Pelzl\, J.\, & G�neysu\, T. (2024). Understanding cryptogra
 phy: From Established Symmetric and Asymmetric Ciphers to Post-Quantum Alg
 orithms. Springer.
SEQUENCE:0
SUMMARY:Chapter 8 Discussion [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_766216
X-ALT-DESC;FMTTYPE=text/html:<div class="paragraph normal ng-star-inserted"
  data-start-index="224">\n<div class="paragraph normal ng-star-inserted" d
 ata-start-index="310">\n<h3 class="paragraph heading3 ng-star-inserted" da
 ta-start-index="181"><span class="ng-star-inserted">The Practicality and P
 erils of Diffie-Hellman Key Exchange</span></h3>\n<div class="paragraph 
 normal ng-star-inserted" data-start-index="269"><span class="ng-star-inser
 ted" data-start-index="269">In Section 8.1\, the source introduces the </s
 pan><span class="ng-star-inserted">Diffie-Hellman Key Exchange (DHKE)</s
 pan><span class="ng-star-inserted" data-start-index="345"> as a foundation
 al asymmetric scheme designed to solve the </span><span class="ng-star-ins
 erted">key distribution problem</span><span class="ng-star-inserted" data-
 start-index="428">.</span></div>\n<div class="paragraph normal ng-star-ins
 erted" data-start-index="429"><span class="ng-star-inserted">. </span><s
 pan class="ng-star-inserted" data-start-index="429">Explain how the </span
 ><span class="ng-star-inserted">Diffie-Hellman Key Exchange (DHKE)</span
 ><span class="ng-star-inserted" data-start-index="479"> enables two partie
 s to </span><span class="ng-star-inserted">derive a common secret key by c
 ommunicating over an insecure channel</span><span class="ng-star-inserted"
  data-start-index="571">\, thereby addressing the key distribution problem
  in cryptography</span><span class="ng-star-inserted" data-start-index="63
 6">.</span></div>\n<div class="paragraph normal ng-star-inserted" data-sta
 rt-index="637"><span class="ng-star-inserted">. </span><span class="ng-s
 tar-inserted" data-start-index="637">Discuss the </span><span class="ng-st
 ar-inserted">fundamental mathematical properties</span><span class="ng-sta
 r-inserted" data-start-index="684">-specifically\, the nature of </span>
 <span class="ng-star-inserted">exponentiation in <img class="equation_imag
 e" title="\\mathbb{Z}_{p}^{*} " src="https://classes.iwcc.edu/equation_ima
 ges/%255Cmathbb%257BZ%257D_%257Bp%257D%255E%257B*%257D%2520?scale=1" alt="
 LaTeX: \\mathbb{Z}_{p}^{*} " data-equation-content="\\mathbb{Z}_{p}^{*} " 
 data-ignore-a11y-check="" loading="lazy" x-canvaslms-safe-mathml="<math xm
 lns=&quot\;http://www.w3.org/1998/Math/MathML&quot\;>\n  <msubsup>\n    <m
 row class=&quot\;MJX-TeXAtom-ORD&quot\;>\n      <mi mathvariant=&quot\;dou
 ble-struck&quot\;>Z</mi>\n    </mrow>\n    <mrow class=&quot\;MJX-TeXAtom-
 ORD&quot\;>\n      <mi>p</mi>\n    </mrow>\n    <mrow class=&quot\;MJX-TeX
 Atom-ORD&quot\;>\n      <mo>&amp\;#x2217\;<!-- ? --></mo>\n    </mrow>\n
   </msubsup>\n</math>"></span><span class="ng-star-inserted" data-start-in
 dex="734">&nbsp\;as a </span><span class="ng-star-inserted">one-way functi
 on</span><span class="ng-star-inserted" data-start-index="756"> and its </
 span><span class="ng-star-inserted">commutative property</span><span class
 ="ng-star-inserted" data-start-index="785">-that make the DHKE protocol 
 possible and secure in principle</span><span class="ng-star-inserted" data
 -start-index="846">.</span></div>\n<div class="paragraph normal ng-star-in
 serted" data-start-index="847"><span class="ng-star-inserted">. </span><
 span class="ng-star-inserted" data-start-index="847">Beyond the inherent d
 ifficulty of the Discrete Logarithm Problem (DLP) itself\, identify and ex
 plain a </span><span class="ng-star-inserted">significant security vulnera
 bility</span><span class="ng-star-inserted" data-start-index="983"> of the
  </span><i class="ng-star-inserted" data-start-index="991">basic</i><span 
 class="ng-star-inserted" data-start-index="996"> DHKE protocol that arises
  when the communication channel is </span><i class="ng-star-inserted" data
 -start-index="1057">not</i><span class="ng-star-inserted" data-start-index
 ="1060"> authenticated</span><span class="ng-star-inserted" data-start-ind
 ex="1074">. Briefly mention how this vulnerability is typically addressed 
 in practice</span><span class="ng-star-inserted" data-start-index="1149">.
 </span></div>\n</div>\n</div>\n<p><span class="ng-star-inserted">Your init
 ial post should be at least two paragraphs long\, with each containing fou
 r sentences. This is due by Friday at 11:59 PM. A minimum of three replies
  is due Sunday evening by 11:59 PM.</span></p>\n<p>&nbsp\;</p>\n<p>Works C
 ited:</p>\n<div>\n<p>Paar\, C.\, Pelzl\, J.\, &amp\; G�neysu\, T. (2024).
  <i>Understanding cryptography: From Established Symmetric and Asymmetric 
 Ciphers to Post-Quantum Algorithms</i>. Springer.</p>\n</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251027T050000Z
UID:event-assignment-766219
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 8 Quiz [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_766219
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251023T211300Z
UID:event-assignment-781803
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:Complete the Chapter 8 quiz. You get 2 attempts on the quiz and
  the highest grade will be recorded.�\n\nLooking up the answers is cheati
 ng. Read through the resources in the module before taking it.�
SEQUENCE:0
SUMMARY:Chapter 8 Quiz [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_781803
X-ALT-DESC;FMTTYPE=text/html:<p><span>Complete the Chapter 8 quiz. You get 
 2 attempts on the quiz and the highest grade will be recorded.&nbsp\;</spa
 n></p>\n<p><span>Looking up the answers is cheating. Read through the reso
 urces in the module before taking it.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251027T050000Z
UID:event-assignment-766217
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:Unpacking the Discrete Logarithm Problem: Foundations and Crypt
 analytic Approaches\n-----------------------------------------------------
 -----------------------------\n\nThe Discrete Logarithm Problem (DLP) is p
 resented in Chapter 8 as a crucial one-way function underpinning the secur
 ity of numerous public-key algorithms\, including the Diffie-Hellman Key
  Exchange and Elgamal encryption.\n\n* Drawing on the concepts of abstract
  algebra from Section 8.2\, explain what constitutes a finite cyclic group
  and how a primitive element (also known as a generator) can generate all 
 elements within such a group.\n\n* Formally define the Discrete Logarithm 
 Problem (DLP) itself within this algebraic context\, stating the given inp
 uts and the desired output.\n\n* Then\, compare and contrast two distinct 
 classes of algorithms used to attack the DLP: one that is generic (applica
 ble to any finite cyclic group) and another that is nongeneric (exploits s
 pecific algebraic structures of the group). For each class\, describe its 
 underlying principle\, its general computational complexity\, and explicit
 ly state whether it applies to DLP instances in prime fields ([LaTeX: \\ma
 thbb{Z}_{p}^{*} ] (https://classes.iwcc.edu/equation_images/%255Cmathbb%25
 7BZ%257D_%257Bp%257D%255E%257B*%257D%2520?scale=1)) and/or elliptic curve 
 groups.\n\nYour essay should draw directly from both the provided source m
 aterial and external sources. Cite your work appropriately to support your
  arguments and offer detailed explanations of the cryptographic concepts i
 nvolved.� The assignment should be at a minimum of three pages and in APA
  format.\n\nSubmit your work as either a Word Document or a PDF. Ensure yo
 u follow the rubric.
SEQUENCE:0
SUMMARY:Chapter 8 Writing Assignment [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_766217
X-ALT-DESC;FMTTYPE=text/html:<div class="paragraph normal ng-star-inserted"
  data-start-index="274">\n<h3 class="paragraph heading3 ng-star-inserted" 
 data-start-index="1232"><span class="ng-star-inserted">Unpacking the Discr
 ete Logarithm Problem: Foundations and Cryptanalytic Approaches</span></h3
 >\n<div class="paragraph normal ng-star-inserted" data-start-index="1341">
 <span class="ng-star-inserted" data-start-index="1341">The </span><span cl
 ass="ng-star-inserted">Discrete Logarithm Problem (DLP)</span><span class=
 "ng-star-inserted" data-start-index="1377"> is presented in Chapter 8 as a
  crucial one-way function underpinning the security of numerous public-key
  algorithms\, including the Diffie-Hellman Key Exchange and Elgamal encr
 yption</span><span class="ng-star-inserted" data-start-index="1559">.</spa
 n></div>\n<ul>\n<li class="paragraph normal ng-star-inserted" data-start-i
 ndex="1560"><span class="ng-star-inserted" data-start-index="1560">Drawing
  on the concepts of </span><span class="ng-star-inserted">abstract algebra
  from Section 8.2</span><span class="ng-star-inserted" data-start-index="1
 620">\, explain what constitutes a </span><span class="ng-star-inserted">f
 inite cyclic group</span><span class="ng-star-inserted" data-start-index="
 1668"> and how a </span><span class="ng-star-inserted">primitive element (
 also known as a generator)</span><span class="ng-star-inserted" data-start
 -index="1724"> can generate all elements within such a group</span><span c
 lass="ng-star-inserted" data-start-index="1770">.</span></li>\n<li class="
 paragraph normal ng-star-inserted" data-start-index="1771"><span class="ng
 -star-inserted" data-start-index="1771">Formally define the </span><span c
 lass="ng-star-inserted">Discrete Logarithm Problem (DLP)</span><span class
 ="ng-star-inserted" data-start-index="1823"> itself within this algebraic 
 context\, stating the given inputs and the desired output</span><span clas
 s="ng-star-inserted" data-start-index="1909">.</span></li>\n<li class="par
 agraph normal ng-star-inserted" data-start-index="1910"><span class="ng-st
 ar-inserted" data-start-index="1910">Then\, compare and contrast </span><s
 pan class="ng-star-inserted">two distinct classes of algorithms used to at
 tack the DLP</span><span class="ng-star-inserted" data-start-index="1994">
 : one that is </span><span class="ng-star-inserted">generic</span><span cl
 ass="ng-star-inserted" data-start-index="2015"> (applicable to any finite 
 cyclic group) and another that is </span><span class="ng-star-inserted">no
 ngeneric</span><span class="ng-star-inserted" data-start-index="2086"> (ex
 ploits specific algebraic structures of the group)</span><span class="ng-s
 tar-inserted" data-start-index="2140">. For each class\, describe its </sp
 an><span class="ng-star-inserted">underlying principle</span><span class="
 ng-star-inserted" data-start-index="2191">\, its </span><span class="ng-st
 ar-inserted">general computational complexity</span><span class="ng-star-i
 nserted" data-start-index="2229">\, and explicitly state whether it applie
 s to DLP instances in </span><span class="ng-star-inserted">prime fields (
 <img class="equation_image" title="\\mathbb{Z}_{p}^{*} " src="https://clas
 ses.iwcc.edu/equation_images/%255Cmathbb%257BZ%257D_%257Bp%257D%255E%257B*
 %257D%2520?scale=1" alt="LaTeX: \\mathbb{Z}_{p}^{*} " data-equation-conten
 t="\\mathbb{Z}_{p}^{*} " data-ignore-a11y-check="" loading="lazy" x-canvas
 lms-safe-mathml="<math xmlns=&quot\;http://www.w3.org/1998/Math/MathML&quo
 t\;>\n  <msubsup>\n    <mrow class=&quot\;MJX-TeXAtom-ORD&quot\;>\n      <
 mi mathvariant=&quot\;double-struck&quot\;>Z</mi>\n    </mrow>\n    <mrow 
 class=&quot\;MJX-TeXAtom-ORD&quot\;>\n      <mi>p</mi>\n    </mrow>\n    <
 mrow class=&quot\;MJX-TeXAtom-ORD&quot\;>\n      <mo>&amp\;#x2217\;<!-- 
 ? --></mo>\n    </mrow>\n  </msubsup>\n</math>">)</span><span class="ng-
 star-inserted" data-start-index="2315"> and/or </span><span class="ng-star
 -inserted">elliptic curve groups.</span></li>\n</ul>\n<div class="paragrap
 h normal ng-star-inserted" data-start-index="2811"><span class="ng-star-in
 serted" data-start-index="2811">Your essay </span><span style="font-family
 : inherit\; font-size: 1rem\;">should draw directly from both the provided
  source material and external sources. Cite your work appropriately to sup
 port your arguments and offer detailed explanations of the cryptographic c
 oncepts involved.&nbsp\; The assignment should be at a minimum of three pa
 ges and in APA format.</span></div>\n</div>\n<div class="paragraph normal 
 ng-star-inserted" data-start-index="274">Submit your work as either a Word
  Document or a PDF. Ensure you follow the rubric.</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T132300Z
UID:event-assignment-727837
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:Mobile Protection\n\nAll discussions must be submitted every Su
 nday at 6:00 p.m. (this includes original postings and replies) for attend
 ance purposes.\n\nDiscussion posts should be a paragraph or more and shoul
 d fully answer the questions provided. Please make your initial post by Fr
 iday and respond to at least 2 other students by Sunday.\n\nThis week's qu
 estions:\n\n* Discussion: Going Contactless? (Near Field Communication (NF
 C) Attacks\, Radio Frequency Identification (RFID) Attacks.\n\n* Contactle
 ss payment systems are on the rise. Most of them use NFC or RFID technolog
 y. Take a few minutes to review these technologies and perhaps do some add
 itional research about their safety.\n\n* Based on what you know\, do you 
 think contactless payment is more or less secure than traditional payment 
 methods? Why?\n\nPosting Criteria and Grading�\n\nInitial discussion post
  (8 sentences)\n\n60% of overall credit\n\n2 replies to two other students
  (5 sentences each) 30% each\n\n30% of overall credit\n\nGrammar/spelling\
 n\n10% of overall credit\n\nTo submit your responses to the questions\, fo
 llow the steps below:\n\n* Click Reply at the bottom\,�and post your resp
 onses to both questions in the same thread.� Be sure to click Post Reply
 �at the bottom of the screen when you have completed your response.� If 
 you click�Save Draft\,�your message cannot be viewed by the instructor o
 r other students.\n\n* As other students post their opinions\, read throug
 h the forum\, and respond to at least�two other�messages by clicking�Re
 ply to the student's post\,�and�Post Reply.� The first couple of studen
 ts who post messages may have to check back later to post their replies.\n
 \n�
SEQUENCE:0
SUMMARY:Discussion 10 [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727837
X-ALT-DESC;FMTTYPE=text/html:<p><strong>Mobile Protection</strong></p>\n<p>
 <span style="background-color: #ecf0f1\; font-size: 14pt\;"><strong style=
 "color: #e03e2d\;">All discussions must be submitted every Sunday at 6:00 
 p.m. (this includes original postings and replies) for </strong><span styl
 e="color: #e03e2d\;"><strong>attendance</strong></span><strong style="colo
 r: #e03e2d\;"> purposes.</strong></span></p>\n<p>Discussion posts should b
 e a paragraph or more and should fully answer the questions provided. Plea
 se make your initial post by Friday and respond to at least 2 other studen
 ts by Sunday.</p>\n<p><strong>This week's questions:</strong></p>\n<ol>\n<
 li>Discussion: Going Contactless? (Near Field Communication (NFC) Attacks\
 , Radio Frequency Identification (RFID) Attacks.\n<ol>\n<li>Contactless pa
 yment systems are on the rise. Most of them use NFC or RFID technology. Ta
 ke a few minutes to review these technologies and perhaps do some addition
 al research about their safety.</li>\n<li>Based on what you know\, do you 
 think contactless payment is more or less secure than traditional payment 
 methods? Why?</li>\n</ol>\n</li>\n</ol>\n<p><strong>Posting Criteria </str
 ong><strong>and Grading&nbsp\;</strong><strong></strong></p>\n<table style
 ="border-collapse: collapse\; width: 58.148%\; height: 111px\;" border="1"
 >\n<tbody>\n<tr style="height: 29px\;">\n<td style="width: 49.9483%\; heig
 ht: 29px\;">Initial discussion post (8 sentences)</td>\n<td style="width: 
 49.9483%\; height: 29px\;">60% of overall credit</td>\n</tr>\n<tr style="h
 eight: 53px\;">\n<td style="width: 49.9483%\; height: 53px\;">2 replies to
  two other students (5 sentences each) 30% each</td>\n<td style="width: 49
 .9483%\; height: 53px\;">30% of overall credit</td>\n</tr>\n<tr style="hei
 ght: 29px\;">\n<td style="width: 49.9483%\; height: 29px\;">Grammar/spelli
 ng</td>\n<td style="width: 49.9483%\; height: 29px\;">10% of overall credi
 t</td>\n</tr>\n</tbody>\n</table>\n<p>To submit your responses to the ques
 tions\, follow the steps below:</p>\n<ol>\n<li>Click Reply at the bottom<e
 m>\,&nbsp\;</em>and post your responses to both questions in the same thre
 ad.&nbsp\; Be sure to click Pos<em>t Reply&nbsp\;</em>at the bottom of the
  screen when you have completed your response.&nbsp\; If you click&nbsp\;<
 em>Save Draft\,&nbsp\;</em>your message cannot be viewed by the instructor
  or other students.</li>\n<li>As other students post their opinions\, read
  through the forum\, and respond to at least&nbsp\;two other&nbsp\;message
 s by clicking&nbsp\;<em>Reply to the student's post\,&nbsp\;</em>and&nbsp\
 ;<em>Post Reply</em>.&nbsp\; The first couple of students who post message
 s may have to check back later to post their replies.</li>\n</ol>\n<p>&nbs
 p\;</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251023T211000Z
UID:event-assignment-781805
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:Lab 8-1: Set up Wi-Fi and Configure Port Forwarding [25/FA NET-790-
 OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_781805
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251023T211000Z
UID:event-assignment-781806
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:Lab 8-5: Troubleshoot Network Wiring [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_781806
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251107T202400Z
UID:event-assignment-730826
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 4-1: File and Directory Management in Linu
 x [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730826
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251107T202400Z
UID:event-assignment-730827
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 4-2: Access Control Utilities [25/FA CSC-1
 21-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730827
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251027T050000Z
UID:event-assignment-741498
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:Choose two of the provided essay prompts based on Chapter 11 of
  the Guide to Computer Forensics and Investigations. For each prompt you s
 elect\, write a comprehensive\, well-structured essay of at least one full
  page using APA format. Your response must be based on the information and
  concepts presented in the first chapter of the provided text. The use of 
 external sources is encouraged\; however\, please review the policy on usi
 ng AI in the syllabus for guidance. As a reminder\, your work will be auto
 matically checked for AI generation. Ensure that you use proper citations 
 for all works used\, including the textbook.\n\nSubmit your assignment in 
 a single file\, using either a Word (.doc\, .docx) or PDF format.\n\n*\n\n
 Anatomy of an E-mail Investigation: Detail the process of tracing an e-mai
 l message back to its source. Explain the forensic significance of an e-ma
 il header\, including the information contained within it (IP addresses\, 
 ESMTP numbers\, etc.) and how investigators use network e-mail logs and on
 line lookup tools (like ARIN) to corroborate this information.\n\n*\n\nCli
 ent vs. Server E-mail Forensics: Compare the challenges and procedures for
  recovering e-mail evidence from a client computer versus an e-mail server
 . Discuss how e-mail storage (.pst files vs. server databases)\, logging c
 onfigurations (like circular logging)\, and access protocols (POP3 vs. IMA
 P4) affect the investigation.\n\n*\n\nSocial Media as a Source of Evidence
 : Discuss the growing role of online social networks (OSNs) like Facebook 
 and Twitter in both civil and criminal investigations. What types of evide
 ntiary information can be found on these platforms? Analyze the primary ch
 allenges investigators face\, including data volume\, jurisdictional issue
 s\, and the need for warrants or subpoenas to access non-public informatio
 n from vendors.\n\n*\n\nForensic Linguistics: Define forensic linguistics 
 and explain its application in an e-mail or social media investigation. Di
 scuss what a forensic linguist can and cannot determine from a piece of wr
 iting and how this analysis can be used as evidence to help authenticate (
 or dispute) the authorship of a message.\n\n*\n\nRecovering Deleted E-mail
 : Explain the different methods an investigator can use to recover deleted
  e-mail messages. Your answer should cover the use of specialized GUI tool
 s (like Magnet AXIOM)\, the manual process of carving messages from an mbo
 x format file using a hex editor\, and the function of utilities like scan
 pst.exe for repairing corrupted Outlook files.
SEQUENCE:0
SUMMARY:Module 11 Essay [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_741498
X-ALT-DESC;FMTTYPE=text/html:<p>Choose two of the provided essay prompts ba
 sed on Chapter 11 of the Guide to Computer Forensics and Investigations. F
 or each prompt you select\, write a comprehensive\, well-structured essay 
 of at least one full page using APA format. Your response must be based on
  the information and concepts presented in the first chapter of the provid
 ed text. The use of external sources is encouraged\; however\, please revi
 ew the policy on using AI in the syllabus for guidance. <span>As a reminde
 r\, your work will be automatically checked for AI generation. Ensure that
  you use proper citations for all works used\, including the textbook.</sp
 an></p>\n<p>Submit your assignment in a single file\, using either a Word 
 (.doc\, .docx) or PDF format.</p>\n<ol style="list-style-type: decimal\;">
 \n<li>\n<p><strong>Anatomy of an E-mail Investigation:</strong> Detail the
  process of tracing an e-mail message back to its source. Explain the fore
 nsic significance of an e-mail header\, including the information containe
 d within it (IP addresses\, ESMTP numbers\, etc.) and how investigators us
 e network e-mail logs and online lookup tools (like ARIN) to corroborate t
 his information.</p>\n</li>\n<li>\n<p><strong>Client vs. Server E-mail For
 ensics:</strong> Compare the challenges and procedures for recovering e-ma
 il evidence from a client computer versus an e-mail server. Discuss how e-
 mail storage (.pst files vs. server databases)\, logging configurations (l
 ike circular logging)\, and access protocols (POP3 vs. IMAP4) affect the i
 nvestigation.</p>\n</li>\n<li>\n<p><strong>Social Media</strong> as a Sour
 ce of Evidence: Discuss the growing role of online social networks (OSNs) 
 like Facebook and Twitter in both civil and criminal investigations. What 
 types of evidentiary information can be found on these platforms? Analyze 
 the primary challenges investigators face\, including data volume\, jurisd
 ictional issues\, and the need for warrants or subpoenas to access non-pub
 lic information from vendors.</p>\n</li>\n<li>\n<p><strong>Forensic Lingui
 stics:</strong> Define forensic linguistics and explain its application in
  an e-mail or social media investigation. Discuss what a forensic linguist
  can and cannot determine from a piece of writing and how this analysis ca
 n be used as evidence to help authenticate (or dispute) the authorship of 
 a message.</p>\n</li>\n<li>\n<p><strong>Recovering Deleted E-mail: </stron
 g>Explain the different methods an investigator can use to recover deleted
  e-mail messages. Your answer should cover the use of specialized GUI tool
 s (like Magnet AXIOM)\, the manual process of carving messages from an mbo
 x format file using a hex editor\, and the function of utilities like scan
 pst.exe for repairing corrupted Outlook files.</p>\n</li>\n</ol>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251107T202400Z
UID:event-assignment-730849
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Chapter 04 Linux Filesystem Management [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730849
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251107T202400Z
UID:event-assignment-730871
DTSTART;VALUE=DATE;VALUE=DATE:20251102
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 4-1: Create and Examine Directories [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730871
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T130500Z
UID:event-assignment-727874
DTSTART;VALUE=DATE;VALUE=DATE:20251105
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Module 10 Wireless Network Attacks and Defenses [25/FA CIS-61
 6-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727874
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T130500Z
UID:event-assignment-727882
DTSTART;VALUE=DATE;VALUE=DATE:20251105
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 10-1: Using a Wireless Monitor Tool [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727882
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T130500Z
UID:event-assignment-727883
DTSTART;VALUE=DATE;VALUE=DATE:20251105
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 10-2: Viewing WLAN Security [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727883
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T070000Z
UID:event-assignment-737145
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Lab 12-1: Mobile Device Forensics [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737145
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251118T031600Z
UID:event-assignment-736864
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:For your discussion post\, please complete either the "Linux fo
 r Life" or "Reflection" activity found in the reading section of the modul
 e.\n\nYour initial post is due on Friday by 11:59 PM\, and your three repl
 ies are due by Sunday at 11:59 PM. Please review the rubric in the assignm
 ent for details on grading requirements.
SEQUENCE:0
SUMMARY:Linux Chapter Five Discussion Post [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_736864
X-ALT-DESC;FMTTYPE=text/html:<p>For your discussion post\, please complete 
 either the "Linux for Life" or "Reflection" activity found in the reading 
 section of the module.</p>\n<p>Your initial post is due on Friday by 11:59
  PM\, and your three replies are due by Sunday at 11:59 PM. Please review 
 the rubric in the assignment for details on grading requirements.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T060000Z
UID:event-assignment-730830
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 5-1: Storage Management Concepts [25/FA CS
 C-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730830
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T060000Z
UID:event-assignment-730831
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 5-2: Logical Volume Manager Commands [25/F
 A CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730831
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T070000Z
UID:event-assignment-737158
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Module 12 Quiz [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737158
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T060000Z
UID:event-assignment-730850
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Chapter 05 Linux Filesystem Administration [25/FA CSC-121-OL0
 1]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730850
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T060000Z
UID:event-assignment-730872
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 5-1: Create Device Files [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730872
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251029T184100Z
UID:event-assignment-727226
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:Critical Thinking Exercise: Moving to Green Computing\n\nYour o
 rganization is a leader in the development of renewable energy sources bas
 ed on enhanced geothermal systems and is viewed as a champion in the fight
  to reduce carbon emissions. The organization employs over 25\,000 people 
 worldwide and operates three global data centers\, one each in the United 
 States\, Europe\, and Southeast Asia. The CEO has asked all her direct rep
 orts for input on a proposed strategy to become a leader in green computin
 g. In what ways is a move toward green computing consistent with your orga
 nization's mission of developing renewable energy sources? One green compu
 ting proposal is to consolidate the three data centers into one. Discuss t
 he pros and cons of this approach. Can you identify any other tactics the 
 organization might take to accelerate its move toward green computing? Ide
 ntify the pros and cons or any issues associated with your proposed tactic
 s.\n\nYour response needs to be a minimum of 2 complete paragraphs submitt
 ed via word document and due Sunday by midnight.
SEQUENCE:0
SUMMARY:Week 12 Critical Thinking Assignment [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=11&year=2025#assignment_727226
X-ALT-DESC;FMTTYPE=text/html:<p><strong>Critical Thinking Exercise: Moving 
 to Green Computing</strong></p>\n<p>Your organization is a leader in the d
 evelopment of renewable energy sources based on enhanced geothermal system
 s and is viewed as a champion in the fight to reduce carbon emissions. The
  organization employs over 25\,000 people worldwide and operates three glo
 bal data centers\, one each in the United States\, Europe\, and Southeast 
 Asia. The CEO has asked all her direct reports for input on a proposed str
 ategy to become a leader in green computing. In what ways is a move toward
  green computing consistent with your organization's mission of developing
  renewable energy sources? One green computing proposal is to consolidate 
 the three data centers into one. Discuss the pros and cons of this approac
 h. Can you identify any other tactics the organization might take to accel
 erate its move toward green computing? Identify the pros and cons or any i
 ssues associated with your proposed tactics.</p>\n<p>Your response needs t
 o be a minimum of 2 complete paragraphs submitted via word document and du
 e Sunday by midnight.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251029T184100Z
UID:event-assignment-727219
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:Please be sure to read through Chapter 10 before answering the 
 below questions in your own words:\n\n1. Your own original post that answe
 rs the question below: (Due Friday midnight)�5pts\n\n* What is the Gig ec
 onomy?\n\n* How do you feel about the Gig economy?� Pros or cons\, expand
  on your opinion\n\n* Do you feel that Whistle-Blower Protections go far e
 nough?� Explain why or why not\n\n2. Reply to 2 classmates' posts. (Due S
 unday midnight)�5pts\n\n�\n\nRubric\n\nTo receive full credit\, your pos
 t and reply must be...\n\n* At least three sentences in length (two paragr
 aphs of at least 3 sentences each for the initial post)\n\n* Written in co
 mplete\, grammatically correct sentences\n\n* Free from spelling errors\n\
 n* An intelligent response
SEQUENCE:0
SUMMARY:Week 12 Discussion [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=11&year=2025#assignment_727219
X-ALT-DESC;FMTTYPE=text/html:<p>Please be sure to read through Chapter 10 b
 efore answering the below questions in your own words:</p><p><span>1. Your
  own original post that answers the question below: (Due Friday midnight)&
 nbsp\;</span><strong>5pts</strong></p><ul><li>What is the Gig economy?</li
 ><li>How do you feel about the Gig economy?&nbsp\; Pros or cons\, expand o
 n your opinion</li><li>Do you feel that Whistle-Blower Protections go far 
 enough?&nbsp\; Explain why or why not</li></ul><p><span>2. Reply to 2 clas
 smates' posts. (Due Sunday midnight)</span><span>&nbsp\;</span><strong>5pt
 s</strong></p><p>&nbsp\;</p><p><em><span>Rubric</span></em></p><p>To recei
 ve full credit\, your post and reply must be...</p><ul><li>At least three 
 sentences in length (two paragraphs of at least 3 sentences each for the i
 nitial post)</li><li>Written in complete\, grammatically correct sentences
 </li><li>Free from spelling errors</li><li>An intelligent response</li></u
 l>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T060000Z
UID:event-assignment-737132
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:Class\,\n\nPlease be sure to read Module 12 and then answer the
  questions below:\n\n* Describe what mobile device forensics is in your ow
 n words.\n\n* Using this chapter and online resources\, list at least thre
 e mobile device forensics tools/equipment and explain how they work in you
 r own words. Be sure to cite sources where necessary.\n\n* In your own wor
 ds\, what is the "Internet of Anything"?\n\nPlease respond with a minimum 
 of two complete paragraphs. Your main post is due Friday by midnight\, and
  your three replies minimum are due Sunday by midnight.
SEQUENCE:0
SUMMARY:Week 12 Discussion [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737132
X-ALT-DESC;FMTTYPE=text/html:<p>Class\,</p>\n<p>Please be sure to read Modu
 le 12 and then answer the questions below:</p>\n<ul>\n<li>Describe what mo
 bile device forensics is in your own words.</li>\n<li>Using this chapter a
 nd online resources\, list at least three mobile device forensics tools/eq
 uipment and explain how they work in your own words. Be sure to cite sourc
 es where necessary.</li>\n<li>In your own words\, what is the "Internet of
  Anything"?</li>\n</ul>\n<p>Please respond with a minimum of two complete 
 paragraphs. Your main post is due Friday by midnight\, and your three repl
 ies minimum are due Sunday by midnight.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251029T184100Z
UID:event-assignment-727203
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:please be sure to read chapter 10 and then begin the quiz\, you
  get 2 attempts
SEQUENCE:0
SUMMARY:Week 12 Quiz [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=11&year=2025#assignment_727203
X-ALT-DESC;FMTTYPE=text/html:<p>please be sure to read chapter 10 and then 
 begin the quiz\, you get 2 attempts</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251031T201200Z
UID:event-assignment-783285
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:9-2: Android Smartphone Emulation [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_783285
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251031T201200Z
UID:event-assignment-783286
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:9-2: Troubleshoot Mobile Devices [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_783286
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251031T201300Z
UID:event-assignment-783287
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:10-1: Install and Configure a Printer [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_783287
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251107T153200Z
UID:event-assignment-783284
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:Complete the Chapter 9 & 10 quiz. There are 5 questions from ea
 ch chapter. You get 2 attempts on the quiz and the highest grade will be r
 ecorded.�\n\nLooking up the answers is cheating. Read through the resourc
 es in the module before taking it.�
SEQUENCE:0
SUMMARY:Chapter 9 & 10 Quiz [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_783284
X-ALT-DESC;FMTTYPE=text/html:<p><span>Complete the Chapter 9 &amp\; 10 quiz
 . There are 5 questions from each chapter. You get 2 attempts on the quiz 
 and the highest grade will be recorded.&nbsp\;</span></p>\n<p><span>Lookin
 g up the answers is cheating. Read through the resources in the module bef
 ore taking it.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T060000Z
UID:event-assignment-767851
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:The Indispensability of Digital Signatures\n-------------------
 -----------------------\n\nYou were introduced to digital signatures by hi
 ghlighting why symmetric cryptography\, despite offering confidentiality a
 nd message authentication\, falls short in practical scenarios. The car de
 alership example\, where Bob denies ordering a pink-orange car\, vividly i
 llustrates the critical problem of non-repudiation that symmetric schemes 
 cannot resolve.\n\n* Discuss the core differences in security services pro
 vided by symmetric cryptography (e.g.\, encryption with AES\, Message Auth
 entication Codes or MACs) versus asymmetric digital signatures.\n\n* Beyon
 d the car dealership scenario\, identify and explain at least two other re
 al-world situations where the specific security services offered by digita
 l signatures (especially non-repudiation\, message authentication\, and in
 tegrity) are critically important\, and where symmetric-key solutions woul
 d be inadequate or problematic.\n\nYour initial post should be at least tw
 o paragraphs long\, with each containing four sentences. This is due by Fr
 iday at 11:59 PM. A minimum of three replies is due Sunday evening by 11:5
 9 PM.\n\n�\n\nWorks Cited:\n\nPaar\, C.\, Pelzl\, J.\, & G�neysu\, T. (2
 024). Understanding cryptography: From Established Symmetric and Asymmetri
 c Ciphers to Post-Quantum Algorithms. Springer.
SEQUENCE:0
SUMMARY:Chapter 10 Discussion [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_767851
X-ALT-DESC;FMTTYPE=text/html:<div class="paragraph normal ng-star-inserted"
  data-start-index="224">\n<div class="paragraph normal ng-star-inserted" d
 ata-start-index="310">\n<h3 class="paragraph heading3 ng-star-inserted" da
 ta-start-index="200"><span class="ng-star-inserted" data-start-index="200"
 >The Indispensability of Digital Signatures</span></h3>\n<div class="parag
 raph normal ng-star-inserted" data-start-index="285"><span class="ng-star-
 inserted" data-start-index="285">You were introduced to digital signatures
  by highlighting why symmetric cryptography\, despite offering confidentia
 lity and message authentication\, falls short in practical scenarios</span
 ><span class="ng-star-inserted" data-start-index="475">. The </span><span 
 class="ng-star-inserted">car dealership example</span><span class="ng-star
 -inserted" data-start-index="503">\, where Bob denies ordering a pink-oran
 ge car\, vividly illustrates the critical problem of </span><span class="n
 g-star-inserted">non-repudiation</span><span class="ng-star-inserted" data
 -start-index="609"> that symmetric schemes cannot resolve</span><span clas
 s="ng-star-inserted" data-start-index="647">.</span></div>\n<ul>\n<li clas
 s="paragraph normal ng-star-inserted" data-start-index="648"><span class="
 ng-star-inserted">Discuss the core differences in security services provid
 ed by symmetric cryptography (e.g.\, encryption with AES\, Message Authent
 ication Codes or MACs) versus asymmetric digital signatures</span><span cl
 ass="ng-star-inserted">.</span></li>\n<li class="paragraph normal ng-star-
 inserted" data-start-index="836"><span class="ng-star-inserted">Beyond the
  car dealership scenario\, identify and explain at least two other real-wo
 rld situations where the specific security services offered by digital sig
 natures (especially non-repudiation\, message authentication\, and integri
 ty) are critically important\, and where symmetric-key solutions would be 
 inadequate or problematic</span><span class="ng-star-inserted">.</span></l
 i>\n</ul>\n</div>\n</div>\n<p><span class="ng-star-inserted">Your initial 
 post should be at least two paragraphs long\, with each containing four se
 ntences. This is due by Friday at 11:59 PM. A minimum of three replies is 
 due Sunday evening by 11:59 PM.</span></p>\n<p>&nbsp\;</p>\n<p>Works Cited
 :</p>\n<div>\n<p>Paar\, C.\, Pelzl\, J.\, &amp\; G�neysu\, T. (2024). <i>
 Understanding cryptography: From Established Symmetric and Asymmetric Ciph
 ers to Post-Quantum Algorithms</i>. Springer.</p>\n</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T060000Z
UID:event-assignment-767853
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 10 Quiz [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_767853
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T060000Z
UID:event-assignment-767852
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:The RSA Digital Signature Scheme\n-----------------------------
 ---\n\nThe RSA digital signature scheme is a widely adopted method based o
 n public-key cryptography\, whose security relies on the hardness of the i
 nteger factorization problem.\n\n* Explain the step-by-step process of the
  "schoolbook" RSA digital signature protocol\, covering both how a message
  is signed by the sender and how the signature is verified by the receiver
 . Clearly articulate the role of the private and public keys in this proce
 ss\, highlighting how their usage differs from RSA encryption.\n\n* Analyz
 e the practical computational aspects of RSA digital signatures\, includin
 g signature length and the significant impact of using short public expone
 nts for verification in real-world applications like Public-Key Infrastruc
 tures (PKIs).\n\n* Discuss the security considerations of the RSA digital 
 signature scheme\, specifically addressing how messages of arbitrary lengt
 h are handled in practice (i.e.\, through the use of hash functions and pa
 dding) and on which fundamental mathematical problem its security relies. 
 Conclude by briefly mentioning the future threat posed by large-scale quan
 tum computers to RSA.\n\nYour essay should draw directly from both the pro
 vided source material and external sources. Cite your work appropriately t
 o support your arguments and offer detailed explanations of the cryptograp
 hic concepts involved.� The assignment should be at a minimum of three pa
 ges and in APA format.\n\nSubmit your work as either a Word Document or a 
 PDF. Ensure you follow the rubric.
SEQUENCE:0
SUMMARY:Chapter 10 Writing Assignment [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_767852
X-ALT-DESC;FMTTYPE=text/html:<div class="paragraph normal ng-star-inserted"
  data-start-index="274">\n<h3 class="paragraph heading3 ng-star-inserted" 
 data-start-index="1246"><span class="ng-star-inserted" data-start-index="1
 246">The RSA Digital Signature Scheme</span></h3>\n<div class="paragraph h
 eading3 ng-star-inserted" data-start-index="1246"><span class="ng-star-ins
 erted" data-start-index="1316">The RSA digital signature scheme is a widel
 y adopted method based on public-key cryptography\, whose security relies 
 on the hardness of the integer factorization problem</span><span class="ng
 -star-inserted" data-start-index="1503">.</span></div>\n<ul>\n<li class="p
 aragraph normal ng-star-inserted" data-start-index="1504"><span class="ng-
 star-inserted">Explain the step-by-step process of the "schoolbook" RSA di
 gital signature protocol\, covering both how a message is signed by the se
 nder and how the signature is verified by the receiver</span><span class="
 ng-star-inserted">. Clearly articulate the role of the private and public 
 keys in this process\, highlighting how their usage differs from RSA encry
 ption</span><span class="ng-star-inserted">.</span></li>\n<li class="parag
 raph normal ng-star-inserted" data-start-index="1825"><span class="ng-star
 -inserted">Analyze the practical computational aspects of RSA digital sign
 atures\, including signature length and the significant impact of using sh
 ort public exponents for verification in real-world applications like Publ
 ic-Key Infrastructures (PKIs)</span><span class="ng-star-inserted">.</span
 ></li>\n<li class="paragraph normal ng-star-inserted" data-start-index="18
 25"><span class="ng-star-inserted">Discuss the security considerations of 
 the RSA digital signature scheme\, specifically addressing how messages of
  arbitrary length are handled in practice (i.e.\, through the use of hash 
 functions and padding) and on which fundamental mathematical problem its s
 ecurity relies</span><span class="ng-star-inserted">. Conclude by briefly 
 mentioning the future threat posed by large-scale quantum computers to RSA
 </span><span class="ng-star-inserted">.</span></li>\n</ul>\n<div class="pa
 ragraph normal ng-star-inserted" data-start-index="2811"><span class="ng-s
 tar-inserted" data-start-index="2811">Your essay </span><span style="font-
 family: inherit\; font-size: 1rem\;">should draw directly from both the pr
 ovided source material and external sources. Cite your work appropriately 
 to support your arguments and offer detailed explanations of the cryptogra
 phic concepts involved.&nbsp\; The assignment should be at a minimum of th
 ree pages and in APA format.</span></div>\n</div>\n<div class="paragraph n
 ormal ng-star-inserted" data-start-index="274">Submit your work as either 
 a Word Document or a PDF. Ensure you follow the rubric.</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T233500Z
UID:event-assignment-727835
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:All discussions must be submitted every Sunday at 6:00 p.m. (th
 is includes original postings and replies) for attendance purposes.\n\nDis
 cussion posts should be a paragraph or more and should fully answer the qu
 estions provided. Please make your initial post by Friday and respond to a
 t least 2 other students by Sunday.\n\nThis week's questions:\n\n* Discuss
 ion: Cloud\, Hybrid\, or On-Premises? Duration: 25 minutes.\n\n* While clo
 ud computing is a growing technology\, there are some detractors.\n\n* Wha
 t are some of the pros and cons of using cloud computing and are concerns 
 about its privacy and security valid? Compare the security concerns of usi
 ng an all-cloud model where all critical resources including desktop OSs a
 re housed in the cloud versus a hybrid model where some resources are in t
 he cloud and some are on-premises versus an all on-premises model.\n\nPost
 ing Criteria and Grading�\n\nInitial discussion post (8 sentences)\n\n60%
  of overall credit\n\n2 replies to one other students (5 sentences each) 3
 0% each\n\n30% of overall credit\n\nGrammar/spelling\n\n10% of overall cre
 dit\n\n�
SEQUENCE:0
SUMMARY:Discussion 11 [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727835
X-ALT-DESC;FMTTYPE=text/html:<header class="discussion-section clearfix">\n
 <div class="discussion-header-content right-of-avatar">\n<div class="pull-
 left">\n<p><span style="background-color: #ecf0f1\; font-size: 14pt\;"><st
 rong style="color: #e03e2d\;">All discussions must be submitted every Sund
 ay at 6:00 p.m. (this includes original postings and replies) for </strong
 ><span style="color: #e03e2d\;"><strong>attendance</strong></span><strong 
 style="color: #e03e2d\;"> purposes.</strong></span><strong></strong></p>\n
 <p>Discussion posts should be a paragraph or more and should fully answer 
 the questions provided. Please make your initial post by Friday and respon
 d to at least 2 other students by Sunday.</p>\n<p><strong>This week's ques
 tions:</strong></p>\n<ol>\n<li>Discussion: Cloud\, Hybrid\, or On-Premises
 ? Duration: 25 minutes.\n<ol>\n<li>While cloud computing is a growing tech
 nology\, there are some detractors.</li>\n<li>What are some of the pros an
 d cons of using cloud computing and are concerns about its privacy and sec
 urity valid? Compare the security concerns of using an all-cloud model whe
 re all critical resources including desktop OSs are housed in the cloud ve
 rsus a hybrid model where some resources are in the cloud and some are on-
 premises versus an all on-premises model.</li>\n</ol>\n</li>\n</ol>\n</div
 >\n</div>\n</header>\n<div class="discussion-section message_wrapper">\n<d
 iv class="message user_content enhanced" data-bind="message">\n<p><strong>
 Posting Criteria and Grading&nbsp\;</strong><strong></strong></p>\n<table 
 style="border-collapse: collapse\; width: 58.148%\; height: 111px\;" borde
 r="1">\n<tbody>\n<tr style="height: 29px\;">\n<td style="width: 49.9483%\;
  height: 29px\;">Initial discussion post (8 sentences)</td>\n<td style="wi
 dth: 49.9483%\; height: 29px\;">60% of overall credit</td>\n</tr>\n<tr sty
 le="height: 53px\;">\n<td style="width: 49.9483%\; height: 53px\;">2 repli
 es to one other students (5 sentences each) 30% each</td>\n<td style="widt
 h: 49.9483%\; height: 53px\;">30% of overall credit</td>\n</tr>\n<tr style
 ="height: 29px\;">\n<td style="width: 49.9483%\; height: 29px\;">Grammar/s
 pelling</td>\n<td style="width: 49.9483%\; height: 29px\;">10% of overall 
 credit</td>\n</tr>\n</tbody>\n</table>\n<p>&nbsp\;</p>\n</div>\n</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251031T201400Z
UID:event-assignment-783288
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:Lab 10-4: Troubleshoot a Printer [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_783288
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T060000Z
UID:event-assignment-741499
DTSTART;VALUE=DATE;VALUE=DATE:20251109
CLASS:PUBLIC
DESCRIPTION:Choose two of the provided essay prompts based on Chapter 11 of
  the Guide to Computer Forensics and Investigations. For each prompt you s
 elect\, write a comprehensive\, well-structured essay of at least one full
  page using APA format. Your response must be based on the information and
  concepts presented in the first chapter of the provided text. The use of 
 external sources is encouraged\; however\, please review the policy on usi
 ng AI in the syllabus for guidance. As a reminder\, your work will be auto
 matically checked for AI generation. Ensure that you use proper citations 
 for all works used\, including the textbook.\n\nSubmit your assignment in 
 a single file\, using either a Word (.doc\, .docx) or PDF format.\n\n*\n\n
 Mobile Device Seizure and Isolation: Detail the critical first steps an in
 vestigator must take when seizing a mobile device at a crime scene. Explai
 n the primary concerns-loss of power\, remote wiping\, and network synch
 ronization-and describe the different methods for isolating a device fro
 m the network\, along with the pros and cons of each method.\n\n*\n\nMobil
 e Acquisition Methods: Compare and contrast the six types of mobile forens
 ics methods outlined by NIST: manual\, logical\, physical\, hex dumping/JT
 AG\, chip-off\, and micro read. Explain what kind of data can be expected 
 from each method and the circumstances that would dictate which method is 
 most appropriate.\n\n*\n\nThe Role of the SIM Card: Describe the function 
 and structure of a Subscriber Identity Module (SIM) card in a GSM device. 
 Explain the hierarchical file system of a SIM card (MF\, DF\, EF) and deta
 il the four categories of information that can be retrieved from it. What 
 precautions must an investigator take when using a SIM card reader?\n\n*\n
 \nThe Evolution of Cellular Networks: Trace the evolution of mobile phone 
 networks from 3G to 4G and the upcoming 5G standard. Explain the differenc
 es between the two main network technologies\, CDMA and GSM. How does an u
 nderstanding of this underlying infrastructure (BTS\, BSC\, MSC) aid an in
 vestigator in obtaining evidence from service providers?\n\n*\n\nThe Inter
 net of Anything (IoA) Challenge: Define the Internet of Anything (IoA) and
  explain the new forensic challenges it presents. Discuss the difficulties
  of acquiring data from a wide array of interconnected devices like smart 
 home appliances\, wearable technology\, and vehicle systems. Why is determ
 ining data reliability and dealing with limited data retention on these de
 vices a major concern for investigators?
SEQUENCE:0
SUMMARY:Module 12 Essay [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_741499
X-ALT-DESC;FMTTYPE=text/html:<p>Choose two of the provided essay prompts ba
 sed on Chapter 11 of the Guide to Computer Forensics and Investigations. F
 or each prompt you select\, write a comprehensive\, well-structured essay 
 of at least one full page using APA format. Your response must be based on
  the information and concepts presented in the first chapter of the provid
 ed text. The use of external sources is encouraged\; however\, please revi
 ew the policy on using AI in the syllabus for guidance. <span>As a reminde
 r\, your work will be automatically checked for AI generation. Ensure that
  you use proper citations for all works used\, including the textbook.</sp
 an></p>\n<p>Submit your assignment in a single file\, using either a Word 
 (.doc\, .docx) or PDF format.</p>\n<ol style="list-style-type: decimal\;">
 \n<li>\n<p><strong>Mobile Device Seizure and Isolation:</strong> Detail th
 e critical first steps an investigator must take when seizing a mobile dev
 ice at a crime scene. Explain the primary concerns-loss of power\, remot
 e wiping\, and network synchronization-and describe the different method
 s for isolating a device from the network\, along with the pros and cons o
 f each method.</p>\n</li>\n<li>\n<p><strong>Mobile Acquisition Methods: </
 strong>Compare and contrast the six types of mobile forensics methods outl
 ined by NIST: manual\, logical\, physical\, hex dumping/JTAG\, chip-off\, 
 and micro read. Explain what kind of data can be expected from each method
  and the circumstances that would dictate which method is most appropriate
 .</p>\n</li>\n<li>\n<p><strong>The Role of the SIM Card: </strong>Describe
  the function and structure of a Subscriber Identity Module (SIM) card in 
 a GSM device. Explain the hierarchical file system of a SIM card (MF\, DF\
 , EF) and detail the four categories of information that can be retrieved 
 from it. What precautions must an investigator take when using a SIM card 
 reader?</p>\n</li>\n<li>\n<p><strong>The Evolution of Cellular Networks: <
 /strong>Trace the evolution of mobile phone networks from 3G to 4G and the
  upcoming 5G standard. Explain the differences between the two main networ
 k technologies\, CDMA and GSM. How does an understanding of this underlyin
 g infrastructure (BTS\, BSC\, MSC) aid an investigator in obtaining eviden
 ce from service providers?</p>\n</li>\n<li>\n<p><strong>The Internet of An
 ything (IoA) Challenge: </strong>Define the Internet of Anything (IoA) and
  explain the new forensic challenges it presents. Discuss the difficulties
  of acquiring data from a wide array of interconnected devices like smart 
 home appliances\, wearable technology\, and vehicle systems. Why is determ
 ining data reliability and dealing with limited data retention on these de
 vices a major concern for investigators?</p>\n</li>\n</ol>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T130500Z
UID:event-assignment-727875
DTSTART;VALUE=DATE;VALUE=DATE:20251112
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Module 11 Cloud and Virtualization Security [25/FA CIS-616-OL
 01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727875
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T130500Z
UID:event-assignment-727884
DTSTART;VALUE=DATE;VALUE=DATE:20251112
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 11-1: Install Fedora VM [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727884
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T130500Z
UID:event-assignment-727885
DTSTART;VALUE=DATE;VALUE=DATE:20251112
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 11-2: Install Windows 11 VM [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727885
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251113T161400Z
UID:event-assignment-737142
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Lab 1-1: Understanding the Digital Forensics Profession and Investi
 gation [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737142
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251113T161400Z
UID:event-assignment-737150
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Lab 3-1: Data Acquisition [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737150
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251113T161600Z
UID:event-assignment-737151
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Lab 4-1: Processing Crime and Incident Scenes [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737151
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251113T161600Z
UID:event-assignment-737152
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Lab 5-1: Working with Windows and CLI Systems [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737152
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T070000Z
UID:event-assignment-737146
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Lab 13-1: Cloud Forensics [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737146
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251118T033000Z
UID:event-assignment-736865
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:For your discussion post\, please complete either the "Linux fo
 r Life" or "Reflection" activity found in the reading section of the modul
 e.\n\nYour initial post is due on Friday by 11:59 PM\, and your three repl
 ies are due by Sunday at 11:59 PM. Please review the rubric in the assignm
 ent for details on grading requirements.
SEQUENCE:0
SUMMARY:Linux Chapter Seven Discussion Post [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_736865
X-ALT-DESC;FMTTYPE=text/html:<p>For your discussion post\, please complete 
 either the "Linux for Life" or "Reflection" activity found in the reading 
 section of the module.</p>\n<p>Your initial post is due on Friday by 11:59
  PM\, and your three replies are due by Sunday at 11:59 PM. Please review 
 the rubric in the assignment for details on grading requirements.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T060000Z
UID:event-assignment-730835
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 7-1: Linux Scripting Techniques [25/FA CSC
 -121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730835
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T060000Z
UID:event-assignment-730836
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 7-2: Versioning Control using GIT [25/FA C
 SC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730836
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T060000Z
UID:event-assignment-737133
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:Class\,\n\nBe sure to read Module 13 Chapter and then review th
 e discussion questions below:\n\n* In your own words\, how would you descr
 ibe cloud computing to someone?\n\n* What are the pros and cons of securin
 g data in the cloud?\n\n* Research at least one article online related to 
 cloud computing security and then summarize in your own words how this rel
 ates to our chapter.� Be sure to cite your sources and link the article.\
 n\nYour main post needs at least two complete paragraphs and is due Friday
  by midnight\, and your three reply minimum is due Sunday by midnight.
SEQUENCE:0
SUMMARY:Module 13 Discussion [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737133
X-ALT-DESC;FMTTYPE=text/html:<p>Class\,</p>\n<p>Be sure to read Module 13 C
 hapter and then review the discussion questions below:</p>\n<ul>\n<li>In y
 our own words\, how would you describe cloud computing to someone?</li>\n<
 li>What are the pros and cons of securing data in the cloud?</li>\n<li>Res
 earch at least one article online related to cloud computing security and 
 then summarize in your own words how this relates to our chapter.&nbsp\; B
 e sure to cite your sources and link the article.</li>\n</ul>\n<p>Your mai
 n post needs at least two complete paragraphs and is due Friday by midnigh
 t\, and your three reply minimum is due Sunday by midnight.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T070000Z
UID:event-assignment-737159
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Module 13 Quiz [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737159
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T060000Z
UID:event-assignment-730851
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Chapter 07 Working with the Shell [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730851
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T060000Z
UID:event-assignment-730873
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 7-1: Set Up and Use the Z Shell [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730873
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T195900Z
UID:event-assignment-727227
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:Class\n\nYour assignment this week is to research a minimum of 
 2 different kinds of Cyber Forensics Tools\, this will require you to goog
 le information online and cite your sources.� I would like at least 1 par
 agraph summarizing each type of cyber forensics tool that you find and you
  can include things such as the following:\n\n* The name of this produce a
 nd how long has it been around?\n\n* What makes this forensics tool specia
 l or unique?\n\n* Why would you recommend a cyber security professional ha
 ve this forensics tool on their computer?\n\n* what else would you like to
  mention about this?\n\nSo to reiterate you should end up with a minimum o
 f 2 complete paragraphs summarizing 2 different software tools for cyber f
 orensics and cite your sources.��\n\nthis must be submitted in a .doc or
  .docx word file format no later than Sunday by midnight
SEQUENCE:0
SUMMARY:Week 13 Assignment [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=11&year=2025#assignment_727227
X-ALT-DESC;FMTTYPE=text/html:<p>Class</p>\n<p>Your assignment this week is 
 to research a minimum of 2 different kinds of Cyber Forensics Tools\, this
  will require you to google information online and cite your sources.&nbsp
 \; I would like at least 1 paragraph summarizing each type of cyber forens
 ics tool that you find and you can include things such as the following:</
 p>\n<ul>\n<li>The name of this produce and how long has it been around?</l
 i>\n<li>What makes this forensics tool special or unique?</li>\n<li>Why wo
 uld you recommend a cyber security professional have this forensics tool o
 n their computer?</li>\n<li>what else would you like to mention about this
 ?</li>\n</ul>\n<p>So to reiterate you should end up with a minimum of 2 co
 mplete paragraphs summarizing 2 different software tools for cyber forensi
 cs and cite your sources.&nbsp\;&nbsp\;</p>\n<p>this must be submitted in 
 a .doc or .docx word file format no later than Sunday by midnight</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251103T195900Z
UID:event-assignment-727220
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:1. Your own original post that answers the question below: (Due
  Friday midnight)�5pts\n\n* What do you think the future of cyber investi
 gation tools will include?\n\n* how do you think they will work?\n\n* What
  kinds of ethical dilemmas and professional responsibility do cyber securi
 ty experts have when using these kinds of tools?\n\n2. Reply to 2 classmat
 es' posts. (Due Sunday midnight)�5pts\n\n�\n\nRubric\n\nTo receive full 
 credit\, your post and reply must be...\n\n* At least three sentences in l
 ength (two paragraphs of at least 3 sentences each for the initial post)\n
 \n* Written in complete\, grammatically correct sentences\n\n* Free from s
 pelling errors\n\n* An intelligent response\n\n�
SEQUENCE:0
SUMMARY:Week 13 Discussion [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=11&year=2025#assignment_727220
X-ALT-DESC;FMTTYPE=text/html:<p><span>1. Your own original post that answer
 s the question below: (Due Friday midnight)&nbsp\;</span><strong>5pts</str
 ong></p><ul><li>What do you think the future of cyber investigation tools 
 will include?<ul><li>how do you think they will work?</li></ul></li><li>Wh
 at kinds of ethical dilemmas and professional responsibility do cyber secu
 rity experts have when using these kinds of tools?</li></ul><p><span>2. Re
 ply to 2 classmates' posts. (Due Sunday midnight)</span><span>&nbsp\;</spa
 n><strong>5pts</strong></p><p>&nbsp\;</p><p><em><span>Rubric</span></em></
 p><p>To receive full credit\, your post and reply must be...</p><ul><li>At
  least three sentences in length (two paragraphs of at least 3 sentences e
 ach for the initial post)</li><li>Written in complete\, grammatically corr
 ect sentences</li><li>Free from spelling errors</li><li>An intelligent res
 ponse</li></ul><p>&nbsp\;</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T060000Z
UID:event-assignment-767854
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:The Necessity of Hash Functions in Digital Signatures\n--------
 ---------------------------------------------\n\nThe text highlights criti
 cal issues that arise when attempting to digitally sign long messages dire
 ctly using schemes like RSA. These issues include significant bandwidth ov
 erhead and inherent security vulnerabilities that could allow attackers to
  manipulate signed documents by reordering or removing blocks\, even if in
 dividual blocks are cryptographically protected. Hash functions are presen
 ted as the elegant solution\, creating a fixed-length "digital fingerprint
 " that is then signed instead of the entire message.\n\nConsider the impli
 cations of these challenges and the solution offered by hash functions:\n\
 n* Beyond the stated "bandwidth overhead" and "security limitations"\, dis
 cuss in detail why directly signing a long message block-by-block is funda
 mentally flawed from a security perspective. Provide a concrete\, imaginat
 ive example of an attack scenario that exploits the ability to reorder or 
 remove signed blocks.\n\n* How does the "digital fingerprint" property of 
 hash functions not only solve the length and integrity problems but also c
 ontribute to the non-repudiation service discussed last week?\n\n* Can you
  think of any scenarios where the original\, "schoolbook" method of signin
 g entire messages directly might still be acceptably secure\, perhaps due 
 to specific application constraints or short message lengths? Justify your
  reasoning.\n\nYour initial post should be at least two paragraphs long\, 
 with each containing four sentences. This is due by Friday at 11:59 PM. A 
 minimum of three replies is due Sunday evening by 11:59 PM.\n\n�\n\nWorks
  Cited:\n\nPaar\, C.\, Pelzl\, J.\, & G�neysu\, T. (2024). Understanding 
 cryptography: From Established Symmetric and Asymmetric Ciphers to Post-Qu
 antum Algorithms. Springer.
SEQUENCE:0
SUMMARY:Chapter 11 Discussion [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_767854
X-ALT-DESC;FMTTYPE=text/html:<div class="paragraph normal ng-star-inserted"
  data-start-index="224">\n<div class="paragraph normal ng-star-inserted" d
 ata-start-index="310">\n<h3 class="paragraph heading3 ng-star-inserted" da
 ta-start-index="200">The Necessity of Hash Functions in Digital Signatures
 </h3>\n<div class="paragraph normal ng-star-inserted" data-start-index="28
 5">\n<div class="paragraph normal ng-star-inserted" data-start-index="264"
 ><span class="ng-star-inserted" data-start-index="264">The text highlights
  critical issues that arise when attempting to digitally sign long message
 s directly using schemes like RSA</span><span class="ng-star-inserted" dat
 a-start-index="432">. These issues include </span><span class="ng-star-ins
 erted">significant bandwidth overhead</span><span class="ng-star-inserted"
  data-start-index="485"> and </span><span class="ng-star-inserted">inheren
 t security vulnerabilities</span><span class="ng-star-inserted" data-start
 -index="523"> that could allow attackers to manipulate signed documents by
  reordering or removing blocks\, even if individual blocks are cryptograph
 ically protected</span><span class="ng-star-inserted" data-start-index="67
 3">. Hash functions are presented as the elegant solution\, creating a </s
 pan><span class="ng-star-inserted">fixed-length "digital fingerprint"</spa
 n><span class="ng-star-inserted" data-start-index="774"> that is then sign
 ed instead of the entire message</span><span class="ng-star-inserted" data
 -start-index="824">.</span></div>\n<div class="paragraph normal ng-star-in
 serted" data-start-index="825"><span class="ng-star-inserted" data-start-i
 ndex="825">Consider the implications of these challenges and the solution 
 offered by hash functions:</span></div>\n<ul>\n<li class="paragraph normal
  ng-star-inserted" data-start-index="914"><span class="ng-star-inserted" d
 ata-start-index="914">Beyond the stated "bandwidth overhead" and "security
  limitations"</span><span class="ng-star-inserted" data-start-index="979">
 \, discuss in detail </span><i class="ng-star-inserted" data-start-index="
 999">why</i><span class="ng-star-inserted" data-start-index="1002"> direct
 ly signing a long message block-by-block is fundamentally flawed from a se
 curity perspective. Provide a concrete\, imaginative example of an attack 
 scenario that exploits the ability to reorder or remove signed blocks.</sp
 an></li>\n<li class="paragraph normal ng-star-inserted" data-start-index="
 1226"><span class="ng-star-inserted" data-start-index="1226">How does the 
 "digital fingerprint" property of hash functions</span><span class="ng-sta
 r-inserted" data-start-index="1287"> not only solve the length and integri
 ty problems but also contribute to the non-repudiation service discussed l
 ast week</span><span class="ng-star-inserted" data-start-index="1411">?</s
 pan></li>\n<li class="paragraph normal ng-star-inserted" data-start-index=
 "1412"><span class="ng-star-inserted" data-start-index="1412">Can you thin
 k of any scenarios where the original\, "schoolbook" method of signing ent
 ire messages directly might still be acceptably secure\, perhaps due to sp
 ecific application constraints or short message lengths? Justify your reas
 oning.</span></li>\n</ul>\n</div>\n</div>\n</div>\n<p><span class="ng-star
 -inserted">Your initial post should be at least two paragraphs long\, with
  each containing four sentences. This is due by Friday at 11:59 PM. A mini
 mum of three replies is due Sunday evening by 11:59 PM.</span></p>\n<p>&nb
 sp\;</p>\n<p>Works Cited:</p>\n<div>\n<p>Paar\, C.\, Pelzl\, J.\, &amp\; G
 �neysu\, T. (2024). <i>Understanding cryptography: From Established Symme
 tric and Asymmetric Ciphers to Post-Quantum Algorithms</i>. Springer.</p>\
 n</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T060000Z
UID:event-assignment-767856
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 11 Quiz [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_767856
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T060000Z
UID:event-assignment-767855
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:Design Principles and Security Implications of Hash Algorithms\
 n--------------------------------------------------------------\n\nIn your
  text\, the section "Overview of Hash Algorithms\," categorizes them into 
 dedicated hash functions and block cipher-based constructions\, and introd
 uces fundamental design principles like the Merkle-Damg�rd and sponge c
 onstructions. It also discusses the critical security implications related
  to output length\, particularly concerning collision resistance and the B
 irthday Attack. Write an essay that addresses the following points:\n\n* C
 ompare and contrast the Merkle-Damg�rd construction (used by SHA-1 and 
 SHA-2) with the sponge construction (used by SHA-3). Discuss the philosoph
 ical differences in their design approach and how these might influence th
 eir versatility or resistance to future attacks.\n\n* Analyze the trade-of
 fs involved in constructing hash functions from existing block ciphers (e.
 g.\, Matyas-Meyer-Oseas\, Davies-Meyer\, Miyaguchi-Preneel) versus
  designing dedicated hash functions (e.g.\, SHA family). Highlight the sec
 urity vulnerabilities that arise when block cipher-based hashes have outpu
 t lengths equal to common block cipher widths (e.g.\, 128 bits for AES) wh
 en aiming for collision resistance\, explaining the role of the Birthday A
 ttack and why 256 bits or more are recommended for security against it.\n\
 n* Discuss the significance of the SHA-3 competition and its outcome. Why 
 did NIST decide to develop SHA-3 as an alternative to SHA-2 with a dissimi
 lar internal design\, rather than a direct replacement? How does the SHA-3
  family's support for various output lengths and the Extendable-Output Fun
 ction (XOF) functionality demonstrate a forward-looking design philosophy 
 compared to SHA-1 and SHA-2?\n\nYour essay should demonstrate a clear unde
 rstanding of the cryptographic concepts\, design choices\, and security co
 nsiderations\, drawing directly from both the provided source material and
  external sources. Cite your work appropriately to support your arguments 
 and offer detailed explanations of the cryptographic concepts involved.� 
 The assignment should be at a minimum of three pages and in APA format.\n\
 nSubmit your work as either a Word Document or a PDF. Ensure you follow th
 e rubric.
SEQUENCE:0
SUMMARY:Chapter 11 Writing Assignment [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_767855
X-ALT-DESC;FMTTYPE=text/html:<div class="paragraph normal ng-star-inserted"
  data-start-index="274">\n<h3 class="paragraph heading3 ng-star-inserted" 
 data-start-index="1246">Design Principles and Security Implications of Has
 h Algorithms</h3>\n<div class="paragraph heading3 ng-star-inserted" data-s
 tart-index="1246">\n<div class="paragraph normal ng-star-inserted" data-st
 art-index="1866"><span class="ng-star-inserted" data-start-index="1866">In
  your text\, the section "Overview of Hash Algorithms\," categorizes them 
 into dedicated hash functions and block cipher-based constructions\, and i
 ntroduces fundamental design principles like the Merkle-Damg�rd and spo
 nge constructions</span><span class="ng-star-inserted" data-start-index="2
 102">. It also discusses the critical security implications related to out
 put length\, particularly concerning collision resistance and the Birthday
  Attack</span><span class="ng-star-inserted" data-start-index="2251">. </s
 pan><span class="ng-star-inserted" data-start-index="2252">Write an essay 
 that addresses the following points:</span></div>\n<ul>\n<li class="paragr
 aph normal ng-star-inserted" data-start-index="2303"><span class="ng-star-
 inserted" data-start-index="2303">Compare and contrast the </span><span cl
 ass="ng-star-inserted">Merkle-Damg�rd construction</span><span class="n
 g-star-inserted" data-start-index="2355"> (used by SHA-1 and SHA-2) with t
 he </span><span class="ng-star-inserted">sponge construction</span><span c
 lass="ng-star-inserted" data-start-index="2410"> (used by SHA-3)</span><sp
 an class="ng-star-inserted" data-start-index="2426">. Discuss the philosop
 hical differences in their design approach and how these might influence t
 heir versatility or resistance to future attacks.</span></li>\n<li class="
 paragraph normal ng-star-inserted" data-start-index="2571"><span class="ng
 -star-inserted" data-start-index="2571">Analyze the trade-offs involved in
  constructing hash functions from </span><span class="ng-star-inserted">ex
 isting block ciphers</span><span class="ng-star-inserted" data-start-index
 ="2661"> (e.g.\, Matyas-Meyer-Oseas\, Davies-Meyer\, Miyaguchi-Pre
 neel) versus designing </span><span class="ng-star-inserted">dedicated has
 h functions</span><span class="ng-star-inserted" data-start-index="2763"> 
 (e.g.\, SHA family)</span><span class="ng-star-inserted" data-start-index=
 "2782">. Highlight the security vulnerabilities that arise when block ciph
 er-based hashes have output lengths equal to common block cipher widths (e
 .g.\, 128 bits for AES) when aiming for collision resistance\, explaining 
 the role of the </span><span class="ng-star-inserted">Birthday Attack</spa
 n><span class="ng-star-inserted" data-start-index="3026"> and why </span><
 span class="ng-star-inserted">256 bits or more</span><span class="ng-star-
 inserted" data-start-index="3051"> are recommended for security against it
 </span><span class="ng-star-inserted" data-start-index="3091">.</span></li
 >\n<li class="paragraph normal ng-star-inserted" data-start-index="3092"><
 span class="ng-star-inserted" data-start-index="3092">Discuss the signific
 ance of the </span><span class="ng-star-inserted">SHA-3 competition</span>
 <span class="ng-star-inserted" data-start-index="3141"> and its outcome</s
 pan><span class="ng-star-inserted" data-start-index="3157">. Why did NIST 
 decide to develop SHA-3 as an </span><i class="ng-star-inserted" data-star
 t-index="3202">alternative</i><span class="ng-star-inserted" data-start-in
 dex="3213"> to SHA-2 with a dissimilar internal design\, rather than a dir
 ect </span><i class="ng-star-inserted" data-start-index="3279">replacement
 </i><span class="ng-star-inserted" data-start-index="3290">? How does the 
 SHA-3 family's support for various output lengths and the </span><span cla
 ss="ng-star-inserted">Extendable-Output Function (XOF) functionality</span
 ><span class="ng-star-inserted" data-start-index="3409"> demonstrate a for
 ward-looking design philosophy compared to SHA-1 and SHA-2?</span></li>\n<
 /ul>\n<div class="paragraph normal ng-star-inserted" data-start-index="348
 6"><span class="ng-star-inserted" data-start-index="3486">Your essay shoul
 d demonstrate a clear understanding of the cryptographic concepts\, design
  choices\, and security considerations\, </span><span style="font-family: 
 inherit\; font-size: 1rem\;">drawing directly from both the provided sourc
 e material and external sources. Cite your work appropriately to support y
 our arguments and offer detailed explanations of the cryptographic concept
 s involved.&nbsp\; The assignment should be at a minimum of three pages an
 d in APA format.</span></div>\n</div>\n</div>\n<div class="paragraph norma
 l ng-star-inserted" data-start-index="274">Submit your work as either a Wo
 rd Document or a PDF. Ensure you follow the rubric.</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T132600Z
UID:event-assignment-727840
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:All discussions must be submitted every Sunday at 6:00 p.m. (th
 is includes original postings and replies) for attendance purposes.\n\nDis
 cussion posts should be a paragraph or more and should fully answer the qu
 estions provided. Please make your initial post by Friday and respond to a
 t least 2 other students by Sunday.\n\nThis week's questions:\n\n* Discuss
 ion: Penetration Testing: Internal vs External.�\n\n* When planning to pe
 rform a penetration test\, an organization must decide whether to use inte
 rnal security personnel or external consultants to conduct the test.\n\n* 
 What are the advantages and disadvantages of using internal vs external te
 sters?\n\nPosting Criteria and Grading�\n\nInitial discussion post (8 sen
 tences)\n\n60% of overall credit\n\n2 replies to two other students (5 sen
 tences each) 30% each\n\n30% of overall credit\n\nGrammar/spelling\n\n10% 
 of overall credit\n\nTo submit your responses to the questions\, follow th
 e steps below:\n\n* Click Reply at the bottom\,�and post your responses t
 o both questions in the same thread.� Be sure to click Post Reply�at the
  bottom of the screen when you have completed your response.� If you clic
 k�Save Draft\,�your message cannot be viewed by the instructor or other 
 students.\n\n* As other students post their opinions\, read through the fo
 rum\, and respond to at least�two other�messages by clicking�Reply to t
 he student's post\,�and�Post Reply.� The first couple of students who p
 ost messages may have to check back later to post their replies.\n\n�
SEQUENCE:0
SUMMARY:Discussion 12 [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727840
X-ALT-DESC;FMTTYPE=text/html:<p><span style="background-color: #ecf0f1\; fo
 nt-size: 14pt\;"><strong style="color: #e03e2d\;">All discussions must be 
 submitted every Sunday at 6:00 p.m. (this includes original postings and r
 eplies) for </strong><span style="color: #e03e2d\;"><strong>attendance</st
 rong></span><strong style="color: #e03e2d\;"> purposes.</strong></span></p
 >\n<p>Discussion posts should be a paragraph or more and should fully answ
 er the questions provided. Please make your initial post by Friday and res
 pond to at least 2 other students by Sunday.</p>\n<p><strong>This week's q
 uestions:</strong></p>\n<ol>\n<li>Discussion: Penetration Testing: Interna
 l vs External.&nbsp\;\n<ol>\n<li>When planning to perform a penetration te
 st\, an organization must decide whether to use internal security personne
 l or external consultants to conduct the test.</li>\n<li>What are the adva
 ntages and disadvantages of using internal vs external testers?</li>\n</ol
 >\n</li>\n</ol>\n<p><strong>Posting Criteria and Grading&nbsp\;</strong><s
 trong></strong></p>\n<table style="border-collapse: collapse\; width: 58.1
 48%\; height: 111px\;" border="1">\n<tbody>\n<tr style="height: 29px\;">\n
 <td style="width: 49.9483%\; height: 29px\;">Initial discussion post (8 se
 ntences)</td>\n<td style="width: 49.9483%\; height: 29px\;">60% of overall
  credit</td>\n</tr>\n<tr style="height: 53px\;">\n<td style="width: 49.948
 3%\; height: 53px\;"><span>2 replies to two other students (5 sentences ea
 ch) 30% each</span></td>\n<td style="width: 49.9483%\; height: 53px\;">30%
  of overall credit</td>\n</tr>\n<tr style="height: 29px\;">\n<td style="wi
 dth: 49.9483%\; height: 29px\;">Grammar/spelling</td>\n<td style="width: 4
 9.9483%\; height: 29px\;">10% of overall credit</td>\n</tr>\n</tbody>\n</t
 able>\n<p>To submit your responses to the questions\, follow the steps bel
 ow:</p>\n<ol>\n<li>Click Reply at the bottom<em>\,&nbsp\;</em>and post you
 r responses to both questions in the same thread.&nbsp\; Be sure to click 
 Pos<em>t Reply&nbsp\;</em>at the bottom of the screen when you have comple
 ted your response.&nbsp\; If you click&nbsp\;<em>Save Draft\,&nbsp\;</em>y
 our message cannot be viewed by the instructor or other students.</li>\n<l
 i>As other students post their opinions\, read through the forum\, and res
 pond to at least&nbsp\;two other&nbsp\;messages by clicking&nbsp\;<em>Repl
 y to the student's post\,&nbsp\;</em>and&nbsp\;<em>Post Reply</em>.&nbsp\;
  The first couple of students who post messages may have to check back lat
 er to post their replies.</li>\n</ol>\n<p>&nbsp\;</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251107T184200Z
UID:event-assignment-784276
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:Exam 2 covers chapters 6-10. There are 10 questions from each c
 hapter worth 2 points each. You have 60 minutes to complete the exam\, 2 a
 ttempts on it\, the highest grade will be recorded.�\n\nStudy the PowerPo
 ints and the flashcards before you take the exam.�Looking up the question
 s is cheating and doesn't show what you know.�\n\nMake sure you have enou
 gh time to complete both attempts of the exam at the same time.�If you ex
 it the exam and try getting back in\, the time will have ended.�
SEQUENCE:0
SUMMARY:Exam 2 [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_784276
X-ALT-DESC;FMTTYPE=text/html:<p>Exam 2 covers chapters 6-10. There are 10 q
 uestions from each chapter worth 2 points each. You have 60 minutes to com
 plete the exam\, 2 attempts on it\, the highest grade will be recorded.&nb
 sp\;</p>\n<p>Study the PowerPoints and the flashcards before you take the 
 exam.<span>&nbsp\;</span><strong>Looking up the questions is cheating and 
 doesn't show what you know.&nbsp\;</strong></p>\n<p><strong>Make sure you 
 have enough time to complete both attempts of the exam at the same time.&n
 bsp\;</strong>If you exit the exam and try getting back in\, the time will
  have ended.&nbsp\;</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251118T004600Z
UID:event-assignment-784894
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:Submit your challenge answer from the 13-1 weekly slides here. 
 Please submit a screenshot containing both the command you used and the ou
 tput. Ensure that the output matches the screenshot shown in the PowerPoin
 t slides' answer.\n\nDo not submit your answer on both assignments\, or yo
 u will not receive credit for either. You choose whether to apply it to yo
 ur quizzes or assignments based on which one you submit to.\n\nSince this 
 is extra credit and an optional assignment\, you have until Sunday at 11:5
 9 PM to submit it. No late submissions will be accepted.
SEQUENCE:0
SUMMARY:Extra Credit (Assignments) [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_784894
X-ALT-DESC;FMTTYPE=text/html:<p>Submit your challenge answer from the 13-1 
 weekly slides here. Please submit a screenshot containing both the command
  you used and the output. Ensure that the output matches the screenshot sh
 own in the PowerPoint slides' answer.</p>\n<p>Do not submit your answer on
  both assignments\, or you will not receive credit for either. You choose 
 whether to apply it to your quizzes or assignments based on which one you 
 submit to.</p>\n<p>Since this is extra credit and an optional assignment\,
  you have until Sunday at 11:59 PM to submit it. No late submissions will 
 be accepted.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T201700Z
UID:event-assignment-784895
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:Submit your challenge answer from the 13-1 weekly slides here. 
 Please submit a screenshot containing both the command you used and the ou
 tput. Ensure that the output matches the screenshot shown in the PowerPoin
 t slides' answer.\n\nDo not submit your answer on both assignments\, or yo
 u will not receive credit for either. You choose whether to apply it to yo
 ur quizzes or assignments based on which one you submit to.\n\nSince this 
 is extra credit and an optional assignment\, you have until Sunday at 11:5
 9 PM to submit it. No late submissions will be accepted.
SEQUENCE:0
SUMMARY:Extra Credit (Quizzes) [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_784895
X-ALT-DESC;FMTTYPE=text/html:<p>Submit your challenge answer from the 13-1 
 weekly slides here. Please submit a screenshot containing both the command
  you used and the output. Ensure that the output matches the screenshot sh
 own in the PowerPoint slides' answer.</p>\n<p>Do not submit your answer on
  both assignments\, or you will not receive credit for either. You choose 
 whether to apply it to your quizzes or assignments based on which one you 
 submit to.</p>\n<p>Since this is extra credit and an optional assignment\,
  you have until Sunday at 11:59 PM to submit it. No late submissions will 
 be accepted.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251107T184200Z
UID:event-assignment-784348
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:Read the article\, [What is TCP/IP?] (https://www.techtarget.co
 m/searchnetworking/definition/TCP-IP) and then in your own words explain w
 hat it is and why it is important. List and explain the 4 layers of the mo
 del. Then explain what area of technology you plan to get a job in and the
  role TCP/IP will play in that area.\n\nTo earn all of the points\, make a
 n initial post and then read through the other posts and comment on 2. Mak
 e sure you are adding to the discussion\, do not just write I agree or goo
 d post.�\n\n10 points for the initial post\n3 points for 1st response\n2 
 points for 2nd response\n\n�\n\n�
SEQUENCE:0
SUMMARY:Mobile Devices Discussion [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_784348
X-ALT-DESC;FMTTYPE=text/html:<p>Read the article\, <a class="inline_disable
 d" href="https://www.techtarget.com/searchnetworking/definition/TCP-IP" ta
 rget="_blank">What is TCP/IP?</a> and then in your own words explain what 
 it is and why it is important. List and explain the 4 layers of the model.
  Then explain what area of technology you plan to get a job in and the rol
 e TCP/IP will play in that area.</p>\n<p>To earn all of the points\, make 
 an initial post and then read through the other posts and comment on 2. Ma
 ke sure you are adding to the discussion\, do not just write I agree or go
 od post.&nbsp\;</p>\n<p>10 points for the initial post<br>3 points for 1st
  response<br>2 points for 2nd response</p>\n<p>&nbsp\;</p>\n<p>&nbsp\;</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251110T060000Z
UID:event-assignment-741501
DTSTART;VALUE=DATE;VALUE=DATE:20251116
CLASS:PUBLIC
DESCRIPTION:Choose two of the provided essay prompts based on Chapter 12 of
  the Guide to Computer Forensics and Investigations. For each prompt you s
 elect\, write a comprehensive\, well-structured essay of at least one full
  page using APA format. Your response must be based on the information and
  concepts presented in the first chapter of the provided text. The use of 
 external sources is encouraged\; however\, please review the policy on usi
 ng AI in the syllabus for guidance. As a reminder\, your work will be auto
 matically checked for AI generation. Ensure that you use proper citations 
 for all works used\, including the textbook.\n\nSubmit your assignment in 
 a single file\, using either a Word (.doc\, .docx) or PDF format.\n\n*\n\n
 Cloud Service and Deployment Models: Describe the three cloud service leve
 ls (SaaS\, PaaS\, IaaS) and the four deployment methods (public\, private\
 , community\, hybrid) as defined by NIST. Explain how the specific service
  level and deployment model used in a case can dramatically affect the loc
 ation and accessibility of evidence for a forensic investigator.\n\n*\n\nL
 egal Challenges in Cloud Forensics: Analyze the primary legal challenges i
 nvestigators face when dealing with cloud environments. Discuss the comple
 xities of jurisdictional issues when data is stored across national border
 s\, the importance of the Cloud Service Agreement (CSA)\, and the differen
 t legal mechanisms (search warrants vs. subpoenas) used to access data fro
 m a Cloud Service Provider (CSP).\n\n*\n\nTechnical Challenges in Cloud In
 vestigations: The text lists numerous technical challenges in cloud forens
 ics\, including architecture\, data collection\, and anti-forensics. Selec
 t three of these challenges and explain in detail why they complicate the 
 investigative process. For example\, how does the multitenancy architectur
 e make evidence segregation difficult?\n\n*\n\nForensic Artifacts on a Cli
 ent Machine: Even when data is stored "in the cloud\," traces are often le
 ft on the client computer. Describe the types of artifacts an investigator
  can find on a user's PC that indicate the use of services like Dropbox\, 
 Google Drive\, or OneDrive. Your answer should include a discussion of syn
 chronization files\, log files\, and the evidentiary value of Prefetch fil
 es.\n\n*\n\nAcquisition Strategies for the Cloud: Compare and contrast the
  various strategies for acquiring evidence in cloud investigations. Discus
 s the role of the CSP's incident response team\, the potential need for re
 mote acquisition tools like F-Response\, and the value of analyzing VM sna
 pshots to build a timeline of an incident.
SEQUENCE:0
SUMMARY:Module 13 Essay [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_741501
X-ALT-DESC;FMTTYPE=text/html:<p>Choose two of the provided essay prompts ba
 sed on Chapter 12 of the Guide to Computer Forensics and Investigations. F
 or each prompt you select\, write a comprehensive\, well-structured essay 
 of at least one full page using APA format. Your response must be based on
  the information and concepts presented in the first chapter of the provid
 ed text. The use of external sources is encouraged\; however\, please revi
 ew the policy on using AI in the syllabus for guidance. <span>As a reminde
 r\, your work will be automatically checked for AI generation. Ensure that
  you use proper citations for all works used\, including the textbook.</sp
 an></p>\n<p>Submit your assignment in a single file\, using either a Word 
 (.doc\, .docx) or PDF format.</p>\n<ol style="list-style-type: decimal\;">
 \n<li>\n<p><strong>Cloud Service and Deployment Models: </strong>Describe 
 the three cloud service levels (SaaS\, PaaS\, IaaS) and the four deploymen
 t methods (public\, private\, community\, hybrid) as defined by NIST. Expl
 ain how the specific service level and deployment model used in a case can
  dramatically affect the location and accessibility of evidence for a fore
 nsic investigator.</p>\n</li>\n<li>\n<p><strong>Legal Challenges in Cloud 
 Forensics: </strong>Analyze the primary legal challenges investigators fac
 e when dealing with cloud environments. Discuss the complexities of jurisd
 ictional issues when data is stored across national borders\, the importan
 ce of the Cloud Service Agreement (CSA)\, and the different legal mechanis
 ms (search warrants vs. subpoenas) used to access data from a Cloud Servic
 e Provider (CSP).</p>\n</li>\n<li>\n<p><strong>Technical Challenges in Clo
 ud Investigations: </strong>The text lists numerous technical challenges i
 n cloud forensics\, including architecture\, data collection\, and anti-fo
 rensics. Select three of these challenges and explain in detail why they c
 omplicate the investigative process. For example\, how does the multitenan
 cy architecture make evidence segregation difficult?</p>\n</li>\n<li>\n<p>
 <strong>Forensic Artifacts on a Client Machine: </strong>Even when data is
  stored "in the cloud\," traces are often left on the client computer. Des
 cribe the types of artifacts an investigator can find on a user's PC that 
 indicate the use of services like Dropbox\, Google Drive\, or OneDrive. Yo
 ur answer should include a discussion of synchronization files\, log files
 \, and the evidentiary value of Prefetch files.</p>\n</li>\n<li>\n<p><stro
 ng>Acquisition Strategies for the Cloud:</strong> Compare and contrast the
  various strategies for acquiring evidence in cloud investigations. Discus
 s the role of the CSP's incident response team\, the potential need for re
 mote acquisition tools like F-Response\, and the value of analyzing VM sna
 pshots to build a timeline of an incident.</p>\n</li>\n</ol>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T001500Z
UID:event-assignment-727849
DTSTART;VALUE=DATE;VALUE=DATE:20251117
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 12-1: Vulnerability Management [25/FA CIS-
 616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727849
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T001500Z
UID:event-assignment-727876
DTSTART;VALUE=DATE;VALUE=DATE:20251117
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Module 12 Vulnerability Management [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727876
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T001500Z
UID:event-assignment-727886
DTSTART;VALUE=DATE;VALUE=DATE:20251117
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 12-1: Understanding Vulnerability Scans [25/FA CIS-616-O
 L01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727886
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T001500Z
UID:event-assignment-727887
DTSTART;VALUE=DATE;VALUE=DATE:20251117
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 12-2: Types of Vulnerability Scans [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727887
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T001000Z
UID:event-assignment-727848
DTSTART;VALUE=DATE;VALUE=DATE:20251118
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 11-1: Security Architecture Models [25/FA 
 CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727848
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250825T140700Z
UID:event-assignment-737147
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Lab 14-1: Report Writing for High-Tech Investigations [25/FA CIS-60
 2-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737147
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T060000Z
UID:event-assignment-736866
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:For your discussion post\, please complete either the "Linux fo
 r Life" or "Reflection" activity found in the reading section of the modul
 e.\n\nYour initial post is due on Friday by 11:59 PM\, and your three repl
 ies are due by Sunday at 11:59 PM. Please review the rubric in the assignm
 ent for details on grading requirements.
SEQUENCE:0
SUMMARY:Linux Chapter Nine Discussion Post [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_736866
X-ALT-DESC;FMTTYPE=text/html:<p>For your discussion post\, please complete 
 either the "Linux for Life" or "Reflection" activity found in the reading 
 section of the module.</p>\n<p>Your initial post is due on Friday by 11:59
  PM\, and your three replies are due by Sunday at 11:59 PM. Please review 
 the rubric in the assignment for details on grading requirements.</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T060000Z
UID:event-assignment-730839
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 9-1: Managing Processes in Linux [25/FA CS
 C-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730839
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231600Z
UID:event-assignment-727850
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 13-1: Resilience in Security Architecture 
 [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727850
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231600Z
UID:event-assignment-727851
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 13-2: Investigative Data Sources [25/FA CI
 S-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727851
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231600Z
UID:event-assignment-727852
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 13-3: Security Concept Fundamentals [25/FA
  CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727852
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T060000Z
UID:event-assignment-737134
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:Class\,\n\nPlease be sure to read through Module 14 Chapter bef
 ore answering the following questions:\n\n* In your own opinion\, why is r
 eport writing necessary for Cyber Security Professionals?\n\n* Why is it i
 mportant to convey a tone of objectivity when writing a report?\n\n* How w
 ould you go about having your report proofread if you were a Cyber Securit
 y Expert?\n\nPlease be sure to write a minimum of 2 complete paragraphs\, 
 which is due Friday by midnight\, and your three replies are due Sunday by
  midnight
SEQUENCE:0
SUMMARY:Module 14 Discussion [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737134
X-ALT-DESC;FMTTYPE=text/html:<p>Class\,</p>\n<p>Please be sure to read thro
 ugh Module 14 Chapter before answering the following questions:</p>\n<ul>\
 n<li>In your own opinion\, why is report writing necessary for Cyber Secur
 ity Professionals?</li>\n<li>Why is it important to convey a tone of objec
 tivity when writing a report?</li>\n<li>How would you go about having your
  report proofread if you were a Cyber Security Expert?</li>\n</ul>\n<p>Ple
 ase be sure to write a minimum of 2 complete paragraphs\, which is due Fri
 day by midnight\, and your three replies are due Sunday by midnight</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250825T140700Z
UID:event-assignment-737160
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Module 14 Quiz [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737160
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T060000Z
UID:event-assignment-730852
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Chapter 09 Managing Linux Processes [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730852
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231600Z
UID:event-assignment-727877
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Module 13 Incident Preparation and Investigation [25/FA CIS-6
 16-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727877
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T060000Z
UID:event-assignment-730874
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 9-1: View Processes [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730874
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231600Z
UID:event-assignment-727888
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 13-1: Using Windows File History to Perform Data Backups
  [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727888
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231600Z
UID:event-assignment-727889
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 13-2: Backup Archive Bit [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727889
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T191500Z
UID:event-assignment-786189
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:12-2: Configuring a Windows Device using the Control Panel [25/FA N
 ET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_786189
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T191500Z
UID:event-assignment-786188
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:12-2: Install Hyper-V\, Configure\, and Create VM [25/FA NET-790-OL
 01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_786188
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T191600Z
UID:event-assignment-786190
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:12-3: Different Operating System Installation Methods [25/FA NET-79
 0-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_786190
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T060000Z
UID:event-assignment-767858
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:The Quantum Threat and the Urgency of PQC�\n------------------
 ------------------------\n\nThis week\, you were introduced to the concept
  of Post-Quantum Cryptography (PQC) by highlighting the significant threat
  that future large-scale quantum computers pose to conventional cryptograp
 hic schemes. The text particularly emphasizes the "store now\, decrypt lat
 er" adversary strategy and the inherent latency involved in developing and
  deploying new cryptographic standards.\n\nFor this discussion\, consider 
 the following:\n\n* Explain in detail how Shor's algorithm specifically im
 pacts established public-key schemes such as RSA\, discrete logarithm sche
 mes (e.g.\, Diffie-Hellman)\, and elliptic curve cryptography (ECC). Contr
 ast this with the effect of Grover's algorithm on symmetric ciphers like A
 ES\, explaining how the level of threat fundamentally differs for asymmetr
 ic versus symmetric cryptography.\n\n* Why is it deemed crucial to develop
  and deploy PQC now\, even though large-scale quantum computers are not ye
 t fully realized? Discuss the implications of the "store now\, decrypt lat
 er" strategy for organizations handling long-lived sensitive data\, refere
 ncing historical precedents if applicable.\n\n* Beyond the purely technica
 l challenges of designing new quantum-resistant algorithms\, what are the 
 major non-technical hurdles (e.g.\, standardization processes\, ensuring i
 nteroperability\, key management complexities\, or even political consider
 ations) that contribute to the significant latency in widespread PQC adopt
 ion?\n\n* Reflect on the design principles of "information loss" and "appr
 oximation" as foundational concepts for many PQC schemes\, as outlined in 
 Section 12.1.3. How do these principles contribute to the assumed quantum-
 resistance of these new algorithms\, fundamentally differentiating them fr
 om the mathematical problems that underpin conventional cryptography?\n\nY
 our initial post should be at least two paragraphs long\, with each contai
 ning four sentences. This is due by Friday at 11:59 PM. A minimum of three
  replies is due Sunday evening by 11:59 PM.\n\n�\n\nWorks Cited:\n\nPaar\
 , C.\, Pelzl\, J.\, & G�neysu\, T. (2024). Understanding cryptography: Fr
 om Established Symmetric and Asymmetric Ciphers to Post-Quantum Algorithms
 . Springer.
SEQUENCE:0
SUMMARY:Chapter 12 Discussion [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_767858
X-ALT-DESC;FMTTYPE=text/html:<div class="paragraph normal ng-star-inserted"
  data-start-index="224">\n<div class="paragraph normal ng-star-inserted" d
 ata-start-index="310">\n<h3 class="paragraph heading3 ng-star-inserted" da
 ta-start-index="200">The Quantum Threat and the Urgency of PQC&nbsp\;</h3>
 \n<div class="paragraph normal ng-star-inserted" data-start-index="285">\n
 <div class="paragraph normal ng-star-inserted" data-start-index="264">\n<d
 iv class="paragraph normal ng-star-inserted" data-start-index="293"><span 
 class="ng-star-inserted" data-start-index="293">This week\, you were intro
 duced to the concept of </span><span class="ng-star-inserted">Post-Quantum
  Cryptography (PQC)</span><span class="ng-star-inserted" data-start-index=
 "395"> by highlighting the </span><span class="ng-star-inserted">significa
 nt threat that future large-scale quantum computers pose to conventional c
 ryptographic schemes</span><span class="ng-star-inserted" data-start-index
 ="519">. The text particularly emphasizes the </span><span class="ng-star-
 inserted">"store now\, decrypt later" adversary strategy</span><span class
 ="ng-star-inserted" data-start-index="603"> and the </span><span class="ng
 -star-inserted">inherent latency involved in developing and deploying new 
 cryptographic standards</span><span class="ng-star-inserted" data-start-in
 dex="693">.</span></div>\n<div class="paragraph normal ng-star-inserted" d
 ata-start-index="694"><span class="ng-star-inserted" data-start-index="694
 ">For this discussion\, consider the following:</span></div>\n<ul>\n<li cl
 ass="paragraph normal ng-star-inserted" data-start-index="738"><span class
 ="ng-star-inserted">Explain in detail how Shor's algorithm specifically im
 pacts established public-key schemes such as RSA\, discrete logarithm sche
 mes (e.g.\, Diffie-Hellman)\, and elliptic curve cryptography (ECC).</span
 ><span class="ng-star-inserted" data-start-index="931"> Contrast this with
  the effect of Grover's algorithm on symmetric ciphers like AES\, explaini
 ng how the level of threat fundamentally differs for asymmetric versus sym
 metric cryptography</span><span class="ng-star-inserted" data-start-index=
 "1116">.</span></li>\n<li class="paragraph normal ng-star-inserted" data-s
 tart-index="1117"><span class="ng-star-inserted">Why is it deemed crucial 
 to develop and deploy PQC </span><span class="italic ng-star-inserted">now
 </span><span class="ng-star-inserted">\, even though large-scale quantum c
 omputers are not yet fully realized?</span><span class="ng-star-inserted" 
 data-start-index="1242"> Discuss the implications of the "store now\, decr
 ypt later" strategy for organizations handling long-lived sensitive data\,
  referencing historical precedents if applicable</span><span class="ng-sta
 r-inserted" data-start-index="1412">.</span></li>\n<li class="paragraph no
 rmal ng-star-inserted" data-start-index="1413"><span class="ng-star-insert
 ed">Beyond the purely technical challenges of designing new quantum-resist
 ant algorithms\, what are the major non-technical hurdles (e.g.\, standard
 ization processes\, ensuring interoperability\, key management complexitie
 s\, or even political considerations) that contribute to the significant l
 atency in widespread PQC adoption?</span></li>\n<li class="paragraph norma
 l ng-star-inserted" data-start-index="1734"><span class="ng-star-inserted"
 >Reflect on the design principles of "information loss" and "approximation
 " as foundational concepts for many PQC schemes\, as outlined in Section 1
 2.1.3.</span><span class="ng-star-inserted" data-start-index="1886"> How d
 o these principles contribute to the assumed quantum-resistance of these n
 ew algorithms\, fundamentally differentiating them from the mathematical p
 roblems that underpin conventional cryptography?</span></li>\n</ul>\n</div
 >\n</div>\n</div>\n</div>\n<p><span class="ng-star-inserted">Your initial 
 post should be at least two paragraphs long\, with each containing four se
 ntences. This is due by Friday at 11:59 PM. A minimum of three replies is 
 due Sunday evening by 11:59 PM.</span></p>\n<p>&nbsp\;</p>\n<p>Works Cited
 :</p>\n<div>\n<p>Paar\, C.\, Pelzl\, J.\, &amp\; G�neysu\, T. (2024). <i>
 Understanding cryptography: From Established Symmetric and Asymmetric Ciph
 ers to Post-Quantum Algorithms</i>. Springer.</p>\n</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T060000Z
UID:event-assignment-767860
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 12 Quiz [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_767860
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T191900Z
UID:event-assignment-786198
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:Complete the Chapter 12 quiz. You get 2 attempts on the quiz an
 d the highest grade will be recorded.�\n\nLooking up the answers is cheat
 ing. Read through the resources in the module before taking it.�
SEQUENCE:0
SUMMARY:Chapter 12 Quiz [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_786198
X-ALT-DESC;FMTTYPE=text/html:<p><span>Complete the Chapter 12 quiz. You get
  2 attempts on the quiz and the highest grade will be recorded.&nbsp\;</sp
 an></p>\n<p><span>Looking up the answers is cheating. Read through the res
 ources in the module before taking it.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T060000Z
UID:event-assignment-767859
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:Hash-Based Cryptography: From One-Time to Many-Time Signatures\
 n--------------------------------------------------------------\n\n�Hash-
 Based Cryptography is a family of Post-Quantum digital signature schemes w
 hose security fundamentally relies on the assumed resistance of cryptograp
 hic hash functions (like SHA-2 or SHA-3) to inversion by quantum computers
 . These schemes offer a distinct approach to digital signatures compared t
 o conventional methods.\nFor this essay\, address the following:\n\n* Expl
 ain the core principles and detailed mechanisms of a Lamport-Diffie One-Ti
 me Signature (LD-OTS) scheme. Describe its key generation\, signing\, and 
 verification processes\, illustrating how a one-way function is utilized a
 nd why the scheme is limited to "one-time" use.\n\n* Discuss the primary p
 ractical limitations of the LD-OTS scheme\, particularly concerning the si
 ze of keys and signatures for real-world messages. How does the Winternitz
  One-Time Signature (W-OTS) scheme improve upon LD-OTS by reducing the siz
 e of signatures and public keys\, and what is the underlying mechanism for
  this improvement?\n\n* Analyze how the Merkle Signature Scheme (MSS) over
 comes the "one-time" limitation of its predecessors to create a "many-time
 " signature scheme. Explain the structure and purpose of a Merkle hash tre
 e in this context\, detailing how the root of the tree serves as the publi
 c key and how an authentication path enables the verification of individua
 l one-time signatures.\n\n* Compare and contrast hash-based digital signat
 ures (such as MSS\, XMSS\, or LMS) with conventional digital signature alg
 orithms (like RSA or ECDSA\, as discussed in Chapter 10). Your comparison 
 should cover their underlying security assumptions (classical vs. quantum 
 resistance)\, typical key and signature sizes\, and practical applicabilit
 y (e.g.\, efficiency\, stateless vs. stateful nature). What are the specif
 ic advantages and disadvantages of adopting hash-based signatures in a pos
 t-quantum world?\n\nYour essay should demonstrate a comprehensive understa
 nding of the mechanisms\, security properties\, and practical implications
  of hash-based cryptography\, drawing directly from both the provided sour
 ce material and external sources. Cite your work appropriately to support 
 your arguments and offer detailed explanations of the cryptographic concep
 ts involved.� The assignment should be at least three pages long and in A
 PA format.\n\nSubmit your work as either a Word Document or a PDF. Ensure 
 you follow the rubric.
SEQUENCE:0
SUMMARY:Chapter 12 Writing Assignment [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_767859
X-ALT-DESC;FMTTYPE=text/html:<div class="paragraph normal ng-star-inserted"
  data-start-index="274">\n<h3 class="paragraph heading3 ng-star-inserted" 
 data-start-index="1246">Hash-Based Cryptography: From One-Time to Many-Tim
 e Signatures</h3>\n<div class="paragraph heading3 ng-star-inserted" data-s
 tart-index="1246">\n<p>&nbsp\;Hash-Based Cryptography is a family of Post-
 Quantum digital signature schemes whose security fundamentally relies on t
 he assumed resistance of cryptographic hash functions (like SHA-2 or SHA-3
 ) to inversion by quantum computers. These schemes offer a distinct approa
 ch to digital signatures compared to conventional methods.<br>For this ess
 ay\, address the following:</p>\n<ul>\n<li>Explain the core principles and
  detailed mechanisms of a Lamport-Diffie One-Time Signature (LD-OTS) schem
 e. Describe its key generation\, signing\, and verification processes\, il
 lustrating how a one-way function is utilized and why the scheme is limite
 d to "one-time" use.</li>\n<li>Discuss the primary practical limitations o
 f the LD-OTS scheme\, particularly concerning the size of keys and signatu
 res for real-world messages. How does the Winternitz One-Time Signature (W
 -OTS) scheme improve upon LD-OTS by reducing the size of signatures and pu
 blic keys\, and what is the underlying mechanism for this improvement?</li
 >\n<li>Analyze how the Merkle Signature Scheme (MSS) overcomes the "one-ti
 me" limitation of its predecessors to create a "many-time" signature schem
 e. Explain the structure and purpose of a Merkle hash tree in this context
 \, detailing how the root of the tree serves as the public key and how an 
 authentication path enables the verification of individual one-time signat
 ures.</li>\n<li>Compare and contrast hash-based digital signatures (such a
 s MSS\, XMSS\, or LMS) with conventional digital signature algorithms (lik
 e RSA or ECDSA\, as discussed in Chapter 10). Your comparison should cover
  their underlying security assumptions (classical vs. quantum resistance)\
 , typical key and signature sizes\, and practical applicability (e.g.\, ef
 ficiency\, stateless vs. stateful nature). What are the specific advantage
 s and disadvantages of adopting hash-based signatures in a post-quantum wo
 rld?</li>\n</ul>\n<div class="paragraph normal ng-star-inserted" data-star
 t-index="3486"><span class="ng-star-inserted" data-start-index="3486">Your
  essay should demonstrate <span>a comprehensive understanding of the mecha
 nisms\, security properties\, and practical implications of hash-based cry
 ptography</span>\, </span><span style="font-family: inherit\; font-size: 1
 rem\;">drawing directly from both the provided source material and externa
 l sources. Cite your work appropriately to support your arguments and offe
 r detailed explanations of the cryptographic concepts involved.&nbsp\; The
  assignment should be at least three pages long and in APA format.</span><
 /div>\n</div>\n</div>\n<div class="paragraph normal ng-star-inserted" data
 -start-index="274">Submit your work as either a Word Document or a PDF. En
 sure you follow the rubric.</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250928T050000Z
UID:event-assignment-727832
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:---------------------------------------------------------------
 -------------------------------------------------------------------\nAll d
 iscussions must be submitted every Sunday at 6:00 p.m. (this includes orig
 inal postings and replies) for attendance purposes.\n---------------------
 --------------------------------------------------------------------------
 -----------------------------------\n\nDiscussion posts should be a paragr
 aph or more and should fully answer the questions provided. Please make yo
 ur initial post by Friday and respond to at least 2 other students by Sund
 ay.\n\nThis week's questions:\n\n* Discussion: Chain of Custody.\n\n* Fore
 nsic Procedures\n\n* What is chain of custody and why is it important to p
 reserve the chain of custody?\n\n* What are some of the consequences of a 
 poorly maintained chain of custody of digital evidence?\n\nPosting Criteri
 a and Grading�\n\nInitial discussion post (8 sentences)\n\n60% of overall
  credit\n\n1 reply to one other student (5 sentences each) 30% each\n\n30%
  of overall credit\n\nGrammar/spelling\n\n10% of overall credit\n\n�
SEQUENCE:0
SUMMARY:Discussion 13 [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727832
X-ALT-DESC;FMTTYPE=text/html:<h2 class="fOyUs_bGBk"><span style="color: #e0
 3e2d\;"><strong><span style="font-family: inherit\; font-size: 1rem\;">All
  discussions must be submitted every Sunday at 6:00 p.m. (this includes or
 iginal postings and replies) for attendance purposes.</span></strong></spa
 n></h2>\n<div class="discussion-section message_wrapper">\n<div class="mes
 sage user_content enhanced" data-bind="message">\n<p>Discussion posts shou
 ld be a paragraph or more and should fully answer the questions provided. 
 Please make your initial post by Friday and respond to at least 2 other st
 udents by Sunday.</p>\n<p><strong>This week's questions:</strong></p>\n<ol
 >\n<li>Discussion: Chain of Custody.\n<ol>\n<li>Forensic Procedures</li>\n
 <li>What is chain of custody and why is it important to preserve the chain
  of custody?</li>\n<li>What are some of the consequences of a poorly maint
 ained chain of custody of digital evidence?</li>\n</ol>\n</li>\n</ol>\n<p>
 <strong style="color: var(--ic-brand-font-color-dark)\; font-family: inher
 it\; font-size: 1rem\;">Posting Criteria and Grading&nbsp\;</strong></p>\n
 <table border="1">\n<tbody>\n<tr>\n<td>Initial discussion post (8 sentence
 s)</td>\n<td>60% of overall credit</td>\n</tr>\n<tr>\n<td>1 reply to one o
 ther student (5 sentences each) 30% each</td>\n<td>30% of overall credit</
 td>\n</tr>\n<tr>\n<td>Grammar/spelling</td>\n<td>10% of overall credit</td
 >\n</tr>\n</tbody>\n</table>\n<p>&nbsp\;</p>\n</div>\n</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251117T060000Z
UID:event-assignment-741503
DTSTART;VALUE=DATE;VALUE=DATE:20251123
CLASS:PUBLIC
DESCRIPTION:Choose two of the provided essay prompts based on Chapter 14 of
  the Guide to Computer Forensics and Investigations. For each prompt you s
 elect\, write a comprehensive\, well-structured essay of at least one full
  page using APA format. Your response must be based on the information and
  concepts presented in the first chapter of the provided text. The use of 
 external sources is encouraged\; however\, please review the policy on usi
 ng AI in the syllabus for guidance. As a reminder\, your work will be auto
 matically checked for AI generation. Ensure that you use proper citations 
 for all works used\, including the textbook.\n\nSubmit your assignment in 
 a single file\, using either a Word (.doc\, .docx) or PDF format.\n\n*\n\n
 The Structure and Purpose of a Forensic Report: Outline the key sections o
 f a formal forensic report as described in the chapter (abstract\, body\, 
 conclusion\, etc.). Explain the overall purpose of the report and why it m
 ust be written with the expectation that opposing counsel will scrutinize 
 it. Discuss the differences between a formal written report and a prelimin
 ary verbal report.\n\n*\n\nWriting for a Non-Technical Audience: One of th
 e most significant challenges in report writing is conveying complex techn
 ical information to a non-technical audience\, like a judge or jury. Discu
 ss the specific writing strategies the chapter recommends to achieve clari
 ty\, including using a natural language style\, avoiding jargon\, defining
  technical terms\, and using signposts to guide the reader.\n\n*\n\nLegal 
 Requirements for Expert Reports: Explain the requirements for an expert wi
 tness report under Rule 26 of the Federal Rules of Civil Procedure. What s
 pecific information regarding qualifications\, prior testimony\, publicati
 ons\, and compensation must be included? How do deposition banks factor in
 to an opposing attorney's preparation?\n\n*\n\nObjectivity and the Hypothe
 tical Question: Discuss the importance of maintaining objectivity and avoi
 ding advocacy in a forensic report. Explain the structure and purpose of t
 he hypothetical question\, and how it allows an expert to render an opinio
 n based on a specific set of factual evidence without having personal know
 ledge of the event.\n\n*\n\nIntegrating Tool-Generated Data: Modern forens
 ics tools can automatically generate logs and reports. Explain the benefit
 s and limitations of using these automated reports. How should an investig
 ator incorporate data from a tool like Autopsy into their own formal writt
 en report to provide context and explain the significance of the findings?
 \n\n�
SEQUENCE:0
SUMMARY:Module 14 Essay [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_741503
X-ALT-DESC;FMTTYPE=text/html:<p>Choose two of the provided essay prompts ba
 sed on Chapter 14 of the Guide to Computer Forensics and Investigations. F
 or each prompt you select\, write a comprehensive\, well-structured essay 
 of at least one full page using APA format. Your response must be based on
  the information and concepts presented in the first chapter of the provid
 ed text. The use of external sources is encouraged\; however\, please revi
 ew the policy on using AI in the syllabus for guidance. <span>As a reminde
 r\, your work will be automatically checked for AI generation. Ensure that
  you use proper citations for all works used\, including the textbook.</sp
 an></p>\n<p>Submit your assignment in a single file\, using either a Word 
 (.doc\, .docx) or PDF format.</p>\n<ol style="list-style-type: decimal\;">
 \n<li>\n<p><strong>The Structure and Purpose of a Forensic Report: </stron
 g>Outline the key sections of a formal forensic report as described in the
  chapter (abstract\, body\, conclusion\, etc.). Explain the overall purpos
 e of the report and why it must be written with the expectation that oppos
 ing counsel will scrutinize it. Discuss the differences between a formal w
 ritten report and a preliminary verbal report.</p>\n</li>\n<li>\n<p><stron
 g>Writing for a Non-Technical Audience: </strong>One of the most significa
 nt challenges in report writing is conveying complex technical information
  to a non-technical audience\, like a judge or jury. Discuss the specific 
 writing strategies the chapter recommends to achieve clarity\, including u
 sing a natural language style\, avoiding jargon\, defining technical terms
 \, and using signposts to guide the reader.</p>\n</li>\n<li>\n<p><strong>L
 egal Requirements for Expert Reports: </strong>Explain the requirements fo
 r an expert witness report under Rule 26 of the Federal Rules of Civil Pro
 cedure. What specific information regarding qualifications\, prior testimo
 ny\, publications\, and compensation must be included? How do deposition b
 anks factor into an opposing attorney's preparation?</p>\n</li>\n<li>\n<p>
 <strong>Objectivity and the Hypothetical Question:</strong> Discuss the im
 portance of maintaining objectivity and avoiding advocacy in a forensic re
 port. Explain the structure and purpose of the hypothetical question\, and
  how it allows an expert to render an opinion based on a specific set of f
 actual evidence without having personal knowledge of the event.</p>\n</li>
 \n<li>\n<p><strong>Integrating Tool-Generated Data: </strong>Modern forens
 ics tools can automatically generate logs and reports. Explain the benefit
 s and limitations of using these automated reports. How should an investig
 ator incorporate data from a tool like Autopsy into their own formal writt
 en report to provide context and explain the significance of the findings?
 </p>\n<p>&nbsp\;</p>\n</li>\n</ol>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250825T140700Z
UID:event-assignment-737148
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Lab 15-1: Expert Testimony in Digital Investigations [25/FA CIS-602
 -OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737148
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250721T202800Z
UID:event-assignment-736867
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Linux Chapter Ten Discussion Post [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_736867
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211700Z
UID:event-assignment-730814
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 10-1: Linux Identity Management [25/FA CSC
 -121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730814
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250728T190300Z
UID:event-assignment-737138
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Module 15 Discussion [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737138
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250825T140700Z
UID:event-assignment-737161
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Module 15 Quiz [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_737161
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211700Z
UID:event-assignment-730853
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Quiz: Chapter 10 Common Administrative Tasks [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730853
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211800Z
UID:event-assignment-730866
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Simulation 10-1: User Account Databases [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=11&year=2025#assignment_730866
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T192500Z
UID:event-assignment-786193
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:13-1: Managing a Windows Device using the Command Line Interface [2
 5/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_786193
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T192400Z
UID:event-assignment-786191
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:13-1: Using System Restore [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_786191
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T192400Z
UID:event-assignment-786192
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:13-2: Verifying TCP IP Settings [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_786192
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250821T012000Z
UID:event-assignment-768759
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 13 Discussion [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_768759
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250821T012000Z
UID:event-assignment-768761
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 13 Quiz [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_768761
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T192500Z
UID:event-assignment-786199
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
DESCRIPTION:Complete the Chapter 13 quiz. You get 2 attempts on the quiz an
 d the highest grade will be recorded.�\n\nLooking up the answers is cheat
 ing. Read through the resources in the module before taking it.�
SEQUENCE:0
SUMMARY:Chapter 13 Quiz [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=11&year=2025#assignment_786199
X-ALT-DESC;FMTTYPE=text/html:<p><span>Complete the Chapter 13 quiz. You get
  2 attempts on the quiz and the highest grade will be recorded.&nbsp\;</sp
 an></p>\n<p><span>Looking up the answers is cheating. Read through the res
 ources in the module before taking it.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250821T012000Z
UID:event-assignment-768760
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 13 Writing Assignment [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=11&year=2025#assignment_768760
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250928T050000Z
UID:event-assignment-727836
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
DESCRIPTION:All discussions must be submitted every Sunday at 6:00 p.m. (th
 is includes original postings and replies) for attendance purposes.\n\nDis
 cussion posts should be a paragraph or more and should fully answer the qu
 estions provided. Please make your initial post by Friday and respond to a
 t least 2 other students by Sunday.\n\nThis week's questions:\n\n* Discuss
 ion: Disaster Recovery Plan.\n\n* Introduction to Business Continuity\n\n*
  What is the importance of a disaster recovery plan?\n\n* What are the con
 sequences of not creating this plan?\n\nPosting Criteria and Grading�\n\n
 Initial discussion post (8 sentences)\n\n60% of overall credit\n\n2 replie
 s to two other students (5 sentences each) 30% each\n\n30% of overall cred
 it\n\nGrammar/spelling\n\n10% of overall credit\n\n�
SEQUENCE:0
SUMMARY:Discussion 14 [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=11&year=2025#assignment_727836
X-ALT-DESC;FMTTYPE=text/html:<header class="discussion-section clearfix">\n
 <div class="discussion-header-content right-of-avatar">\n<div class="pull-
 left">\n<p><span style="background-color: #ecf0f1\; font-size: 14pt\;"><st
 rong style="color: #e03e2d\;">All discussions must be submitted every Sund
 ay at 6:00 p.m. (this includes original postings and replies) for </strong
 ><span style="color: #e03e2d\;"><strong>attendance</strong></span><strong 
 style="color: #e03e2d\;"> purposes.</strong></span></p>\n</div>\n</div>\n<
 /header>\n<div class="discussion-section message_wrapper">\n<div class="me
 ssage user_content enhanced" data-bind="message">\n<p>Discussion posts sho
 uld be a paragraph or more and should fully answer the questions provided.
  Please make your initial post by Friday and respond to at least 2 other s
 tudents by Sunday.</p>\n<p><strong>This week's questions:</strong></p>\n<o
 l>\n<li>Discussion: Disaster Recovery Plan.\n<ol>\n<li>Introduction to Bus
 iness Continuity</li>\n<li>What is the importance of a disaster recovery p
 lan?</li>\n<li>What are the consequences of not creating this plan?</li>\n
 </ol>\n</li>\n</ol>\n<p><strong>Posting Criteria and Grading&nbsp\;</stron
 g><strong></strong></p>\n<table style="border-collapse: collapse\; width: 
 58.148%\; height: 111px\;" border="1">\n<tbody>\n<tr style="height: 29px\;
 ">\n<td style="width: 49.9483%\; height: 29px\;">Initial discussion post (
 8 sentences)</td>\n<td style="width: 49.9483%\; height: 29px\;">60% of ove
 rall credit</td>\n</tr>\n<tr style="height: 53px\;">\n<td style="width: 49
 .9483%\; height: 53px\;">2 replies to two other students (5 sentences each
 ) 30% each</td>\n<td style="width: 49.9483%\; height: 53px\;">30% of overa
 ll credit</td>\n</tr>\n<tr style="height: 29px\;">\n<td style="width: 49.9
 483%\; height: 29px\;">Grammar/spelling</td>\n<td style="width: 49.9483%\;
  height: 29px\;">10% of overall credit</td>\n</tr>\n</tbody>\n</table>\n<p
 >&nbsp\;</p>\n</div>\n</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251008T003600Z
UID:event-assignment-741522
DTSTART;VALUE=DATE;VALUE=DATE:20251130
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Module 15 Essay [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=11&year=2025#assignment_741522
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231700Z
UID:event-assignment-727853
DTSTART;VALUE=DATE;VALUE=DATE:20251201
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 14-1: Implementation of Automation & Orche
 stration for Security Operations [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=12&year=2025#assignment_727853
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231700Z
UID:event-assignment-727878
DTSTART;VALUE=DATE;VALUE=DATE:20251201
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Module 14 Oversight and Operations [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=12&year=2025#assignment_727878
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231700Z
UID:event-assignment-727890
DTSTART;VALUE=DATE;VALUE=DATE:20251201
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 14-1: Using a Nonpersistent Web Browser [25/FA CIS-616-O
 L01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=12&year=2025#assignment_727890
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231700Z
UID:event-assignment-727891
DTSTART;VALUE=DATE;VALUE=DATE:20251201
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 14-2: Local Security Policy [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=12&year=2025#assignment_727891
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251116T203900Z
UID:event-assignment-727221
DTSTART;VALUE=DATE;VALUE=DATE:20251205
CLASS:PUBLIC
DESCRIPTION:1. Your own original post that answers the question below: (Due
  Friday December 8 at midnight) 10pts\n\nImagine you are a cyber security 
 professional and you are always in a position where you need to properly c
 ommunicate what's going on with evidence.� You could be in the courthouse
  handling evidence or you could be on a crime scene as it doesn't matter b
 ecause handling digital evidence and communicating is crucial.� Imagine y
 ou are in a situation where you have to explain to a judge/jury/legal team
  who's not very technically savvy how you were able to prove that a defend
 ant is guilty.� I want you to answer the following:\n\n* What strategies 
 would you take to explain and communicate how technical digital forensics 
 strategies work to non technical judges and juries?\n\n* provide a hypothe
 tical example\n\n* How would you explain that you digital forensics softwa
 re is trustworthy and not tampered with?\n\n* How would you communicate to
  a lawyer team that you are 100% confident your digital forensics analysis
  is correct?\n\n* How important in your opinion is confidence when communi
 cating digital forensics?� explain\n\nThis final discussion is worth more
  points that most weeks\, the number of paragraphs I expect is between 3-6
 .\n\n2. Reply to 2 classmates' posts. (Due Friday December 10 midnight)�1
 0pts\n\n�\n\nRubric\n\nTo receive full credit\, your post and reply must 
 be...\n\n* At least three sentences in length (two paragraphs of at least 
 3 sentences each for the initial post)\n\n* Written in complete\, grammati
 cally correct sentences\n\n* Free from spelling errors\n\n* An intelligent
  response
SEQUENCE:0
SUMMARY:Final Discussion [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=12&year=2025#assignment_727221
X-ALT-DESC;FMTTYPE=text/html:<p><span>1. Your own original post that answer
 s the question below: (Due Friday December 8 at midnight) </span><strong>1
 0pts</strong></p><p>Imagine you are a cyber security professional and you 
 are always in a position where you need to properly communicate what's goi
 ng on with evidence.&nbsp\; You could be in the courthouse handling eviden
 ce or you could be on a crime scene as it doesn't matter because handling 
 digital evidence and communicating is crucial.&nbsp\; Imagine you are in a
  situation where you have to explain to a judge/jury/legal team who's not 
 very technically savvy how you were able to prove that a defendant is guil
 ty.&nbsp\; I want you to answer the following:</p><ul><li>What strategies 
 would you take to explain and communicate how technical digital forensics 
 strategies work to non technical judges and juries?<ul><li>provide a hypot
 hetical example</li></ul></li><li>How would you explain that you digital f
 orensics software is trustworthy and not tampered with?</li><li>How would 
 you communicate to a lawyer team that you are 100% confident your digital 
 forensics analysis is correct?</li><li>How important in your opinion is co
 nfidence when communicating digital forensics?&nbsp\; explain</li></ul><p>
 This final discussion is worth more points that most weeks\, the number of
  paragraphs I expect is between 3-6.</p><p><span>2. Reply to 2 classmates'
  posts. (Due Friday December 10 midnight)</span><span>&nbsp\;</span><stron
 g>10pts</strong></p><p>&nbsp\;</p><p><em><span>Rubric</span></em></p><p>To
  receive full credit\, your post and reply must be...</p><ul><li>At least 
 three sentences in length (two paragraphs of at least 3 sentences each for
  the initial post)</li><li>Written in complete\, grammatically correct sen
 tences</li><li>Free from spelling errors</li><li>An intelligent response</
 li></ul>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250825T140700Z
UID:event-assignment-737149
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Lab 16-1: Ethics for the Expert Witness [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=12&year=2025#assignment_737149
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250721T202900Z
UID:event-assignment-736868
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Linux Chapter Twelve Discussion Post [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_736868
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211700Z
UID:event-assignment-730815
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 12-1: Configuring Networking in Linux [25/
 FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730815
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211700Z
UID:event-assignment-730816
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 12-2: Name Resolution Concepts and Tools [
 25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730816
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211700Z
UID:event-assignment-730817
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 12-3: Remote Connectivity Management [25/F
 A CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730817
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211700Z
UID:event-assignment-730818
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 12-4: Remote Access Tools [25/FA CSC-121-O
 L01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730818
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250728T192300Z
UID:event-assignment-737135
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Module 16 Discussion [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=12&year=2025#assignment_737135
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250825T140700Z
UID:event-assignment-737162
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Module 16 Quiz [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=12&year=2025#assignment_737162
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211700Z
UID:event-assignment-730854
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Quiz: Chapter 12 Network Configuration [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730854
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211800Z
UID:event-assignment-730867
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Simulation 12-1: Configure IP Routing [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730867
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T192600Z
UID:event-assignment-786194
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:14-1: Registry Editor [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=12&year=2025#assignment_786194
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T192600Z
UID:event-assignment-786195
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:14-1: Troubleshooting Windows Operating Systems [25/FA NET-790-OL01
 ]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=12&year=2025#assignment_786195
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T192800Z
UID:event-assignment-786197
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:15-1: Backup and Recovery Implementation [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=12&year=2025#assignment_786197
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T192700Z
UID:event-assignment-786196
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
DESCRIPTION:Take notes as you are completing the lab. Remember\, you can co
 mplete the lab as many times as you want to get the grade you want.�
SEQUENCE:0
SUMMARY:15-1: Startup Repair [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=12&year=2025#assignment_786196
X-ALT-DESC;FMTTYPE=text/html:<p><span>Take notes as you are completing the 
 lab. Remember\, you can complete the lab as many times as you want to get 
 the grade you want.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T192800Z
UID:event-assignment-786200
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
DESCRIPTION:Complete the Chapter 14 & 15 quiz. There are 5 questions from e
 ach chapter. You get 2 attempts on the quiz and the highest grade will be 
 recorded.�\n\nLooking up the answers is cheating. Read through the resour
 ces in the module before taking it.�
SEQUENCE:0
SUMMARY:Chapter 14 & 15 Quiz [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=12&year=2025#assignment_786200
X-ALT-DESC;FMTTYPE=text/html:<p><span>Complete the Chapter 14 &amp\; 15 qui
 z. There are 5 questions from each chapter. You get 2 attempts on the quiz
  and the highest grade will be recorded.&nbsp\;</span></p>\n<p><span>Looki
 ng up the answers is cheating. Read through the resources in the module be
 fore taking it.&nbsp\;</span></p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250821T020500Z
UID:event-assignment-768762
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 14 Discussion [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=12&year=2025#assignment_768762
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250821T020500Z
UID:event-assignment-768765
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 14 Quiz [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=12&year=2025#assignment_768765
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250821T020500Z
UID:event-assignment-768763
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Chapter 14 Writing Assignment [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=12&year=2025#assignment_768763
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251008T003600Z
UID:event-assignment-741551
DTSTART;VALUE=DATE;VALUE=DATE:20251207
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Module 16 Essay [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=12&year=2025#assignment_741551
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231800Z
UID:event-assignment-727854
DTSTART;VALUE=DATE;VALUE=DATE:20251208
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 15-1: Asset Management Techniques [25/FA C
 IS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=12&year=2025#assignment_727854
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231800Z
UID:event-assignment-727879
DTSTART;VALUE=DATE;VALUE=DATE:20251208
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Quiz: Module 15 Information Security Management [25/FA CIS-616-OL01
 ]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=12&year=2025#assignment_727879
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231800Z
UID:event-assignment-727892
DTSTART;VALUE=DATE;VALUE=DATE:20251208
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 15-1: Asset Management [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=12&year=2025#assignment_727892
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250924T231800Z
UID:event-assignment-727893
DTSTART;VALUE=DATE;VALUE=DATE:20251208
CLASS:PUBLIC
DESCRIPTION:
SEQUENCE:0
SUMMARY:Simulation 15-2: Managing Risk [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=12&year=2025#assignment_727893
X-ALT-DESC;FMTTYPE=text/html:
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250928T050000Z
UID:event-assignment-727829
DTSTART;VALUE=DATE;VALUE=DATE:20251208
CLASS:PUBLIC
DESCRIPTION:---------------------------------------------------------------
 -------------------------------------------------------------------\nAll d
 iscussions must be submitted every Sunday at 6:00 p.m. (this includes orig
 inal postings and replies) for attendance purposes.\n---------------------
 --------------------------------------------------------------------------
 -----------------------------------\n\nDiscussion posts should be a paragr
 aph or more and should fully answer the questions provided. Please make yo
 ur initial post by Friday and respond to at least 2 other students by Sund
 ay.\n\nThis week's questions:\n\n* Discussion: Data Privacy. Duration: 10 
 minutes.\n\n* Protecting Data\n\n* What is your involvement or awareness o
 f data storage\, retention\, and destruction activities? What types of dat
 a were involved? What forms of storage? Were there formal retention guidel
 ines or regulations? What method of destruction was used? Did they believe
  it was effectively destroying the records and data?\n\nPosting Criteria a
 nd Grading�\n\nInitial discussion post (8 sentences)\n\n60% of overall cr
 edit\n\n2 replies to two other student (5 sentences each) 30% each\n\n30% 
 of overall credit\n\nGrammar/spelling\n\n10% of overall credit\n\n�
SEQUENCE:0
SUMMARY:Discussion 15 [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=12&year=2025#assignment_727829
X-ALT-DESC;FMTTYPE=text/html:<h2 class="fOyUs_bGBk"><span><strong>All discu
 ssions must be submitted every Sunday at 6:00 p.m. (this includes original
  postings and replies) for attendance purposes.</strong></span></h2>\n<div
  class="discussion-section message_wrapper">\n<div class="message user_con
 tent enhanced" data-bind="message">\n<p>Discussion posts should be a parag
 raph or more and should fully answer the questions provided. Please make y
 our initial post by Friday and respond to at least 2 other students by Sun
 day.</p>\n<p><strong>This week's questions:</strong></p>\n<ol>\n<li>Discus
 sion: Data Privacy. Duration: 10 minutes.\n<ol>\n<li>Protecting Data</li>\
 n<li>What is your involvement or awareness of data storage\, retention\, a
 nd destruction activities? What types of data were involved? What forms of
  storage? Were there formal retention guidelines or regulations? What meth
 od of destruction was used? Did they believe it was effectively destroying
  the records and data?</li>\n</ol>\n</li>\n</ol>\n<p><strong>Posting Crite
 ria and Grading&nbsp\;</strong></p>\n<table border="1">\n<tbody>\n<tr>\n<t
 d>Initial discussion post (8 sentences)</td>\n<td>60% of overall credit</t
 d>\n</tr>\n<tr>\n<td>2 replies to two other student (5 sentences each) 30%
  each</td>\n<td>30% of overall credit</td>\n</tr>\n<tr>\n<td>Grammar/spell
 ing</td>\n<td>10% of overall credit</td>\n</tr>\n</tbody>\n</table>\n<p>&n
 bsp\;</p>\n</div>\n</div>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251114T194800Z
UID:event-assignment-786202
DTSTART;VALUE=DATE;VALUE=DATE:20251210
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Exam 3 [25/FA NET-790-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_261
 26&month=12&year=2025#assignment_786202
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251026T050000Z
UID:event-assignment-727827
DTSTART;VALUE=DATE;VALUE=DATE:20251211
CLASS:PUBLIC
DESCRIPTION:Details about the Exam 2 (Final)\n\n* Covers Chapters 9 - 15\n\
 n* 50 Questions (Questions may be in multiple-choice/ true false/ fill-in-
 the-blank format)\n\n* Possible grade: 100\n\n* Time limit: 70 minutes\n\n
 * Number of attempts: 2\n\nGood luck to all!
SEQUENCE:0
SUMMARY:Exam 2 (Final) [25/FA CIS-616-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 37&month=12&year=2025#assignment_727827
X-ALT-DESC;FMTTYPE=text/html:<p><strong><u>Details about the Exam 2 (Final)
 </u></strong></p>\n<ul>\n<li>Covers Chapters 9 - 15</li>\n<li>50 Questions
  (Questions may be in multiple-choice/ true false/ fill-in-the-blank forma
 t)</li>\n<li>Possible grade: 100</li>\n<li>Time limit: 70 minutes</li>\n<l
 i>Number of attempts: 2</li>\n</ul>\n<p>Good luck to all!</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20251116T204000Z
UID:event-assignment-727223
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
DESCRIPTION:Class\,\n\nWelcome to your final research assignment:\n\n* I wa
 nt you to research an article not older than 5 years explaining digital ev
 idence collection best practices or something closely related to those key
 words.�\n\n* You are to read and then summarize the article with a minimu
 m of 2 complete pages and cite your sources and explain the significance o
 f the article as it relates to proper evidence collection.� (just to clar
 ify\, I'm looking for something between 2-4 pages that adequately describe
 s proper evidence collection).\n\n* Please make sure you touch on the foll
 owing idea's\n\n* What kind of digital evidence collection practices exist
 ?\n\n* what kind of software support this?\n\n* is the software free or pa
 id for\, show different examples of this software.\n\n* Explain what each 
 time of software is\, the brand and what it could be used for\n\n* Explain
  why digital forensics is important and why would best practices need to b
 e followed?\n\n* feel free to support your claim with an article that disc
 usses digital forensics or an example of its use\n\n* What kind of IT jobs
  are associated with digital forensics and is it something that interests 
 you?� Explain\n\nIf any of this doesn't make sense please reach out to me
  as soon as possible\, please don't wait until the last minute to ask for 
 help as well as please don't wait until the last minute to begin your rese
 arch paper.\n\nThis final research paper is worth 3 times the typical week
 ly assignment.\n\nThis is due no later than 12/13 by 11:59PM\, please subm
 it via .doc/.docx word format
SEQUENCE:0
SUMMARY:Final Assignment [25/FA CIS-617-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 50&month=12&year=2025#assignment_727223
X-ALT-DESC;FMTTYPE=text/html:<p>Class\,</p>\n<p>Welcome to your final resea
 rch assignment:</p>\n<ul>\n<li>I want you to research an article not older
  than 5 years explaining <span style="text-decoration: underline\;">digita
 l evidence collection best practices</span> or something closely related t
 o those keywords.&nbsp\;</li>\n<li>You are to read and then summarize the 
 article with a minimum of 2 complete pages and cite your sources and expla
 in the significance of the article as it relates to proper evidence collec
 tion.&nbsp\; (just to clarify\, I'm looking for something between 2-4 page
 s that adequately describes proper evidence collection).</li>\n<li>Please 
 make sure you touch on the following idea's\n<ul>\n<li>What kind of digita
 l evidence collection practices exist?\n<ul>\n<li>what kind of software su
 pport this?</li>\n<li>is the software free or paid for\, show different ex
 amples of this software.</li>\n<li>Explain what each time of software is\,
  the brand and what it could be used for</li>\n</ul>\n</li>\n<li>Explain w
 hy digital forensics is important and why would best practices need to be 
 followed?\n<ul>\n<li>feel free to support your claim with an article that 
 discusses digital forensics or an example of its use</li>\n</ul>\n</li>\n<
 li>What kind of IT jobs are associated with digital forensics and is it so
 mething that interests you?&nbsp\; Explain</li>\n</ul>\n</li>\n</ul>\n<p>I
 f any of this doesn't make sense please reach out to me as soon as possibl
 e\, please don't wait until the last minute to ask for help as well as ple
 ase don't wait until the last minute to begin your research paper.</p>\n<p
 >This final research paper is worth 3 times the typical weekly assignment.
 </p>\n<p>This is due no later than 12/13 by 11:59PM\, please submit via .d
 oc/.docx word format</p>
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250825T141000Z
UID:event-assignment-737141
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Final Capstone [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=12&year=2025#assignment_737141
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250728T191600Z
UID:event-assignment-737139
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Finals Week Discussion [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=12&year=2025#assignment_737139
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250721T203000Z
UID:event-assignment-736869
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Linux Chapter Fourteen Discussion Post [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_736869
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211800Z
UID:event-assignment-730813
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Linux Exam [25/FA CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730813
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211700Z
UID:event-assignment-730819
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 14-2: Securing Linux Devices [25/FA CSC-12
 1-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730819
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211700Z
UID:event-assignment-730820
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Live Virtual Machine Lab 14-3: Configuring Linux Firewalls [25/FA C
 SC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730820
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211700Z
UID:event-assignment-730855
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Quiz: Chapter 14 Security\, Troubleshooting\, and Performance [25/F
 A CSC-121-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730855
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250714T211800Z
UID:event-assignment-730868
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Simulation 14-1: Configuring Privilege Escalation [25/FA CSC-121-OL
 01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 49&month=12&year=2025#assignment_730868
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250730T003100Z
UID:event-assignment-740816
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Final Exam - Modules 9-16 [25/FA CIS-602-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 44&month=12&year=2025#assignment_740816
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20250916T185500Z
UID:event-assignment-768766
DTSTART;VALUE=DATE;VALUE=DATE:20251212
CLASS:PUBLIC
SEQUENCE:0
SUMMARY:Final Writing Assignment [25/FA CIS-601-OL01]
URL;VALUE=URI:https://classes.iwcc.edu/calendar?include_contexts=course_239
 31&month=12&year=2025#assignment_768766
END:VEVENT
END:VCALENDAR
`,
    "public/language-schedule.ics": String.raw`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Weekly School Planner//Language Schedule//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Language Schedule
BEGIN:VEVENT
UID:language-korean-20260104-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260104T090000
DTEND:20260104T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260104-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260104T093000
DTEND:20260104T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260104-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260104T100000
DTEND:20260104T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260104-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260104T103000
DTEND:20260104T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260104-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260104T110000
DTEND:20260104T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260105-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260105T090000
DTEND:20260105T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260105-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260105T093000
DTEND:20260105T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260105-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260105T100000
DTEND:20260105T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260105-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260105T103000
DTEND:20260105T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260105-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260105T110000
DTEND:20260105T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260106-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260106T090000
DTEND:20260106T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260106-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260106T093000
DTEND:20260106T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260106-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260106T100000
DTEND:20260106T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260106-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260106T103000
DTEND:20260106T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260106-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260106T110000
DTEND:20260106T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260107-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260107T130000
DTEND:20260107T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260107-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260107T170000
DTEND:20260107T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260107-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260107T173000
DTEND:20260107T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260107-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260107T180000
DTEND:20260107T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260108-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260108T090000
DTEND:20260108T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260108-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260108T093000
DTEND:20260108T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260108-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260108T100000
DTEND:20260108T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260108-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260108T103000
DTEND:20260108T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260108-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260108T110000
DTEND:20260108T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260109-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260109T090000
DTEND:20260109T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260109-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260109T093000
DTEND:20260109T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260109-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260109T100000
DTEND:20260109T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260109-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260109T103000
DTEND:20260109T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260109-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260109T110000
DTEND:20260109T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260110-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260110T090000
DTEND:20260110T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260110-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260110T093000
DTEND:20260110T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260110-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260110T100000
DTEND:20260110T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260110-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260110T103000
DTEND:20260110T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260110-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260110T110000
DTEND:20260110T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260111-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260111T090000
DTEND:20260111T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260111-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260111T093000
DTEND:20260111T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260111-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260111T100000
DTEND:20260111T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260111-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260111T103000
DTEND:20260111T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260111-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260111T110000
DTEND:20260111T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260112-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260112T090000
DTEND:20260112T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260112-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260112T093000
DTEND:20260112T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260112-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260112T100000
DTEND:20260112T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260112-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260112T103000
DTEND:20260112T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260112-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260112T110000
DTEND:20260112T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260113-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260113T090000
DTEND:20260113T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260113-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260113T093000
DTEND:20260113T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260113-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260113T100000
DTEND:20260113T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260113-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260113T103000
DTEND:20260113T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260113-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260113T110000
DTEND:20260113T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260114-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260114T130000
DTEND:20260114T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260114-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260114T170000
DTEND:20260114T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260114-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260114T173000
DTEND:20260114T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260114-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260114T180000
DTEND:20260114T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260115-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260115T090000
DTEND:20260115T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260115-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260115T093000
DTEND:20260115T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260115-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260115T100000
DTEND:20260115T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260115-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260115T103000
DTEND:20260115T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260115-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260115T110000
DTEND:20260115T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260116-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260116T090000
DTEND:20260116T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260116-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260116T093000
DTEND:20260116T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260116-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260116T100000
DTEND:20260116T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260116-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260116T103000
DTEND:20260116T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260116-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260116T110000
DTEND:20260116T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260117-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260117T090000
DTEND:20260117T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260117-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260117T093000
DTEND:20260117T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260117-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260117T100000
DTEND:20260117T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260117-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260117T103000
DTEND:20260117T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260117-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260117T110000
DTEND:20260117T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260118-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260118T090000
DTEND:20260118T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260118-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260118T093000
DTEND:20260118T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260118-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260118T100000
DTEND:20260118T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260118-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260118T103000
DTEND:20260118T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260118-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260118T110000
DTEND:20260118T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260119-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260119T090000
DTEND:20260119T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260119-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260119T093000
DTEND:20260119T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260119-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260119T100000
DTEND:20260119T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260119-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260119T103000
DTEND:20260119T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260119-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260119T110000
DTEND:20260119T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260120-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260120T090000
DTEND:20260120T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260120-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260120T093000
DTEND:20260120T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260120-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260120T100000
DTEND:20260120T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260120-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260120T103000
DTEND:20260120T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260120-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260120T110000
DTEND:20260120T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260121-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260121T130000
DTEND:20260121T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260121-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260121T170000
DTEND:20260121T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260121-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260121T173000
DTEND:20260121T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260121-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260121T180000
DTEND:20260121T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260122-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260122T090000
DTEND:20260122T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260122-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260122T093000
DTEND:20260122T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260122-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260122T100000
DTEND:20260122T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260122-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260122T103000
DTEND:20260122T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260122-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260122T110000
DTEND:20260122T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260123-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260123T090000
DTEND:20260123T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260123-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260123T093000
DTEND:20260123T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260123-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260123T100000
DTEND:20260123T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260123-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260123T103000
DTEND:20260123T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260123-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260123T110000
DTEND:20260123T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260124-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260124T090000
DTEND:20260124T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260124-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260124T093000
DTEND:20260124T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260124-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260124T100000
DTEND:20260124T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260124-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260124T103000
DTEND:20260124T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260124-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260124T110000
DTEND:20260124T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260125-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260125T090000
DTEND:20260125T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260125-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260125T093000
DTEND:20260125T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260125-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260125T100000
DTEND:20260125T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260125-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260125T103000
DTEND:20260125T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260125-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260125T110000
DTEND:20260125T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260126-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260126T090000
DTEND:20260126T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260126-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260126T093000
DTEND:20260126T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260126-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260126T100000
DTEND:20260126T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260126-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260126T103000
DTEND:20260126T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260126-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260126T110000
DTEND:20260126T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260127-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260127T090000
DTEND:20260127T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260127-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260127T093000
DTEND:20260127T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260127-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260127T100000
DTEND:20260127T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260127-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260127T103000
DTEND:20260127T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260127-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260127T110000
DTEND:20260127T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260128-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260128T130000
DTEND:20260128T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260128-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260128T170000
DTEND:20260128T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260128-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260128T173000
DTEND:20260128T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260128-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260128T180000
DTEND:20260128T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260129-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260129T090000
DTEND:20260129T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260129-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260129T093000
DTEND:20260129T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260129-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260129T100000
DTEND:20260129T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260129-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260129T103000
DTEND:20260129T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260129-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260129T110000
DTEND:20260129T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260130-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260130T090000
DTEND:20260130T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260130-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260130T093000
DTEND:20260130T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260130-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260130T100000
DTEND:20260130T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260130-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260130T103000
DTEND:20260130T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260130-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260130T110000
DTEND:20260130T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260131-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260131T090000
DTEND:20260131T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260131-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260131T093000
DTEND:20260131T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260131-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260131T100000
DTEND:20260131T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260131-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260131T103000
DTEND:20260131T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260131-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260131T110000
DTEND:20260131T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260201-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260201T090000
DTEND:20260201T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260201-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260201T093000
DTEND:20260201T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260201-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260201T100000
DTEND:20260201T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260201-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260201T103000
DTEND:20260201T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260201-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260201T110000
DTEND:20260201T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260202-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260202T090000
DTEND:20260202T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260202-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260202T093000
DTEND:20260202T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260202-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260202T100000
DTEND:20260202T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260202-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260202T103000
DTEND:20260202T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260202-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260202T110000
DTEND:20260202T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260203-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260203T090000
DTEND:20260203T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260203-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260203T093000
DTEND:20260203T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260203-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260203T100000
DTEND:20260203T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260203-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260203T103000
DTEND:20260203T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260203-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260203T110000
DTEND:20260203T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260204-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260204T130000
DTEND:20260204T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260204-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260204T170000
DTEND:20260204T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260204-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260204T173000
DTEND:20260204T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260204-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260204T180000
DTEND:20260204T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260205-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260205T090000
DTEND:20260205T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260205-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260205T093000
DTEND:20260205T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260205-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260205T100000
DTEND:20260205T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260205-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260205T103000
DTEND:20260205T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260205-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260205T110000
DTEND:20260205T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260206-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260206T090000
DTEND:20260206T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260206-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260206T093000
DTEND:20260206T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260206-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260206T100000
DTEND:20260206T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260206-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260206T103000
DTEND:20260206T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260206-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260206T110000
DTEND:20260206T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260207-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260207T090000
DTEND:20260207T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260207-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260207T093000
DTEND:20260207T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260207-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260207T100000
DTEND:20260207T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260207-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260207T103000
DTEND:20260207T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260207-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260207T110000
DTEND:20260207T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260208-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260208T090000
DTEND:20260208T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260208-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260208T093000
DTEND:20260208T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260208-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260208T100000
DTEND:20260208T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260208-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260208T103000
DTEND:20260208T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260208-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260208T110000
DTEND:20260208T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260209-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260209T090000
DTEND:20260209T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260209-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260209T093000
DTEND:20260209T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260209-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260209T100000
DTEND:20260209T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260209-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260209T103000
DTEND:20260209T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260209-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260209T110000
DTEND:20260209T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260210-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260210T090000
DTEND:20260210T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260210-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260210T093000
DTEND:20260210T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260210-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260210T100000
DTEND:20260210T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260210-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260210T103000
DTEND:20260210T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260210-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260210T110000
DTEND:20260210T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260211-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260211T130000
DTEND:20260211T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260211-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260211T170000
DTEND:20260211T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260211-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260211T173000
DTEND:20260211T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260211-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260211T180000
DTEND:20260211T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260212-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260212T090000
DTEND:20260212T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260212-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260212T093000
DTEND:20260212T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260212-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260212T100000
DTEND:20260212T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260212-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260212T103000
DTEND:20260212T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260212-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260212T110000
DTEND:20260212T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260213-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260213T090000
DTEND:20260213T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260213-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260213T093000
DTEND:20260213T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260213-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260213T100000
DTEND:20260213T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260213-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260213T103000
DTEND:20260213T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260213-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260213T110000
DTEND:20260213T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260214-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260214T090000
DTEND:20260214T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260214-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260214T093000
DTEND:20260214T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260214-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260214T100000
DTEND:20260214T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260214-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260214T103000
DTEND:20260214T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260214-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260214T110000
DTEND:20260214T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260215-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260215T090000
DTEND:20260215T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260215-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260215T093000
DTEND:20260215T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260215-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260215T100000
DTEND:20260215T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260215-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260215T103000
DTEND:20260215T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260215-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260215T110000
DTEND:20260215T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260216-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260216T090000
DTEND:20260216T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260216-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260216T093000
DTEND:20260216T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260216-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260216T100000
DTEND:20260216T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260216-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260216T103000
DTEND:20260216T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260216-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260216T110000
DTEND:20260216T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260217-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260217T090000
DTEND:20260217T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260217-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260217T093000
DTEND:20260217T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260217-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260217T100000
DTEND:20260217T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260217-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260217T103000
DTEND:20260217T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260217-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260217T110000
DTEND:20260217T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260218-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260218T130000
DTEND:20260218T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260218-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260218T170000
DTEND:20260218T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260218-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260218T173000
DTEND:20260218T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260218-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260218T180000
DTEND:20260218T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260219-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260219T090000
DTEND:20260219T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260219-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260219T093000
DTEND:20260219T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260219-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260219T100000
DTEND:20260219T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260219-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260219T103000
DTEND:20260219T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260219-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260219T110000
DTEND:20260219T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260220-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260220T090000
DTEND:20260220T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260220-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260220T093000
DTEND:20260220T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260220-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260220T100000
DTEND:20260220T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260220-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260220T103000
DTEND:20260220T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260220-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260220T110000
DTEND:20260220T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260221-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260221T090000
DTEND:20260221T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260221-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260221T093000
DTEND:20260221T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260221-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260221T100000
DTEND:20260221T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260221-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260221T103000
DTEND:20260221T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260221-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260221T110000
DTEND:20260221T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260222-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260222T090000
DTEND:20260222T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260222-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260222T093000
DTEND:20260222T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260222-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260222T100000
DTEND:20260222T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260222-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260222T103000
DTEND:20260222T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260222-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260222T110000
DTEND:20260222T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260223-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260223T090000
DTEND:20260223T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260223-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260223T093000
DTEND:20260223T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260223-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260223T100000
DTEND:20260223T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260223-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260223T103000
DTEND:20260223T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260223-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260223T110000
DTEND:20260223T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260224-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260224T090000
DTEND:20260224T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260224-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260224T093000
DTEND:20260224T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260224-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260224T100000
DTEND:20260224T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260224-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260224T103000
DTEND:20260224T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260224-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260224T110000
DTEND:20260224T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260225-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260225T130000
DTEND:20260225T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260225-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260225T170000
DTEND:20260225T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260225-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260225T173000
DTEND:20260225T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260225-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260225T180000
DTEND:20260225T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260226-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260226T090000
DTEND:20260226T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260226-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260226T093000
DTEND:20260226T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260226-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260226T100000
DTEND:20260226T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260226-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260226T103000
DTEND:20260226T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260226-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260226T110000
DTEND:20260226T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260227-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260227T090000
DTEND:20260227T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260227-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260227T093000
DTEND:20260227T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260227-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260227T100000
DTEND:20260227T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260227-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260227T103000
DTEND:20260227T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260227-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260227T110000
DTEND:20260227T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260228-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260228T090000
DTEND:20260228T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260228-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260228T093000
DTEND:20260228T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260228-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260228T100000
DTEND:20260228T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260228-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260228T103000
DTEND:20260228T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260228-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260228T110000
DTEND:20260228T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260301-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260301T090000
DTEND:20260301T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260301-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260301T093000
DTEND:20260301T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260301-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260301T100000
DTEND:20260301T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260301-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260301T103000
DTEND:20260301T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260301-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260301T110000
DTEND:20260301T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260302-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260302T090000
DTEND:20260302T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260302-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260302T093000
DTEND:20260302T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260302-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260302T100000
DTEND:20260302T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260302-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260302T103000
DTEND:20260302T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260302-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260302T110000
DTEND:20260302T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260303-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260303T090000
DTEND:20260303T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260303-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260303T093000
DTEND:20260303T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260303-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260303T100000
DTEND:20260303T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260303-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260303T103000
DTEND:20260303T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260303-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260303T110000
DTEND:20260303T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260304-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260304T130000
DTEND:20260304T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260304-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260304T170000
DTEND:20260304T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260304-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260304T173000
DTEND:20260304T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260304-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260304T180000
DTEND:20260304T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260305-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260305T090000
DTEND:20260305T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260305-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260305T093000
DTEND:20260305T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260305-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260305T100000
DTEND:20260305T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260305-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260305T103000
DTEND:20260305T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260305-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260305T110000
DTEND:20260305T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260306-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260306T090000
DTEND:20260306T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260306-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260306T093000
DTEND:20260306T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260306-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260306T100000
DTEND:20260306T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260306-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260306T103000
DTEND:20260306T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260306-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260306T110000
DTEND:20260306T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260307-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260307T090000
DTEND:20260307T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260307-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260307T093000
DTEND:20260307T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260307-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260307T100000
DTEND:20260307T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260307-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260307T103000
DTEND:20260307T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260307-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260307T110000
DTEND:20260307T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260308-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260308T090000
DTEND:20260308T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260308-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260308T093000
DTEND:20260308T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260308-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260308T100000
DTEND:20260308T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260308-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260308T103000
DTEND:20260308T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260308-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260308T110000
DTEND:20260308T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260309-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260309T090000
DTEND:20260309T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260309-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260309T093000
DTEND:20260309T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260309-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260309T100000
DTEND:20260309T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260309-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260309T103000
DTEND:20260309T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260309-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260309T110000
DTEND:20260309T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260310-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260310T090000
DTEND:20260310T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260310-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260310T093000
DTEND:20260310T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260310-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260310T100000
DTEND:20260310T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260310-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260310T103000
DTEND:20260310T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260310-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260310T110000
DTEND:20260310T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260311-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260311T130000
DTEND:20260311T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260311-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260311T170000
DTEND:20260311T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260311-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260311T173000
DTEND:20260311T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260311-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260311T180000
DTEND:20260311T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260312-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260312T090000
DTEND:20260312T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260312-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260312T093000
DTEND:20260312T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260312-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260312T100000
DTEND:20260312T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260312-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260312T103000
DTEND:20260312T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260312-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260312T110000
DTEND:20260312T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260313-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260313T090000
DTEND:20260313T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260313-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260313T093000
DTEND:20260313T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260313-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260313T100000
DTEND:20260313T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260313-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260313T103000
DTEND:20260313T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260313-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260313T110000
DTEND:20260313T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260314-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260314T090000
DTEND:20260314T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260314-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260314T093000
DTEND:20260314T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260314-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260314T100000
DTEND:20260314T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260314-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260314T103000
DTEND:20260314T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260314-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260314T110000
DTEND:20260314T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260315-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260315T090000
DTEND:20260315T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260315-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260315T093000
DTEND:20260315T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260315-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260315T100000
DTEND:20260315T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260315-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260315T103000
DTEND:20260315T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260315-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260315T110000
DTEND:20260315T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260316-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260316T090000
DTEND:20260316T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260316-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260316T093000
DTEND:20260316T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260316-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260316T100000
DTEND:20260316T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260316-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260316T103000
DTEND:20260316T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260316-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260316T110000
DTEND:20260316T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260317-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260317T090000
DTEND:20260317T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260317-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260317T093000
DTEND:20260317T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260317-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260317T100000
DTEND:20260317T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260317-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260317T103000
DTEND:20260317T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260317-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260317T110000
DTEND:20260317T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260318-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260318T130000
DTEND:20260318T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260318-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260318T170000
DTEND:20260318T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260318-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260318T173000
DTEND:20260318T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260318-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260318T180000
DTEND:20260318T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260319-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260319T090000
DTEND:20260319T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260319-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260319T093000
DTEND:20260319T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260319-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260319T100000
DTEND:20260319T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260319-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260319T103000
DTEND:20260319T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260319-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260319T110000
DTEND:20260319T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260320-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260320T090000
DTEND:20260320T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260320-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260320T093000
DTEND:20260320T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260320-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260320T100000
DTEND:20260320T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260320-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260320T103000
DTEND:20260320T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260320-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260320T110000
DTEND:20260320T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260321-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260321T090000
DTEND:20260321T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260321-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260321T093000
DTEND:20260321T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260321-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260321T100000
DTEND:20260321T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260321-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260321T103000
DTEND:20260321T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260321-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260321T110000
DTEND:20260321T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260322-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260322T090000
DTEND:20260322T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260322-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260322T093000
DTEND:20260322T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260322-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260322T100000
DTEND:20260322T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260322-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260322T103000
DTEND:20260322T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260322-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260322T110000
DTEND:20260322T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260323-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260323T090000
DTEND:20260323T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260323-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260323T093000
DTEND:20260323T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260323-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260323T100000
DTEND:20260323T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260323-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260323T103000
DTEND:20260323T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260323-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260323T110000
DTEND:20260323T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260324-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260324T090000
DTEND:20260324T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260324-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260324T093000
DTEND:20260324T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260324-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260324T100000
DTEND:20260324T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260324-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260324T103000
DTEND:20260324T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260324-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260324T110000
DTEND:20260324T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260325-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260325T130000
DTEND:20260325T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260325-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260325T170000
DTEND:20260325T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260325-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260325T173000
DTEND:20260325T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260325-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260325T180000
DTEND:20260325T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260326-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260326T090000
DTEND:20260326T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260326-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260326T093000
DTEND:20260326T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260326-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260326T100000
DTEND:20260326T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260326-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260326T103000
DTEND:20260326T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260326-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260326T110000
DTEND:20260326T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260327-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260327T090000
DTEND:20260327T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260327-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260327T093000
DTEND:20260327T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260327-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260327T100000
DTEND:20260327T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260327-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260327T103000
DTEND:20260327T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260327-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260327T110000
DTEND:20260327T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260328-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260328T090000
DTEND:20260328T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260328-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260328T093000
DTEND:20260328T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260328-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260328T100000
DTEND:20260328T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260328-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260328T103000
DTEND:20260328T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260328-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260328T110000
DTEND:20260328T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260329-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260329T090000
DTEND:20260329T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260329-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260329T093000
DTEND:20260329T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260329-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260329T100000
DTEND:20260329T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260329-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260329T103000
DTEND:20260329T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260329-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260329T110000
DTEND:20260329T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260330-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260330T090000
DTEND:20260330T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260330-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260330T093000
DTEND:20260330T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260330-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260330T100000
DTEND:20260330T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260330-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260330T103000
DTEND:20260330T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260330-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260330T110000
DTEND:20260330T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260331-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260331T090000
DTEND:20260331T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260331-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260331T093000
DTEND:20260331T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260331-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260331T100000
DTEND:20260331T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260331-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260331T103000
DTEND:20260331T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260331-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260331T110000
DTEND:20260331T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260401-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260401T130000
DTEND:20260401T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260401-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260401T170000
DTEND:20260401T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260401-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260401T173000
DTEND:20260401T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260401-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260401T180000
DTEND:20260401T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260402-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260402T090000
DTEND:20260402T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260402-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260402T093000
DTEND:20260402T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260402-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260402T100000
DTEND:20260402T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260402-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260402T103000
DTEND:20260402T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260402-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260402T110000
DTEND:20260402T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260403-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260403T090000
DTEND:20260403T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260403-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260403T093000
DTEND:20260403T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260403-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260403T100000
DTEND:20260403T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260403-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260403T103000
DTEND:20260403T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260403-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260403T110000
DTEND:20260403T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260404-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260404T090000
DTEND:20260404T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260404-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260404T093000
DTEND:20260404T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260404-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260404T100000
DTEND:20260404T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260404-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260404T103000
DTEND:20260404T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260404-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260404T110000
DTEND:20260404T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260405-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260405T090000
DTEND:20260405T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260405-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260405T093000
DTEND:20260405T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260405-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260405T100000
DTEND:20260405T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260405-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260405T103000
DTEND:20260405T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260405-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260405T110000
DTEND:20260405T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260406-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260406T090000
DTEND:20260406T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260406-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260406T093000
DTEND:20260406T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260406-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260406T100000
DTEND:20260406T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260406-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260406T103000
DTEND:20260406T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260406-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260406T110000
DTEND:20260406T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260407-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260407T090000
DTEND:20260407T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260407-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260407T093000
DTEND:20260407T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260407-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260407T100000
DTEND:20260407T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260407-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260407T103000
DTEND:20260407T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260407-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260407T110000
DTEND:20260407T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260408-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260408T130000
DTEND:20260408T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260408-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260408T170000
DTEND:20260408T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260408-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260408T173000
DTEND:20260408T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260408-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260408T180000
DTEND:20260408T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260409-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260409T090000
DTEND:20260409T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260409-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260409T093000
DTEND:20260409T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260409-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260409T100000
DTEND:20260409T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260409-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260409T103000
DTEND:20260409T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260409-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260409T110000
DTEND:20260409T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260410-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260410T090000
DTEND:20260410T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260410-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260410T093000
DTEND:20260410T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260410-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260410T100000
DTEND:20260410T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260410-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260410T103000
DTEND:20260410T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260410-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260410T110000
DTEND:20260410T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260411-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260411T090000
DTEND:20260411T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260411-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260411T093000
DTEND:20260411T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260411-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260411T100000
DTEND:20260411T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260411-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260411T103000
DTEND:20260411T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260411-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260411T110000
DTEND:20260411T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260412-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260412T090000
DTEND:20260412T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260412-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260412T093000
DTEND:20260412T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260412-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260412T100000
DTEND:20260412T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260412-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260412T103000
DTEND:20260412T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260412-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260412T110000
DTEND:20260412T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260413-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260413T090000
DTEND:20260413T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260413-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260413T093000
DTEND:20260413T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260413-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260413T100000
DTEND:20260413T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260413-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260413T103000
DTEND:20260413T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260413-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260413T110000
DTEND:20260413T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260414-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260414T090000
DTEND:20260414T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260414-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260414T093000
DTEND:20260414T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260414-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260414T100000
DTEND:20260414T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260414-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260414T103000
DTEND:20260414T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260414-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260414T110000
DTEND:20260414T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260415-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260415T130000
DTEND:20260415T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260415-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260415T170000
DTEND:20260415T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260415-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260415T173000
DTEND:20260415T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260415-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260415T180000
DTEND:20260415T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260416-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260416T090000
DTEND:20260416T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260416-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260416T093000
DTEND:20260416T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260416-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260416T100000
DTEND:20260416T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260416-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260416T103000
DTEND:20260416T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260416-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260416T110000
DTEND:20260416T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260417-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260417T090000
DTEND:20260417T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260417-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260417T093000
DTEND:20260417T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260417-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260417T100000
DTEND:20260417T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260417-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260417T103000
DTEND:20260417T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260417-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260417T110000
DTEND:20260417T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260418-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260418T090000
DTEND:20260418T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260418-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260418T093000
DTEND:20260418T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260418-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260418T100000
DTEND:20260418T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260418-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260418T103000
DTEND:20260418T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260418-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260418T110000
DTEND:20260418T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260419-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260419T090000
DTEND:20260419T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260419-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260419T093000
DTEND:20260419T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260419-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260419T100000
DTEND:20260419T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260419-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260419T103000
DTEND:20260419T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260419-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260419T110000
DTEND:20260419T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260420-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260420T090000
DTEND:20260420T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260420-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260420T093000
DTEND:20260420T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260420-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260420T100000
DTEND:20260420T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260420-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260420T103000
DTEND:20260420T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260420-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260420T110000
DTEND:20260420T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260421-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260421T090000
DTEND:20260421T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260421-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260421T093000
DTEND:20260421T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260421-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260421T100000
DTEND:20260421T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260421-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260421T103000
DTEND:20260421T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260421-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260421T110000
DTEND:20260421T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260422-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260422T130000
DTEND:20260422T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260422-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260422T170000
DTEND:20260422T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260422-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260422T173000
DTEND:20260422T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260422-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260422T180000
DTEND:20260422T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260423-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260423T090000
DTEND:20260423T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260423-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260423T093000
DTEND:20260423T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260423-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260423T100000
DTEND:20260423T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260423-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260423T103000
DTEND:20260423T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260423-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260423T110000
DTEND:20260423T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260424-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260424T090000
DTEND:20260424T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260424-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260424T093000
DTEND:20260424T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260424-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260424T100000
DTEND:20260424T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260424-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260424T103000
DTEND:20260424T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260424-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260424T110000
DTEND:20260424T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260425-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260425T090000
DTEND:20260425T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260425-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260425T093000
DTEND:20260425T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260425-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260425T100000
DTEND:20260425T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260425-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260425T103000
DTEND:20260425T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260425-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260425T110000
DTEND:20260425T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260426-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260426T090000
DTEND:20260426T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260426-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260426T093000
DTEND:20260426T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260426-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260426T100000
DTEND:20260426T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260426-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260426T103000
DTEND:20260426T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260426-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260426T110000
DTEND:20260426T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260427-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260427T090000
DTEND:20260427T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260427-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260427T093000
DTEND:20260427T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260427-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260427T100000
DTEND:20260427T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260427-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260427T103000
DTEND:20260427T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260427-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260427T110000
DTEND:20260427T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260428-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260428T090000
DTEND:20260428T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260428-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260428T093000
DTEND:20260428T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260428-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260428T100000
DTEND:20260428T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260428-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260428T103000
DTEND:20260428T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260428-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260428T110000
DTEND:20260428T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260429-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260429T130000
DTEND:20260429T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260429-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260429T170000
DTEND:20260429T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260429-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260429T173000
DTEND:20260429T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260429-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260429T180000
DTEND:20260429T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260430-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260430T090000
DTEND:20260430T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260430-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260430T093000
DTEND:20260430T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260430-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260430T100000
DTEND:20260430T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260430-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260430T103000
DTEND:20260430T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260430-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260430T110000
DTEND:20260430T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260501-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260501T090000
DTEND:20260501T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260501-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260501T093000
DTEND:20260501T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260501-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260501T100000
DTEND:20260501T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260501-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260501T103000
DTEND:20260501T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260501-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260501T110000
DTEND:20260501T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260502-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260502T090000
DTEND:20260502T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260502-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260502T093000
DTEND:20260502T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260502-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260502T100000
DTEND:20260502T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260502-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260502T103000
DTEND:20260502T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260502-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260502T110000
DTEND:20260502T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260503-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260503T090000
DTEND:20260503T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260503-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260503T093000
DTEND:20260503T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260503-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260503T100000
DTEND:20260503T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260503-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260503T103000
DTEND:20260503T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260503-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260503T110000
DTEND:20260503T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260504-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260504T090000
DTEND:20260504T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260504-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260504T093000
DTEND:20260504T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260504-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260504T100000
DTEND:20260504T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260504-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260504T103000
DTEND:20260504T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260504-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260504T110000
DTEND:20260504T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260505-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260505T090000
DTEND:20260505T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260505-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260505T093000
DTEND:20260505T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260505-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260505T100000
DTEND:20260505T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260505-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260505T103000
DTEND:20260505T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260505-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260505T110000
DTEND:20260505T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260506-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260506T130000
DTEND:20260506T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260506-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260506T170000
DTEND:20260506T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260506-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260506T173000
DTEND:20260506T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260506-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260506T180000
DTEND:20260506T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260507-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260507T090000
DTEND:20260507T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260507-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260507T093000
DTEND:20260507T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260507-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260507T100000
DTEND:20260507T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260507-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260507T103000
DTEND:20260507T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260507-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260507T110000
DTEND:20260507T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260508-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260508T090000
DTEND:20260508T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260508-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260508T093000
DTEND:20260508T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260508-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260508T100000
DTEND:20260508T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260508-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260508T103000
DTEND:20260508T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260508-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260508T110000
DTEND:20260508T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260509-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260509T090000
DTEND:20260509T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260509-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260509T093000
DTEND:20260509T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260509-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260509T100000
DTEND:20260509T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260509-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260509T103000
DTEND:20260509T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260509-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260509T110000
DTEND:20260509T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260510-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260510T090000
DTEND:20260510T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260510-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260510T093000
DTEND:20260510T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260510-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260510T100000
DTEND:20260510T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260510-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260510T103000
DTEND:20260510T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260510-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260510T110000
DTEND:20260510T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260511-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260511T090000
DTEND:20260511T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260511-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260511T093000
DTEND:20260511T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260511-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260511T100000
DTEND:20260511T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260511-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260511T103000
DTEND:20260511T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260511-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260511T110000
DTEND:20260511T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260512-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260512T090000
DTEND:20260512T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260512-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260512T093000
DTEND:20260512T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260512-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260512T100000
DTEND:20260512T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260512-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260512T103000
DTEND:20260512T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260512-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260512T110000
DTEND:20260512T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260513-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260513T130000
DTEND:20260513T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260513-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260513T170000
DTEND:20260513T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260513-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260513T173000
DTEND:20260513T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260513-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260513T180000
DTEND:20260513T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260514-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260514T090000
DTEND:20260514T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260514-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260514T093000
DTEND:20260514T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260514-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260514T100000
DTEND:20260514T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260514-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260514T103000
DTEND:20260514T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260514-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260514T110000
DTEND:20260514T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260515-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260515T090000
DTEND:20260515T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260515-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260515T093000
DTEND:20260515T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260515-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260515T100000
DTEND:20260515T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260515-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260515T103000
DTEND:20260515T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260515-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260515T110000
DTEND:20260515T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260516-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260516T090000
DTEND:20260516T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260516-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260516T093000
DTEND:20260516T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260516-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260516T100000
DTEND:20260516T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260516-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260516T103000
DTEND:20260516T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260516-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260516T110000
DTEND:20260516T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260517-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260517T090000
DTEND:20260517T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260517-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260517T093000
DTEND:20260517T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260517-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260517T100000
DTEND:20260517T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260517-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260517T103000
DTEND:20260517T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260517-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260517T110000
DTEND:20260517T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260518-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260518T090000
DTEND:20260518T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260518-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260518T093000
DTEND:20260518T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260518-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260518T100000
DTEND:20260518T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260518-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260518T103000
DTEND:20260518T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260518-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260518T110000
DTEND:20260518T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260519-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260519T090000
DTEND:20260519T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260519-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260519T093000
DTEND:20260519T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260519-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260519T100000
DTEND:20260519T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260519-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260519T103000
DTEND:20260519T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260519-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260519T110000
DTEND:20260519T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260520-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260520T130000
DTEND:20260520T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260520-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260520T170000
DTEND:20260520T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260520-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260520T173000
DTEND:20260520T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260520-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260520T180000
DTEND:20260520T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260521-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260521T090000
DTEND:20260521T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260521-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260521T093000
DTEND:20260521T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260521-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260521T100000
DTEND:20260521T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260521-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260521T103000
DTEND:20260521T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260521-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260521T110000
DTEND:20260521T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260522-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260522T090000
DTEND:20260522T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260522-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260522T093000
DTEND:20260522T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260522-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260522T100000
DTEND:20260522T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260522-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260522T103000
DTEND:20260522T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260522-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260522T110000
DTEND:20260522T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260523-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260523T090000
DTEND:20260523T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260523-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260523T093000
DTEND:20260523T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260523-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260523T100000
DTEND:20260523T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260523-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260523T103000
DTEND:20260523T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260523-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260523T110000
DTEND:20260523T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260524-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260524T090000
DTEND:20260524T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260524-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260524T093000
DTEND:20260524T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260524-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260524T100000
DTEND:20260524T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260524-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260524T103000
DTEND:20260524T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260524-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260524T110000
DTEND:20260524T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260525-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260525T090000
DTEND:20260525T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260525-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260525T093000
DTEND:20260525T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260525-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260525T100000
DTEND:20260525T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260525-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260525T103000
DTEND:20260525T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260525-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260525T110000
DTEND:20260525T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260526-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260526T090000
DTEND:20260526T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260526-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260526T093000
DTEND:20260526T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260526-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260526T100000
DTEND:20260526T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260526-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260526T103000
DTEND:20260526T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260526-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260526T110000
DTEND:20260526T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260527-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260527T130000
DTEND:20260527T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260527-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260527T170000
DTEND:20260527T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260527-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260527T173000
DTEND:20260527T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260527-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260527T180000
DTEND:20260527T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260528-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260528T090000
DTEND:20260528T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260528-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260528T093000
DTEND:20260528T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260528-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260528T100000
DTEND:20260528T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260528-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260528T103000
DTEND:20260528T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260528-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260528T110000
DTEND:20260528T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260529-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260529T090000
DTEND:20260529T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260529-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260529T093000
DTEND:20260529T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260529-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260529T100000
DTEND:20260529T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260529-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260529T103000
DTEND:20260529T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260529-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260529T110000
DTEND:20260529T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260530-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260530T090000
DTEND:20260530T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260530-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260530T093000
DTEND:20260530T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260530-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260530T100000
DTEND:20260530T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260530-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260530T103000
DTEND:20260530T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260530-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260530T110000
DTEND:20260530T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260531-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260531T090000
DTEND:20260531T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260531-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260531T093000
DTEND:20260531T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260531-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260531T100000
DTEND:20260531T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260531-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260531T103000
DTEND:20260531T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260531-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260531T110000
DTEND:20260531T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260601-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260601T090000
DTEND:20260601T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260601-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260601T093000
DTEND:20260601T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260601-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260601T100000
DTEND:20260601T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260601-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260601T103000
DTEND:20260601T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260601-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260601T110000
DTEND:20260601T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260602-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260602T090000
DTEND:20260602T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260602-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260602T093000
DTEND:20260602T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260602-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260602T100000
DTEND:20260602T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260602-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260602T103000
DTEND:20260602T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260602-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260602T110000
DTEND:20260602T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260603-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260603T130000
DTEND:20260603T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260603-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260603T170000
DTEND:20260603T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260603-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260603T173000
DTEND:20260603T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260603-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260603T180000
DTEND:20260603T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260604-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260604T090000
DTEND:20260604T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260604-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260604T093000
DTEND:20260604T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260604-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260604T100000
DTEND:20260604T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260604-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260604T103000
DTEND:20260604T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260604-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260604T110000
DTEND:20260604T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260605-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260605T090000
DTEND:20260605T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260605-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260605T093000
DTEND:20260605T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260605-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260605T100000
DTEND:20260605T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260605-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260605T103000
DTEND:20260605T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260605-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260605T110000
DTEND:20260605T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260606-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260606T090000
DTEND:20260606T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260606-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260606T093000
DTEND:20260606T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260606-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260606T100000
DTEND:20260606T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260606-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260606T103000
DTEND:20260606T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260606-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260606T110000
DTEND:20260606T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260607-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260607T090000
DTEND:20260607T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260607-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260607T093000
DTEND:20260607T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260607-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260607T100000
DTEND:20260607T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260607-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260607T103000
DTEND:20260607T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260607-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260607T110000
DTEND:20260607T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260608-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260608T090000
DTEND:20260608T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260608-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260608T093000
DTEND:20260608T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260608-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260608T100000
DTEND:20260608T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260608-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260608T103000
DTEND:20260608T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260608-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260608T110000
DTEND:20260608T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260609-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260609T090000
DTEND:20260609T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260609-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260609T093000
DTEND:20260609T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260609-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260609T100000
DTEND:20260609T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260609-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260609T103000
DTEND:20260609T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260609-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260609T110000
DTEND:20260609T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260610-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260610T130000
DTEND:20260610T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260610-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260610T170000
DTEND:20260610T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260610-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260610T173000
DTEND:20260610T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260610-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260610T180000
DTEND:20260610T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260611-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260611T090000
DTEND:20260611T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260611-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260611T093000
DTEND:20260611T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260611-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260611T100000
DTEND:20260611T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260611-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260611T103000
DTEND:20260611T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260611-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260611T110000
DTEND:20260611T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260612-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260612T090000
DTEND:20260612T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260612-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260612T093000
DTEND:20260612T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260612-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260612T100000
DTEND:20260612T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260612-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260612T103000
DTEND:20260612T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260612-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260612T110000
DTEND:20260612T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260613-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260613T090000
DTEND:20260613T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260613-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260613T093000
DTEND:20260613T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260613-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260613T100000
DTEND:20260613T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260613-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260613T103000
DTEND:20260613T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260613-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260613T110000
DTEND:20260613T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260614-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260614T090000
DTEND:20260614T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260614-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260614T093000
DTEND:20260614T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260614-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260614T100000
DTEND:20260614T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260614-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260614T103000
DTEND:20260614T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260614-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260614T110000
DTEND:20260614T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260615-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260615T090000
DTEND:20260615T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260615-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260615T093000
DTEND:20260615T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260615-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260615T100000
DTEND:20260615T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260615-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260615T103000
DTEND:20260615T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260615-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260615T110000
DTEND:20260615T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260616-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260616T090000
DTEND:20260616T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260616-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260616T093000
DTEND:20260616T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260616-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260616T100000
DTEND:20260616T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260616-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260616T103000
DTEND:20260616T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260616-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260616T110000
DTEND:20260616T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260617-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260617T130000
DTEND:20260617T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260617-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260617T170000
DTEND:20260617T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260617-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260617T173000
DTEND:20260617T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260617-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260617T180000
DTEND:20260617T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260618-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260618T090000
DTEND:20260618T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260618-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260618T093000
DTEND:20260618T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260618-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260618T100000
DTEND:20260618T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260618-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260618T103000
DTEND:20260618T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260618-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260618T110000
DTEND:20260618T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260619-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260619T090000
DTEND:20260619T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260619-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260619T093000
DTEND:20260619T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260619-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260619T100000
DTEND:20260619T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260619-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260619T103000
DTEND:20260619T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260619-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260619T110000
DTEND:20260619T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260620-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260620T090000
DTEND:20260620T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260620-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260620T093000
DTEND:20260620T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260620-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260620T100000
DTEND:20260620T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260620-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260620T103000
DTEND:20260620T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260620-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260620T110000
DTEND:20260620T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260621-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260621T090000
DTEND:20260621T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260621-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260621T093000
DTEND:20260621T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260621-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260621T100000
DTEND:20260621T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260621-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260621T103000
DTEND:20260621T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260621-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260621T110000
DTEND:20260621T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260622-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260622T090000
DTEND:20260622T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260622-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260622T093000
DTEND:20260622T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260622-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260622T100000
DTEND:20260622T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260622-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260622T103000
DTEND:20260622T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260622-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260622T110000
DTEND:20260622T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260623-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260623T090000
DTEND:20260623T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260623-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260623T093000
DTEND:20260623T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260623-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260623T100000
DTEND:20260623T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260623-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260623T103000
DTEND:20260623T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260623-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260623T110000
DTEND:20260623T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260624-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260624T130000
DTEND:20260624T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260624-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260624T170000
DTEND:20260624T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260624-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260624T173000
DTEND:20260624T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260624-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260624T180000
DTEND:20260624T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260625-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260625T090000
DTEND:20260625T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260625-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260625T093000
DTEND:20260625T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260625-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260625T100000
DTEND:20260625T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260625-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260625T103000
DTEND:20260625T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260625-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260625T110000
DTEND:20260625T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260626-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260626T090000
DTEND:20260626T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260626-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260626T093000
DTEND:20260626T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260626-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260626T100000
DTEND:20260626T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260626-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260626T103000
DTEND:20260626T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260626-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260626T110000
DTEND:20260626T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260627-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260627T090000
DTEND:20260627T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260627-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260627T093000
DTEND:20260627T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260627-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260627T100000
DTEND:20260627T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260627-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260627T103000
DTEND:20260627T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260627-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260627T110000
DTEND:20260627T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260628-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260628T090000
DTEND:20260628T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260628-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260628T093000
DTEND:20260628T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260628-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260628T100000
DTEND:20260628T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260628-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260628T103000
DTEND:20260628T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260628-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260628T110000
DTEND:20260628T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260629-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260629T090000
DTEND:20260629T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260629-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260629T093000
DTEND:20260629T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260629-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260629T100000
DTEND:20260629T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260629-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260629T103000
DTEND:20260629T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260629-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260629T110000
DTEND:20260629T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260630-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260630T090000
DTEND:20260630T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260630-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260630T093000
DTEND:20260630T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260630-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260630T100000
DTEND:20260630T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260630-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260630T103000
DTEND:20260630T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260630-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260630T110000
DTEND:20260630T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260701-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260701T130000
DTEND:20260701T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260701-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260701T170000
DTEND:20260701T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260701-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260701T173000
DTEND:20260701T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260701-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260701T180000
DTEND:20260701T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260702-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260702T090000
DTEND:20260702T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260702-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260702T093000
DTEND:20260702T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260702-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260702T100000
DTEND:20260702T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260702-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260702T103000
DTEND:20260702T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260702-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260702T110000
DTEND:20260702T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260703-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260703T090000
DTEND:20260703T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260703-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260703T093000
DTEND:20260703T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260703-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260703T100000
DTEND:20260703T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260703-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260703T103000
DTEND:20260703T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260703-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260703T110000
DTEND:20260703T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260704-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260704T090000
DTEND:20260704T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260704-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260704T093000
DTEND:20260704T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260704-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260704T100000
DTEND:20260704T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260704-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260704T103000
DTEND:20260704T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260704-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260704T110000
DTEND:20260704T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260705-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260705T090000
DTEND:20260705T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260705-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260705T093000
DTEND:20260705T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260705-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260705T100000
DTEND:20260705T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260705-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260705T103000
DTEND:20260705T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260705-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260705T110000
DTEND:20260705T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260706-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260706T090000
DTEND:20260706T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260706-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260706T093000
DTEND:20260706T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260706-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260706T100000
DTEND:20260706T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260706-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260706T103000
DTEND:20260706T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260706-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260706T110000
DTEND:20260706T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260707-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260707T090000
DTEND:20260707T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260707-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260707T093000
DTEND:20260707T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260707-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260707T100000
DTEND:20260707T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260707-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260707T103000
DTEND:20260707T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260707-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260707T110000
DTEND:20260707T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260708-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260708T130000
DTEND:20260708T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260708-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260708T170000
DTEND:20260708T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260708-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260708T173000
DTEND:20260708T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260708-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260708T180000
DTEND:20260708T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260709-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260709T090000
DTEND:20260709T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260709-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260709T093000
DTEND:20260709T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260709-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260709T100000
DTEND:20260709T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260709-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260709T103000
DTEND:20260709T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260709-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260709T110000
DTEND:20260709T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260710-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260710T090000
DTEND:20260710T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260710-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260710T093000
DTEND:20260710T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260710-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260710T100000
DTEND:20260710T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260710-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260710T103000
DTEND:20260710T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260710-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260710T110000
DTEND:20260710T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260711-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260711T090000
DTEND:20260711T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260711-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260711T093000
DTEND:20260711T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260711-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260711T100000
DTEND:20260711T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260711-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260711T103000
DTEND:20260711T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260711-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260711T110000
DTEND:20260711T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260712-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260712T090000
DTEND:20260712T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260712-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260712T093000
DTEND:20260712T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260712-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260712T100000
DTEND:20260712T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260712-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260712T103000
DTEND:20260712T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260712-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260712T110000
DTEND:20260712T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260713-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260713T090000
DTEND:20260713T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260713-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260713T093000
DTEND:20260713T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260713-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260713T100000
DTEND:20260713T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260713-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260713T103000
DTEND:20260713T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260713-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260713T110000
DTEND:20260713T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260714-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260714T090000
DTEND:20260714T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260714-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260714T093000
DTEND:20260714T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260714-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260714T100000
DTEND:20260714T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260714-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260714T103000
DTEND:20260714T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260714-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260714T110000
DTEND:20260714T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260715-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260715T130000
DTEND:20260715T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260715-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260715T170000
DTEND:20260715T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260715-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260715T173000
DTEND:20260715T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260715-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260715T180000
DTEND:20260715T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260716-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260716T090000
DTEND:20260716T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260716-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260716T093000
DTEND:20260716T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260716-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260716T100000
DTEND:20260716T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260716-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260716T103000
DTEND:20260716T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260716-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260716T110000
DTEND:20260716T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260717-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260717T090000
DTEND:20260717T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260717-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260717T093000
DTEND:20260717T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260717-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260717T100000
DTEND:20260717T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260717-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260717T103000
DTEND:20260717T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260717-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260717T110000
DTEND:20260717T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260718-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260718T090000
DTEND:20260718T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260718-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260718T093000
DTEND:20260718T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260718-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260718T100000
DTEND:20260718T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260718-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260718T103000
DTEND:20260718T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260718-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260718T110000
DTEND:20260718T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260719-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260719T090000
DTEND:20260719T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260719-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260719T093000
DTEND:20260719T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260719-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260719T100000
DTEND:20260719T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260719-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260719T103000
DTEND:20260719T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260719-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260719T110000
DTEND:20260719T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260720-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260720T090000
DTEND:20260720T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260720-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260720T093000
DTEND:20260720T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260720-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260720T100000
DTEND:20260720T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260720-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260720T103000
DTEND:20260720T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260720-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260720T110000
DTEND:20260720T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260721-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260721T090000
DTEND:20260721T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260721-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260721T093000
DTEND:20260721T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260721-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260721T100000
DTEND:20260721T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260721-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260721T103000
DTEND:20260721T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260721-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260721T110000
DTEND:20260721T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260722-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260722T130000
DTEND:20260722T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260722-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260722T170000
DTEND:20260722T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260722-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260722T173000
DTEND:20260722T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260722-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260722T180000
DTEND:20260722T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260723-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260723T090000
DTEND:20260723T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260723-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260723T093000
DTEND:20260723T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260723-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260723T100000
DTEND:20260723T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260723-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260723T103000
DTEND:20260723T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260723-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260723T110000
DTEND:20260723T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260724-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260724T090000
DTEND:20260724T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260724-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260724T093000
DTEND:20260724T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260724-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260724T100000
DTEND:20260724T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260724-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260724T103000
DTEND:20260724T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260724-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260724T110000
DTEND:20260724T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260725-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260725T090000
DTEND:20260725T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260725-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260725T093000
DTEND:20260725T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260725-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260725T100000
DTEND:20260725T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260725-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260725T103000
DTEND:20260725T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260725-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260725T110000
DTEND:20260725T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260726-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260726T090000
DTEND:20260726T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260726-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260726T093000
DTEND:20260726T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260726-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260726T100000
DTEND:20260726T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260726-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260726T103000
DTEND:20260726T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260726-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260726T110000
DTEND:20260726T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260727-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260727T090000
DTEND:20260727T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260727-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260727T093000
DTEND:20260727T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260727-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260727T100000
DTEND:20260727T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260727-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260727T103000
DTEND:20260727T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260727-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260727T110000
DTEND:20260727T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260728-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260728T090000
DTEND:20260728T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260728-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260728T093000
DTEND:20260728T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260728-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260728T100000
DTEND:20260728T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260728-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260728T103000
DTEND:20260728T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260728-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260728T110000
DTEND:20260728T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260729-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260729T130000
DTEND:20260729T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260729-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260729T170000
DTEND:20260729T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260729-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260729T173000
DTEND:20260729T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260729-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260729T180000
DTEND:20260729T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260730-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260730T090000
DTEND:20260730T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260730-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260730T093000
DTEND:20260730T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260730-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260730T100000
DTEND:20260730T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260730-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260730T103000
DTEND:20260730T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260730-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260730T110000
DTEND:20260730T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260731-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260731T090000
DTEND:20260731T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260731-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260731T093000
DTEND:20260731T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260731-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260731T100000
DTEND:20260731T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260731-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260731T103000
DTEND:20260731T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260731-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260731T110000
DTEND:20260731T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260801-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260801T090000
DTEND:20260801T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260801-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260801T093000
DTEND:20260801T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260801-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260801T100000
DTEND:20260801T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260801-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260801T103000
DTEND:20260801T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260801-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260801T110000
DTEND:20260801T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260802-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260802T090000
DTEND:20260802T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260802-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260802T093000
DTEND:20260802T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260802-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260802T100000
DTEND:20260802T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260802-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260802T103000
DTEND:20260802T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260802-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260802T110000
DTEND:20260802T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260803-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260803T090000
DTEND:20260803T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260803-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260803T093000
DTEND:20260803T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260803-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260803T100000
DTEND:20260803T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260803-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260803T103000
DTEND:20260803T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260803-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260803T110000
DTEND:20260803T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260804-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260804T090000
DTEND:20260804T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260804-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260804T093000
DTEND:20260804T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260804-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260804T100000
DTEND:20260804T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260804-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260804T103000
DTEND:20260804T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260804-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260804T110000
DTEND:20260804T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260805-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260805T130000
DTEND:20260805T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260805-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260805T170000
DTEND:20260805T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260805-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260805T173000
DTEND:20260805T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260805-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260805T180000
DTEND:20260805T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260806-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260806T090000
DTEND:20260806T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260806-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260806T093000
DTEND:20260806T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260806-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260806T100000
DTEND:20260806T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260806-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260806T103000
DTEND:20260806T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260806-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260806T110000
DTEND:20260806T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260807-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260807T090000
DTEND:20260807T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260807-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260807T093000
DTEND:20260807T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260807-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260807T100000
DTEND:20260807T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260807-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260807T103000
DTEND:20260807T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260807-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260807T110000
DTEND:20260807T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260808-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260808T090000
DTEND:20260808T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260808-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260808T093000
DTEND:20260808T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260808-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260808T100000
DTEND:20260808T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260808-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260808T103000
DTEND:20260808T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260808-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260808T110000
DTEND:20260808T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260809-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260809T090000
DTEND:20260809T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260809-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260809T093000
DTEND:20260809T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260809-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260809T100000
DTEND:20260809T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260809-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260809T103000
DTEND:20260809T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260809-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260809T110000
DTEND:20260809T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260810-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260810T090000
DTEND:20260810T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260810-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260810T093000
DTEND:20260810T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260810-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260810T100000
DTEND:20260810T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260810-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260810T103000
DTEND:20260810T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260810-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260810T110000
DTEND:20260810T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260811-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260811T090000
DTEND:20260811T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260811-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260811T093000
DTEND:20260811T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260811-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260811T100000
DTEND:20260811T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260811-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260811T103000
DTEND:20260811T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260811-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260811T110000
DTEND:20260811T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260812-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260812T130000
DTEND:20260812T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260812-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260812T170000
DTEND:20260812T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260812-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260812T173000
DTEND:20260812T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260812-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260812T180000
DTEND:20260812T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260813-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260813T090000
DTEND:20260813T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260813-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260813T093000
DTEND:20260813T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260813-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260813T100000
DTEND:20260813T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260813-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260813T103000
DTEND:20260813T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260813-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260813T110000
DTEND:20260813T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260814-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260814T090000
DTEND:20260814T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260814-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260814T093000
DTEND:20260814T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260814-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260814T100000
DTEND:20260814T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260814-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260814T103000
DTEND:20260814T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260814-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260814T110000
DTEND:20260814T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260815-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260815T090000
DTEND:20260815T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260815-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260815T093000
DTEND:20260815T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260815-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260815T100000
DTEND:20260815T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260815-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260815T103000
DTEND:20260815T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260815-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260815T110000
DTEND:20260815T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260816-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260816T090000
DTEND:20260816T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260816-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260816T093000
DTEND:20260816T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260816-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260816T100000
DTEND:20260816T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260816-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260816T103000
DTEND:20260816T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260816-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260816T110000
DTEND:20260816T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260817-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260817T090000
DTEND:20260817T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260817-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260817T093000
DTEND:20260817T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260817-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260817T100000
DTEND:20260817T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260817-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260817T103000
DTEND:20260817T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260817-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260817T110000
DTEND:20260817T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260818-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260818T090000
DTEND:20260818T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260818-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260818T093000
DTEND:20260818T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260818-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260818T100000
DTEND:20260818T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260818-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260818T103000
DTEND:20260818T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260818-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260818T110000
DTEND:20260818T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260819-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260819T130000
DTEND:20260819T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260819-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260819T170000
DTEND:20260819T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260819-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260819T173000
DTEND:20260819T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260819-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260819T180000
DTEND:20260819T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260820-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260820T090000
DTEND:20260820T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260820-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260820T093000
DTEND:20260820T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260820-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260820T100000
DTEND:20260820T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260820-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260820T103000
DTEND:20260820T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260820-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260820T110000
DTEND:20260820T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260821-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260821T090000
DTEND:20260821T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260821-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260821T093000
DTEND:20260821T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260821-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260821T100000
DTEND:20260821T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260821-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260821T103000
DTEND:20260821T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260821-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260821T110000
DTEND:20260821T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260822-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260822T090000
DTEND:20260822T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260822-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260822T093000
DTEND:20260822T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260822-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260822T100000
DTEND:20260822T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260822-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260822T103000
DTEND:20260822T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260822-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260822T110000
DTEND:20260822T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260823-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260823T090000
DTEND:20260823T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260823-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260823T093000
DTEND:20260823T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260823-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260823T100000
DTEND:20260823T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260823-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260823T103000
DTEND:20260823T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260823-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260823T110000
DTEND:20260823T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260824-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260824T090000
DTEND:20260824T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260824-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260824T093000
DTEND:20260824T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260824-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260824T100000
DTEND:20260824T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260824-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260824T103000
DTEND:20260824T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260824-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260824T110000
DTEND:20260824T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260825-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260825T090000
DTEND:20260825T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260825-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260825T093000
DTEND:20260825T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260825-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260825T100000
DTEND:20260825T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260825-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260825T103000
DTEND:20260825T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260825-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260825T110000
DTEND:20260825T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260826-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260826T130000
DTEND:20260826T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260826-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260826T170000
DTEND:20260826T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260826-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260826T173000
DTEND:20260826T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260826-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260826T180000
DTEND:20260826T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260827-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260827T090000
DTEND:20260827T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260827-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260827T093000
DTEND:20260827T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260827-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260827T100000
DTEND:20260827T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260827-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260827T103000
DTEND:20260827T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260827-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260827T110000
DTEND:20260827T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260828-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260828T090000
DTEND:20260828T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260828-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260828T093000
DTEND:20260828T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260828-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260828T100000
DTEND:20260828T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260828-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260828T103000
DTEND:20260828T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260828-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260828T110000
DTEND:20260828T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260829-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260829T090000
DTEND:20260829T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260829-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260829T093000
DTEND:20260829T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260829-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260829T100000
DTEND:20260829T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260829-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260829T103000
DTEND:20260829T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260829-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260829T110000
DTEND:20260829T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260830-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260830T090000
DTEND:20260830T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260830-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260830T093000
DTEND:20260830T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260830-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260830T100000
DTEND:20260830T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260830-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260830T103000
DTEND:20260830T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260830-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260830T110000
DTEND:20260830T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260831-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260831T090000
DTEND:20260831T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260831-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260831T093000
DTEND:20260831T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260831-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260831T100000
DTEND:20260831T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260831-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260831T103000
DTEND:20260831T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260831-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260831T110000
DTEND:20260831T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260901-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260901T090000
DTEND:20260901T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260901-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260901T093000
DTEND:20260901T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260901-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260901T100000
DTEND:20260901T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260901-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260901T103000
DTEND:20260901T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260901-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260901T110000
DTEND:20260901T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260902-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260902T130000
DTEND:20260902T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260902-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260902T170000
DTEND:20260902T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260902-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260902T173000
DTEND:20260902T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260902-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260902T180000
DTEND:20260902T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260903-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260903T090000
DTEND:20260903T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260903-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260903T093000
DTEND:20260903T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260903-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260903T100000
DTEND:20260903T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260903-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260903T103000
DTEND:20260903T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260903-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260903T110000
DTEND:20260903T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260904-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260904T090000
DTEND:20260904T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260904-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260904T093000
DTEND:20260904T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260904-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260904T100000
DTEND:20260904T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260904-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260904T103000
DTEND:20260904T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260904-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260904T110000
DTEND:20260904T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260905-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260905T090000
DTEND:20260905T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260905-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260905T093000
DTEND:20260905T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260905-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260905T100000
DTEND:20260905T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260905-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260905T103000
DTEND:20260905T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260905-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260905T110000
DTEND:20260905T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260906-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260906T090000
DTEND:20260906T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260906-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260906T093000
DTEND:20260906T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260906-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260906T100000
DTEND:20260906T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260906-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260906T103000
DTEND:20260906T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260906-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260906T110000
DTEND:20260906T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260907-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260907T090000
DTEND:20260907T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260907-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260907T093000
DTEND:20260907T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260907-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260907T100000
DTEND:20260907T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260907-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260907T103000
DTEND:20260907T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260907-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260907T110000
DTEND:20260907T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260908-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260908T090000
DTEND:20260908T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260908-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260908T093000
DTEND:20260908T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260908-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260908T100000
DTEND:20260908T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260908-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260908T103000
DTEND:20260908T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260908-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260908T110000
DTEND:20260908T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260909-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260909T130000
DTEND:20260909T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260909-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260909T170000
DTEND:20260909T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260909-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260909T173000
DTEND:20260909T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260909-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260909T180000
DTEND:20260909T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260910-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260910T090000
DTEND:20260910T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260910-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260910T093000
DTEND:20260910T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260910-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260910T100000
DTEND:20260910T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260910-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260910T103000
DTEND:20260910T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260910-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260910T110000
DTEND:20260910T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260911-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260911T090000
DTEND:20260911T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260911-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260911T093000
DTEND:20260911T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260911-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260911T100000
DTEND:20260911T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260911-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260911T103000
DTEND:20260911T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260911-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260911T110000
DTEND:20260911T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260912-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260912T090000
DTEND:20260912T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260912-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260912T093000
DTEND:20260912T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260912-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260912T100000
DTEND:20260912T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260912-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260912T103000
DTEND:20260912T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260912-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260912T110000
DTEND:20260912T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260913-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260913T090000
DTEND:20260913T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260913-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260913T093000
DTEND:20260913T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260913-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260913T100000
DTEND:20260913T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260913-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260913T103000
DTEND:20260913T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260913-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260913T110000
DTEND:20260913T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260914-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260914T090000
DTEND:20260914T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260914-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260914T093000
DTEND:20260914T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260914-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260914T100000
DTEND:20260914T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260914-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260914T103000
DTEND:20260914T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260914-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260914T110000
DTEND:20260914T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260915-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260915T090000
DTEND:20260915T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260915-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260915T093000
DTEND:20260915T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260915-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260915T100000
DTEND:20260915T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260915-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260915T103000
DTEND:20260915T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260915-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260915T110000
DTEND:20260915T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260916-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260916T130000
DTEND:20260916T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260916-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260916T170000
DTEND:20260916T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260916-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260916T173000
DTEND:20260916T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260916-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260916T180000
DTEND:20260916T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260917-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260917T090000
DTEND:20260917T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260917-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260917T093000
DTEND:20260917T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260917-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260917T100000
DTEND:20260917T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260917-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260917T103000
DTEND:20260917T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260917-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260917T110000
DTEND:20260917T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260918-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260918T090000
DTEND:20260918T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260918-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260918T093000
DTEND:20260918T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260918-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260918T100000
DTEND:20260918T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260918-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260918T103000
DTEND:20260918T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260918-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260918T110000
DTEND:20260918T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260919-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260919T090000
DTEND:20260919T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260919-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260919T093000
DTEND:20260919T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260919-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260919T100000
DTEND:20260919T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260919-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260919T103000
DTEND:20260919T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260919-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260919T110000
DTEND:20260919T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260920-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260920T090000
DTEND:20260920T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260920-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260920T093000
DTEND:20260920T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260920-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260920T100000
DTEND:20260920T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260920-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260920T103000
DTEND:20260920T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260920-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260920T110000
DTEND:20260920T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260921-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260921T090000
DTEND:20260921T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260921-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260921T093000
DTEND:20260921T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260921-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260921T100000
DTEND:20260921T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260921-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260921T103000
DTEND:20260921T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260921-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260921T110000
DTEND:20260921T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260922-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260922T090000
DTEND:20260922T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260922-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260922T093000
DTEND:20260922T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260922-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260922T100000
DTEND:20260922T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260922-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260922T103000
DTEND:20260922T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260922-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260922T110000
DTEND:20260922T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260923-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260923T130000
DTEND:20260923T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260923-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260923T170000
DTEND:20260923T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260923-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260923T173000
DTEND:20260923T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260923-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260923T180000
DTEND:20260923T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260924-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260924T090000
DTEND:20260924T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260924-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260924T093000
DTEND:20260924T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260924-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260924T100000
DTEND:20260924T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260924-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260924T103000
DTEND:20260924T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260924-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260924T110000
DTEND:20260924T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260925-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260925T090000
DTEND:20260925T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260925-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260925T093000
DTEND:20260925T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260925-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260925T100000
DTEND:20260925T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260925-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260925T103000
DTEND:20260925T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260925-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260925T110000
DTEND:20260925T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260926-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260926T090000
DTEND:20260926T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260926-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260926T093000
DTEND:20260926T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260926-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260926T100000
DTEND:20260926T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260926-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260926T103000
DTEND:20260926T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260926-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260926T110000
DTEND:20260926T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260927-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260927T090000
DTEND:20260927T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260927-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260927T093000
DTEND:20260927T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260927-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260927T100000
DTEND:20260927T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260927-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260927T103000
DTEND:20260927T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260927-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260927T110000
DTEND:20260927T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260928-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260928T090000
DTEND:20260928T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260928-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260928T093000
DTEND:20260928T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260928-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260928T100000
DTEND:20260928T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260928-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260928T103000
DTEND:20260928T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260928-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260928T110000
DTEND:20260928T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20260929-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260929T090000
DTEND:20260929T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20260929-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260929T093000
DTEND:20260929T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20260929-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260929T100000
DTEND:20260929T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20260929-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260929T103000
DTEND:20260929T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20260929-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260929T110000
DTEND:20260929T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20260930-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260930T130000
DTEND:20260930T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20260930-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260930T170000
DTEND:20260930T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20260930-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260930T173000
DTEND:20260930T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20260930-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20260930T180000
DTEND:20260930T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261001-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261001T090000
DTEND:20261001T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261001-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261001T093000
DTEND:20261001T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261001-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261001T100000
DTEND:20261001T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261001-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261001T103000
DTEND:20261001T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261001-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261001T110000
DTEND:20261001T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261002-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261002T090000
DTEND:20261002T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261002-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261002T093000
DTEND:20261002T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261002-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261002T100000
DTEND:20261002T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261002-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261002T103000
DTEND:20261002T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261002-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261002T110000
DTEND:20261002T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261003-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261003T090000
DTEND:20261003T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261003-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261003T093000
DTEND:20261003T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261003-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261003T100000
DTEND:20261003T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261003-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261003T103000
DTEND:20261003T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261003-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261003T110000
DTEND:20261003T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261004-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261004T090000
DTEND:20261004T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261004-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261004T093000
DTEND:20261004T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261004-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261004T100000
DTEND:20261004T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261004-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261004T103000
DTEND:20261004T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261004-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261004T110000
DTEND:20261004T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261005-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261005T090000
DTEND:20261005T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261005-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261005T093000
DTEND:20261005T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261005-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261005T100000
DTEND:20261005T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261005-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261005T103000
DTEND:20261005T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261005-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261005T110000
DTEND:20261005T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261006-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261006T090000
DTEND:20261006T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261006-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261006T093000
DTEND:20261006T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261006-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261006T100000
DTEND:20261006T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261006-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261006T103000
DTEND:20261006T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261006-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261006T110000
DTEND:20261006T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261007-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261007T130000
DTEND:20261007T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261007-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261007T170000
DTEND:20261007T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261007-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261007T173000
DTEND:20261007T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261007-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261007T180000
DTEND:20261007T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261008-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261008T090000
DTEND:20261008T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261008-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261008T093000
DTEND:20261008T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261008-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261008T100000
DTEND:20261008T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261008-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261008T103000
DTEND:20261008T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261008-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261008T110000
DTEND:20261008T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261009-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261009T090000
DTEND:20261009T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261009-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261009T093000
DTEND:20261009T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261009-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261009T100000
DTEND:20261009T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261009-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261009T103000
DTEND:20261009T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261009-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261009T110000
DTEND:20261009T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261010-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261010T090000
DTEND:20261010T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261010-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261010T093000
DTEND:20261010T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261010-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261010T100000
DTEND:20261010T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261010-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261010T103000
DTEND:20261010T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261010-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261010T110000
DTEND:20261010T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261011-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261011T090000
DTEND:20261011T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261011-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261011T093000
DTEND:20261011T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261011-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261011T100000
DTEND:20261011T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261011-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261011T103000
DTEND:20261011T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261011-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261011T110000
DTEND:20261011T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261012-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261012T090000
DTEND:20261012T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261012-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261012T093000
DTEND:20261012T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261012-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261012T100000
DTEND:20261012T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261012-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261012T103000
DTEND:20261012T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261012-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261012T110000
DTEND:20261012T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261013-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261013T090000
DTEND:20261013T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261013-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261013T093000
DTEND:20261013T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261013-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261013T100000
DTEND:20261013T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261013-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261013T103000
DTEND:20261013T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261013-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261013T110000
DTEND:20261013T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261014-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261014T130000
DTEND:20261014T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261014-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261014T170000
DTEND:20261014T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261014-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261014T173000
DTEND:20261014T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261014-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261014T180000
DTEND:20261014T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261015-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261015T090000
DTEND:20261015T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261015-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261015T093000
DTEND:20261015T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261015-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261015T100000
DTEND:20261015T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261015-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261015T103000
DTEND:20261015T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261015-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261015T110000
DTEND:20261015T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261016-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261016T090000
DTEND:20261016T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261016-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261016T093000
DTEND:20261016T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261016-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261016T100000
DTEND:20261016T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261016-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261016T103000
DTEND:20261016T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261016-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261016T110000
DTEND:20261016T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261017-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261017T090000
DTEND:20261017T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261017-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261017T093000
DTEND:20261017T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261017-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261017T100000
DTEND:20261017T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261017-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261017T103000
DTEND:20261017T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261017-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261017T110000
DTEND:20261017T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261018-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261018T090000
DTEND:20261018T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261018-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261018T093000
DTEND:20261018T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261018-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261018T100000
DTEND:20261018T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261018-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261018T103000
DTEND:20261018T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261018-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261018T110000
DTEND:20261018T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261019-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261019T090000
DTEND:20261019T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261019-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261019T093000
DTEND:20261019T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261019-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261019T100000
DTEND:20261019T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261019-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261019T103000
DTEND:20261019T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261019-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261019T110000
DTEND:20261019T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261020-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261020T090000
DTEND:20261020T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261020-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261020T093000
DTEND:20261020T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261020-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261020T100000
DTEND:20261020T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261020-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261020T103000
DTEND:20261020T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261020-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261020T110000
DTEND:20261020T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261021-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261021T130000
DTEND:20261021T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261021-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261021T170000
DTEND:20261021T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261021-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261021T173000
DTEND:20261021T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261021-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261021T180000
DTEND:20261021T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261022-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261022T090000
DTEND:20261022T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261022-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261022T093000
DTEND:20261022T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261022-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261022T100000
DTEND:20261022T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261022-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261022T103000
DTEND:20261022T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261022-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261022T110000
DTEND:20261022T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261023-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261023T090000
DTEND:20261023T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261023-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261023T093000
DTEND:20261023T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261023-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261023T100000
DTEND:20261023T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261023-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261023T103000
DTEND:20261023T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261023-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261023T110000
DTEND:20261023T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261024-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261024T090000
DTEND:20261024T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261024-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261024T093000
DTEND:20261024T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261024-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261024T100000
DTEND:20261024T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261024-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261024T103000
DTEND:20261024T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261024-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261024T110000
DTEND:20261024T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261025-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261025T090000
DTEND:20261025T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261025-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261025T093000
DTEND:20261025T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261025-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261025T100000
DTEND:20261025T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261025-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261025T103000
DTEND:20261025T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261025-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261025T110000
DTEND:20261025T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261026-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261026T090000
DTEND:20261026T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261026-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261026T093000
DTEND:20261026T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261026-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261026T100000
DTEND:20261026T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261026-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261026T103000
DTEND:20261026T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261026-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261026T110000
DTEND:20261026T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261027-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261027T090000
DTEND:20261027T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261027-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261027T093000
DTEND:20261027T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261027-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261027T100000
DTEND:20261027T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261027-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261027T103000
DTEND:20261027T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261027-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261027T110000
DTEND:20261027T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261028-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261028T130000
DTEND:20261028T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261028-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261028T170000
DTEND:20261028T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261028-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261028T173000
DTEND:20261028T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261028-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261028T180000
DTEND:20261028T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261029-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261029T090000
DTEND:20261029T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261029-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261029T093000
DTEND:20261029T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261029-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261029T100000
DTEND:20261029T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261029-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261029T103000
DTEND:20261029T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261029-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261029T110000
DTEND:20261029T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261030-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261030T090000
DTEND:20261030T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261030-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261030T093000
DTEND:20261030T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261030-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261030T100000
DTEND:20261030T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261030-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261030T103000
DTEND:20261030T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261030-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261030T110000
DTEND:20261030T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261031-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261031T090000
DTEND:20261031T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261031-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261031T093000
DTEND:20261031T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261031-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261031T100000
DTEND:20261031T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261031-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261031T103000
DTEND:20261031T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261031-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261031T110000
DTEND:20261031T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261101-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261101T090000
DTEND:20261101T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261101-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261101T093000
DTEND:20261101T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261101-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261101T100000
DTEND:20261101T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261101-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261101T103000
DTEND:20261101T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261101-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261101T110000
DTEND:20261101T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261102-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261102T090000
DTEND:20261102T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261102-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261102T093000
DTEND:20261102T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261102-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261102T100000
DTEND:20261102T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261102-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261102T103000
DTEND:20261102T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261102-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261102T110000
DTEND:20261102T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261103-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261103T090000
DTEND:20261103T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261103-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261103T093000
DTEND:20261103T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261103-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261103T100000
DTEND:20261103T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261103-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261103T103000
DTEND:20261103T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261103-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261103T110000
DTEND:20261103T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261104-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261104T130000
DTEND:20261104T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261104-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261104T170000
DTEND:20261104T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261104-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261104T173000
DTEND:20261104T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261104-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261104T180000
DTEND:20261104T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261105-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261105T090000
DTEND:20261105T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261105-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261105T093000
DTEND:20261105T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261105-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261105T100000
DTEND:20261105T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261105-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261105T103000
DTEND:20261105T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261105-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261105T110000
DTEND:20261105T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261106-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261106T090000
DTEND:20261106T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261106-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261106T093000
DTEND:20261106T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261106-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261106T100000
DTEND:20261106T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261106-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261106T103000
DTEND:20261106T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261106-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261106T110000
DTEND:20261106T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261107-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261107T090000
DTEND:20261107T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261107-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261107T093000
DTEND:20261107T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261107-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261107T100000
DTEND:20261107T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261107-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261107T103000
DTEND:20261107T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261107-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261107T110000
DTEND:20261107T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261108-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261108T090000
DTEND:20261108T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261108-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261108T093000
DTEND:20261108T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261108-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261108T100000
DTEND:20261108T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261108-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261108T103000
DTEND:20261108T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261108-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261108T110000
DTEND:20261108T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261109-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261109T090000
DTEND:20261109T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261109-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261109T093000
DTEND:20261109T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261109-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261109T100000
DTEND:20261109T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261109-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261109T103000
DTEND:20261109T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261109-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261109T110000
DTEND:20261109T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261110-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261110T090000
DTEND:20261110T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261110-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261110T093000
DTEND:20261110T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261110-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261110T100000
DTEND:20261110T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261110-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261110T103000
DTEND:20261110T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261110-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261110T110000
DTEND:20261110T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261111-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261111T130000
DTEND:20261111T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261111-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261111T170000
DTEND:20261111T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261111-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261111T173000
DTEND:20261111T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261111-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261111T180000
DTEND:20261111T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261112-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261112T090000
DTEND:20261112T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261112-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261112T093000
DTEND:20261112T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261112-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261112T100000
DTEND:20261112T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261112-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261112T103000
DTEND:20261112T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261112-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261112T110000
DTEND:20261112T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261113-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261113T090000
DTEND:20261113T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261113-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261113T093000
DTEND:20261113T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261113-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261113T100000
DTEND:20261113T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261113-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261113T103000
DTEND:20261113T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261113-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261113T110000
DTEND:20261113T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261114-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261114T090000
DTEND:20261114T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261114-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261114T093000
DTEND:20261114T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261114-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261114T100000
DTEND:20261114T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261114-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261114T103000
DTEND:20261114T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261114-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261114T110000
DTEND:20261114T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261115-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261115T090000
DTEND:20261115T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261115-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261115T093000
DTEND:20261115T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261115-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261115T100000
DTEND:20261115T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261115-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261115T103000
DTEND:20261115T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261115-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261115T110000
DTEND:20261115T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261116-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261116T090000
DTEND:20261116T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261116-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261116T093000
DTEND:20261116T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261116-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261116T100000
DTEND:20261116T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261116-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261116T103000
DTEND:20261116T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261116-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261116T110000
DTEND:20261116T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261117-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261117T090000
DTEND:20261117T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261117-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261117T093000
DTEND:20261117T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261117-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261117T100000
DTEND:20261117T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261117-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261117T103000
DTEND:20261117T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261117-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261117T110000
DTEND:20261117T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261118-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261118T130000
DTEND:20261118T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261118-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261118T170000
DTEND:20261118T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261118-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261118T173000
DTEND:20261118T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261118-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261118T180000
DTEND:20261118T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261119-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261119T090000
DTEND:20261119T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261119-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261119T093000
DTEND:20261119T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261119-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261119T100000
DTEND:20261119T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261119-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261119T103000
DTEND:20261119T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261119-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261119T110000
DTEND:20261119T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261120-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261120T090000
DTEND:20261120T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261120-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261120T093000
DTEND:20261120T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261120-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261120T100000
DTEND:20261120T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261120-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261120T103000
DTEND:20261120T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261120-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261120T110000
DTEND:20261120T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261121-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261121T090000
DTEND:20261121T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261121-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261121T093000
DTEND:20261121T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261121-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261121T100000
DTEND:20261121T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261121-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261121T103000
DTEND:20261121T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261121-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261121T110000
DTEND:20261121T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261122-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261122T090000
DTEND:20261122T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261122-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261122T093000
DTEND:20261122T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261122-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261122T100000
DTEND:20261122T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261122-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261122T103000
DTEND:20261122T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261122-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261122T110000
DTEND:20261122T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261123-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261123T090000
DTEND:20261123T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261123-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261123T093000
DTEND:20261123T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261123-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261123T100000
DTEND:20261123T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261123-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261123T103000
DTEND:20261123T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261123-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261123T110000
DTEND:20261123T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261124-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261124T090000
DTEND:20261124T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261124-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261124T093000
DTEND:20261124T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261124-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261124T100000
DTEND:20261124T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261124-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261124T103000
DTEND:20261124T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261124-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261124T110000
DTEND:20261124T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261125-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261125T130000
DTEND:20261125T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261125-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261125T170000
DTEND:20261125T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261125-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261125T173000
DTEND:20261125T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261125-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261125T180000
DTEND:20261125T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261126-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261126T090000
DTEND:20261126T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261126-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261126T093000
DTEND:20261126T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261126-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261126T100000
DTEND:20261126T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261126-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261126T103000
DTEND:20261126T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261126-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261126T110000
DTEND:20261126T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261127-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261127T090000
DTEND:20261127T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261127-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261127T093000
DTEND:20261127T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261127-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261127T100000
DTEND:20261127T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261127-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261127T103000
DTEND:20261127T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261127-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261127T110000
DTEND:20261127T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261128-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261128T090000
DTEND:20261128T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261128-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261128T093000
DTEND:20261128T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261128-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261128T100000
DTEND:20261128T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261128-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261128T103000
DTEND:20261128T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261128-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261128T110000
DTEND:20261128T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261129-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261129T090000
DTEND:20261129T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261129-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261129T093000
DTEND:20261129T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261129-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261129T100000
DTEND:20261129T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261129-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261129T103000
DTEND:20261129T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261129-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261129T110000
DTEND:20261129T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261130-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261130T090000
DTEND:20261130T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261130-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261130T093000
DTEND:20261130T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261130-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261130T100000
DTEND:20261130T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261130-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261130T103000
DTEND:20261130T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261130-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261130T110000
DTEND:20261130T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261201-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261201T090000
DTEND:20261201T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261201-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261201T093000
DTEND:20261201T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261201-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261201T100000
DTEND:20261201T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261201-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261201T103000
DTEND:20261201T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261201-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261201T110000
DTEND:20261201T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261202-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261202T130000
DTEND:20261202T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261202-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261202T170000
DTEND:20261202T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261202-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261202T173000
DTEND:20261202T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261202-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261202T180000
DTEND:20261202T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261203-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261203T090000
DTEND:20261203T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261203-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261203T093000
DTEND:20261203T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261203-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261203T100000
DTEND:20261203T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261203-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261203T103000
DTEND:20261203T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261203-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261203T110000
DTEND:20261203T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261204-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261204T090000
DTEND:20261204T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261204-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261204T093000
DTEND:20261204T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261204-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261204T100000
DTEND:20261204T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261204-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261204T103000
DTEND:20261204T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261204-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261204T110000
DTEND:20261204T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261205-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261205T090000
DTEND:20261205T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261205-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261205T093000
DTEND:20261205T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261205-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261205T100000
DTEND:20261205T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261205-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261205T103000
DTEND:20261205T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261205-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261205T110000
DTEND:20261205T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261206-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261206T090000
DTEND:20261206T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261206-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261206T093000
DTEND:20261206T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261206-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261206T100000
DTEND:20261206T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261206-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261206T103000
DTEND:20261206T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261206-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261206T110000
DTEND:20261206T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261207-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261207T090000
DTEND:20261207T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261207-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261207T093000
DTEND:20261207T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261207-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261207T100000
DTEND:20261207T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261207-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261207T103000
DTEND:20261207T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261207-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261207T110000
DTEND:20261207T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261208-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261208T090000
DTEND:20261208T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261208-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261208T093000
DTEND:20261208T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261208-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261208T100000
DTEND:20261208T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261208-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261208T103000
DTEND:20261208T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261208-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261208T110000
DTEND:20261208T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261209-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261209T130000
DTEND:20261209T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261209-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261209T170000
DTEND:20261209T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261209-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261209T173000
DTEND:20261209T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261209-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261209T180000
DTEND:20261209T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261210-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261210T090000
DTEND:20261210T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261210-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261210T093000
DTEND:20261210T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261210-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261210T100000
DTEND:20261210T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261210-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261210T103000
DTEND:20261210T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261210-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261210T110000
DTEND:20261210T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261211-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261211T090000
DTEND:20261211T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261211-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261211T093000
DTEND:20261211T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261211-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261211T100000
DTEND:20261211T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261211-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261211T103000
DTEND:20261211T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261211-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261211T110000
DTEND:20261211T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261212-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261212T090000
DTEND:20261212T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261212-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261212T093000
DTEND:20261212T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261212-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261212T100000
DTEND:20261212T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261212-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261212T103000
DTEND:20261212T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261212-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261212T110000
DTEND:20261212T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261213-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261213T090000
DTEND:20261213T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261213-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261213T093000
DTEND:20261213T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261213-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261213T100000
DTEND:20261213T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261213-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261213T103000
DTEND:20261213T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261213-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261213T110000
DTEND:20261213T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261214-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261214T090000
DTEND:20261214T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261214-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261214T093000
DTEND:20261214T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261214-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261214T100000
DTEND:20261214T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261214-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261214T103000
DTEND:20261214T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261214-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261214T110000
DTEND:20261214T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261215-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261215T090000
DTEND:20261215T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261215-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261215T093000
DTEND:20261215T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261215-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261215T100000
DTEND:20261215T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261215-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261215T103000
DTEND:20261215T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261215-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261215T110000
DTEND:20261215T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261216-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261216T130000
DTEND:20261216T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261216-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261216T170000
DTEND:20261216T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261216-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261216T173000
DTEND:20261216T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261216-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261216T180000
DTEND:20261216T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261217-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261217T090000
DTEND:20261217T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261217-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261217T093000
DTEND:20261217T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261217-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261217T100000
DTEND:20261217T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261217-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261217T103000
DTEND:20261217T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261217-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261217T110000
DTEND:20261217T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261218-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261218T090000
DTEND:20261218T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261218-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261218T093000
DTEND:20261218T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261218-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261218T100000
DTEND:20261218T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261218-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261218T103000
DTEND:20261218T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261218-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261218T110000
DTEND:20261218T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261219-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261219T090000
DTEND:20261219T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261219-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261219T093000
DTEND:20261219T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261219-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261219T100000
DTEND:20261219T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261219-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261219T103000
DTEND:20261219T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261219-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261219T110000
DTEND:20261219T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261220-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261220T090000
DTEND:20261220T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261220-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261220T093000
DTEND:20261220T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261220-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261220T100000
DTEND:20261220T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261220-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261220T103000
DTEND:20261220T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261220-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261220T110000
DTEND:20261220T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261221-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261221T090000
DTEND:20261221T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261221-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261221T093000
DTEND:20261221T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261221-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261221T100000
DTEND:20261221T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261221-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261221T103000
DTEND:20261221T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261221-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261221T110000
DTEND:20261221T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261222-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261222T090000
DTEND:20261222T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261222-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261222T093000
DTEND:20261222T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261222-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261222T100000
DTEND:20261222T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261222-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261222T103000
DTEND:20261222T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261222-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261222T110000
DTEND:20261222T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261223-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261223T130000
DTEND:20261223T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261223-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261223T170000
DTEND:20261223T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261223-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261223T173000
DTEND:20261223T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261223-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261223T180000
DTEND:20261223T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261224-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261224T090000
DTEND:20261224T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261224-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261224T093000
DTEND:20261224T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261224-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261224T100000
DTEND:20261224T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261224-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261224T103000
DTEND:20261224T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261224-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261224T110000
DTEND:20261224T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261225-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261225T090000
DTEND:20261225T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261225-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261225T093000
DTEND:20261225T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261225-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261225T100000
DTEND:20261225T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261225-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261225T103000
DTEND:20261225T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261225-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261225T110000
DTEND:20261225T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261226-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261226T090000
DTEND:20261226T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261226-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261226T093000
DTEND:20261226T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261226-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261226T100000
DTEND:20261226T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261226-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261226T103000
DTEND:20261226T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261226-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261226T110000
DTEND:20261226T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261227-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261227T090000
DTEND:20261227T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261227-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261227T093000
DTEND:20261227T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261227-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261227T100000
DTEND:20261227T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261227-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261227T103000
DTEND:20261227T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261227-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261227T110000
DTEND:20261227T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261228-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261228T090000
DTEND:20261228T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261228-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261228T093000
DTEND:20261228T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261228-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261228T100000
DTEND:20261228T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261228-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261228T103000
DTEND:20261228T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261228-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261228T110000
DTEND:20261228T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261229-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261229T090000
DTEND:20261229T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261229-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261229T093000
DTEND:20261229T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261229-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261229T100000
DTEND:20261229T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261229-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261229T103000
DTEND:20261229T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261229-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261229T110000
DTEND:20261229T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-work-20261230-130000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261230T130000
DTEND:20261230T170000
SUMMARY:Work schedule (1-5 PM)
END:VEVENT
BEGIN:VEVENT
UID:language-echelon-20261230-170000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261230T170000
DTEND:20261230T173000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-japanese-20261230-173000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261230T173000
DTEND:20261230T180000
SUMMARY:Japanese
END:VEVENT
BEGIN:VEVENT
UID:language-spanish-20261230-180000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261230T180000
DTEND:20261230T183000
SUMMARY:Spanish
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20261231-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261231T090000
DTEND:20261231T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20261231-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261231T093000
DTEND:20261231T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20261231-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261231T100000
DTEND:20261231T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20261231-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261231T103000
DTEND:20261231T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20261231-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20261231T110000
DTEND:20261231T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20270101-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20270101T090000
DTEND:20270101T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20270101-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20270101T093000
DTEND:20270101T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20270101-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20270101T100000
DTEND:20270101T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20270101-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20270101T103000
DTEND:20270101T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20270101-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20270101T110000
DTEND:20270101T113000
SUMMARY:Persian
END:VEVENT
BEGIN:VEVENT
UID:language-korean-20270102-090000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20270102T090000
DTEND:20270102T093000
SUMMARY:Korean
END:VEVENT
BEGIN:VEVENT
UID:language-french-20270102-093000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20270102T093000
DTEND:20270102T100000
SUMMARY:French
END:VEVENT
BEGIN:VEVENT
UID:language-russian-20270102-100000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20270102T100000
DTEND:20270102T103000
SUMMARY:Russian
END:VEVENT
BEGIN:VEVENT
UID:language-chinese-20270102-103000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20270102T103000
DTEND:20270102T110000
SUMMARY:Chinese
END:VEVENT
BEGIN:VEVENT
UID:language-persian-20270102-110000@weekly-planner
DTSTAMP:20260107T042951Z
DTSTART:20270102T110000
DTEND:20270102T113000
SUMMARY:Persian
END:VEVENT
END:VCALENDAR
`
  };
  // EMBEDDED_ICS_END

  const pad2 = (n)=> String(n).padStart(2, "0");
  const formatDateKey = (date)=> `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
  const formatTimeKey = (date)=> `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  const makeEventId = ()=>{
    if(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"){
      return crypto.randomUUID();
    }
    return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };
  const normalizeEventRecord = (ev)=>{
    let changed = false;
    if(!ev || typeof ev !== "object") return { record: null, changed: true };
    const title = normalizeTitle(ev.title || "");
    if(!title || /^\[object\s/i.test(title)) return { record: null, changed: true };
    const rawDate = typeof ev.date === "string" ? ev.date : "";
    const rawTime = typeof ev.time === "string" ? ev.time : "";
    let startValue = ev.start;
    if(!startValue && rawDate){
      startValue = rawTime ? `${rawDate}T${rawTime}` : `${rawDate}T00:00:00`;
      changed = true;
    }
    const startDate = startValue ? new Date(startValue) : null;
    if(!startDate || isNaN(startDate)) return { record: null, changed: true };
    let endDate = ev.end ? new Date(ev.end) : null;
    if(!endDate || isNaN(endDate)){
      endDate = rawTime ? new Date(startDate.getTime() + 60 * 60000) : new Date(startDate);
      changed = true;
    }
    const hasExplicitTime = typeof ev.time === "string" && ev.time.trim() !== "";
    let allDay = typeof ev.allDay === "boolean" ? ev.allDay : !hasExplicitTime;
    let time = hasExplicitTime ? rawTime : "";
    if(!hasExplicitTime && !allDay){
      time = formatTimeKey(startDate);
      changed = true;
    }
    if(allDay && time){
      time = "";
      changed = true;
    }
    const date = formatDateKey(startDate);
    const color = CAL_EVENT_COLORS.includes(ev.color) ? ev.color : "indigo";
    if(color !== ev.color) changed = true;
    const reminders = Array.isArray(ev.reminders)
      ? ev.reminders.map(Number).filter(Number.isFinite)
      : [];
    if(!Array.isArray(ev.reminders)) changed = true;
    const notified = Array.isArray(ev.notified_reminders)
      ? ev.notified_reminders.map(Number).filter(Number.isFinite)
      : [];
    if(!Array.isArray(ev.notified_reminders)) changed = true;
    const id = typeof ev.id === "string" && ev.id ? ev.id : makeEventId();
    if(id !== ev.id) changed = true;
    const url = typeof ev.url === "string" ? ev.url : "";
    if(url !== ev.url) changed = true;
    const description = normalizeTitle(ev.description || "");
    if(description !== (ev.description || "")) changed = true;
    const recurrence = typeof ev.recurrence === "string" ? ev.recurrence : "";
    if(recurrence !== (ev.recurrence || "")) changed = true;
    const recurrence_until = typeof ev.recurrence_until === "string" ? ev.recurrence_until : "";
    if(recurrence_until !== (ev.recurrence_until || "")) changed = true;
    const seriesId = typeof ev.seriesId === "string" ? ev.seriesId : "";
    if(seriesId !== (ev.seriesId || "")) changed = true;
    return {
      record: {
        id,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        allDay,
        title,
        description,
        url,
        date,
        time,
        color,
        reminders,
        notified_reminders: notified,
        recurrence,
        recurrence_until,
        seriesId
      },
      changed
    };
  };
  let currentWeek = startOfWeek(new Date());
  let plannerViewMode = "class";
  let panel = null;
  let classTermFilter = "all";
  let classCourses = [];
  let selectedCourseId = null;
  let isRenderingPlanner = false; // prevent nested renders triggered by event saves
  const RPG_KEY="planner_v3_rpg";
  const MOOD_STATE_KEY="planner_v3_mood_energy";
  const DEFAULT_ASSIGNMENT_WINDOW_DAYS = 10;
  const rpgTitles = [
    { level:1, title:"Notebook Novice" },
    { level:2, title:"Keyboard Cadet" },
    { level:3, title:"Hash Function Wizard" },
    { level:4, title:"Cache Scout" },
    { level:5, title:"Forensics Gremlin" },
    { level:6, title:"Stack Explorer" },
    { level:7, title:"Pomodoro Demon" },
    { level:8, title:"Packet Mapper" },
    { level:9, title:"Terminal Tinkerer" },
    { level:10, title:"Week 10 Scholar" },
    { level:11, title:"Kernel Conjurer" },
    { level:12, title:"Systems Sage" },
    { level:13, title:"API Wrangler" },
    { level:14, title:"Breakpoint Sleuth" },
    { level:15, title:"Cipher Runner" },
    { level:16, title:"Query Alchemist" },
    { level:17, title:"Sprint Sprinter" },
    { level:18, title:"Memory Mapper" },
    { level:19, title:"Parallel Planner" },
    { level:20, title:"Latency Slayer" },
    { level:21, title:"Thread Whisperer" },
    { level:22, title:"Schedule Samurai" },
    { level:23, title:"Repo Ranger" },
    { level:24, title:"Branch Bard" },
    { level:25, title:"Sync Sorcerer" },
    { level:26, title:"Buildsmith" },
    { level:27, title:"Deadline Duelist" },
    { level:28, title:"Task Cartographer" },
    { level:29, title:"Cron Captain" },
    { level:30, title:"Focus Vanguard" },
    { level:31, title:"Heuristic Hunter" },
    { level:32, title:"Feature Forger" },
    { level:33, title:"Regression Guard" },
    { level:34, title:"Dataset Diver" },
    { level:35, title:"Signal Spotter" },
    { level:36, title:"Protocol Paladin" },
    { level:37, title:"Uptime Guardian" },
    { level:38, title:"Latent Lorekeeper" },
    { level:39, title:"Insight Illuminator" },
    { level:40, title:"Habit Herald" },
    { level:41, title:"Routine Ronin" },
    { level:42, title:"Study Strategist" },
    { level:43, title:"Iteration Illusionist" },
    { level:44, title:"Velocity Virtuoso" },
    { level:45, title:"Domain Dreamer" },
    { level:46, title:"Arcane Architect" },
    { level:47, title:"Blueprint Baron" },
    { level:48, title:"Cognitive Captain" },
    { level:49, title:"Execution Envoy" },
    { level:50, title:"Priorities Pharaoh" },
    { level:51, title:"Flowstate Finder" },
    { level:52, title:"Resilience Ranger" },
    { level:53, title:"Tempo Tactician" },
    { level:54, title:"Context Commander" },
    { level:55, title:"Milestone Mystic" },
    { level:56, title:"Scope Sentinel" },
    { level:57, title:"Boundary Breaker" },
    { level:58, title:"Deep Work Druid" },
    { level:59, title:"Academic Arcanist" },
    { level:60, title:"Planning Paragon" },
    { level:61, title:"Feedback Falcon" },
    { level:62, title:"Signal Scribe" },
    { level:63, title:"Alignment Adept" },
    { level:64, title:"Momentum Marshal" },
    { level:65, title:"Reliability Regent" },
    { level:66, title:"Review Raconteur" },
    { level:67, title:"Energy Engineer" },
    { level:68, title:"Stability Steward" },
    { level:69, title:"Precision Paladin" },
    { level:70, title:"Insight Inquisitor" },
    { level:71, title:"Delivery Dragon" },
    { level:72, title:"Triage Titan" },
    { level:73, title:"Outcome Oracle" },
    { level:74, title:"Craft Conductor" },
    { level:75, title:"Sprint Sage" },
    { level:76, title:"Ritual Regent" },
    { level:77, title:"Focused Firebrand" },
    { level:78, title:"Cadence Conjurer" },
    { level:79, title:"Schedule Sage Supreme" },
    { level:80, title:"Strategy Seer" },
    { level:81, title:"Timeline Tactician" },
    { level:82, title:"Resilience Revenant" },
    { level:83, title:"Productivity Paladin" },
    { level:84, title:"Systematic Seeker" },
    { level:85, title:"Efficiency Envoy" },
    { level:86, title:"Clarity Champion" },
    { level:87, title:"Apex Planner" },
    { level:88, title:"Summit Scholar" },
    { level:89, title:"Pinnacle Pathfinder" },
    { level:90, title:"Zenith Zealot" },
    { level:91, title:"Aurora Analyst" },
    { level:92, title:"Nebula Navigator" },
    { level:93, title:"Galaxy Guardian" },
    { level:94, title:"Cosmos Cartographer" },
    { level:95, title:"Quantum Quartermaster" },
    { level:96, title:"Stellar Strategist" },
    { level:97, title:"Nova Nomad" },
    { level:98, title:"Eclipse Executor" },
    { level:99, title:"Horizon Herald" },
    { level:100, title:"Ascendant Architect" }
  ];
  const storyStages = [
    { name:"Boot Camp Operative", desc:"HQ just pulled you into the cyber-forensics division. Run drills and keep your scanners sharp." },
    { name:"Signal Tracer", desc:"You're tracing hostile packets across campus networks. Every checklist gives you new fingerprints." },
    { name:"Forensics Detective", desc:"Advanced cases land on your desk. Triage evidence and stay ahead of the breach." },
    { name:"Incident Commander", desc:"You're coordinating takedowns. Keep the intel synced and the team briefed." },
    { name:"Cyber Guardian", desc:"You run the entire task force. Keep the whole board green to unlock the next saga." }
  ];
  const integrationScripts = {
    newTab: "Set your browser's new-tab page to show the task list so idle browsing triggers a mini review.",
    calendar: "Automate .ics exports on Sunday so every device calendar mirrors this planner.",
    voice: "Create a voice shortcut like \"start focus timer\" that launches Pomodoro hands-free.",
    email: "Schedule a 7am email summary with your top three priorities to start the day aligned.",
    widget: "Add a home-screen widget that shows habit streaks; it keeps you accountable the moment you unlock your phone."
  };
  const reflectionPrompts = [
    "What did you handle this week that would've derailed you last month?",
    "Where did you feel the most focused flow, and what triggered it?",
    "What friction showed up repeatedly? How can next week's plan reduce it?",
    "How did your energy trend across the week compared to your expectations?",
    "Which habit win are you proudest of and why?"
  ];
  function xpForLevel(level){
    return 100 + (level-1)*80;
  }
  function parseICSFeed(raw=""){
    const text = String(raw||"");
    const clean = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
    if(!clean.includes("BEGIN:VEVENT")) return [];
    const blocks = clean.split(/BEGIN:VEVENT/).slice(1).map(b=>"BEGIN:VEVENT"+b.split(/END:VEVENT/)[0]+"END:VEVENT");
    const events = [];
    blocks.forEach(block=>{
      const lines = block.split(/\r?\n/).filter(Boolean);
      let start = null;
      let summary = "";
      let description = "";
      let url = "";
      lines.forEach(line=>{
        if(line.startsWith("DTSTART")){
          const val = line.split(":").slice(1).join(":").trim();
          const clean = val.replace(/[^0-9T]/g,"").replace("T","");
          if(clean.length>=8){
            const y = +clean.slice(0,4), m=+clean.slice(4,6)-1, d=+clean.slice(6,8);
            start = new Date(y,m,d,0,0,0,0).toISOString();
          }
        } else if(line.startsWith("SUMMARY")){
          summary = line.split(":").slice(1).join(":").trim();
        } else if(line.startsWith("DESCRIPTION")){
          description = line.split(":").slice(1).join(":").trim();
        } else if(line.startsWith("URL")){
          url = line.split(":").slice(1).join(":").trim();
        }
      });
      if(start && summary){
        events.push({
          start,
          end: start,
          allDay: true,
          title: summary,
          description,
          url
        });
      }
    });
    return events;
  }

  function loadEvents(){
    const sanitize = (list)=>{
      const cleaned = [];
      let changed = false;
      (Array.isArray(list) ? list : []).forEach(ev=>{
        const normalized = normalizeEventRecord(ev);
        if(!normalized.record){ changed = true; return; }
        if(normalized.changed) changed = true;
        cleaned.push(normalized.record);
      });
      return { cleaned, changed };
    };
    try{
      const raw = localStorage.getItem(CAL_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const { cleaned, changed } = sanitize(parsed);
      if(changed){
        try{ localStorage.setItem(CAL_KEY, JSON.stringify(cleaned)); }catch(e){}
      }
      return cleaned;
    }catch(e){
      return [];
    }
  }

  function saveEvents(evts){
    try{
      const cleaned = [];
      (Array.isArray(evts) ? evts : []).forEach(ev=>{
        const normalized = normalizeEventRecord(ev);
        if(normalized.record) cleaned.push(normalized.record);
      });
      localStorage.setItem(CAL_KEY, JSON.stringify(cleaned));
    }catch(e){}
    buildClassData();
    if(plannerViewMode==="class") render();
  }
  function loadRPG(){
    const raw = hasStorage ? localStorage.getItem(RPG_KEY) : null;
    if(!raw) return { level:1, xp:0 };
    try{
      const parsed = JSON.parse(raw);
      if(parsed && typeof parsed.level==="number" && typeof parsed.xp==="number"){
        return parsed;
      }
    }catch(e){}
    return { level:1, xp:0 };
  }
  function loadMoodEnergy(){
    if(!hasStorage) return { mood:"neutral", energy:"medium" };
    try{
      const raw = localStorage.getItem(MOOD_STATE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if(parsed && parsed.mood && parsed.energy) return parsed;
    }catch(e){}
    return { mood:"neutral", energy:"medium" };
  }
  function saveMoodEnergy(state){
    if(hasStorage) localStorage.setItem(MOOD_STATE_KEY, JSON.stringify(state));
  }
  function saveRPG(state){
    if(hasStorage) localStorage.setItem(RPG_KEY, JSON.stringify(state));
  }
  function addXP(amount){
    rpgState.xp = Math.max(0, rpgState.xp + amount);
    let needed = xpForLevel(rpgState.level);
    while(rpgState.xp >= needed){
      rpgState.xp -= needed;
      rpgState.level += 1;
      needed = xpForLevel(rpgState.level);
      showToast(`Level up! Now level ${rpgState.level} - ${getRpgTitle(rpgState.level)}.`, "success");
    }
    saveRPG(rpgState);
    renderRpgHUD();
    updateStoryModeCard();
  }
  function getRpgTitle(level){
    let title = "Learner";
    rpgTitles.forEach(t=>{ if(level>=t.level) title = t.title; });
    return title;
  }

  function deepCopy(x){ return JSON.parse(JSON.stringify(x)); }
  function loadData(){ if(!hasStorage) return deepCopy(sample); try{ const s = JSON.parse(localStorage.getItem(S_KEY)); if(s && typeof s==="object") return s; }catch{} return deepCopy(sample); }
  function saveData(d){ if(hasStorage) localStorage.setItem(S_KEY, JSON.stringify(d)); }
  function loadMood(){ if(!hasStorage) return {}; try{ const m = JSON.parse(localStorage.getItem(M_KEY)); if(m && typeof m==="object") return m; }catch{} return {}; }
  function saveMood(m){ if(hasStorage) localStorage.setItem(M_KEY, JSON.stringify(m)); }
  function loadJournal(){ if(!hasStorage) return []; try{ const j = JSON.parse(localStorage.getItem(J_KEY)); return Array.isArray(j)?j:[]; }catch(e){ return []; } }
  function saveJournal(list){ if(hasStorage) localStorage.setItem(J_KEY, JSON.stringify(list)); }
  function loadNotes(){ if(!hasStorage) return []; try{ const n = JSON.parse(localStorage.getItem(NOTES_KEY)); return Array.isArray(n)?n:[]; }catch(e){ return []; } }
  function saveNotes(list){ if(hasStorage) localStorage.setItem(NOTES_KEY, JSON.stringify(list)); }
  function loadHabits(){ if(!hasStorage) return null; try{ const h = JSON.parse(localStorage.getItem("habits-data")); return Array.isArray(h)?h:null; }catch(e){ return null; } }
  function saveHabits(list){ if(hasStorage) localStorage.setItem("habits-data", JSON.stringify(list)); }
  function loadDailyStreak(){
    if(!hasStorage) return { current:0, best:0, lastVisit:null };
    try{
      const raw = JSON.parse(localStorage.getItem(DAILY_STREAK_KEY));
      if(raw && typeof raw === "object"){
        return {
          current: Number(raw.current) || 0,
          best: Number(raw.best) || 0,
          lastVisit: typeof raw.lastVisit === "string" ? raw.lastVisit : null
        };
      }
    }catch(e){}
    return { current:0, best:0, lastVisit:null };
  }
  function saveDailyStreak(state){
    if(!hasStorage) return;
    try{
      localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify(state || { current:0, best:0, lastVisit:null }));
    }catch(e){}
  }
  // Detect non-ASCII/garbled chars so we can ignore corrupted entries
  function isGarbled(str=""){ return /[^\x00-\x7F]/.test(str); }
  function sanitizePlannerData(d){
    const cleaned = deepCopy(sample);
    let garbled = false;
    plannerDayOrder.forEach(day=>{
      const arr = Array.isArray(d?.[day]) ? d[day] : [];
      cleaned[day] = arr.map(entry=>{
       // if(isGarbled(entry)) { garbled = true; return "X, "; }
        return typeof entry === "string" ? entry : String(entry||"");
      });
    });
    return { cleaned, garbled };
  }
  function loadHabitHistory(){
    if(!hasStorage) return {};
    try{
      const raw = JSON.parse(localStorage.getItem(HABIT_HISTORY_KEY));
      if(raw && typeof raw === "object"){
        const normalized = {};
        Object.keys(raw).forEach(k=>{
          if(Array.isArray(raw[k])){
            normalized[k] = raw[k].filter(v=>typeof v==="string");
          }
        });
        return normalized;
      }
    }catch(e){}
    return {};
  }
  function saveHabitHistory(){
    if(!hasStorage) return;
    localStorage.setItem(HABIT_HISTORY_KEY, JSON.stringify(habitHistory));
  }
  // Load stored integration toggle preferences.
  function loadIntegrationPrefs(){
    if(!hasStorage) return {};
    try{
      const raw = JSON.parse(localStorage.getItem(INTEGRATION_KEY));
      return raw && typeof raw === "object" ? raw : {};
    }catch(e){
      return {};
    }
  }
  // Persist integration toggle preferences.
  function saveIntegrationPrefs(){
    if(!hasStorage) return;
    localStorage.setItem(INTEGRATION_KEY, JSON.stringify(integrationPrefs));
  }
  // Load saved weekly reflection state (text, timestamp, prompt index).
function loadReflectionState(){
  if(!hasStorage) return { text:"", savedAt:null, promptIndex:0 };
  try{
    const raw = JSON.parse(localStorage.getItem(REFLECTION_KEY));
    if(raw && typeof raw === "object"){
        return {
          text: raw.text || "",
          savedAt: raw.savedAt || null,
          promptIndex: typeof raw.promptIndex === "number" ? raw.promptIndex : 0
        };
      }
    }catch(e){}
    return { text:"", savedAt:null, promptIndex:0 };
}
// Persist weekly reflection state.
function saveReflectionState(){
  if(!hasStorage) return;
  localStorage.setItem(REFLECTION_KEY, JSON.stringify(reflectionState));
}
// Load/save reflection log history.
function loadReflectionLog(){
  if(!hasStorage) return [];
  try{
    const raw = JSON.parse(localStorage.getItem(REFLECTION_LOG_KEY));
    if(Array.isArray(raw)){
      return raw
        .filter(e=>e && typeof e.text==="string")
        .map(e=>({ text:e.text, savedAt:e.savedAt || new Date().toISOString(), source:e.source || "manual" }));
    }
  }catch(e){}
  return [];
}
function saveReflectionLog(){
  if(!hasStorage) return;
  try{
    localStorage.setItem(REFLECTION_LOG_KEY, JSON.stringify(reflectionLog));
  }catch(e){}
}
  function loadStreakFreeze(){
    if(!hasStorage) return { charges:0, used:[], lastUsed:null };
    try{
      const raw = JSON.parse(localStorage.getItem(STREAK_FREEZE_KEY));
      if(raw && typeof raw === "object"){
        return {
          charges: Number(raw.charges)||0,
          used: Array.isArray(raw.used)? raw.used.filter(v=>typeof v==="string") : [],
          lastUsed: raw.lastUsed || null
        };
      }
    }catch(e){}
    return { charges:0, used:[], lastUsed:null };
  }
  function saveStreakFreeze(){
    if(!hasStorage) return;
    localStorage.setItem(STREAK_FREEZE_KEY, JSON.stringify(streakFreeze));
  }
  function getFreezeSet(){
    const set = new Set();
    (streakFreeze.used||[]).forEach(d=>set.add(d));
    return set;
  }
  function formatHabitDate(date){
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${year}-${month}-${day}`;
  }
  function getHabitWeekStart(date=new Date()){
    const d = new Date(date);
    const raw = d.getDay();
    const offset = raw === 0 ? -6 : 1 - raw;
    d.setDate(d.getDate() + offset);
    d.setHours(0,0,0,0);
    return d;
  }
  function getHabitWeekKeySunday(){
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - d.getDay());
    return formatHabitDate(d);
  }
  function getHabitMonthKey(){
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(1);
    const year = d.getFullYear();
    const month = String(d.getMonth()+1).padStart(2,"0");
    return `${year}-${month}`;
  }
  function getHabitDateForDay(dayIdx){
    const weekStart = getHabitWeekStart();
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIdx);
    return d;
  }
  // Return raw completion dates for a habit (without streak freeze days).
  function getHabitHistoryRawSet(habitId){
    const list = habitHistory[habitId] || [];
    return new Set(list);
  }
  function getHabitHistorySet(habitId){
    const merged = getHabitHistoryRawSet(habitId);
    getFreezeSet().forEach(d=>merged.add(d));
    return merged;
  }
  function trimHabitHistory(habitId){
    const list = habitHistory[habitId] || [];
    if(!list.length) return;
    const cutoff = new Date();
    cutoff.setHours(0,0,0,0);
    cutoff.setDate(cutoff.getDate() - HABIT_HISTORY_RETENTION_DAYS);
    habitHistory[habitId] = list.filter(entry => {
      const entryDate = new Date(entry);
      return entryDate >= cutoff;
    }).sort();
  }
  function recordHabitCompletion(habitId, dayDate, completed){
    if(!habitId || !dayDate) return;
    const key = formatHabitDate(dayDate);
    const rawSet = getHabitHistoryRawSet(habitId);
    const beforeSet = getHabitHistorySet(habitId);
    const beforeCurrent = calculateConsecutiveDays(new Set(beforeSet));
    const beforeBest = calculateBestStreak(new Set(beforeSet));
    if(completed){
      rawSet.add(key);
    } else {
      rawSet.delete(key);
    }
    habitHistory[habitId] = Array.from(rawSet).sort();
    trimHabitHistory(habitId);
    if(!habitHistory[habitId].length){
      delete habitHistory[habitId];
    }
    const afterSet = getHabitHistorySet(habitId);
    const afterCurrent = calculateConsecutiveDays(new Set(afterSet));
    const afterBest = calculateBestStreak(new Set(afterSet));
    if(completed){
      launchConfetti();
      maybeCelebrateStreak(beforeCurrent, afterCurrent, beforeBest, afterBest);
    }
    saveHabitHistory();
    updateHabitStreakPanel();
    updateStreakFreezeBar();
  }
  function calculateConsecutiveDays(set, anchor=new Date()){
    let count = 0;
    const cursor = new Date(anchor);
    cursor.setHours(0,0,0,0);
    while(true){
      const key = formatHabitDate(cursor);
      if(!set.has(key)) break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }
  function calculateBestStreak(set){
    if(!set.size) return 0;
    const dates = Array.from(set).map(v => new Date(v));
    dates.sort((a,b)=>a-b);
    let best = 1;
    let current = 1;
    for(let i=1;i<dates.length;i++){
      const diff = Math.round((dates[i] - dates[i-1]) / 86400000);
      if(diff === 1){
        current += 1;
      } else if(diff === 0){
        continue;
      } else {
        current = 1;
      }
      best = Math.max(best, current);
    }
    return best;
  }
  function getSundayStart(date=new Date()){
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0,0,0,0);
    return d;
  }
  function calculatePerfectWeekStreak(completions){
    const set = new Set(completions);
    let streak = 0;
    let reference = getSundayStart();
    while(true){
      let weekPerfect = true;
      for(let i=0;i<7;i++){
        const day = new Date(reference);
        day.setDate(reference.getDate() + i);
        if(!set.has(formatHabitDate(day))){
          weekPerfect = false;
          break;
        }
      }
      if(!weekPerfect) break;
      streak++;
      reference.setDate(reference.getDate() - 7);
    }
    return streak;
  }
  function updateHabitStreakPanel(){
    if(!habitStreakPanel) return;
    const completions = new Set();
    Object.values(habitHistory).forEach(list=>{ list.forEach(entry=>completions.add(entry)); });
    getFreezeSet().forEach(date=>completions.add(date));
    const sunday = getSundayStart();
    const dayLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    habitStreakPanel.innerHTML = "";
    const dayRow = document.createElement("div");
    dayRow.className = "habit-streak-days";
    dayLabels.forEach((label, idx)=>{
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + idx);
      const done = completions.has(formatHabitDate(day));
      const dayEl = document.createElement("div");
      dayEl.className = `habit-streak-day${done ? " on" : ""}`;
      dayEl.innerHTML = `<span class="day-label">${label}</span><span class="fire-icon">${done ? "??" : "??"}</span>`;
      dayRow.append(dayEl);
    });
    const perfect = calculatePerfectWeekStreak(completions);
    const info = document.createElement("div");
    info.className = "habit-streak-info";
    info.textContent = `Perfect streak: ${perfect} week${perfect === 1 ? "" : "s"}`;
    habitStreakPanel.append(dayRow, info);
  }
  function updateStreakFreezeBar(){
    if(!streakFreezeBar) return;
    if(freezeCountEl) freezeCountEl.textContent = `${streakFreeze.charges||0} stocked`;
    if(freezeUseBtn) freezeUseBtn.disabled = (streakFreeze.charges||0) <= 0;
    if(freezeNoteEl){
      const last = streakFreeze.lastUsed ? `Last used: ${streakFreeze.lastUsed}` : "Buy a freeze to protect one missed day.";
      freezeNoteEl.textContent = last;
    }
    updateStoryModeCard();
  }
  function updateDailyStreakUI(note){
    const current = Math.max(0, dailyStreakState.current || 0);
    const best = Math.max(0, dailyStreakState.best || 0);
    const defaultNote = hasStorage
      ? `Back tomorrow for +${DAILY_STREAK_REWARD} XP.`
      : "Browser storage is blocked; streak won't persist after this tab.";
    const displayNote = note || defaultNote;
    if(dailyStreakCountEl) dailyStreakCountEl.textContent = current;
    if(dailyStreakBestEl) dailyStreakBestEl.textContent = best;
    if(dailyStreakNoteEl) dailyStreakNoteEl.textContent = displayNote;
    if(levelStreakCountEl) levelStreakCountEl.textContent = current;
    if(levelStreakBestEl) levelStreakBestEl.textContent = best;
    if(levelStreakNoteEl) levelStreakNoteEl.textContent = displayNote;
  }
  function recordDailyCheckIn(){
    const today = new Date();
    const todayKey = formatHabitDate(today);
    if(dailyStreakState.lastVisit === todayKey){
      updateDailyStreakUI(`Check-in logged. Today's +${DAILY_STREAK_REWARD} XP is already banked.`);
      return;
    }
    const isWinterBreak = (d)=>{
      const m = d.getMonth(); // 0=Jan, 11=Dec
      const day = d.getDate();
      return (m === 11 && day >= 12) || (m === 0 && day <= 12);
    };
    const isSummerBreak = (d)=>{
      const m = d.getMonth(); // June=5, July=6
      return m === 5 || m === 6;
    };
    const lastKey = dailyStreakState.lastVisit;
    let continued = true;
    if(lastKey){
      const lastDate = new Date(lastKey);
      const diffDays = Math.floor((today - lastDate)/86400000);
      const withinBreak = isWinterBreak(today) || isWinterBreak(lastDate) || isSummerBreak(today) || isSummerBreak(lastDate);
      if(diffDays > 1 && !withinBreak){
        const best = Math.max(Number(dailyStreakState.best)||0, 7);
        const askRestore = window.confirm(`You missed a few days. Restore your streak to your best (${best}d) instead of resetting?`);
        if(askRestore){
          dailyStreakState.current = best;
          dailyStreakState.lastVisit = todayKey;
          dailyStreakState.best = Math.max(dailyStreakState.best || 0, best);
          saveDailyStreak(dailyStreakState);
          updateDailyStreakUI(`Streak restored to ${best} days.`);
          addXP(DAILY_STREAK_REWARD);
          showToast(`Restored streak (${best}d) and added daily check-in XP.`);
          return;
        }else{
          continued = false;
        }
      }else{
        continued = diffDays <= 1 || withinBreak;
      }
    }
    dailyStreakState.current = continued ? Math.max(1, (dailyStreakState.current || 0) + 1) : 1;
    dailyStreakState.lastVisit = todayKey;
    dailyStreakState.best = Math.max(dailyStreakState.best || 0, dailyStreakState.current);
    saveDailyStreak(dailyStreakState);
    updateDailyStreakUI(continued ? `Streak extended. Back tomorrow to lock another +${DAILY_STREAK_REWARD} XP.` : `Fresh streak started today. +${DAILY_STREAK_REWARD} XP locked in.`);
    addXP(DAILY_STREAK_REWARD);
    showToast(`Daily check-in +${DAILY_STREAK_REWARD} XP (streak ${dailyStreakState.current}d)`);
  }

  function exportDailyStreak(){
    const payload = {
      current: Number(dailyStreakState.current)||0,
      best: Number(dailyStreakState.best)||0,
      lastVisit: dailyStreakState.lastVisit || null,
      exportedAt: new Date().toISOString(),
      version: "v1"
    };
    downloadBlob(JSON.stringify(payload,null,2), "daily-streak-backup.json", "application/json;charset=utf-8");
    showToast("Streak exported");
  }
  function importDailyStreak(obj){
    if(!obj || typeof obj !== "object") throw new Error("Invalid streak file");
    dailyStreakState = {
      current: Number(obj.current)||0,
      best: Number(obj.best)||0,
      lastVisit: typeof obj.lastVisit === "string" ? obj.lastVisit : null
    };
    saveDailyStreak(dailyStreakState);
    updateDailyStreakUI("Streak restored from file.");
    showToast("Streak restored");
  }
  function shouldOfferFreezeOnExit(){
    const todayKey = formatHabitDate(new Date());
    const alreadyUsed = (streakFreeze.used||[]).includes(todayKey);
    return hasStorage && (streakFreeze.charges||0) > 0 && dailyStreakState.lastVisit !== todayKey && !alreadyUsed;
  }
  function attachExitFreezePrompt(){
    const handler = (e)=>{
      if(!shouldOfferFreezeOnExit()) return;
      const msg = "Use a streak freeze to cover today before you leave?";
      const useIt = window.confirm(msg);
      if(useIt){
        useStreakFreeze(new Date());
        return;
      }
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
  }

  function useStreakFreeze(targetDate=new Date()){
    if((streakFreeze.charges||0) <= 0) return false;
    const key = formatHabitDate(targetDate);
    if(streakFreeze.used && streakFreeze.used.includes(key)) return false;
    streakFreeze.charges = Math.max(0, (streakFreeze.charges||0) - 1);
    streakFreeze.used = Array.from(new Set([...(streakFreeze.used||[]), key]));
    streakFreeze.lastUsed = key;
    saveStreakFreeze();
    updateStreakFreezeBar();
    updateHabitStreakPanel();
    return true;
  }
  function getHabitStreakInfo(habitId){
    const set = getHabitHistorySet(habitId);
    return {
      current: calculateConsecutiveDays(set),
      best: calculateBestStreak(set)
    };
  }
  function renderHabitHistoryDots(habitId){
    const container = document.createElement("div");
    container.className = "habit-history";
    const set = getHabitHistorySet(habitId);
    const today = new Date();
    today.setHours(0,0,0,0);
    for(let offset=6; offset>=0; offset--){
      const day = new Date(today);
      day.setDate(day.getDate() - offset);
      const key = formatHabitDate(day);
      const span = document.createElement("span");
      span.className = `habit-history-day${set.has(key) ? " on" : ""}`;
      span.title = `${key}`;
      container.append(span);
    }
    return container;
  }
  function importScheduleFrom(payload){
    if(!payload || typeof payload !== "object") return false;
    const source = (payload.schedule && typeof payload.schedule === "object") ? payload.schedule : payload;
    let changed = false;
    const next = deepCopy(sample);
    plannerDayOrder.forEach(day=>{
      if(Array.isArray(source[day])){
        next[day] = source[day].map(entry => typeof entry === "string" ? entry : String(entry ?? ""));
        changed = true;
      }
    });
    if(!changed) return false;
    data = next;
    saveData(data);
    render();
    return true;
  }

  let data = loadData();
  const legacySampleMarker = "1-4 AM: Discussion Posts (Pomodoro)";
  if(Array.isArray(data?.Monday) && data.Monday.includes(legacySampleMarker)){
    data = deepCopy(sample);
    saveData(data);
  }
  const { cleaned, garbled } = sanitizePlannerData(data);
  if(garbled){
    data = cleaned;
    saveData(data);
  }
  let mood = loadMood();
  let editMode = hasStorage ? (localStorage.getItem(E_KEY) === "1") : true;
  let moodEntries = loadJournal();
  let notesData = loadNotes();
  const loadedHabits = loadHabits();
  let habitsState = (loadedHabits && Array.isArray(loadedHabits) ? loadedHabits : defaultHabits).map(normalizeHabit);
  (function backfillRemovedHabits(){
    const names = [
      "Calligraphy",
      "Embroidery",
      "Sewing",
      "Video editing",
      "Pyrography",
      "Calligraphy", // keep both spellings; dedupe below
      "Gregg Shorthand",
      "Guitar",
      "Violin",
      "Drums",
      "Coding",
      "Stenography on Keyboard",
      "Writing coaching",
      "Stretching"
    ];
    const existing = new Set(habitsState.map(h=> (h.name||"").trim().toLowerCase()));
    names.forEach(name=>{
      const key = name.trim().toLowerCase();
      if(!key || existing.has(key)) return;
      habitsState.push(normalizeHabit({ name, cat:"study", type:"normal", target:7 }));
      existing.add(key);
    });
    saveHabits(habitsState);
  })();
  (function ensureBreakIdeasHabit(){
    const targetName = "Break ideas";
    const targetKey = targetName.trim().toLowerCase();
    const exists = habitsState.some(h=> (h.name||"").trim().toLowerCase() === targetKey);
    if(exists) return;
    habitsState.push(normalizeHabit({ name: targetName, cat:"exercise", type:"normal", target:7 }));
    saveHabits(habitsState);
  })();
let roadmapState = loadRoadmap();
let skillProgressState = loadSkillProgress();
let coachState = loadCoachState();
  let streakFreeze = loadStreakFreeze();
  let integrationPrefs = loadIntegrationPrefs();
  let reflectionState = loadReflectionState();
  let reflectionLog = loadReflectionLog();
  let currentReflectionPrompt = typeof reflectionState.promptIndex === "number" ? reflectionState.promptIndex : 0;
  let habitHistory = loadHabitHistory();
  let dailyStreakState = loadDailyStreak();
  importChoreHabitsIntoHabits();

  function importChoreHabitsIntoHabits(){
    if(!habitsState) habitsState = [];
    if(!hasStorage) return;
    if(localStorage.getItem(CHORE_IMPORT_DONE_KEY)==="1") return;
    let source = null;
    try{
      const raw = JSON.parse(localStorage.getItem(CHORE_IMPORT_KEY)||"null");
      if(raw && typeof raw==="object") source = raw;
    }catch(e){}
    if(!source){
      try{
        const legacy = JSON.parse(localStorage.getItem(LEGACY_CHORE_KEY)||"null");
        if(legacy && typeof legacy==="object"){
          source = {
            weekly: typeof legacy.weekly==="string" ? legacy.weekly.split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : [],
            monthly: [
              ...(typeof legacy.biweekly==="string" ? legacy.biweekly.split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : []),
              ...(typeof legacy.once==="string" ? legacy.once.split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : [])
            ],
            weeklyDone:{},
            monthlyDone:{}
          };
        }
      }catch(e){}
    }
    if(!source) return;
    const weekKey = getHabitWeekKeySunday();
    const monthKey = getHabitMonthKey();
    const weeklyDoneMap = source.weeklyDone && typeof source.weeklyDone==="object" ? source.weeklyDone : {};
    const monthlyDoneMap = source.monthlyDone && typeof source.monthlyDone==="object" ? source.monthlyDone : {};
    const weeklyList = Array.isArray(source.weekly) ? source.weekly : [];
    const monthlyList = Array.isArray(source.monthly) ? source.monthly : [];
    const existing = new Set(habitsState.map(h=> (h.name||"").toLowerCase()));
    const addHabit = (name, type)=>{
      if(!name) return;
      const key = name.toLowerCase();
      if(existing.has(key)) return;
      const base = {name, cat:"admin", type, target:1};
      if(type==="weekly"){
        const done = !!(weeklyDoneMap[weekKey]?.[name]);
        base.weeklyLog = { ...(source.weeklyLog||{}), [weekKey]: done };
        base.days = done ? Array(7).fill(true) : blankWeek();
      }
      if(type==="monthly"){
        const done = !!(monthlyDoneMap[monthKey]?.[name]);
        base.monthlyLog = { ...(source.monthlyLog||{}), [monthKey]: done };
        base.days = done ? Array(7).fill(true) : blankWeek();
      }
      habitsState.push(normalizeHabit(base));
      existing.add(key);
    };
    weeklyList.forEach(name=> addHabit(name, "weekly"));
    monthlyList.forEach(name=> addHabit(name, "monthly"));
    saveHabits(habitsState);
    localStorage.setItem(CHORE_IMPORT_DONE_KEY,"1");
  }
  plannerDayOrder = loadPlannerDayOrder();
  plannerDayLabels = loadPlannerDayLabels();
  let allowDayDrag = loadDayDragAllowed();
  let studyNagTimer = null;
  let workloadExtras = [];
  let celebrationTimer = null;

  function isWorkloadEntry(text=""){
    return /^\s*\[(P|D|Q|L)\]/i.test(text || "");
  }

  function extractDue(line){
    const m = /due\s+([0-9/\\-]+(?:\\s+\\d{1,2}:\\d{2}\\s*(?:AM|PM))?)/i.exec(line || "");
    if(m){
      const d = new Date(m[1]);
      if(!isNaN(d)) return d;
    }
    return null;
  }
  let rpgState = loadRPG();
  let moodEnergyState = loadMoodEnergy();
  try{
    buildClassData();
  }catch(e){
    console.error("buildClassData failed", e);
    classCourses = [];
  }
  if(!Array.isArray(habitsState)){
    habitsState = defaultHabits.map(normalizeHabit);
  } else {
    habitsState = habitsState.map(normalizeHabit);
    let hadGarbled = false;
    habitsState.forEach((h, idx)=>{
      if(isGarbled(h.name)){
        habitsState[idx].name = "Habit";
        hadGarbled = true;
      }
    });
    if(hadGarbled) saveHabits(habitsState);
  }
  if(moodEntries.length){
    let synced = false;
    moodEntries.forEach(entry=>{
      if(!notesData.some(n=>n && n.linkedId===entry.id)){
        notesData.unshift({
          id: entry.id,
          linkedId: entry.id,
          title: entry.title || entry.mood || "Mood entry",
          body: entry.text || "",
          tag: "Mood journal",
          created: entry.created || new Date().toISOString()
        });
        synced = true;
      }
    });
    if(synced) saveNotes(notesData);
  }

  const storageNote = document.getElementById("storage-note");
  storageNote.textContent = hasStorage ? "" : "Browser storage is blocked - changes last until you close this tab.";
  const toast = document.getElementById("toast");
  function showToast(msg, cls){ toast.textContent = msg; toast.className = "toast " + (cls||""); requestAnimationFrame(()=>{ toast.classList.add("show"); }); setTimeout(()=>{ toast.classList.remove("show"); }, 1200); }
  function downloadBlob(content, filename, type){
    const blob = new Blob([content],{type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chk = document.getElementById("chk-edit");
  chk.checked = !!editMode;
  chk.addEventListener("change",()=>{ editMode = chk.checked; if(hasStorage) localStorage.setItem(E_KEY, editMode ? "1":"0"); render(); });

  // Pixel the PUP snarky motivator (every 30 minutes)
  (function initPixelSnark(){
    const lines = [
      "You opened me. Now open your work tab, champ.",
      "That assignment won't write itself. Unless it's sentient. It isn't.",
      "Hydrate, posture check, then ship one thing.",
      "Scrolling is not a deliverable. Do one messy draft.",
      "If procrastination paid bills, you'd be CEO. Until then, work time.",
      "Future you left a note: stop stalling.",
      "You're cute. Your inbox isn't. Clear one email.",
      "Tiny ask: 10 minutes of real effort. Then flex.",
      "Deadlines are closer than they appear in your mirror.",
      "If you're reading this, you could be typing that doc."
    ];
    let timer = null;

    let notifyGestureSeen = false;
    const markNotifyGesture = ()=>{ notifyGestureSeen = true; document.removeEventListener("pointerdown", markNotifyGesture, true); };
    document.addEventListener("pointerdown", markNotifyGesture, true);
    const requestNotifyPermission = ()=>{
      if(!notifyGestureSeen) return;
      if(typeof Notification === "undefined") return;
      if(Notification.permission === "default"){
        try{ Notification.requestPermission(); }catch(e){}
      }
    };

    const pushNotify = (msg)=>{
      if(typeof Notification === "function" && Notification.permission === "granted"){
        try{ new Notification("Pixel the PUP", { body: msg }); return true; }catch(e){}
      }
      return false;
    };

    const fire = ()=>{
      const pick = lines[Math.floor(Math.random()*lines.length)];
      const body = `Hey this is Pixel your adorbs motivator: ${pick}`;
      if(!pushNotify(body) && typeof showToast === "function"){
        showToast(body, "warn");
      } else if(!pushNotify(body)){
        console.log(body);
      }
    };

    if(!timer){
      requestNotifyPermission();
      fire();
      timer = setInterval(fire, 30 * 60 * 1000);
    }
  })();

  const btnSave = document.getElementById("btn-save");
  btnSave.addEventListener("click",()=>{ if(!hasStorage){ showToast("Storage blocked - not saved", "warn"); return; } saveData(data); saveMood(mood); localStorage.setItem(E_KEY, editMode ? "1":"0"); showToast("Saved to browser"); });
  const plannerImportInput = document.getElementById("planner-import-file");
  const plannerImportCSV = document.getElementById("planner-import-csv");
  const plannerExportJSON = document.getElementById("planner-export-json");
  const plannerExportCSV = document.getElementById("planner-export-csv");
  const habitStreakPanel = document.getElementById("habit-streak-hub");
  const storyModeCard = document.getElementById("story-mode-card");
  const storyModeHome = storyModeCard?.parentElement || null;
  const storyModeStage = document.getElementById("story-mode-stage");
  const storyModeText = document.getElementById("story-mode-text");
  const storyModeList = document.getElementById("story-mode-list");
  const storyModeFooter = document.getElementById("story-mode-footer");
const integrationCard = document.getElementById("integration-card");
const integrationNudgeBtn = document.getElementById("integration-nudge");
const integrationNudgeText = document.getElementById("integration-nudge-text");
const integrationToggles = integrationCard ? Array.from(document.querySelectorAll("[data-integration]")) : [];
const reflectionCard = document.getElementById("reflection-card");
const reflectionPromptEl = document.getElementById("reflection-prompt");
const reflectionInput = document.getElementById("reflection-input");
const reflectionMeta = document.getElementById("reflection-meta");
const reflectionNewBtn = document.getElementById("reflection-new");
const reflectionLogEl = document.getElementById("reflection-log");
integrationNudgeBtn?.addEventListener("click",()=>{
  updateIntegrationSuggestion(true);
  showToast("Smart suggestion refreshed");
});
reflectionNewBtn?.addEventListener("click",()=>{
  updateReflectionPrompt(true);
  updateReflectionMeta();
});
// Auto-log reflection after each pomodoro cycle completion.
window.addEventListener("pomoCycleFinished",()=>{
  logReflection({ source:"pomodoro", silent:true });
});
  const streakFreezeBar = document.getElementById("streak-freeze-bar");
  const freezeCountEl = document.getElementById("freeze-count");
  const freezeNoteEl = document.getElementById("freeze-note");
  const freezeBuyBtn = document.getElementById("freeze-buy");
  const freezeUseBtn = document.getElementById("freeze-use");
  if(plannerImportInput){
    plannerImportInput.addEventListener("change",e=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = ()=>{
        try{
          const parsed = JSON.parse(String(reader.result || ""));
          if(importScheduleFrom(parsed)){
            showToast("Planner JSON imported!");
          }else{
            showToast("That file did not contain planner data.", "warn");
          }
        }catch(err){
          showToast("Invalid JSON file.", "warn");
        }
        plannerImportInput.value = "";
      };
      reader.readAsText(file);
    });
  }

  if(!panel) panel = document.getElementById("panel-planner");
  const focusTodayBtn = document.getElementById("focus-today");
  const toggleDaysBtn = document.getElementById("toggle-days");
  const dayDragToggle = document.getElementById("toggle-day-drag");
  const assignmentsBtn = null;
  const weekViewToggle = document.getElementById("planner-week-view");
  const classViewToggle = document.getElementById("planner-class-view");
  const workloadCard = null;
  const workloadList = null;
  const workloadBtn = null;
  const workloadClose = null;
  const rpgHud = document.getElementById("rpg-hud");
  const levelWellnessSlot = document.getElementById("level-wellness");
  const levelButton = document.getElementById("level-button");
  const levelPopover = document.getElementById("level-popover");
  const levelNumberEl = document.getElementById("level-number");
  const levelTitleEl = document.getElementById("level-title");
  const levelLabelEl = document.getElementById("level-label");
  const levelXpEl = document.getElementById("level-xp");
  const levelBarFill = document.getElementById("level-bar-fill");
  const levelRingTrack = document.getElementById("level-ring-track");
  const levelRingProgress = document.getElementById("level-ring-progress");
  const levelStreakCountEl = document.getElementById("level-streak-count");
  const levelStreakBestEl = document.getElementById("level-streak-best");
  const levelStreakNoteEl = document.getElementById("level-streak-note");
  const profileButton = document.getElementById("profile-button");
  const profilePopover = document.getElementById("profile-popover");
  const profileStreakPreview = document.getElementById("profile-streak-preview");
  const profileLevelPreview = document.getElementById("profile-level-preview");
  const profileGearBtn = document.getElementById("profile-gear");
  let plannerPage = "story";
  const loadPlannerPage = ()=>{
    try{
      const raw = localStorage.getItem(PLANNER_PAGE_KEY);
      if(raw === "danger") return "danger";
      if(raw === "calendar") return "calendar";
    }catch(e){}
    return "story";
  };
  const savePlannerPage = (value)=>{
    try{ localStorage.setItem(PLANNER_PAGE_KEY, value); }catch(e){}
  };
  plannerPage = loadPlannerPage();
  const dailyStreakCard = document.getElementById("daily-streak");
  const dailyStreakCountEl = document.getElementById("daily-streak-count");
  const dailyStreakBestEl = document.getElementById("daily-streak-best");
  const dailyStreakNoteEl = document.getElementById("daily-streak-note");
  const dailyStreakExportBtn = document.getElementById("daily-streak-export");
  const dailyStreakImportInput = document.getElementById("daily-streak-import-input");
  const moodSelect = document.getElementById("mood-select");
  const energySelect = document.getElementById("energy-select");
  if(levelButton && levelPopover){
    const setLevelExpanded = (on)=> levelButton.setAttribute("aria-expanded", on ? "true" : "false");
    const positionLevelPopover = ()=>{
      if(!levelButton || !levelPopover) return;
      levelPopover.style.visibility = "hidden";
      levelPopover.style.display = "block";
      const gap = 8;
      const btnRect = levelButton.getBoundingClientRect();
      const popWidth = levelPopover.offsetWidth || 260;
      const popHeight = levelPopover.offsetHeight || levelPopover.scrollHeight || 260;
      let top = btnRect.top - popHeight - gap;
      let left = btnRect.right + gap;
      if(top < 8) top = Math.min(window.innerHeight - popHeight - 8, btnRect.bottom + gap);
      if(left + popWidth > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popWidth - 8);
      top = Math.max(8, Math.min(top, window.innerHeight - popHeight - 8));
      levelPopover.style.top = `${top}px`;
      levelPopover.style.left = `${left}px`;
      levelPopover.style.visibility = "";
      levelPopover.style.display = "";
    };
    const openPopover = ()=>{
      levelButton.classList.add("show-popover");
      levelButton.parentElement?.classList.add("show-popover");
      setLevelExpanded(true);
      positionLevelPopover();
      renderWellnessIntoPopover();
      renderReflectionCard();
      placeReflectionInPlanner();
    };
    const closePopover = ()=>{ levelButton.classList.remove("show-popover"); levelButton.parentElement?.classList.remove("show-popover"); setLevelExpanded(false); };
    ["mouseenter","focus"].forEach((ev)=> levelButton.addEventListener(ev, openPopover));
    ["mouseleave","blur"].forEach((ev)=> levelButton.addEventListener(ev, closePopover));
    ["mouseenter","focusin"].forEach((ev)=> levelPopover.addEventListener(ev, openPopover));
    ["mouseleave","focusout"].forEach((ev)=> levelPopover.addEventListener(ev, closePopover));
    levelButton.addEventListener("click",(e)=>{
      e.stopPropagation();
      const open = levelButton.classList.contains("show-popover");
      if(open){ closePopover(); } else { openPopover(); }
    });
    document.addEventListener("click",(e)=>{
      if(levelButton.contains(e.target) || levelPopover.contains(e.target)) return;
      closePopover();
    });
    window.addEventListener("resize", ()=>{ if(levelButton.classList.contains("show-popover")) positionLevelPopover(); });
  }
  if(profileButton && profilePopover){
    const setProfileExpanded = (on)=> profileButton.setAttribute("aria-expanded", on ? "true" : "false");
    const positionProfilePopover = ()=>{
      profilePopover.style.visibility = "hidden";
      profilePopover.style.display = "block";
      const gap = 10;
      const btnRect = profileButton.getBoundingClientRect();
      const popWidth = profilePopover.offsetWidth || 280;
      const popHeight = profilePopover.offsetHeight || profilePopover.scrollHeight || 240;
      let left = btnRect.right + gap;
      let top = btnRect.top + (btnRect.height / 2) - (popHeight / 2);
      if(left + popWidth > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popWidth - 8);
      if(left < 8) left = 8;
      top = Math.max(8, Math.min(top, window.innerHeight - popHeight - 8));
      profilePopover.style.top = `${top}px`;
      profilePopover.style.left = `${left}px`;
      profilePopover.style.visibility = "";
      profilePopover.style.display = "";
    };
    const syncProfilePreview = ()=>{
      if(profileStreakPreview){
        const streak = levelStreakCountEl?.textContent || dailyStreakCountEl?.textContent || "0";
        profileStreakPreview.textContent = `${streak} days`;
      }
      if(profileLevelPreview){
        const label = levelLabelEl?.textContent || levelNumberEl?.textContent || "1";
        profileLevelPreview.textContent = label.toString().includes("Level") ? label : `Level ${label}`;
      }
    };
    const openPopover = ()=>{
      profileButton.parentElement?.classList.add("show-profile");
      setProfileExpanded(true);
      syncProfilePreview();
      positionProfilePopover();
    };
    const closePopover = ()=>{
      profileButton.parentElement?.classList.remove("show-profile");
      setProfileExpanded(false);
    };
    // Open/close only on click so it doesn't vanish while hovering.
    profileButton.addEventListener("click",(e)=>{
      e.stopPropagation();
      const open = profileButton.parentElement?.classList.contains("show-profile");
      if(open){ closePopover(); } else { openPopover(); }
    });
    profilePopover.addEventListener("click", e=> e.stopPropagation());
    document.addEventListener("click",(e)=>{
      if(profileButton.contains(e.target) || profilePopover.contains(e.target)) return;
      closePopover();
    });
    window.addEventListener("resize", ()=>{ if(profileButton.classList.contains("show-popover")) positionProfilePopover(); });
  }
  profileGearBtn?.addEventListener("click", ()=>{
    if(typeof window.activateTab === "function"){
      window.activateTab("tab-settings");
    }
  });
  if(dailyStreakExportBtn){
    dailyStreakExportBtn.addEventListener("click", exportDailyStreak);
  }
  if(dailyStreakImportInput){
    dailyStreakImportInput.addEventListener("change",(e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (ev)=>{
        try{
          const obj = JSON.parse(ev.target.result);
          importDailyStreak(obj);
        }catch(err){
          console.error(err);
          showToast("Invalid streak file", "err");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }
  function hideMoodEnergyControls(){
    const box = document.querySelector(".mood-energy");
    if(box) box.style.display = "none";
  }
  const plannerPanel = document.getElementById("panel-planner");
  function setPlannerWeekView(){
    plannerViewMode = "calendar";
    updatePlannerViewButtons();
    render();
    if(typeof window.activateTab === "function"){
      window.activateTab("tab-calendar");
    }
  }
  function setPlannerClassView(){
    plannerViewMode = "class";
    updatePlannerViewButtons();
    render();
  }
  window.setPlannerWeekView = setPlannerWeekView;
  window.setPlannerClassView = setPlannerClassView;
  function renderRitualCardFallback(){
    const anchor = document.querySelector(".view-controls");
    if(!anchor) return;
    let card = document.getElementById("ritual-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "ritual-card";
    card.className = "ritual-card";
    const rituals = [
      "Stack your books neatly.",
      "Close all tabs except this one & your LMS.",
      "Take 3 slow breaths and think of one reason you care about this class.",
      "Phone goes face-down in another room.",
      "Fill your water bottle before you start."
    ];
    const pick = rituals[Math.floor(Math.random()*rituals.length)];
    card.innerHTML = `<div class="smart-chip">Ritual</div><strong>${pick}</strong>`;
    anchor.parentElement.insertBefore(card, anchor.nextSibling);
  }
  // Study Plan fallback (in case module listener misses)
  function openStudyPlanFallback(){
    if(typeof openStudyPlanModal === "function"){
      openStudyPlanModal();
      return;
    }
    if(document.getElementById("study-plan-modal")) return;
    const overlay = document.createElement("div");
    overlay.id = "study-plan-modal";
    Object.assign(overlay.style, {
      position:"fixed", inset:"0", background:"rgba(0,0,0,.45)", zIndex:"230",
      display:"flex", alignItems:"center", justifyContent:"center"
    });
    const card = document.createElement("div");
    Object.assign(card.style, {
      background:"#fff", padding:"14px", borderRadius:"14px", maxWidth:"520px", width:"90%"
    });
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>Generate study plan</strong>
        <button class="btn" id="study-plan-close" type="button">Close</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-top:8px;">
        <input id="plan-exam" type="text" placeholder="Exam/Project name">
        <input id="plan-days" type="number" min="1" max="30" placeholder="Days until exam">
        <input id="plan-chapters" type="number" min="1" max="30" placeholder="Chapters/Topics">
        <input id="plan-hours" type="number" min="1" max="12" placeholder="Hours per day">
      </div>
      <button class="btn" id="plan-generate" type="button" style="margin-top:8px;">Create plan</button>
    `;
    overlay.append(card);
    document.body.append(overlay);
    card.querySelector("#study-plan-close")?.addEventListener("click", ()=> overlay.remove());
    card.querySelector("#plan-generate")?.addEventListener("click", ()=>{
      const name = card.querySelector("#plan-exam")?.value.trim() || "Exam";
      const days = Math.max(1, Math.min(30, Number(card.querySelector("#plan-days")?.value || 1)));
      const chapters = Math.max(1, Math.min(30, Number(card.querySelector("#plan-chapters")?.value || 1)));
      const hours = Math.max(1, Math.min(12, Number(card.querySelector("#plan-hours")?.value || 1)));
      if(typeof createStudyPlan === "function"){
        createStudyPlan(name, days, chapters, hours, false);
      } else {
        showToast("Study plan added (basic)", "success");
      }
      overlay.remove();
    });
  }
  // PACER fallback overlay (in case module hook misses)
  function openPacerOverlayFallback(){
    if(document.getElementById("pacer-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "pacer-overlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,.45)";
    overlay.style.zIndex = "220";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "flex-end";
    const panel = document.createElement("div");
    panel.style.width = "360px";
    panel.style.maxWidth = "90%";
    panel.style.background = "#fff";
    panel.style.padding = "12px";
    panel.style.borderRadius = "12px 0 0 12px";
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong>PACER Mode</strong>
        <button class="btn" id="pacer-close" type="button">Close</button>
      </div>
      <div class="note" style="margin:6px 0;">Capture a quick C-P-A-E-R note to review later.</div>
      <input id="pacer-quick-topic" type="text" placeholder="Topic/Reading" style="width:100%;padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;margin-top:6px;">
      <textarea id="pacer-quick-c" placeholder="What did you just learn? (C)" style="width:100%;min-height:50px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;margin-top:6px;"></textarea>
      <textarea id="pacer-quick-p" placeholder="How would you do it? (P)" style="width:100%;min-height:50px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;margin-top:6px;"></textarea>
      <textarea id="pacer-quick-a" placeholder="Analogy or silly example (A)" style="width:100%;min-height:50px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;margin-top:6px;"></textarea>
      <textarea id="pacer-quick-e" placeholder="Evidence / example (E)" style="width:100%;min-height:50px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;margin-top:6px;"></textarea>
      <input id="pacer-quick-r" type="text" placeholder="Reference (R)" style="width:100%;padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;margin-top:6px;">
      <button class="btn" id="pacer-quick-save" type="button" style="margin-top:8px;">Save PACER chunk</button>
    `;
    overlay.append(panel);
    document.body.append(overlay);
    panel.querySelector("#pacer-close")?.addEventListener("click", ()=> overlay.remove());
    panel.querySelector("#pacer-quick-save")?.addEventListener("click", ()=>{
      const topic = panel.querySelector("#pacer-quick-topic")?.value.trim() || "";
      if(!topic){ showToast("Need a topic", "warn"); return; }
      const entry = {
        id:`pacer-${Date.now()}`,
        topic,
        c: panel.querySelector("#pacer-quick-c")?.value.trim() || "",
        p: panel.querySelector("#pacer-quick-p")?.value.trim() || "",
        a: panel.querySelector("#pacer-quick-a")?.value.trim() || "",
        e: panel.querySelector("#pacer-quick-e")?.value.trim() || "",
        r: panel.querySelector("#pacer-quick-r")?.value.trim() || "",
        status:"new",
        created: Date.now(),
        nextReview: Date.now()
      };
      const pacerList = loadPacer?.() || [];
      pacerList.unshift(entry);
      if(typeof savePacer === "function") savePacer(pacerList);
      overlay.remove();
      showToast("PACER chunk saved");
    });
  }
  document.getElementById("btn-pacer-mode")?.addEventListener("click", openPacerOverlayFallback);
  document.getElementById("btn-study-plan")?.addEventListener("click", openStudyPlanFallback);
  document.getElementById("btn-rituals")?.addEventListener("click", renderRitualCardFallback);
  function placeReflectionInPlanner(){
    if(!reflectionCard) return;
    const slot = document.querySelector(".wellness-reflection-slot");
    const storySlot = document.getElementById("planner-story-page");
    if(slot && reflectionCard.parentElement !== slot){
      slot.innerHTML = "";
      slot.append(reflectionCard);
    }else if(!slot && storySlot && reflectionCard.parentElement !== storySlot){
      storySlot.append(reflectionCard);
    }else if(!slot && !storySlot && plannerPanel && reflectionCard.parentElement !== plannerPanel){
      plannerPanel.append(reflectionCard);
    }
    reflectionCard.style.display = "";
  }
  updateHabitStreakPanel();
  updateStreakFreezeBar();
  renderIntegrationToggles();
  renderReflectionCard();
  placeReflectionInPlanner();
  if(moodSelect) moodSelect.value = moodEnergyState.mood || "neutral";
  if(energySelect) energySelect.value = moodEnergyState.energy || "medium";
  hideMoodEnergyControls();
  updateDailyStreakUI();
  // Daily check-in feature removed; skip auto check-in and freeze prompts.

  const getPlannerDayCards = () => Array.from(panel ? panel.querySelectorAll(".card[data-day]") : []);
  const collapseAllDayCards = () => { getPlannerDayCards().forEach(card=>{ card.classList.add("collapsed"); }); };
  const expandAllDayCards = () => { getPlannerDayCards().forEach(card=>{ card.classList.remove("collapsed"); }); };
  const ensureWeekPlannerCards = ()=> [];
  const updateDayDragToggle = ()=>{
    if(!dayDragToggle) return;
    dayDragToggle.textContent = allowDayDrag ? "Drag days (On)" : "Drag days (Off)";
    dayDragToggle.setAttribute("aria-pressed", allowDayDrag ? "true" : "false");
    dayDragToggle.setAttribute("aria-label", allowDayDrag ? "Drag day columns enabled" : "Drag day columns disabled");
    dayDragToggle.title = allowDayDrag ? "Drag-and-drop for day columns is enabled" : "Drag-and-drop for day columns is disabled";
  };
  const updateDayToggleButton = () => {
    if(!toggleDaysBtn) return;
    const cards = getPlannerDayCards();
    const allCollapsed = cards.length ? cards.every(card=>card.classList.contains("collapsed")) : false;
    toggleDaysBtn.textContent = allCollapsed ? "Expand all" : "Collapse all";
    toggleDaysBtn.setAttribute("aria-pressed", allCollapsed ? "true" : "false");
  };
  const toggleAllDayCards = () => {
    const cards = ensureWeekPlannerCards();
    if(!cards.length) return;
    const allCollapsed = cards.length ? cards.every(card=>card.classList.contains("collapsed")) : false;
    if(allCollapsed){
      expandAllDayCards();
    }else{
      collapseAllDayCards();
    }
    updateDayToggleButton();
  };
  const focusTodayCard = () => {
    const cards = ensureWeekPlannerCards();
    if(!cards.length) return;
    const today = new Date();
    const index = (today.getDay() + 6) % 7;
    const dayName = dayOrder[index] || dayOrder[0];
    collapseAllDayCards();
    const target = panel?.querySelector(`.card[data-day="${dayName}"]`);
    if(target){
      target.classList.remove("collapsed");
      target.scrollIntoView({behavior:"smooth", block:"center"});
    }
    updateDayToggleButton();
  };
  function getDayLabel(day){
    return (plannerDayLabels && plannerDayLabels[day]) ? plannerDayLabels[day] : day;
  }
  function setDayLabel(day, label){
    const clean = (label || "").trim();
    const next = clean || day;
    const prev = getDayLabel(day);
    if(next === prev) return false;
    if(!clean || clean.toLowerCase() === day.toLowerCase()){
      delete plannerDayLabels[day];
    } else {
      plannerDayLabels[day] = next;
    }
    savePlannerDayLabels(plannerDayLabels);
    return true;
  }
  function reorderPlannerDays(fromDay, toDay){
    const fromIdx = plannerDayOrder.indexOf(fromDay);
    const toIdx = plannerDayOrder.indexOf(toDay);
    if(fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const next = [...plannerDayOrder];
    next.splice(fromIdx,1);
    next.splice(toIdx,0,fromDay);
    plannerDayOrder = next;
    savePlannerDayOrder(plannerDayOrder);
    render();
  }
  function clearDayDropTargets(){
    document.querySelectorAll(".day-drop-target").forEach(el=> el.classList.remove("day-drop-target"));
  }
  const addWeeklyAssignmentDeadlines = () => {
    const sundayDate = getUpcomingSunday();
    const dueDay = dayOrder[6];
    if(!dueDay) return;
    const dueLabel = `${sundayDate.toLocaleDateString()} 11:59 PM`;
    const targets = data[dueDay] || (data[dueDay]=[]);
   const templates = [
  { icon: "[P]", label: "Paper",           count: 3 },
  { icon: "[D]", label: "Discussion post", count: 4 },
  { icon: "[Q]", label: "Quiz",            count: 4 }
    ];
    let added = 0;
    templates.forEach(item=>{
      for(let i=0;i<item.count;i++){
        const entry = `${item.icon} ${item.label} ${i+1} - due ${dueLabel}`;
        if(!targets.includes(entry)){
          targets.push(entry);
          added++;
        }
      }
    });
    const labs = getStoredCalendarEvents().filter(ev=>/lab/i.test(ev.title || ""));
    labs.forEach(ev=>{
    const entry = `ðŸ§ª Lab: ${ev.title || "Lab"} - due ${dueLabel}`;
      if(!targets.includes(entry)){
        targets.push(entry);
        added++;
      }
    });
    if(added){
      saveData(data);
      render();
      showToast(`Added ${added} deadlines for Sunday ${sundayDate.toLocaleDateString()}.`);
    } else {
      showToast("Weekly assignment deadlines already exist.", "warn");
    }
  };

    function renderClassDashboard(){
    const iconForAssignment = (item={}, idx=0, total=0)=>{
      const title = String(item.title||item.rawTitle||"").toLowerCase();
      if(title.includes("quiz") || title.includes("exam")) return "\uD83E\uDDE0"; // brain
      if(title.includes("lab") || title.includes("sim") || title.includes("project")) return "\uD83E\uDDEA"; // dna flask
      if(title.includes("discussion") || title.includes("post")) return "\uD83D\uDCAC"; // speech bubble
      if(idx === total-1) return "\uD83C\uDFC6"; // trophy
      if(idx === Math.max(1, Math.floor(total/2))) return "\uD83C\uDF81"; // gift
      return "\u2705"; // checkmark
    };
    const formatDateLabel = (item={})=>{
      const due = new Date(item.due || Date.now());
      const dateLabel = due.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
      return `${dateLabel}${item.description ? " - " + item.description : ""}`;
    };
    const wrapper = el("div",{class:"class-dashboard"});
    const filterRow = el("div",{class:"class-filter"});
    const filters = [
      {id:"all", label:"All terms"},
      {id:"fall", label:"Fall (Aug,Dec)"},
      {id:"spring", label:"Spring (Jan,May)"},
      {id:"summer", label:"Summer (Jun,Aug)"}
    ];
    filters.forEach(f=>{
      const btn = el("button",{class:`btn${classTermFilter===f.id?" tab":""}`, type:"button", "aria-pressed":String(classTermFilter===f.id)}, f.label);
      btn.addEventListener("click",()=>{
        classTermFilter = f.id;
        render();
      });
      filterRow.append(btn);
    });
    wrapper.append(filterRow);

    const availableCourses = classCourses.filter(c=> classTermFilter==="all" || c.term===classTermFilter);
    if(selectedCourseId && !availableCourses.some(c=>c.id===selectedCourseId)){
      selectedCourseId = availableCourses[0]?.id || null;
    }

    if(!availableCourses.length){
      wrapper.append(el("div",{class:"note"},"No class data yet. Import your .ics file in the Calendar tab or reset after importing."));
      return wrapper;
    }

    const tabs = el("div",{class:"class-tabs"});
    availableCourses.forEach(course=>{
      const tabBtn = el("button",{
        class:`class-tab${course.id===selectedCourseId?" on":""}`,
        type:"button",
        "aria-pressed":String(course.id===selectedCourseId)
      }, course.id);
      tabBtn.addEventListener("click",()=>{
        selectedCourseId = course.id;
        render();
      });
      tabs.append(tabBtn);
    });
    wrapper.append(tabs);

    const selected = availableCourses.find(c=>c.id===selectedCourseId) || availableCourses[0];
    selectedCourseId = selected?.id || selectedCourseId;
    if(selected){
      const card = el("div",{class:"class-card"});
      const termLabel = selected.term ? selected.term.toUpperCase() : "TERM";
      card.append(
        el("div",{class:"class-card-head"},
          el("div",null,
            el("h3",null, selected.id),
            el("p",{class:"note"}, selected.code || "")
          ),
          el("div",{class:"class-term-pill"}, termLabel)
        )
      );
      const list = el("div",{class:"class-assignments"});
      const now = Date.now() - 86400000;
      const upcoming = (selected.entries||[]).filter(item=> new Date(item.due || Date.now()).getTime() >= now);
      const rows = (upcoming.length ? upcoming : selected.entries).slice(0,12);
      rows.forEach(item=>{
        const row = el("div",{class:"class-assignment"});
        const due = new Date(item.due || Date.now());
        row.append(
          el("div",{class:"class-assignment-title"}, item.title || item.rawTitle || "Assignment"),
          el("div",{class:"class-assignment-meta"}, `${due.toLocaleDateString()}${item.description ? " - " + item.description : ""}`)
        );
        list.append(row);
      });
      if(!rows.length){
        list.append(el("div",{class:"note"},"No assignments found for this class."));
      }
      card.append(list);
      const pathCard = el("div",{class:"class-path-card"});
      pathCard.append(
        el("div",{class:"class-path-head"},
          el("div",{class:"class-path-title"},"Weekly journey"),
          el("div",{class:"note"},"Built from your .ics import - finish the path to reveal the next week.")
        )
      );
      const path = el("div",{class:"class-path"});
      const mapItems = rows.slice(0,7);
      mapItems.forEach((item, idx)=>{
        const due = new Date(item.due || Date.now());
        const isDone = due.getTime() < Date.now();
        const isNext = !isDone && idx===0;
        const step = el("div",{class:`path-step${idx%2?" alt":""}`});
        step.append(
          el("div",{class:`path-node${isDone?" done":""}${isNext?" next":""}`}, iconForAssignment(item, idx, mapItems.length)),
          el("div",{class:"path-label"},
            el("strong",null, (item.title || item.rawTitle || "Assignment").slice(0,60)),
            el("small",null, `${formatDateLabel(item)}${isNext ? " . start this one first" : ""}`)
          )
        );
        if(idx < mapItems.length-1){
          step.append(el("span",{class:"path-connector"}));
        }
        path.append(step);
      });
      if(!mapItems.length){
        path.append(el("div",{class:"note"},"No timeline yet. Import your .ics and the path will appear here."));
      }
      pathCard.append(path);
      card.append(pathCard);
      wrapper.append(card);
    }
    return wrapper;
  }

  function updatePlannerViewButtons(){
    if(plannerViewMode==="week"){
      weekViewToggle?.setAttribute("aria-pressed","true");
      classViewToggle?.setAttribute("aria-pressed","false");
    } else {
      classViewToggle?.setAttribute("aria-pressed","true");
      weekViewToggle?.setAttribute("aria-pressed","false");
    }
  }
  function renderRpgHUD(){
    if(!rpgHud || !levelButton || !levelNumberEl) return;
    const needed = xpForLevel(rpgState.level);
    const safeNeeded = Math.max(1, needed || 1);
    const pct = Math.min(100, Math.round((rpgState.xp/safeNeeded)*100));
    const progressRatio = Math.max(0, Math.min(1, rpgState.xp/safeNeeded));
    levelNumberEl.textContent = rpgState.level;
    levelButton.setAttribute("aria-label", `Level ${rpgState.level} (${pct}% to next)`);
    if(levelTitleEl) levelTitleEl.textContent = getRpgTitle(rpgState.level);
    if(levelLabelEl) levelLabelEl.textContent = `Level ${rpgState.level}`;
    if(levelXpEl) levelXpEl.textContent = `${rpgState.xp} XP / ${safeNeeded} XP`;
    if(levelBarFill) levelBarFill.style.width = `${pct}%`;
    const radius = 17;
    const circumference = 2 * Math.PI * radius;
    const arcMax = 0.82;
    const arcLength = circumference * arcMax;
    const dash = Math.max(0, Math.min(arcLength, arcLength * progressRatio));
    const gapOffset = (circumference - arcLength)/2;
    if(levelRingTrack){
      levelRingTrack.style.strokeDasharray = `${arcLength} ${circumference}`;
      levelRingTrack.style.strokeDashoffset = `${-gapOffset}`;
    }
    if(levelRingProgress){
      levelRingProgress.style.strokeDasharray = `${dash} ${circumference}`;
      levelRingProgress.style.strokeDashoffset = `${-gapOffset}`;
    }
  }

  function renderDangerZone(){
  const zone = document.getElementById("danger-zone");
  if(!zone) return;
  zone.innerHTML = "";
  const items = getUpcomingAssignments(500);
  const bossDone = loadDangerBossDone();
  const resourceCard = el("div",{class:"danger-resource-card"},
    el("div",{class:"resource-head"},
      el("div",{class:"resource-title"},"Study boosters"),
      el("div",{class:"resource-sub"},"Free textbooks + quick citation helpers")
    ),
    el("div",{class:"resource-grid"},
      el("div",{class:"resource-pill"},
        el("div",{class:"resource-label"},"My textbooks"),
        el("p",{class:"resource-note"},"Direct links to your vitalsource + cengage shelves (login required)."),
        el("div",{class:"resource-links"},
          el("a",{class:"resource-link",href:"https://bookshelf.vitalsource.com/reader/books/9783662690079/pageid/99?context_token=bb735620-afa2-013e-1178-3e8ecb35ba3c",target:"_blank",rel:"noopener noreferrer"},"Vitalsource reader"),
          el("a",{class:"resource-link",href:"https://www.cengage.com/dashboard/home",target:"_blank",rel:"noopener noreferrer"},"Cengage dashboard")
        )
      ),
      el("div",{class:"resource-pill"},
        el("div",{class:"resource-label"},"Essay citations"),
        el("p",{class:"resource-note"},"Drop a URL/title, export MLA/APA/BibTeX."),
        el("div",{class:"resource-links"},
          el("a",{class:"resource-link",href:"https://zbib.org",target:"_blank",rel:"noopener noreferrer"},"Zbib (Zotero)"),
          el("a",{class:"resource-link",href:"https://www.citethisforme.com",target:"_blank",rel:"noopener noreferrer"},"Cite This For Me"),
          el("a",{class:"resource-link",href:"https://www.mybib.com",target:"_blank",rel:"noopener noreferrer"},"MyBib")
        )
      ),
      el("div",{class:"resource-pill"},
        el("div",{class:"resource-label"},"Essay research tasks"),
        el("p",{class:"resource-note"},"Treat this like an assignment: check sources + lock citations."),
        el("ul",{class:"resource-tasks"},
          el("li",null,"1) Skim your Vitalsource/Cengage chapter for the essay topic."),
          el("li",null,"2) Pull 2 citation-ready sources (Zbib/MyBib)."),
          el("li",null,"3) Capture one quote + page number per source.")
        ),
        el("div",{class:"resource-links"},
          el("a",{class:"resource-link",href:"https://bookshelf.vitalsource.com/reader/books/9783662690079/pageid/99?context_token=bb735620-afa2-013e-1178-3e8ecb35ba3c",target:"_blank",rel:"noopener noreferrer"},"Open Vitalsource"),
          el("a",{class:"resource-link",href:"https://www.cengage.com/dashboard/home",target:"_blank",rel:"noopener noreferrer"},"Open Cengage"),
          el("a",{class:"resource-link",href:"https://zbib.org",target:"_blank",rel:"noopener noreferrer"},"Make citations"),
          el("a",{class:"resource-link",href:"https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_style_introduction.html",target:"_blank",rel:"noopener noreferrer"},"APA guide")
        )
      )
    )
  );
  if(!items.length){
    zone.append(
      el("div",{class:"danger-label"},"Danger Zone"),
      el("div",{class:"danger-empty"},"No looming deadlines detected. Keep grinding!"),
      resourceCard
    );
    return;
  }
  const list = el("div",{class:"danger-list"});
  items.forEach(item=>{
    const days = item.daysLeft;
    const totalWindow = DEFAULT_ASSIGNMENT_WINDOW_DAYS;
    const pct = Math.max(0, Math.min(100, Math.round((days/totalWindow)*100)));
    const bar = el("div",{class:"danger-bar"}, el("span",{style:`width:${pct}%`}));
    const status = days > 0 ? `${days} day${days===1?"":"s"} left` : "FINAL FORM: TURN IT IN TODAY.";
    const title = normalizeTitle(item.title || "");
    if(!title) return;
    const key = makeDangerKey(item);
    const done = bossDone.has(key);
    const doneBtn = el("button",{class:"danger-done-btn", type:"button"}, done ? "Defeated" : "Strike");
    doneBtn.addEventListener("click",()=>{
      if(done){
        bossDone.delete(key);
      } else {
        bossDone.add(key);
        recordStabilitySuccess();
        addXP?.(5);
      }
      saveDangerBossDone(bossDone);
      renderDangerZone();
    });
    const row = el("div",{class:`danger-item${days<=0?" boss":""}`},
      el("div",{class:"danger-head"},
        el("div",{class:"danger-title"}, title),
        el("div",{class:"danger-status"}, status),
        doneBtn
      ),
      bar
    );
    list.append(row);
  });
  const threatScore = (()=>{
    let score = 0;
    let overdue = 0;
    let soon = 0;
    const replies = loadRepliesState();
    const now = Date.now();
    items.forEach(it=>{
      const d = it.daysLeft;
      if(d < 0){ overdue += 1; score += 70 + Math.min(60, Math.abs(d)*8); }
      else if(d <= 1){ soon += 1; score += 50; }
      else if(d <= 2){ soon += 1; score += 35; }
      else if(d <= 3){ score += 25; }
      else if(d <= 6){ score += 10; }
    });
    const weekEnd = new Date(startOfWeek(currentWeek||new Date()));
    weekEnd.setDate(weekEnd.getDate()+6);
    const daysLeftWeek = Math.max(0, Math.ceil((weekEnd.getTime() - now)/86400000));
    const remainingReplies = Math.max(0, (replies.needed||15) - (replies.done||0));
    if(remainingReplies>0){
      if(daysLeftWeek <=1) score += 50;
      else if(daysLeftWeek <=2) score += 35;
      else score += 20;
    }
    const level = score >= 120 || (overdue>0 && soon>0) ? "red" : score >= 70 ? "orange" : score >= 30 ? "yellow" : "green";
    const bunker = document.body.classList.contains("theme-bunker");
    const detail = (()=>{
      if(level==="red") return bunker ? "Critical: hostiles at the gate. Overdue or imminent missions detected." : "Critical: overdue or due-now items need action.";
      if(level==="orange") return bunker ? "High alert: multiple missions due soon." : "High: several deadlines within a few days.";
      if(level==="yellow") return bunker ? "Elevated: keep eyes on approaching missions." : "Caution: some deadlines approaching.";
      return bunker ? "All clear: no hostile deadlines this week." : "Low: no urgent deadlines.";
    })();
    return { score: Math.min(100, score), level, detail, overdue, soon };
  })();
  const total = items.length;
  const defeated = Array.from(bossDone).filter(k=> items.some(it=> makeDangerKey(it)===k)).length;
  const remaining = Math.max(0, total - defeated);
  const hpPct = total ? Math.round((remaining/total)*100) : 0;
  if(total>0 && remaining===0){
    const weekKey = startOfWeek(currentWeek || new Date()).toISOString();
    if(loadBossRewardWeek() !== weekKey){
      addXP(500);
      saveBossRewardWeek(weekKey);
      showToast("+500 XP for defeating the boss!");
    }
  }
  const threatCard = el("div",{class:`threat-card level-${threatScore.level}`},
    el("div",{class:"threat-head"},
      el("div",{class:"threat-title"},"Threat Level"),
      el("div",{class:"threat-badge"}, threatScore.level.toUpperCase())
    ),
    el("div",{class:"threat-gauge"}, el("span",{style:`width:${threatScore.score}%`}))
  );
  const bossCard = el("div",{class:"boss-card"},
    el("div",{class:"boss-head"},
      el("div",{class:"boss-title"},"Boss Fight: Pixel Wyrm"),
      el("div",{class:"boss-meta"}, `${remaining} / ${total} HP left`)
    ),
    el("div",{class:"boss-visual"},
      el("div",{class:"boss-monster"}),
      el("div",{class:"boss-bar"}, el("span",{style:`width:${hpPct}%`}))
    ),
    el("div",{class:"boss-note"}, "Strike each task as you finish it. Clear the week to defeat the boss and earn XP.")
  );
  const replies = loadRepliesState();
  const remainingReplies = Math.max(0, (replies.needed||15) - (replies.done||0));
  const replyPct = Math.min(100, Math.round((replies.done||0) * 100 / (replies.needed||15)));
  const replyCard = el("div",{class:"reply-card"},
    el("div",{class:"reply-head"},
      el("div",null,"Discussion replies"),
      el("div",{class:"reply-meta"}, `${replies.done||0} / ${replies.needed||15}`)
    ),
    el("div",{class:"reply-bar"}, el("span",{style:`width:${replyPct}%`})),
    el("div",{class:"reply-actions"},
      el("button",{class:"btn",type:"button",onclick:()=>{
        const before = replies.done||0;
        replies.done = Math.max(0, Math.min((replies.needed||15), (replies.done||0)+1));
        if(replies.done > before){
          addXP?.(1);
        }
        saveRepliesState(replies);
        renderDangerZone();
      }},"+1 done"),
      el("button",{class:"btn",type:"button",onclick:()=>{
        replies.done = 0;
        saveRepliesState(replies);
        renderDangerZone();
      }},"Reset week")
    ),
    el("div",{class:"reply-note"}, remainingReplies>0 ? `${remainingReplies} replies left this week.` : "All replies logged for this week."),
    el("div",{class:"reply-note", style:"display:flex;align-items:center;gap:8px;margin-top:6px;"},
      el("span",{style: replies.citations ? "text-decoration:line-through;opacity:0.7;" : ""},"Double-check citations on current discussion post."),
      el("button",{
        class:`btn ${replies.citations ? "ghost" : ""}`,
        type:"button",
        onclick:()=>{
          replies.citations = !replies.citations;
          saveRepliesState(replies);
          if(replies.citations) addXP?.(30);
          renderDangerZone();
        }
      }, replies.citations ? "Struck" : "Strike it")
    )
  );
  const citationCard = el("div",{class:"reply-card"},
    el("div",{class:"reply-head"},
      el("div",null,"Essay citations double-check"),
      el("div",{class:"reply-meta"}, replies.citations ? "Done" : "Pending")
    ),
    el("div",{class:"reply-note"}, "Verify quotes, page numbers, and bibliography before you submit."),
    el("div",{class:"reply-actions"},
      el("button",{class:`btn ${replies.citations ? "ghost" : ""}`,type:"button",onclick:()=>{
        replies.citations = !replies.citations;
        saveRepliesState(replies);
        if(replies.citations) addXP?.(30);
        renderDangerZone();
      }}, replies.citations ? "Unstrike" : "Strike")
    )
  );
  const strip = renderBriefingStrip(threatScore, items);
  zone.append(
    el("div",{class:"danger-label"},"Danger Zone"),
    threatCard,
    replyCard,
    citationCard,
    strip || document.createElement("div"),
    resourceCard,
    list,
    bossCard
  );
  renderBriefLog();
}function updateStoryModeCard(){
    if(!storyModeCard) return;
    const habitPct = calcHabitProgress();
    const stageIdx = Math.min(storyStages.length-1, Math.floor(Math.max(0, (rpgState.level-1))/3));
    const stage = storyStages[stageIdx] || storyStages[0];
    const missions = getUpcomingAssignments(3);
    const primary = missions[0];
    const backup = missions[1];
    const formatDue = (item)=>{
      if(!item || !item.due) return "No due date";
      const d = new Date(item.due);
      const label = d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
      const delta = item.daysLeft;
      const suffix = delta===0 ? "due today" : (delta>0 ? `${delta}d left` : `${Math.abs(delta)}d late`);
      return `${label} . ${suffix}`;
    };
    if(storyModeStage) storyModeStage.textContent = stage.name;
    if(storyModeText){
      const intelLine = primary
        ? `Next case: ${primary.title} hits ${new Date(primary.due).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}.`
        : "Bring in your .ics feed to load the next briefing.";
      storyModeText.textContent = `${stage.desc} ${intelLine}`;
    }
    if(storyModeList){
      storyModeList.innerHTML = "";
      const bullets = [];
      bullets.push(primary
        ? `Evidence queue: ${primary.title} (${formatDue(primary)})`
        : "Evidence queue: Waiting on imported deadlines.");
      if(backup){
        bullets.push(`Shadow lead: ${backup.title} (${formatDue(backup)})`);
      }
      const freezeCount = streakFreeze.charges || 0;
      bullets.push(`Field readiness: Habits ${habitPct}% . ${freezeCount} Freeze${freezeCount===1?"":"s"} stocked`);
      bullets.push(`Rank: ${getRpgTitle(rpgState.level)} (${rpgState.xp}/${xpForLevel(rpgState.level)} XP)`);
      bullets.forEach(line=>{
        const li = document.createElement("li");
        li.textContent = line;
        storyModeList.append(li);
      });
    }
    if(storyModeFooter){
      const xpNeeded = Math.max(0, xpForLevel(rpgState.level) - rpgState.xp);
      const habitGap = Math.max(0, 100 - habitPct);
      storyModeFooter.textContent = xpNeeded
        ? `${xpNeeded} XP to your next promotion . ${habitGap}% habit power to max out.`
        : `Promotion pending. Keep habits green for another ${habitGap}% to seal the chapter.`;
    }
  }
  // Trigger celebratory UI when streak milestones are hit.
  function maybeCelebrateStreak(beforeCurrent, afterCurrent, beforeBest, afterBest){
    if(afterCurrent <= beforeCurrent && afterBest <= beforeBest) return;
    if(afterCurrent < 3 && afterBest <= beforeBest) return;
    let title = "Streak Extended!";
    let text = `You're on a ${afterCurrent}-day streak. Keep the intel flowing.`;
    if(afterCurrent > 0 && afterCurrent % 7 === 0){
      title = "Perfect Week!";
      text = `Seven-day run secured. HQ upgraded your narrative path.`;
    } else if(afterBest > beforeBest){
      title = "New Record!";
      text = `Longest streak yet: ${afterBest} days.`;
    }
    showCelebration(title, text);
  }
  // Render and wire integration toggle switches.
  function renderIntegrationToggles(){
    if(!integrationCard || !integrationToggles.length) return;
    integrationToggles.forEach(toggle=>{
      const id = toggle.dataset.integration;
      if(!(id in integrationPrefs)) integrationPrefs[id] = false;
      toggle.checked = !!integrationPrefs[id];
      toggle.addEventListener("change",()=>{
        integrationPrefs[id] = toggle.checked;
        saveIntegrationPrefs();
        showToast("Integration cue updated");
        updateIntegrationSuggestion(true);
      });
    });
    updateIntegrationSuggestion();
  }
  // Rotate contextual integration suggestions based on active toggles and schedule.
  function updateIntegrationSuggestion(forceActive=false){
    if(!integrationCard || !integrationNudgeText) return;
    const active = Object.keys(integrationPrefs).filter(key=>integrationPrefs[key]);
    let pool = Object.keys(integrationScripts);
    if(forceActive && active.length){
      pool = active;
    } else if(active.length){
      pool = active;
    }
    const choice = pool.length ? pool[Math.floor(Math.random()*pool.length)] : "newTab";
    const base = integrationScripts[choice] || integrationScripts.newTab;
    const habitPct = calcHabitProgress();
    const upcoming = getUpcomingAssignments(1)[0];
    const extra = upcoming ? ` Next up: ${upcoming.title} (${new Date(upcoming.due).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}).` : " Keep the calendar hook alive to stay ahead.";
    integrationNudgeText.textContent = `${base} Habit progress is ${habitPct}% this week.${extra}`;
  }
  // Pick and display a reflection prompt.
function updateReflectionPrompt(forceNew=false){
  if(!reflectionPromptEl || !reflectionPrompts.length) return;
  if(forceNew || currentReflectionPrompt >= reflectionPrompts.length){
    let next = Math.floor(Math.random()*reflectionPrompts.length);
    if(reflectionPrompts.length > 1){
        while(next === currentReflectionPrompt){
          next = Math.floor(Math.random()*reflectionPrompts.length);
        }
      }
      currentReflectionPrompt = next;
      reflectionState.promptIndex = next;
      saveReflectionState();
    }
    reflectionPromptEl.textContent = reflectionPrompts[currentReflectionPrompt] || reflectionPrompts[0];
  }
  // Update reflection metadata label.
  function updateReflectionMeta(){
    if(!reflectionMeta) return;
    if(reflectionState.savedAt){
      const stamp = new Date(reflectionState.savedAt);
      reflectionMeta.textContent = `Last logged ${stamp.toLocaleString()}`;
    } else {
      reflectionMeta.textContent = "No reflection logged yet.";
    }
  }
  function renderReflectionLog(){
    if(!reflectionLogEl) return;
    if(!reflectionLog.length){
      reflectionLogEl.innerHTML = `<div class="note">No reflections logged yet.</div>`;
      return;
    }
    const recent = reflectionLog.slice(-8).reverse().map(entry=>{
      const when = entry.savedAt ? new Date(entry.savedAt).toLocaleString() : "";
      return `<div class="reflection-log-entry"><small>${when}</small><div>${entry.text}</div></div>`;
    }).join("");
    reflectionLogEl.innerHTML = recent;
  }
  function logReflection({ source="manual", silent=false }={}){
    if(!reflectionInput) return;
    const text = (reflectionInput.value || "").trim();
    if(!text){
      reflectionState.text = "";
      reflectionState.savedAt = null;
      reflectionState.promptIndex = currentReflectionPrompt;
      saveReflectionState();
      renderReflectionLog();
      updateReflectionMeta();
      return;
    }
    const entry = { text, savedAt:new Date().toISOString(), source };
    reflectionState.text = text;
    reflectionState.savedAt = entry.savedAt;
    reflectionState.promptIndex = currentReflectionPrompt;
    reflectionLog.push(entry);
    if(reflectionLog.length > 50) reflectionLog = reflectionLog.slice(-50);
    saveReflectionState();
    saveReflectionLog();
    renderReflectionLog();
    updateReflectionMeta();
    if(!silent) showToast("Reflection logged");
    updateIntegrationSuggestion(true);
  }
  // Render reflection UI with prompt and saved text.
  function renderReflectionCard(){
    if(!reflectionCard) return;
    updateReflectionPrompt(false);
    if(reflectionInput) reflectionInput.value = reflectionState.text || "";
    updateReflectionMeta();
    renderReflectionLog();
  }

  function startStudyNag(promptIfNeeded=true){
    if(studyNagTimer || !("Notification" in window)) return;
    const baseLines = [
      "Are you studying or should I file an official complaint?",
      "Study check: are you working or do I need to start humming elevator music?",
      "Quick poke: back to the books or should I get upset?",
      "Friendly reminder: the notes won't read themselves.",
      "Status: waiting for you to study. Please don't make me pout.",
      "Alert: You have not even started, do you even care?",
      "Your coffee is getting cold and so is your grade.",
      "I just saw your to-do list cry.",
      "Paging scholar: the tasks are staging a protest.",
      "This is your conscience. Go study.",
      "Stop scrolling. Start doing.",
      "Imagine finishing now. Feels good, right? So move.",
      "Another tab? Really? Back to the assignment.",
      "Your pillow says: earn me. Study, then sleep."
    ];
    const duckLines = [
      "Duck says: quack your way back to the timer.",
      "The duck put on sunglasses but took them off-finish a session to earn them back.",
      "Duck tilts its head: that was a short break. too short.",
      "Disappointing the duck? Bold move. Get back to the block.",
      "The duck is tapping its foot. That's not a good sign."
    ];
    const mascotLines = [
      "Pixel pup rolled its eyes. Start a Pomodoro to redeem yourself.",
      "Mascot hype: finish one task and I'll drop a victory sticker.",
      "Mascot growl: deadlines are prowling-move!",
      "Mascot flex: one focus block and I'll chill.",
      "Pixel pup brings water. Now you bring focus."
    ];
    const allLines = baseLines.concat(duckLines, mascotLines);
    const send = ()=>{
      let msg = "";
      const missions = getUpcomingAssignments(3);
      if(missions && missions.length){
        const target = missions.find(m=>m.daysLeft<=2) || missions[0];
        if(target){
          const cleanTitle = target.title.replace(/\[.*?\]\s*/,"").trim() || target.title;
          let when = "soon";
          if(target.daysLeft===0) when = "today";
          else if(target.daysLeft===1) when = "tomorrow";
          else if(target.daysLeft<0) when = `${Math.abs(target.daysLeft)} day${Math.abs(target.daysLeft)===1?"":"s"} late`;
          else when = `in ${target.daysLeft} day${target.daysLeft===1?"":"s"}`;
          msg = `Hey, your ${cleanTitle} boss fight is ${when}. Gear up!`;
        }
      }
      if(!msg){
        const pool = allLines;
        msg = pool[Math.floor(Math.random()*pool.length)];
      }
      try{
        new Notification("Study check", { body: msg });
      }catch(e){}
    };
    const schedule = ()=>{
      if(studyNagTimer) return;
      studyNagTimer = setInterval(()=>{
        if(Notification.permission !== "granted") return;
        send();
      }, 60*60*1000);
      setTimeout(()=>{ if(Notification.permission==="granted") send(); }, 60*1000);
    };
    const handlePermission = (value)=>{
      updateNotificationStatus();
      if(value === "granted") schedule();
    };
    const state = Notification.permission;
    if(state === "granted"){
      handlePermission("granted");
      return;
    }
    if(state === "denied"){
      handlePermission("denied");
      return;
    }
    if(!promptIfNeeded) return;
    try{
      const result = Notification.requestPermission();
      if(result && typeof result.then === "function"){
        result.then(handlePermission);
      } else {
        handlePermission(Notification.permission);
      }
    }catch(err){
      console.warn("Notification permission request failed", err);
    }
  }

  function renderWorkload(){ return; }

  render();
  // workload UI removed
  weekViewToggle?.addEventListener("click", setPlannerWeekView);
  classViewToggle?.addEventListener("click", setPlannerClassView);
  // workload UI removed
  moodSelect?.addEventListener("change",e=>{
    moodEnergyState.mood = e.target.value;
    saveMoodEnergy(moodEnergyState);
    render();
  });
  energySelect?.addEventListener("change",e=>{
    moodEnergyState.energy = e.target.value;
    saveMoodEnergy(moodEnergyState);
    render();
  });

  const habitListEl = document.getElementById("habits-list");
  const habitProgressEl = document.getElementById("habits-progress");
  const habitAddBtn = document.getElementById("habit-add");
  const habitResetWeekBtn = document.getElementById("habit-reset-week");
  const habitSaveBtn = document.getElementById("habit-save");
  const habitExportBtn = document.getElementById("habit-export");
  const habitExportCsvBtn = document.getElementById("habit-export-csv");
  const habitImportInput = document.getElementById("habit-import");
  const habitImportCsvInput = document.getElementById("habit-import-csv");
  function calcHabitProgress(){
    let total = 0;
    let done = 0;
    const weekKey = getHabitWeekKeySunday();
    const monthKey = getHabitMonthKey();
    habitsState.forEach(h=>{
      const type = h.type || "normal";
      if(type === "weekly"){
        total += 1;
        if(h.weeklyLog?.[weekKey]) done += 1;
      }else if(type === "monthly"){
        total += 1;
        if(h.monthlyLog?.[monthKey]) done += 1;
      }else{
        const goal = Math.max(1, Math.min(7, Number(h.target)||7));
        const hits = h.days.filter(Boolean).length;
        total += goal;
        done += Math.min(goal, hits);
      }
    });
    return total ? Math.round(done * 100 / total) : 0;
  }
  function renderHabits(){
    if(!habitListEl) return;
    habitListEl.innerHTML = "";
    const pct = calcHabitProgress();
    if(habitProgressEl) habitProgressEl.textContent = `Week progress: ${pct}%`;
    if(!habitsState.length){
      habitListEl.append(el("div",{class:"habit-empty"},"No habits yet. Click \"Add habit\" to begin."));
      return;
    }
    habitsState.forEach((habit, idx)=>{
      const weekKey = getHabitWeekKeySunday();
      const monthKey = getHabitMonthKey();
      if(habit.type === "weekly"){
        const on = !!habit.weeklyLog?.[weekKey];
        habitsState[idx].days = on ? Array(7).fill(true) : blankWeek();
      }else if(habit.type === "monthly"){
        const on = !!habit.monthlyLog?.[monthKey];
        habitsState[idx].days = on ? Array(7).fill(true) : blankWeek();
      }
      const cat = habitCatById(habit.cat);
      const row = el("div",{class:"habit-row"});
      const info = el("div",{class:"habit-info"});
      const chip = el("span",{class:"chip"},cat.emoji || "â�,�¢");
      const nameInput = el("input",{type:"text",value:habit.name});
      nameInput.addEventListener("input",e=>{ habitsState[idx].name = e.target.value; });
      const select = el("select");
      HABIT_CATEGORIES.forEach(c=>{
        const opt = el("option",{value:c.id},c.label);
        if(c.id===habit.cat) opt.selected = true;
        select.append(opt);
      });
      select.addEventListener("change",e=>{ habitsState[idx].cat = e.target.value; renderHabits(); });
      info.append(chip,nameInput,select);
      const typeChip = el("span",{class:"habit-type-chip"}, habit.type==="weekly"?"WEEKLY":habit.type==="monthly"?"MONTHLY":"NORMAL");
      if(habit.type==="normal"){
        typeChip.append(el("span",{class:"habit-week-note"},` (${habit.target || 7}x/week)`));
      }
      info.append(typeChip);
      row.append(info);

      const weeklyDone = !!habit.weeklyLog?.[weekKey];
      const monthlyDone = !!habit.monthlyLog?.[monthKey];

      const displayDays = [
        {label:"S", idx:6},
        {label:"M", idx:0},
        {label:"T", idx:1},
        {label:"W", idx:2},
        {label:"T", idx:3},
        {label:"F", idx:4},
        {label:"S", idx:5},
      ];

      const daysWrap = el("div",{class:"habit-days"});
      if(habit.type==="weekly"){
        const btn = el("button",{type:"button",class:`habit-day weekly-done-btn ${weeklyDone?"on":""}`,title:"Mark weekly done"},"D");
        btn.addEventListener("click",()=>{
          const next = !weeklyDone;
          habitsState[idx].weeklyLog = { ...(habitsState[idx].weeklyLog||{}), [weekKey]: next };
          habitsState[idx].days = next ? Array(7).fill(true) : blankWeek();
          recordHabitCompletion(habit.id, new Date(), next);
          renderHabits();
        });
        daysWrap.append(btn);
        // show last 4 weeks status
        const weeksWrap = el("div",{class:"habit-week-circles"});
        const base = new Date(weekKey);
        base.setHours(0,0,0,0);
        for(let i=0;i<4;i++){
          const d = new Date(base);
          d.setDate(d.getDate() - i*7);
          const k = formatHabitDate(d);
          const on = !!habit.weeklyLog?.[k];
          const circle = el("div",{class:`week-circle ${on?"on":""}`,title:`Week ${4-i}`}, `W${4-i}`);
          weeksWrap.prepend(circle);
        }
        row.append(weeksWrap);
      }else if(habit.type==="monthly"){
        displayDays.forEach(d=>{
          const on = monthlyDone;
          const btn = el("button",{type:"button",class:`habit-day ${on?"on":""}`,title:"Logged this month"}, d.label);
          btn.addEventListener("click",()=>{
            const next = !monthlyDone;
            habitsState[idx].monthlyLog = { ...(habitsState[idx].monthlyLog||{}), [monthKey]: next };
            habitsState[idx].days = next ? Array(7).fill(true) : blankWeek();
            recordHabitCompletion(habit.id, new Date(), next);
            renderHabits();
          });
          daysWrap.append(btn);
        });
      }else{
        displayDays.forEach(d=>{
          const dayIdx = d.idx;
          const btn = el("button",{type:"button",class:`habit-day ${habit.days[dayIdx]?"on":""}`,title:dayOrder[dayIdx]}, d.label);
          btn.addEventListener("click",()=>{
            const next = !habit.days[dayIdx];
            habitsState[idx].days[dayIdx] = next;
            recordHabitCompletion(habit.id, getHabitDateForDay(dayIdx), next);
            if(next) addXP(3);
            renderHabits();
          });
          daysWrap.append(btn);
        });
      }

      row.append(daysWrap);

      const historyPreview = habit.type==="weekly" ? null : renderHabitHistoryDots(habit.id);

      if(historyPreview) row.append(historyPreview);

      const actions = el("div",{style:"display:flex;gap:8px;flex-wrap:wrap;align-items:center;"});

      const streakInfo = getHabitStreakInfo(habit.id);

      const streakBadge = el("div",{class:"habit-streak"});
      let streakLabel = `Streak: ${streakInfo.current}d`;
      let bestLabel = streakInfo.best;
      if(habit.type==="weekly"){
        const weekStreak = (()=> {
          const keys = Object.keys(habit.weeklyLog||{}).filter(k=>habit.weeklyLog[k]);
          const set = new Set(keys);
          let streak = 0;
          const cursor = new Date(getHabitWeekKeySunday());
          for(let i=0;i<104;i++){
            const key = formatHabitDate(cursor);
            if(!set.has(key)) break;
            streak += 1;
            cursor.setDate(cursor.getDate() - 7);
          }
          return streak;
        })();
        streakLabel = `Streak: ${weekStreak}w`;
        bestLabel = Math.max(bestLabel, weekStreak);
      }
      streakBadge.textContent = streakLabel;
      if(bestLabel > streakInfo.current){
        const best = el("small",{class:"habit-streak-best"},`Best ${habit.type==="weekly"?bestLabel+"w":bestLabel+"d"}`);
        streakBadge.append(best);
      }

      const removeBtn = el("button",{class:"btn",type:"button"},"Remove");

      removeBtn.addEventListener("click",()=>{

        habitsState.splice(idx,1);

        delete habitHistory[habit.id];

        saveHabitHistory();

        renderHabits();

      });

      actions.append(streakBadge, removeBtn);

      row.append(actions);

      habitListEl.append(row);

    });
    if(typeof window.syncPomodoroBreakHabits === "function"){
      window.syncPomodoroBreakHabits();
    }
    renderHabitGraph();
    updateStoryModeCard();
  }
  function renderHabitGraph(){
    if(!document.getElementById("habit-graph-styles")){
      const style = document.createElement("style");
      style.id = "habit-graph-styles";
      style.textContent = `
        #habit-graph{margin-top:10px;padding:12px;border:1px solid var(--border,#1f2937);border-radius:12px;background:linear-gradient(180deg,#0b1220,#0f172a);color:inherit;}
        .habit-graph-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;margin-bottom:10px;}
        .habit-graph-title{font-weight:700;font-size:15px;}
        .habit-graph-note{font-size:12px;opacity:0.8;margin:2px 0 0 0;}
        .habit-graph-legend{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;}
        .habit-legend-item{display:flex;align-items:center;gap:4px;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,0.04);}
        .habit-legend-dot{width:10px;height:10px;border-radius:999px;display:inline-block;box-shadow:0 0 0 1px rgba(0,0,0,0.25);}
        .habit-graph-grid{display:flex;flex-direction:column;gap:6px;}
        .habit-graph-row{display:grid;grid-template-columns:140px repeat(7,minmax(0,1fr));gap:6px;align-items:center;padding:4px 6px;border-radius:8px;}
        .habit-graph-row:nth-child(odd){background:rgba(255,255,255,0.02);}
        .habit-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .habit-dot{width:14px;height:14px;border-radius:50%;margin:0 auto;opacity:0.28;background:var(--dot,var(--accent-2));box-shadow:0 0 0 1px rgba(0,0,0,0.35);}
        .habit-dot.on{opacity:1;box-shadow:0 0 0 2px rgba(255,255,255,0.1),0 0 0 1px rgba(0,0,0,0.3);}
        .habit-total{font-size:12px;text-align:center;font-weight:600;opacity:0.85;}
        .habit-graph-row.labels{background:transparent;border-top:1px solid var(--border,#1f2937);padding-top:8px;}
        .habit-day{font-size:12px;text-align:center;opacity:0.8;}
      `;
      document.head.append(style);
    }
    let graph = document.getElementById("habit-graph");
    if(!graph){
      graph = el("div",{id:"habit-graph"});
      habitListEl.parentElement?.insertBefore(graph, habitListEl);
    }
    const catColors = {
      study:"#60a5fa",
      exercise:"#34d399",
      meals:"#fbbf24",
      admin:"#a78bfa",
      free:"#f97316",
      night:"var(--accent)",
      none:"#94a3b8"
    };
    const totals = dayOrder.map((_, idx)=> habitsState.reduce((sum,h)=> sum + (h.days[idx]?1:0), 0));
    const catsUsed = Array.from(new Set(habitsState.map(h=>h.cat)));
    const dayInitials = dayOrder.map(d=>d[0]);
    graph.innerHTML = `
      <div class="habit-graph-head">
        <div>
          <div class="habit-graph-title">Weekly habit hits</div>
          <p class="habit-graph-note">Dots brighten when you hit that habit day.</p>
        </div>
        <div class="habit-graph-legend">
          ${catsUsed.map(cat=>{
            const color = catColors[cat] || "var(--accent-2)";
            const label = (habitCatById(cat)?.label || cat).replace(/^[^A-Za-z0-9]+/,"");
            return `<span class="habit-legend-item"><span class="habit-legend-dot" style="background:${color}"></span><span>${label}</span></span>`;
          }).join("")}
        </div>
      </div>
      <div class="habit-graph-grid">
        ${habitsState.map(habit=>{
          const color = catColors[habit.cat] || "var(--accent-2)";
          return `<div class="habit-graph-row">
            <div class="habit-name">${habit.name || "Habit"}</div>
            ${dayOrder.map((day, idx)=>{
              const hit = !!habit.days[idx];
              return `<div class="habit-dot ${hit?"on":""}" title="${day}: ${hit?"Hit":"Miss"}" style="--dot:${color};"></div>`;
            }).join("")}
          </div>`;
        }).join("")}
        <div class="habit-graph-row totals">
          <div class="habit-name">Totals</div>
          ${totals.map((count, idx)=>`<div class="habit-total" title="${dayOrder[idx]}: ${count} hit${count===1?"":"s"}">${count}</div>`).join("")}
        </div>
        <div class="habit-graph-row labels">
          <div></div>
          ${dayInitials.map(d=>`<div class="habit-day">${d}</div>`).join("")}
        </div>
      </div>
    `;
  }
  function saveHabitsNow(message=true){
    saveHabits(habitsState);
    if(message) showToast("Habits saved!");
  }
  function openHabitTypeModal(){
    return new Promise(resolve=>{
      const existing = document.querySelector(".habit-modal-backdrop");
      if(existing) existing.remove();
      const backdrop = el("div",{class:"habit-modal-backdrop"});
      const modal = el("div",{class:"habit-modal"});
      const title = el("h3",null,"What type of habit is this?");
      const options = el("div",{class:"options"});
      const makeOption = (value, label, desc, checked=false)=>{
        const row = el("label",{class:"option-row"});
        const radio = el("input",{type:"radio",name:"habit-type",value,checked});
        const body = el("div",null,`${label} - ${desc}`);
        row.append(radio, body);
        options.append(row);
      };
      makeOption("normal","Normal habit","Multi-times per week", true);
      makeOption("weekly","Weekly habit","Log once anywhere in the week");
      makeOption("monthly","Monthly habit","Log once anywhere in the month");
      const targetRow = el("div",{class:"option-row"});
      const targetLabel = el("label",null,"Target times per week (normal habits)");
      const targetInput = el("input",{type:"number",min:"1",max:"7",value:"3",style:"width:80px;"});
      targetRow.append(targetLabel,targetInput);
      const actions = el("div",{class:"actions"});
      const cancel = el("button",{class:"btn ghost",type:"button"},"Cancel");
      const confirm = el("button",{class:"btn",type:"button"},"Add");
      cancel.addEventListener("click",()=>{ backdrop.remove(); resolve(null); });
      confirm.addEventListener("click",()=>{
        const sel = modal.querySelector('input[name="habit-type"]:checked');
        const type = sel ? sel.value : "normal";
        const target = Math.max(1, Math.min(7, Number(targetInput.value)||3));
        backdrop.remove();
        resolve({type, target});
      });
      actions.append(cancel, confirm);
      modal.append(title, options, targetRow, actions);
      backdrop.append(modal);
      document.body.append(backdrop);
    });
  }
  freezeBuyBtn?.addEventListener("click",()=>{
    if(rpgState.xp < STREAK_FREEZE_COST){
      showToast(`Need ${STREAK_FREEZE_COST} XP to buy a Streak Freeze.`, "warn");
      return;
    }
    streakFreeze.charges = (streakFreeze.charges||0) + 1;
    saveStreakFreeze();
    addXP(-STREAK_FREEZE_COST);
    updateStreakFreezeBar();
    showToast("Streak Freeze stocked! Use it before a busy day.");
  });
  freezeUseBtn?.addEventListener("click",()=>{
    const target = new Date();
    target.setDate(target.getDate()-1);
    if(useStreakFreeze(target)){
      showToast(`Protected your streak for ${target.toLocaleDateString()}.`);
    } else {
      showToast("No Streak Freeze ready or already used for yesterday.", "warn");
    }
  });
  habitAddBtn?.addEventListener("click",async ()=>{
    const pick = await openHabitTypeModal();
    const base = {name:"New habit", cat:"none"};
    if(pick){
      base.type = pick.type;
      base.target = pick.target;
    }
    habitsState.push(normalizeHabit(base));
    renderHabits();
  });
  habitResetWeekBtn?.addEventListener("click",()=>{
    const weekKey = getHabitWeekKeySunday();
    habitsState = habitsState.map(h=>{
      const next = {...h, days: blankWeek()};
      if(h.type === "weekly"){
        next.weeklyLog = { ...(h.weeklyLog||{}) };
        next.weeklyLog[weekKey] = false;
      }
      return next;
    });
    renderHabits();
  });
  habitSaveBtn?.addEventListener("click",()=>saveHabitsNow());
  habitExportBtn?.addEventListener("click",()=>{
    const blob = new Blob([JSON.stringify({habits:habitsState},null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "habits.json";
    a.click();
    URL.revokeObjectURL(url);
  });
  habitExportCsvBtn?.addEventListener("click",()=>{
    const header = ["Habit","Category",...dayOrder];
    const lines = [header.join(",")];
    habitsState.forEach(h=>{
      const row = [h.name.replace(/"/g,'""'), habitCatById(h.cat).label, ...h.days.map(v=>v?"1":"0")];
      lines.push(row.map(cell=>`"${cell}"`).join(","));
    });
    downloadBlob(lines.join("\n"),"habits.csv","text/csv");
    showToast("Habit CSV exported");
  });
  habitImportInput?.addEventListener("change",e=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const data = JSON.parse(String(reader.result));
        const list = Array.isArray(data?.habits) ? data.habits : (Array.isArray(data) ? data : null);
        if(list){
          habitsState = list.map(normalizeHabit);
          renderHabits();
          saveHabitsNow(false);
          showToast("Habits imported!");
        }else{
          showToast("Invalid habits file","warn");
        }
      }catch(err){
        showToast("Invalid habits file","warn");
      }
      habitImportInput.value = "";
    };
    reader.readAsText(file);
  });
  renderHabits();
  function normalizePhase(phase={}){
    return {
      id: phase.id || `phase-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      title: phase.title || "New phase",
      range: phase.range || "",
      focus: Array.isArray(phase.focus) ? phase.focus.filter(Boolean) : [],
      checkpoints: Array.isArray(phase.checkpoints) ? phase.checkpoints.filter(Boolean) : []
    };
  }
  function loadRoadmap(){
    if(hasStorage){
      try{
        const raw = JSON.parse(localStorage.getItem(ROADMAP_KEY));
        if(Array.isArray(raw)) return raw.map(normalizePhase);
      }catch(e){}
    }
    return deepCopy(defaultRoadmap);
  }
  function saveRoadmap(){
    if(hasStorage) localStorage.setItem(ROADMAP_KEY, JSON.stringify(roadmapState));
  }
    function renderRoadmapEditor(){
    const container = document.getElementById("roadmap-editor");
    if(!container) return;
    container.innerHTML = "";
    roadmapState.forEach((phase, idx)=>{
      const card = document.createElement("div");
      card.className = "roadmap-card";
      const title = document.createElement("input");
      title.value = phase.title;
      title.placeholder = "Phase title";
      title.addEventListener("input",e=>{ roadmapState[idx].title = e.target.value; saveRoadmap(); });
      const range = document.createElement("input");
      range.value = phase.range;
      range.placeholder = "Timeline";
      range.addEventListener("input",e=>{ roadmapState[idx].range = e.target.value; saveRoadmap(); });
      const focus = document.createElement("textarea");
      focus.value = (phase.focus||[]).join("\n");
      focus.placeholder = "Focus (one per line)";
      focus.addEventListener("input",e=>{
        roadmapState[idx].focus = e.target.value.split(/\n+/).map(line=>line.trim()).filter(Boolean);
        saveRoadmap();
      });
      const checkpoints = document.createElement("textarea");
      checkpoints.value = (phase.checkpoints||[]).join("\n");
      checkpoints.placeholder = "Checkpoints (one per line)";
      checkpoints.addEventListener("input",e=>{
        roadmapState[idx].checkpoints = e.target.value.split(/\n+/).map(line=>line.trim()).filter(Boolean);
        saveRoadmap();
      });
      const actions = document.createElement("div");
      actions.className = "roadmap-actions";
      const remove = document.createElement("button");
      remove.className = "btn";
      remove.type = "button";
      remove.textContent = "Remove phase";
      remove.addEventListener("click",()=>{
        roadmapState.splice(idx,1);
        saveRoadmap();
        renderRoadmapEditor();
      });
      actions.append(remove);
      card.append(title, range, focus, checkpoints, actions);
      container.append(card);
    });
    const addBtn = document.createElement("button");
    addBtn.className = "btn";
    addBtn.type = "button";
    addBtn.textContent = "Add phase";
    addBtn.addEventListener("click",()=>{
      roadmapState.push(normalizePhase());
      saveRoadmap();
      renderRoadmapEditor();
    });
    container.append(addBtn);
  }

  function normalizeSkillProgress(skill={}){
    const template = defaultSkills.find(s=>s.id===skill.id);
    const stages = Array.isArray(skill.stages) && skill.stages.length ? skill.stages : (template ? template.stages.slice() : ["Stage"]);
    const id = skill.id || template?.id || `skill-${Date.now()}`;
    const title = skill.title || template?.title || "Skill";
    const level = Math.max(0, Math.min(skill.level || 0, stages.length-1));
    return { id, title, stages, level };
  }
  function loadSkillProgress(){
    if(hasStorage){
      try{
        const raw = JSON.parse(localStorage.getItem(SKILL_KEY));
        if(Array.isArray(raw)){
          const normalized = raw.map(normalizeSkillProgress);
          defaultSkills.forEach(def=>{
            if(!normalized.some(s=>s.id===def.id)){
              normalized.push(normalizeSkillProgress(def));
            }
          });
          return normalized;
        }
      }catch(e){}
    }
    return deepCopy(defaultSkills);
  }
  function saveSkillProgress(){
    if(hasStorage) localStorage.setItem(SKILL_KEY, JSON.stringify(skillProgressState));
  }
  function updateSkillLevel(id, level){
    const skill = skillProgressState.find(s=>s.id===id);
    if(!skill) return;
    skill.level = Math.max(0, Math.min(level, skill.stages.length-1));
    saveSkillProgress();
    renderSkillVisualizer();
  }
  function normalizeRoutine(r={}){
    const title = r.title || "Routine";
    const id = r.id || title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || `routine-${Date.now()}`;
    const items = Array.isArray(r.items) ? r.items.slice() : [];
    const category = (r.category || r.tag || "strength").toString().toLowerCase();
    const tag = r.tag || (category.charAt(0).toUpperCase()+category.slice(1));
    return { id, title, items, category, tag, open: !!r.open };
  }
  function loadRoutinePrefs(){
    const prefs = { openMap:{}, filter:"all" };
    if(!hasStorage) return prefs;
    try{
      const raw = JSON.parse(localStorage.getItem(ROUTINE_OPEN_KEY)||"{}");
      if(raw && typeof raw === "object") prefs.openMap = raw;
    }catch(e){}
    try{
      const f = localStorage.getItem(ROUTINE_FILTER_KEY);
      if(f) prefs.filter = f;
    }catch(e){}
    return prefs;
  }
  function saveRoutinePrefs(openMap, filter){
    if(!hasStorage) return;
    try{ localStorage.setItem(ROUTINE_OPEN_KEY, JSON.stringify(openMap||{})); }catch(e){}
    if(filter){ try{ localStorage.setItem(ROUTINE_FILTER_KEY, filter); }catch(e){} }
  }
  function renderSkillVisualizer(){
    const container = document.getElementById("skill-visualizer");
    if(!container) return;
    const board = document.getElementById("skill-progress-board");
    const isEditing = board?.classList?.contains("is-editing");
    const colorMap = {
      default:"linear-gradient(90deg,#22d3ee,#a855f7)",
      handstand:"linear-gradient(90deg,#a855f7,#c084fc)",
      planche:"linear-gradient(90deg,#ef4444,#fb7185)",
      lever:"linear-gradient(90deg,#06b6d4,#3b82f6)",
      backlever:"linear-gradient(90deg,#f59e0b,#f97316)",
      pistol:"linear-gradient(90deg,#22c55e,#84cc16)"
    };
    container.innerHTML = "";
    skillProgressState.forEach(skill=>{
      const stages = Array.isArray(skill.stages) ? skill.stages : [];
      const safeLevel = Math.max(0, Math.min(skill.level || 0, stages.length ? stages.length-1 : 0));
      const stageCount = stages.length > 1 ? stages.length - 1 : 1;
      const percent = Math.max(0, Math.min(100, Math.round((safeLevel / stageCount) * 100)));
      const currentStage = stages[safeLevel] || "Stage";

      const card = document.createElement("div");
      card.className = "skill-card";
      card.dataset.skill = skill.id;

      const head = document.createElement("div");
      head.className = "skill-card-head";
      const title = document.createElement("h4");
      title.textContent = skill.title;
      const percentEl = document.createElement("span");
      percentEl.className = "skill-percent";
      percentEl.textContent = `${percent}%`;
      head.append(title, percentEl);

      const bar = document.createElement("div");
      bar.className = "skill-bar";
      const fill = document.createElement("span");
      fill.style.width = `${percent}%`;
      fill.style.background = colorMap[skill.id] || colorMap.default || "linear-gradient(90deg,#22d3ee,#a855f7)";
      bar.append(fill);

      const current = document.createElement("div");
      current.className = "skill-current";
      current.innerHTML = `Current: <strong>${currentStage}</strong>`;

      const detail = document.createElement("div");
      detail.className = "skill-detail";
      const steps = document.createElement("div");
      steps.className = "skill-steps";
      stages.forEach((stage, idx)=>{
        const row = document.createElement("div");
        row.className = "skill-step" + (idx<=safeLevel ? " done":"");
        const label = document.createElement("span");
        label.textContent = stage;
        row.append(label);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = idx===safeLevel ? "Current" : "Set here";
        if(idx===safeLevel){
          btn.disabled = true;
        }else{
          btn.addEventListener("click",()=>updateSkillLevel(skill.id, idx));
        }
        row.append(btn);
        steps.append(row);
      });
      detail.append(steps);
      if(!isEditing) detail.style.display = "none";

      card.append(head, bar, current, detail);
      container.append(card);
    });
  }
  (function initBreakChecks(){
    const FRONT_SPLIT_BREAK_KEY = "split-week";
    const FRONT_SPLIT_HABIT = { name:"Front split stretches", cat:"exercise", target:7 };
    const dayIdxByLabel = { Mon:0, Tue:1, Wed:2, Thu:3, Fri:4, Sat:5, Sun:6 };

    const updatePill = (pill)=>{
      const checkboxes = Array.from(pill.querySelectorAll("input[type='checkbox']"));
      const weekdays = Array.from(pill.querySelectorAll(".pomo-weekday"));
      if(checkboxes.length){
        pill.classList.toggle("done", checkboxes.every(cb=>cb.checked));
      } else if(weekdays.length){
        pill.classList.toggle("done", weekdays.every(btn=>btn.classList.contains("on")));
      }
    };
    const ensureFrontSplitHabit = ()=>{
      const targetName = (FRONT_SPLIT_HABIT.name || "").trim().toLowerCase();
      let habit = habitsState.find(h=> (h.name||"").trim().toLowerCase() === targetName);
      let mutated = false;
      if(!habit){
        habit = normalizeHabit({ name: FRONT_SPLIT_HABIT.name, cat: FRONT_SPLIT_HABIT.cat, type:"normal", target: FRONT_SPLIT_HABIT.target });
        habitsState.push(habit);
        mutated = true;
      } else if(habit.type !== "normal"){
        habit.type = "normal";
        mutated = true;
      }
      if(mutated) saveHabits(habitsState);
      return habit;
    };
    function syncFrontSplitFromHabits(){
      const wrap = document.querySelector(`.pomo-weekdays[data-break="${FRONT_SPLIT_BREAK_KEY}"]`);
      if(!wrap) return;
      const habit = ensureFrontSplitHabit();
      if(!habit) return;
      const buttons = Array.from(wrap.querySelectorAll(".pomo-weekday"));
      buttons.forEach(btn=>{
        const idx = dayIdxByLabel[btn.dataset.day];
        if(typeof idx !== "number") return;
        const on = !!habit.days[idx];
        btn.classList.toggle("on", on);
      });
      const pill = wrap.closest(".pomo-pill");
      if(pill) updatePill(pill);
    }
    function syncFrontSplitToHabit(dayIdx, on){
      if(typeof dayIdx !== "number") return;
      const habit = ensureFrontSplitHabit();
      if(!habit) return;
      const wasOn = !!habit.days[dayIdx];
      habit.days[dayIdx] = !!on;
      recordHabitCompletion(habit.id, getHabitDateForDay(dayIdx), !!on);
      if(on && !wasOn) addXP(3);
      saveHabits(habitsState);
      renderHabits();
    }
    window.syncPomodoroBreakHabits = syncFrontSplitFromHabits;
    document.querySelectorAll(".pomo-pill input[type='checkbox']").forEach(box=>{
      const pill = box.closest(".pomo-pill");
      if(!pill) return;
      updatePill(pill);
      box.addEventListener("change",()=>{
        updatePill(pill);
      });
    });
    document.querySelectorAll(".pomo-weekday").forEach(btn=>{
      const pill = btn.closest(".pomo-pill");
      const wrap = btn.closest("[data-break]");
      const breakKey = wrap?.dataset.break;
      const dayIdx = breakKey === FRONT_SPLIT_BREAK_KEY ? dayIdxByLabel[btn.dataset.day] : null;
      btn.addEventListener("click",()=>{
        const wasOn = btn.classList.contains("on");
        const next = !wasOn;
        btn.classList.toggle("on", next);
        if(breakKey === FRONT_SPLIT_BREAK_KEY) syncFrontSplitToHabit(dayIdx, next);
        updatePill(pill);
      });
    });
    syncFrontSplitFromHabits();
  })();

  (function initPomodoro(){
  const durationLabel = document.getElementById("pomo-durations");
  const timeEl = document.getElementById("pomo-time");
  if(!durationLabel || !timeEl) return;

  let FOCUS_MIN = 52;
  let SHORT_BREAK_MIN = 20;
  let LONG_BREAK_MIN = 40;
  const TOTAL_CYCLES = 4;
  const BREAK_HABIT_MAP = {
    abs: { name: "Abs", cat:"exercise" },
    push: { name: "Pushups", cat:"exercise" },
    stretch: { name: "Stretch", cat:"exercise" }
  };
  const tasks = [
    "30-minute ab workout - hollow holds, leg raises, bicycle crunches, planks",
    "100 Push Plan - break it into four rounds of 25 with strict form",
    "Front split stretches - lunge pulses, quad openers",
    "Recovery walk - light stroll and deep breathing between rounds"
  ];
  const autoStartEnabled = false;
  let cycle = 1;
  let cyclesCompleted = 0;
  let mode = "focus";
  let secondsLeft = FOCUS_MIN * 60;
  let running = false;
  const MINI_BREAK_INTERVAL = 10 * 60; // every 10 minutes
  const MINI_BREAK_DURATION = 60; // 1 minute mini break
  let nextMiniBreakAt = MINI_BREAK_INTERVAL;
  let miniBreakActive = false;
  let miniBreakRemaining = 0;
  let miniBreakStartedAt = null;
  let timerId = null;
  let startedAt = null;
  let lastBreakChime = null;
  let breakWarned = false;
  let oneMinuteWarned = false;
  const BREAK_CHIME_KEY = "planner_pomo_break_chime";
  let breakChimeOn = true;
  const POMO_STATE_KEY = "planner_pomo_state_v1";

  const savePomoState = ()=>{
    try{
      const snap = {
        mode,
        cycle,
        cyclesCompleted,
        secondsLeft,
        running,
        nextMiniBreakAt,
        miniBreakActive,
        miniBreakRemaining,
        FOCUS_MIN,
        SHORT_BREAK_MIN,
        LONG_BREAK_MIN,
        updatedAt: Date.now()
      };
      localStorage.setItem(POMO_STATE_KEY, JSON.stringify(snap));
    }catch(e){}
  };
  const loadPomoState = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem(POMO_STATE_KEY)||"null");
      return raw && typeof raw === "object" ? raw : null;
    }catch(e){ return null; }
  };
  const applyPomoState = (snap)=>{
    if(!snap) return;
    FOCUS_MIN = snap.FOCUS_MIN || FOCUS_MIN;
    SHORT_BREAK_MIN = snap.SHORT_BREAK_MIN || SHORT_BREAK_MIN;
    LONG_BREAK_MIN = snap.LONG_BREAK_MIN || LONG_BREAK_MIN;
    mode = snap.mode || "focus";
    cycle = snap.cycle || 1;
    cyclesCompleted = snap.cyclesCompleted || 0;
    secondsLeft = Math.max(0, snap.secondsLeft || totalFor(mode));
    running = false;
    nextMiniBreakAt = snap.nextMiniBreakAt || MINI_BREAK_INTERVAL;
    miniBreakActive = !!snap.miniBreakActive;
    miniBreakRemaining = snap.miniBreakRemaining || 0;
    setMode(mode);
    updateRender();
    updateCycleUI();
  };

  const circleEl = document.getElementById("pomo-circle");
  const modeLabel = document.getElementById("pomo-mode");
  const modeHint = document.getElementById("pomo-mode-hint");
  const cycleEl = document.getElementById("pomo-cycle");
  const completedEl = document.getElementById("pomo-complete");
  const startBtn = document.getElementById("pomo-start");
  const skipBtn = document.getElementById("pomo-skip");
  const subBtn = document.getElementById("pomo-sub");
  const resetBtn = document.getElementById("pomo-reset");
  const dots = [1,2,3,4].map(n=>document.getElementById("pomo-dot"+n));
  const taskText = document.getElementById("pomo-task");
  const shuffleBtn = document.getElementById("pomo-shuffle");
  const focusInput = document.getElementById("pomo-focus-input");
  const shortInput = document.getElementById("pomo-short-input");
  const longInput = document.getElementById("pomo-long-input");
  const breakChimeToggle = document.getElementById("pomo-break-chime-toggle");
  const breakChecks = Array.from(document.querySelectorAll(".pomo-check input[data-break]"));

  function ensureHabitForBreak(key){
    const cfg = BREAK_HABIT_MAP[key];
    if(!cfg) return null;
    const targetName = (cfg.name || key).trim().toLowerCase();
    let habit = habitsState.find(h=> (h.name||"").trim().toLowerCase() === targetName);
    if(!habit){
      habit = normalizeHabit({ name: cfg.name || key, cat: cfg.cat || "exercise", type:"normal", target:7 });
      habitsState.push(habit);
    }
    return habit;
  }

  function markHabitTodayFromBreak(key){
    const habit = ensureHabitForBreak(key);
    if(!habit) return;
    const today = new Date();
    today.setHours(0,0,0,0);
    if(habit.type === "weekly"){
      const wk = getHabitWeekKeySunday();
      habit.weeklyLog = { ...(habit.weeklyLog||{}), [wk]: true };
      habit.days = Array(7).fill(true);
    }else if(habit.type === "monthly"){
      const mk = getHabitMonthKey();
      habit.monthlyLog = { ...(habit.monthlyLog||{}), [mk]: true };
      habit.days = Array(7).fill(true);
    }else{
      const weekStart = getHabitWeekStart();
      const dayIdx = Math.max(0, Math.min(6, Math.round((today - weekStart)/86400000)));
      habit.days[dayIdx] = true;
    }
    recordHabitCompletion(habit.id, today, true);
    saveHabits(habitsState);
    renderHabits();
    if(typeof showToast === "function"){
      showToast(`Logged "${habit.name}" in Habits.`, "success");
    }
  }
  const isTypingTarget = el => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

  function updateDurationLabel(){
    durationLabel.textContent = `${FOCUS_MIN}-min focus . ${SHORT_BREAK_MIN}-min short breaks . ${LONG_BREAK_MIN}-min final break`;
  }

  function loadBreakChime(){
    try{
      const raw = localStorage.getItem("planner_pomo_break_chime");
      if(raw === "false") return false;
    }catch(e){}
    return true;
  }
  function saveBreakChime(val){
    try{ localStorage.setItem("planner_pomo_break_chime", val ? "true" : "false"); }catch(e){}
  }

  function playBeep(type="default"){
    try{
      const ctx = ensureAudio();
      if(!ctx || ctx.state !== "running") return;
      const now = ctx.currentTime;
      const addTone = (freq, duration=0.3, offset=0)=>{
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + offset);
        osc.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + duration);
      };
      if(type === "focus-long"){
        addTone(1400, 0.25, 0);
        addTone(720, 0.2, 0.18);
        addTone(1400, 0.25, 0.38);
        return;
      }
      if(type === "focus-short"){
        addTone(1200, 0.25, 0);
        addTone(1200, 0.25, 0.2);
        return;
      }
      const freq = type === "focus" ? 1200 : type === "long" ? 520 : type === "break" ? 660 : 880;
      addTone(freq, 0.35, 0);
    }catch(e){
      console.warn("Audio beep failed", e);
    }
  }

  function notifyStage(prevMode){
    const tone = mode === "focus"
      ? (prevMode === "long" ? "focus-long" : prevMode === "short" ? "focus-short" : "focus")
      : (mode === "long" ? "long" : "break");
    playBeep(tone);
    if(!("Notification" in window)) return;
    const title = "Pomodoro Timer";
    const body = mode === "focus"
      ? `Focus session started for ${FOCUS_MIN} minutes.`
      : mode === "short"
        ? `Short break for ${SHORT_BREAK_MIN} minutes.`
        : `Long break for ${LONG_BREAK_MIN} minutes.`;
    const fire = ()=>{ try{ new Notification(title,{body}); }catch(e){ console.warn("Notification failed", e); } };
    if(Notification.permission === "granted"){
      fire();
    } else if(Notification.permission !== "denied"){
      Notification.requestPermission().then(p=>{ if(p==="granted") fire(); });
    }
  }
  const notifyPomodoroStart = (resumed=false)=>{
    const mins = Math.max(1, Math.round(totalFor(mode) / 60));
    const label = mode === "focus" ? "Focus" : (mode === "short" ? "Short break" : "Long break");
    const body = resumed
      ? `${label} resumed for ${mins} minutes.`
      : `${label} started for ${mins} minutes.`;
    if(typeof window.plannerNotify === "function"){
      window.plannerNotify("Pomodoro Timer", body, `pomo-${mode}-start`);
    }
  };

  function pad(n){ return String(n).padStart(2,"0"); }
  function fmt(sec){ const m = Math.floor(sec/60); const s = sec%60; return `${pad(m)}:${pad(s)}`; }
  function totalFor(which){
    if(which==="focus") return FOCUS_MIN*60;
    if(which==="short") return SHORT_BREAK_MIN*60;
    if(which==="long") return LONG_BREAK_MIN*60;
    return 0;
  }
  const clampSeconds = (val)=> Math.max(5, Math.min(totalFor(mode), val));

  function updateRender(){
    if(miniBreakActive){
      const total = MINI_BREAK_DURATION;
      const pct = total ? ((total - miniBreakRemaining) / total) * 100 : 0;
      const limited = Math.min(100, Math.max(0, pct));
      if(circleEl){
        const degrees = (limited / 100) * 360;
        circleEl.style.setProperty("--deg", `${degrees}deg`);
      }
      timeEl.textContent = fmt(miniBreakRemaining);
      document.title = `${timeEl.textContent}  Mini break - Pomodoro`;
      return;
    }
    const total = totalFor(mode);
    const pct = total ? ((total - secondsLeft) / total) * 100 : 0;
    const limited = Math.min(100, Math.max(0, pct));
    if(circleEl){
      const degrees = (limited / 100) * 360;
      circleEl.style.setProperty("--deg", `${degrees}deg`);
    }
    timeEl.textContent = fmt(secondsLeft);
    document.title = `${timeEl.textContent} . ${modeLabel.textContent} - Pomodoro`;
    savePomoState();
  }

  function updateCycleUI(){
    cycleEl.textContent = cycle;
    completedEl.textContent = cyclesCompleted;
    dots.forEach((dot, idx)=>{ if(dot) dot.classList.toggle("on", idx < cycle); });
  }
  function resetMiniBreakSchedule(){
    miniBreakActive = false;
    miniBreakRemaining = 0;
    miniBreakStartedAt = null;
    nextMiniBreakAt = (mode === "focus" && FOCUS_MIN * 60 >= MINI_BREAK_INTERVAL) ? MINI_BREAK_INTERVAL : 0;
  }
  function enterMiniBreak(){
    miniBreakActive = true;
    miniBreakStartedAt = Date.now();
    miniBreakRemaining = MINI_BREAK_DURATION;
    nextMiniBreakAt += MINI_BREAK_INTERVAL;
    modeLabel.textContent = "Mini break";
    modeHint.textContent = "Jumping jacks for 60s - move and breathe.";
    showToast("Mini break: 60s of jumping jacks!");
    playBeep("break");
  }
  function exitMiniBreak(){
    if(miniBreakActive && miniBreakStartedAt){
      const pausedMs = Date.now() - miniBreakStartedAt;
      // Shift start so focus time doesn't shrink while the mini break runs.
      startedAt += pausedMs;
    }
    miniBreakActive = false;
    miniBreakRemaining = 0;
    miniBreakStartedAt = null;
    modeLabel.textContent = "Focus";
    modeHint.textContent = `Focus for ${FOCUS_MIN} minutes. Mini break every 10 minutes.`;
    updateRender();
  }

  function setMode(newMode){
    mode = newMode;
    breakWarned = false;
    oneMinuteWarned = false;
    lastBreakChime = null;
    resetMiniBreakSchedule();
    secondsLeft = totalFor(mode);
    startedAt = null;
    modeLabel.textContent = mode === "focus" ? "Focus" : (mode === "short" ? "Short break" : "Long break");
    modeHint.textContent = mode === "focus"
      ? `Focus for ${FOCUS_MIN} minutes. Mini break every 10 minutes.`
      : mode === "short"
        ? `Short break for ${SHORT_BREAK_MIN} minutes.`
        : `Long break for ${LONG_BREAK_MIN} minutes.`;
    updateRender();
  }

  function tick(){
    if(!running) return;
    const now = Date.now();
    if(!startedAt) startedAt = now;
    if(mode === "focus" && miniBreakActive){
      if(!miniBreakStartedAt){
        miniBreakStartedAt = now - (MINI_BREAK_DURATION - miniBreakRemaining) * 1000;
      }
      const elapsedMini = Math.floor((now - miniBreakStartedAt)/1000);
      miniBreakRemaining = Math.max(0, MINI_BREAK_DURATION - elapsedMini);
      updateRender();
      if(miniBreakRemaining > 0) return;
      exitMiniBreak();
    }
    const elapsed = Math.floor((now - startedAt)/1000);
    const total = totalFor(mode);
    secondsLeft = Math.max(0, total - elapsed);
    if(mode === "focus" && !miniBreakActive && nextMiniBreakAt > 0 && elapsed >= nextMiniBreakAt){
      enterMiniBreak();
      updateRender();
      return;
    }
    if((mode==="short" || mode==="long") && !breakWarned && secondsLeft <= 600){
      speakBreakWarning();
      breakWarned = true;
    }
    if((mode==="short" || mode==="long") && !oneMinuteWarned && secondsLeft <= 60){
      speakOneMinuteReminder();
      oneMinuteWarned = true;
    }
    updateRender();
    if(running && (mode==="short" || mode==="long") && breakChimeOn){
      const elapsedBucket = Math.floor((total - secondsLeft) / 30);
      if(elapsedBucket > 0 && elapsedBucket !== lastBreakChime){
        playBeep();
        lastBreakChime = elapsedBucket;
      }
    }
    if(secondsLeft <= 0){
      nextStage();
    }
  }

  function start(){
    const subjectInput = document.getElementById("pomo-subject-input");
    const subjectMsg = document.getElementById("pomo-subject-msg");
    if(mode === "focus" && subjectInput && !subjectInput.value.trim()){
      if(subjectMsg) subjectMsg.textContent = "Tag your class/project before starting.";
      subjectInput.focus();
      return;
    }
    if(running) return;
    if(mode === "focus" && miniBreakActive){
      miniBreakStartedAt = Date.now() - (MINI_BREAK_DURATION - miniBreakRemaining) * 1000;
    } else {
      startedAt = Date.now() - (totalFor(mode) - secondsLeft) * 1000;
    }
    running = true;
    timerId = setInterval(tick, 1000);
    startBtn.textContent = "Pause";
    breakChimeOn = loadBreakChime();
    if(breakChimeToggle){
      breakChimeToggle.checked = breakChimeOn;
    }
    notifyPomodoroStart(secondsLeft < totalFor(mode));
    if(typeof window.plannerWakeLockAcquire === "function"){
      window.plannerWakeLockAcquire();
    }
  }

  function pause(){
    running = false;
    clearInterval(timerId);
    timerId = null;
    startBtn.textContent = "Start";
    if(typeof window.plannerWakeLockRelease === "function"){
      window.plannerWakeLockRelease();
    }
  }

  function nextStage(){
    const prevMode = mode;
    pause();
    if(mode === "focus"){
      cyclesCompleted += 1;
      cycle = cyclesCompleted + 1;
      if(cyclesCompleted % TOTAL_CYCLES === 0){
        setMode("long");
      } else {
        setMode("short");
      }
      try{
        window.dispatchEvent(new CustomEvent("pomoCycleFinished",{ detail:{ cycle: cyclesCompleted } }));
      }catch(e){}
    } else {
      setMode("focus");
      if(cycle > TOTAL_CYCLES) cycle = 1;
    }
    updateCycleUI();
    notifyStage(prevMode);
    if(autoStartEnabled) start();
  }
  function pickFemaleVoice(){
    try{
      const list = (typeof speechSynthesis !== "undefined") ? speechSynthesis.getVoices() : [];
      if(!list || !list.length) return null;
      const match = list.find(v=>/female|woman|girl|Google UK English Female|Google US English Female/i.test((v.name||"") + " " + (v.voiceURI||"")));
      if(match) return match;
      const en = list.find(v=>/^en/i.test(v.lang||""));
      return en || list[0] || null;
    }catch(e){
      return null;
    }
  }

  function speakBreakWarning(){
    const mins = Math.max(1, Math.round(secondsLeft/60));
    const line = mode === "focus"
      ? `About ${mins} minutes left to study. Prepare for break.`
      : `About ${mins} minutes left on your ${mode === "long" ? "long break" : "break"}. Get ready to focus.`;
    try{
      if("speechSynthesis" in window){
        const u = new SpeechSynthesisUtterance(line);
        const voice = pickFemaleVoice();
        if(voice) u.voice = voice;
        speechSynthesis.speak(u);
        return;
      }
    }catch(e){}
    if(typeof Notification === "function" && Notification.permission === "granted"){
      try{ new Notification("Break ending soon", { body: line }); }catch(e){}
    }
  }

  function speakOneMinuteReminder(){
    const line = "One minute left in your break. Get ready to study.";
    try{
      if("speechSynthesis" in window){
        const u = new SpeechSynthesisUtterance(line);
        const voice = pickFemaleVoice();
        if(voice) u.voice = voice;
        speechSynthesis.speak(u);
        return;
      }
    }catch(e){}
  }

  function resetAll(){
    pause();
    cycle = 1;
    cyclesCompleted = 0;
    lastBreakChime = null;
    setMode("focus");
    updateCycleUI();
    addXP(5);
  }

  function skip(){
    pause();
    nextStage();
  }

  function suggestTask(force){
    if(!taskText) return;
    if(!force && mode === "focus") return;
    const pick = tasks[Math.floor(Math.random() * tasks.length)];
    const [title, detail=""] = pick.split(" - ");
    taskText.innerHTML = `<strong>${title}</strong> - ${detail}`;
  }

  function adjustRemaining(deltaSec){
    const total = totalFor(mode);
    if(!total) return;
    const next = clampSeconds(secondsLeft + deltaSec);
    secondsLeft = next;
    if(mode === "focus"){
      resetMiniBreakSchedule();
    } else {
      breakWarned = secondsLeft <= 600 ? breakWarned : false;
      oneMinuteWarned = secondsLeft <= 60 ? oneMinuteWarned : false;
    }
    if(running){
      startedAt = Date.now() - (total - secondsLeft) * 1000;
    } else {
      startedAt = null;
    }
    updateRender();
  }

  startBtn.addEventListener("click", ()=>{ running ? pause() : start(); });
  skipBtn.addEventListener("click", skip);
  subBtn?.addEventListener("click", ()=> adjustRemaining(-300));
  resetBtn.addEventListener("click", resetAll);
  shuffleBtn.addEventListener("click", ()=>suggestTask(true));
  breakChecks.forEach(input=>{
    input.addEventListener("change", ()=>{
      if(input.checked){
        markHabitTodayFromBreak(input.dataset.break);
      }
    });
  });
  const clampMinutes = (val)=>{
    const n = Number(val);
    if(!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(240, n));
  };
  focusInput?.addEventListener("input", e=>{
    if(e.target.value === "") return;
    const val = clampMinutes(parseInt(e.target.value, 10));
    FOCUS_MIN = val;
    focusInput.value = val;
    updateDurationLabel();
    if(mode === "focus"){
      secondsLeft = FOCUS_MIN * 60;
      startedAt = null;
      updateRender();
      modeHint.textContent = `Focus for ${FOCUS_MIN} minutes. Mini break every 10 minutes.`;
      resetMiniBreakSchedule();
    }
  });
  shortInput?.addEventListener("input", e=>{
    if(e.target.value === "") return;
    const val = clampMinutes(parseInt(e.target.value, 10));
    SHORT_BREAK_MIN = val;
    shortInput.value = val;
    updateDurationLabel();
    if(mode === "short"){
      secondsLeft = SHORT_BREAK_MIN * 60;
      startedAt = null;
      updateRender();
      modeHint.textContent = `Short break for ${SHORT_BREAK_MIN} minutes.`;
    }
  });
  longInput?.addEventListener("input", e=>{
    if(e.target.value === "") return;
    const val = clampMinutes(parseInt(e.target.value, 10));
    LONG_BREAK_MIN = val;
    longInput.value = val;
    updateDurationLabel();
    if(mode === "long"){
      secondsLeft = LONG_BREAK_MIN * 60;
      startedAt = null;
      updateRender();
      modeHint.textContent = `Long break for ${LONG_BREAK_MIN} minutes.`;
    }
  });
  if(breakChimeToggle){
    breakChimeOn = loadBreakChime();
    breakChimeToggle.checked = breakChimeOn;
    breakChimeToggle.addEventListener("change", ()=>{
      breakChimeOn = !!breakChimeToggle.checked;
      saveBreakChime(breakChimeOn);
    });
  } else {
    breakChimeOn = loadBreakChime();
  }
  window.__plannerSavePomo = savePomoState;
  window.__plannerRestorePomo = ()=> applyPomoState(loadPomoState());

  document.addEventListener("keydown", e=>{
    if(isTypingTarget(e.target)) return;
    const key = (e.key || "").toLowerCase();
    if(key === "t"){
      e.preventDefault();
      running ? pause() : start();
    }
    if(key === "r") resetAll();
    if(key === "e") skip();
    if(key === "y") suggestTask(true);
  });

  updateDurationLabel();
  updateCycleUI();
  const savedPomo = loadPomoState();
  if(savedPomo){
    applyPomoState(savedPomo);
  }else{
    setMode("focus");
    suggestTask(true);
  }
  if(autoStartEnabled){
    start();
  } else {
    updateRender();
  }
})();

  let renderCalendarPanel = ()=>{};
  (function initCalendar(){
    const rangeEl = document.getElementById("cal-range");
    const gridEl = document.getElementById("cal-grid");
    const allRow = document.getElementById("cal-all-row");
    const prevBtn = document.getElementById("cal-prev");
    const nextBtn = document.getElementById("cal-next");
    const dateInput = document.getElementById("cal-date");
    const showAllChk = document.getElementById("cal-show-all");
    const compactChk = document.getElementById("cal-compact");
    const importInput = document.getElementById("cal-import");
    const clearBtn = document.getElementById("cal-clear");
    const exportBtn = document.getElementById("cal-export-ics");
    const exportChoresBtn = document.getElementById("cal-export-chores");
    const icsStatus = document.getElementById("cal-ics-status");
    const dayOffsets = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };
    if(!rangeEl || !gridEl) return;

    let week = currentWeek;
    const pad = n => String(n).padStart(2,"0");
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    function parseICS(text){
      function unfold(str){ return str.replace(/\r\n[ \t]/g,"").replace(/\n[ \t]/g,""); }
      function parseDate(val){
        let s = String(val||"").trim();
        // remove timezone prefix if present: DTSTART;TZID=America/...:value
        s = s.split(";").pop().split("=").pop();
        s = s.replace(/[^0-9TzZ]/g,"").replace(/T/,"").replace(/Z/,"");
        // accept formats like 20241123 or 20241123T235900
        if(s.length < 8) return null;
        const y = parseInt(s.slice(0,4),10);
        const m = parseInt(s.slice(4,6),10) - 1;
        const d = parseInt(s.slice(6,8),10);
        if(s.length <= 8){
          return { date: new Date(y,m,d,0,0,0), allDay: true };
        }
        const hh = parseInt(s.slice(8,10)||"0",10);
        const mm = parseInt(s.slice(10,12)||"0",10);
        const ss = parseInt(s.slice(12,14)||"0",10);
        return { date: new Date(y,m,d,hh,mm,ss), allDay: false };
      }
      const clean = unfold(text);
      const blocks = clean.split(/BEGIN:VEVENT/).slice(1).map(b=>"BEGIN:VEVENT"+b.split(/END:VEVENT/)[0]+"END:VEVENT");
      const events = [];
      blocks.forEach(block=>{
        const lines = block.split(/\r?\n/);
        let dtstart = null;
        let dtend = null;
        let allDay = false;
        let summary = "";
        let description = "";
        let url = "";
        lines.forEach(line=>{
          if(!line) return;
          if(line.startsWith("DTSTART")){
            const val = line.split(":").slice(1).join(":").trim();
            const parsed = parseDate(val);
            dtstart = parsed.date;
            if(parsed.allDay) allDay = true;
          } else if(line.startsWith("DTEND")){
            const val = line.split(":").slice(1).join(":").trim();
            const parsed = parseDate(val);
            dtend = parsed.date;
          } else if(line.startsWith("SUMMARY")){
            summary = line.split(":").slice(1).join(":").trim().replace(/[<>]/g,"");
          } else if(line.startsWith("DESCRIPTION")){
            description = line.split(":").slice(1).join(":").trim().replace(/[<>]/g,"");
          } else if(line.startsWith("URL")){
            url = line.split(":").slice(1).join(":").trim();
          }
        });
        if(dtstart){
          events.push({
            start: dtstart.toISOString(),
            end: (dtend || dtstart).toISOString(),
            allDay,
            title: summary || "(No title)",
            description: description || "",
            url
          });
        }
      });
      return events;
    }

    function overlapsDay(ev, day){
      const start = new Date(ev.start);
      const end = new Date(ev.end);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0,0,0,0);
      const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23,59,59,999);
      return start <= dayEnd && end >= dayStart;
    }

    function escapeICSValue(value){
      return (value || "").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
    }

    function formatDateForICS(date){
      return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}`;
    }

    function formatTimestampForICS(date){
      return date.toISOString().replace(/[-:]/g,"").replace(/\.\d+Z$/,"Z");
    }

    function normalizeWorkoutText(value){
      return (value || "").replace(/\s+/g," ").trim();
    }

    function getWorkoutScheduleFromTable(){
      const plannerGrid = document.querySelector(".planner-grid");
      const dayLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
      const normalize = (el)=> normalizeWorkoutText(el?.textContent || el?.innerText || "");

      if(plannerGrid){
        const rows = Array.from(plannerGrid.querySelectorAll(".planner-row"));
        if(!rows.length) return null;
        const days = dayLabels.map(day=>({ day, blocks: [] }));
        rows.forEach(row=>{
          const blockLabel = normalize(row.querySelector(".planner-block-label")) || "Block";
          const cells = Array.from(row.querySelectorAll(".planner-day"));
          cells.forEach(cell=>{
            const idx = parseInt(cell.getAttribute("data-day-index")||"0",10);
            const content = normalize(cell.querySelector(".workout-editable"));
            if(!content || isNaN(idx)) return;
            if(days[idx]) days[idx].blocks.push(`${blockLabel}: ${content}`);
          });
        });
        const schedule = days.map((day, idx)=>{
          const focusLine = day.blocks[0] || "";
          const focus = normalizeWorkoutText(focusLine.replace(/^[^:]+:\s*/,""));
          const desc = day.blocks.join("\n").trim();
          return {
            offset: idx,
            title: `${day.day} Workout${focus ? ` - ${focus}` : ""}`,
            desc
          };
        }).filter(item => normalizeWorkoutText(item.desc).length);
        return schedule.length ? schedule : null;
      }

      const table = document.querySelector(".workout-table");
      if(!table) return null;
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      if(!rows.length) return null;
      const days = dayLabels.map(day=>({ day, blocks: [] }));
      rows.forEach((row, rowIdx)=>{
        const blockLabel = normalize(row.querySelector("th")) || `Block ${rowIdx+1}`;
        const cells = Array.from(row.querySelectorAll("td"));
        cells.forEach((cell, cellIdx)=>{
          const content = normalize(cell);
          if(!content) return;
          if(days[cellIdx]) days[cellIdx].blocks.push(`${blockLabel}: ${content}`);
        });
      });
      const schedule = days.map((day, idx)=>{
        const focusLine = day.blocks[0] || "";
        const focus = normalizeWorkoutText(focusLine.replace(/^[^:]+:\s*/,""));
        const desc = day.blocks.join("\n").trim();
        return {
          offset: idx,
          title: `${day.day} Workout${focus ? ` - ${focus}` : ""}`,
          desc
        };
      }).filter(item => normalizeWorkoutText(item.desc).length);
      return schedule.length ? schedule : null;
    }

    function buildWorkoutHabitBundle(baseWeek){
      const weekStart = getHabitWeekStart(baseWeek || new Date());
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        "PRODID:-//Planner//Workouts+Habits//EN"
      ];
      const autoEvents = [];
      const addEvent = (title, startDate, endDate, desc="")=>{
        lines.push(
          "BEGIN:VEVENT",
          `UID:auto-${title.replace(/[^a-z0-9]/gi,"-")}-${startDate.getTime()}`,
          `DTSTAMP:${formatTimestampForICS(new Date())}`,
          `SUMMARY:${escapeICSValue(title)}`,
          `DESCRIPTION:${escapeICSValue(desc || title)} [auto workouts/habits]`,
          `DTSTART;VALUE=DATE:${formatDateForICS(startDate)}`,
          `DTEND;VALUE=DATE:${formatDateForICS(endDate)}`,
          "END:VEVENT"
        );
        autoEvents.push({
          title,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          allDay: true,
          description: `${desc || title} [auto workouts/habits]`,
          url: ""
        });
      };
      const workouts = getWorkoutScheduleFromTable() || [
        { title:"Chest & Back Strength", offset:0, desc:"Incline bench, pullups, rows" },
        { title:"Technique / Push", offset:1, desc:"Planche entries, push skill practice" },
        { title:"Legs / Abs / Traps", offset:2, desc:"Squats/lunges, hip thrusts, abs, shrugs" },
        { title:"Technique Focus", offset:3, desc:"Pick 1-2 skills and drill clean reps" },
        { title:"Arms / Shoulder / Wrist", offset:4, desc:"Presses, curls, lateral raises, wrist care" },
        { title:"Full-Body Smith", offset:5, desc:"Smith squats, hinge, bench, row, press" },
        { title:"Recovery / Mobility", offset:6, desc:"Rest day; gentle mobility only" }
      ];
      workouts.forEach(w=>{
        const start = new Date(weekStart);
        start.setDate(start.getDate() + (w.offset||0));
        const end = new Date(start);
        end.setDate(end.getDate()+1);
        addEvent(w.title, start, end, w.desc);
      });
      if(Array.isArray(habitsState)){
        habitsState.forEach(habit=>{
          if(!habit || habit.type !== "normal") return;
          habit.days.forEach((on, idx)=>{
            if(!on) return;
            const d = new Date(weekStart);
            d.setDate(d.getDate() + idx);
            const end = new Date(d);
            end.setDate(end.getDate() + 1);
            addEvent(habit.name || "Habit", d, end, `${habit.name || "Habit"} - from Habits tab`);
          });
        });
      }
      lines.push("END:VCALENDAR");
      return { ics: lines.join("\r\n"), events: autoEvents };
    }

    function buildChoreICS(baseWeek){
      const weekStart = new Date(baseWeek);
      weekStart.setHours(0,0,0,0);
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        "PRODID:-//Failsafe Planner//Chores//EN"
      ];
      const pad = n => String(n).padStart(2,"0");
      const formatDate = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;

      const chores = [
        { title:"Bathroom reset", dayOffset:1 },
        { title:"Laundry run", dayOffset:2 },
        { title:"Grocery/Walmart necessities (with a list)", dayOffset:3 },
        { title:"Social time with friends", dayOffset:4 },
        { title:"Full-body shave", dayOffset:5 },
        { title:"Credit freeze/SSN lock check (3 bureaus)", dayOffset:6 },
        { title:"Creative reps: video editing or pyrography", dayOffset:0 },
        { title:"Fridge clear + wipe (biweekly)", dayOffset:2 },
        { title:"Dye hair (one-time)", dayOffset:6 }
      ];

      chores.forEach((chore, idx)=>{
        const start = new Date(weekStart);
        start.setDate(weekStart.getDate() + (chore.dayOffset || 0));
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        lines.push(
          "BEGIN:VEVENT",
          `UID:chore-${idx}-${Date.now()}`,
          `DTSTAMP:${formatTimestampForICS(new Date())}`,
          `SUMMARY:${chore.title}`,
          `DESCRIPTION:${chore.title}`,
          `DTSTART;VALUE=DATE:${formatDate(start)}`,
          `DTEND;VALUE=DATE:${formatDate(end)}`,
          "END:VEVENT"
        );
      });

      lines.push("END:VCALENDAR");
      return lines.join("\r\n");
    }

    function buildPlannerICS(){
      const weekStart = new Date(week);
      weekStart.setHours(0,0,0,0);
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        "PRODID:-//Failsafe Planner//EN"
      ];
      let count = 0;
      dayOrder.forEach(dayName=>{
        const entries = data[dayName] || [];
        if(!entries.length) return;
        const offset = dayOffsets[dayName] ?? 0;
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + offset);
        const nextDay = new Date(dayDate);
        nextDay.setDate(dayDate.getDate() + 1);
        entries.forEach((entry, idx)=>{
          const trimmed = (entry || "").trim();
          if(!trimmed) return;
          const summary = escapeICSValue(trimmed);
          lines.push(
            "BEGIN:VEVENT",
            `UID:planner-${dayName}-${offset}-${idx}-${Date.now()}`,
            `DTSTAMP:${formatTimestampForICS(new Date())}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${summary}`,
            `DTSTART;VALUE=DATE:${formatDateForICS(dayDate)}`,
            `DTEND;VALUE=DATE:${formatDateForICS(nextDay)}`,
            "END:VEVENT"
          );
          count += 1;
        });
      });
      lines.push("END:VCALENDAR");
      return { content: lines.join("\r\n"), count };
    }

    function updateICSStatus(message, tone){
      if(!icsStatus) return;
      icsStatus.textContent = message;
      icsStatus.classList.toggle("warn", tone === "warn");
      icsStatus.classList.toggle("success", tone === "success");
    }

    function mergeAutoEvents(newEvents){
      const existing = loadEvents();
      const filtered = existing.filter(ev => !(ev.description||"").includes("[auto workouts/habits]"));
      const seen = new Set(filtered.map(ev=>`${ev.title}|${ev.start}`));
      newEvents.forEach(ev=>{
        const key = `${ev.title}|${ev.start}`;
        if(!seen.has(key)){
          seen.add(key);
          filtered.push(ev);
        }
      });
      saveEvents(filtered);
      return filtered.length;
    }

    function ensureAutoWorkouts(targetWeek){
      try{
        const baseWeek = targetWeek || currentWeek || new Date();
        const { events } = buildWorkoutHabitBundle(baseWeek);
        mergeAutoEvents(events);
      }catch(err){
        console.warn("Auto workout calendar sync failed", err);
      }
    }

    ensureAutoWorkouts(currentWeek);

    renderCalendarPanel = function(){
      week = currentWeek;
      ensureAutoWorkouts(week);
      const events = loadEvents();
      if(dateInput){
        dateInput.value = `${week.getFullYear()}-${pad(week.getMonth()+1)}-${pad(week.getDate())}`;
      }
      const end = new Date(week);
      end.setDate(week.getDate()+6);
rangeEl.textContent = `${week.toLocaleDateString(undefined,{month:"short",day:"numeric"})} - ${end.toLocaleDateString(undefined,{month:"short",day:"numeric"})}`;
      const showAll = showAllChk ? showAllChk.checked : true;
      const compact = compactChk ? compactChk.checked : false;
      const formatHourLabel = (h)=>{
        const ampm = h >= 12 ? "PM" : "AM";
        const hour12 = ((h + 11) % 12) + 1;
        return `${hour12}:00 ${ampm}`;
      };
      if(allRow){
        allRow.innerHTML = "";
        const showRow = showAll && !compact;
        allRow.classList.toggle("hidden", !showRow);
        if(showRow){
          const label = document.createElement("div");
          label.textContent = "All-day";
          allRow.append(label);
          for(let i=0;i<7;i++){
            const day = new Date(week);
            day.setDate(week.getDate()+i);
            const cell = document.createElement("div");
            const allDayItems = events.filter(ev => ev.allDay && overlapsDay(ev, day));
            if(!allDayItems.length){
              cell.textContent = "";
            } else {
              allDayItems.forEach(ev=>{
                const tag = document.createElement("span");
                tag.className = "cal-tag";
                tag.textContent = ev.title;
                cell.append(tag);
              });
            }
            allRow.append(cell);
          }
        }
      }
      gridEl.innerHTML = "";
      const headTime = document.createElement("div");
      headTime.className = "cal-h";
      headTime.textContent = "Time";
      gridEl.append(headTime);

      for(let i=0;i<7;i++){
        const day = new Date(week);
        day.setDate(week.getDate()+i);
        const header = document.createElement("div");
        header.className = "cal-h";
        header.textContent = `${days[day.getDay()]} ${day.getMonth()+1}/${day.getDate()}`;
        gridEl.append(header);
      }

      const timeCol = document.createElement("div");
      timeCol.className = "cal-col cal-time-col";
      for(let h=0; h<24; h++){
        const hour = document.createElement("div");
        hour.className = "cal-hour cal-time-hour";
        hour.textContent = formatHourLabel(h);
        timeCol.append(hour);
      }
      gridEl.append(timeCol);

      for(let i=0;i<7;i++){
        const col = document.createElement("div");
        col.className = "cal-col";
        for(let h=0; h<24; h++){
          const hour = document.createElement("div");
          hour.className = "cal-hour";
          col.append(hour);
        }
        const day = new Date(week);
        day.setDate(week.getDate()+i);
        const timedEvents = events.filter(ev => !ev.allDay && overlapsDay(ev, day));
        timedEvents.forEach(ev=>{
          const s = new Date(ev.start);
          const e = new Date(ev.end);
          const top = s.getHours()*60 + s.getMinutes();
          const bottom = e.getHours()*60 + e.getMinutes();
          const eventEl = document.createElement("div");
          eventEl.className = "event";
          eventEl.style.top = `${top}px`;
          eventEl.style.height = `${Math.max(20, bottom - top)}px`;
          eventEl.textContent = ev.title;
          if(ev.description) eventEl.title = ev.description;
          col.append(eventEl);
        });
        gridEl.append(col);
      }
      currentWeek = week;
    };

    const autoImportBtn = document.getElementById("cal-sync-workouts");
    const autoExportBtn = document.getElementById("cal-export-workouts");
    autoImportBtn && autoImportBtn.addEventListener("click", ()=>{
      ensureAutoWorkouts(currentWeek);
      renderCalendarPanel();
      updateICSStatus("Imported workouts + habits into calendar.", "success");
    });
    autoExportBtn && autoExportBtn.addEventListener("click", ()=>{
      const { ics } = buildWorkoutHabitBundle(currentWeek);
      downloadBlob(ics, "workouts-habits.ics", "text/calendar;charset=utf-8");
      updateICSStatus("Downloaded workouts + habits .ics", "success");
    });

    prevBtn && prevBtn.addEventListener("click", ()=>{ week.setDate(week.getDate()-7); currentWeek = week; renderCalendarPanel(); });
    nextBtn && nextBtn.addEventListener("click", ()=>{ week.setDate(week.getDate()+7); currentWeek = week; renderCalendarPanel(); });
    dateInput && dateInput.addEventListener("change", e=>{
      const val = e.target.value;
      if(!val) return;
      const next = new Date(val);
      if(!isNaN(next)) week = startOfWeek(next);
      currentWeek = week;
      renderCalendarPanel();
    });
    showAllChk && showAllChk.addEventListener("change", renderCalendarPanel);
    compactChk && compactChk.addEventListener("change", renderCalendarPanel);
    clearBtn && clearBtn.addEventListener("click", ()=>{
      if(confirm("Clear all imported events?")){
        localStorage.removeItem(CAL_KEY);
        renderCalendarPanel();
        updateICSStatus("Imported events cleared.", "success");
      }
    });
    importInput && importInput.addEventListener("change", e=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try{
          const imported = parseICS(String(reader.result));
          if(imported.length){
            const existing = loadEvents();
            saveEvents(existing.concat(imported));
            updateICSStatus(`Imported ${imported.length} events from ${file.name}.`, "success");
            renderCalendarPanel();
          } else {
            updateICSStatus("No events found in that file.", "warn");
          }
        }catch(err){
          updateICSStatus("Could not read calendar file.", "warn");
        }
        importInput.value = "";
      };
      reader.readAsText(file);
    });

    exportBtn && exportBtn.addEventListener("click", ()=>{
      const { content, count } = buildPlannerICS();
      if(!count){
        updateICSStatus("No planner entries found for this week.", "warn");
        return;
      }
      const startLabel = `${week.getFullYear()}-${pad(week.getMonth()+1)}-${pad(week.getDate())}`;
      const endDate = new Date(week);
      endDate.setDate(week.getDate()+6);
      const endLabel = `${endDate.getFullYear()}-${pad(endDate.getMonth()+1)}-${pad(endDate.getDate())}`;
      const fileName = `planner-${startLabel}-${endLabel}.ics`;
      downloadBlob(content, fileName, "text/calendar;charset=utf-8");
      const rangeLabel = rangeEl ? rangeEl.textContent : `${startLabel} - ${endLabel}`;
      updateICSStatus(`Exported ${count} planner entries for ${rangeLabel}.`, "success");
    });

    exportChoresBtn && exportChoresBtn.addEventListener("click", ()=>{
      const weekStart = currentWeek || startOfWeek(new Date());
      const content = buildChoreICS(weekStart);
      const startLabel = `${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,"0")}-${String(weekStart.getDate()).padStart(2,"0")}`;
      const fileName = `chores-${startLabel}.ics`;
      downloadBlob(content, fileName, "text/calendar;charset=utf-8");
      updateICSStatus("Chores.ics downloaded for this week.", "success");
    });

    renderCalendarPanel();
    updateICSStatus("Workouts + habits feed auto-loaded into calendar. Import or export .ics files in this tab.", "success");
  })();

  (function initAdvancedCalendar(){
    const root = document.getElementById("calendar-advanced");
    if(!root) return;

    const monthEl = document.getElementById("calendar-adv-month");
    const yearEl = document.getElementById("calendar-adv-year");
    const weekdaysEl = document.getElementById("calendar-adv-weekdays");
    const daysEl = document.getElementById("calendar-adv-days");
    const statusEl = document.getElementById("calendar-adv-status");
    const prevBtn = document.getElementById("calendar-adv-prev");
    const nextBtn = document.getElementById("calendar-adv-next");
    const todayBtn = document.getElementById("calendar-adv-today");
    const addBtn = document.getElementById("calendar-adv-add-btn");
    const classesBtn = document.getElementById("calendar-adv-classes-btn");
    const importBtn = document.getElementById("calendar-adv-import-btn");
    const exportBtn = document.getElementById("calendar-adv-export-btn");
    const importInput = document.getElementById("calendar-adv-import");
    const overlay = document.getElementById("calendar-adv-overlay");
    const panel = document.getElementById("calendar-adv-panel");
    const panelTitle = document.getElementById("calendar-adv-panel-title");
    const panelSub = document.getElementById("calendar-adv-panel-sub");
    const panelClose = document.getElementById("calendar-adv-panel-close");
    const panelAdd = document.getElementById("calendar-adv-panel-add");
    const allDayEl = document.getElementById("calendar-adv-all-day");
    const timeBlocksEl = document.getElementById("calendar-adv-timeblocks");
    const modal = document.getElementById("calendar-adv-modal");
    const modalTitle = modal ? modal.querySelector(".calendar-adv-modal-title") : null;
    const modalClose = document.getElementById("calendar-adv-modal-close");
    const modalCancel = document.getElementById("calendar-adv-cancel");
    const form = document.getElementById("calendar-adv-form");
    const titleInput = document.getElementById("calendar-adv-title");
    const dateInput = document.getElementById("calendar-adv-date");
    const timeInput = document.getElementById("calendar-adv-time");
    const repeatSelect = document.getElementById("calendar-adv-repeat");
    const repeatUntilInput = document.getElementById("calendar-adv-repeat-until");
    const descInput = document.getElementById("calendar-adv-desc");
    const colorsWrap = document.getElementById("calendar-adv-colors");
    const reminderToast = document.getElementById("calendar-adv-reminder");
    const searchInput = document.getElementById("calendar-adv-search");
    const weekViewEl = document.getElementById("calendar-adv-week-view");
    const agendaViewEl = document.getElementById("calendar-adv-agenda-view");
    const gridWrap = root.querySelector(".calendar-adv-grid");
    const tabs = Array.from(root.querySelectorAll(".calendar-adv-tab"));
    const filterBtn = document.getElementById("calendar-adv-filter-btn");
    const filterPanel = document.getElementById("calendar-adv-filter-panel");
    const filterClearColors = document.getElementById("calendar-adv-filter-clear-colors");
    const filterClearAll = document.getElementById("calendar-adv-filter-clear-all");
    const miniMonthEl = document.getElementById("calendar-mini-month");
    const miniYearEl = document.getElementById("calendar-mini-year");
    const miniDaysEl = document.getElementById("calendar-mini-days");
    const miniPrevBtn = document.getElementById("calendar-mini-prev");
    const miniNextBtn = document.getElementById("calendar-mini-next");
    const miniWrap = document.getElementById("calendar-mini");
    const miniToggle = document.getElementById("calendar-mini-toggle");
    const miniSidebar = document.querySelector(".calendar-sidebar");
    const MINI_PREF_KEY = "planner_calendar_mini_collapsed";
    const positionMiniCalendar = ()=>{
      if(!miniToggle || !miniWrap) return;
      const rect = miniToggle.getBoundingClientRect();
      const wrapRect = miniWrap.getBoundingClientRect();
      const padding = 12;
      const top = rect.bottom + 8;
      let left = rect.left;
      const maxLeft = Math.max(padding, window.innerWidth - wrapRect.width - padding);
      if(left > maxLeft) left = maxLeft;
      document.documentElement.style.setProperty("--calendar-mini-top", `${Math.round(top)}px`);
      document.documentElement.style.setProperty("--calendar-mini-left", `${Math.round(left)}px`);
    };
    const syncMiniPosition = ()=>{
      if(!miniSidebar || miniSidebar.classList.contains("calendar-mini-collapsed")) return;
      positionMiniCalendar();
    };

    const setMiniCollapsed = (collapsed)=>{
      if(!miniSidebar || !miniToggle) return;
      miniSidebar.classList.toggle("calendar-mini-collapsed", collapsed);
      miniToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      miniToggle.title = collapsed ? "Show mini calendar" : "Hide mini calendar";
      if(hasStorage){
        try{ localStorage.setItem(MINI_PREF_KEY, collapsed ? "1" : "0"); }catch(e){}
      }
      if(miniWrap){
        miniWrap.setAttribute("aria-hidden", collapsed ? "true" : "false");
      }
      if(!collapsed){
        requestAnimationFrame(()=> positionMiniCalendar());
      }
    };

    if(miniToggle && miniSidebar){
      const stored = hasStorage ? localStorage.getItem(MINI_PREF_KEY) : null;
      const initialCollapsed = stored === null ? true : stored === "1";
      setMiniCollapsed(initialCollapsed);
      miniToggle.addEventListener("click", ()=>{
        const next = !miniSidebar.classList.contains("calendar-mini-collapsed");
        setMiniCollapsed(next);
      });
      window.addEventListener("resize", syncMiniPosition);
      window.addEventListener("scroll", syncMiniPosition, true);
      window.addEventListener("tabchange", (event)=>{
        if(event.detail?.id === "tab-calendar"){
          requestAnimationFrame(syncMiniPosition);
        }
      });
    }

    if(!monthEl || !yearEl || !weekdaysEl || !daysEl) return;

    const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
    const WEEK_HOURS = Array.from({ length: 24 }, (_, i) => i);
    const WEEK_HOUR_HEIGHT = 56;
    const weekdayLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long" });
    const yearFormatter = new Intl.DateTimeFormat(undefined, { year: "numeric" });
    const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long" });
    const fullDateFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const shortWeekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
    const monthDayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
    const colorHex = {
      indigo: "#6366f1",
      coral: "#fb7185",
      emerald: "#10b981",
      violet: "#a78bfa",
      amber: "#f59e0b"
    };

    let currentDate = new Date();
    let selectedDate = null;
    let activeColor = "indigo";
    let events = loadEvents();
    let visibleEvents = events;
    let searchTerm = "";
    let selectedColors = new Set();
    let timeFilter = "all";
    let activeView = "month";
    let editingEventId = null;
    let editingSeriesId = "";
    let editingSeriesStart = "";
    let editingSeriesEventDate = "";
    const BELT_ENTRIES_KEY = "belt-tracker-entries";
    const autoFiles = (root.dataset.icsFiles || "").split(",").map((s)=>s.trim()).filter(Boolean);
    const getBeltSummary = ()=>{
      try{
        const raw = localStorage.getItem(BELT_ENTRIES_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed) ? parsed : [];
        const classEntries = list.filter((entry)=>entry && entry.type === "class" && entry.date);
        const classCount = classEntries.length;
        const dates = new Set(classEntries.map((entry)=>entry.date));
        return { classCount, dates, tier: getBeltTier(classCount) };
      }catch(e){
        return { classCount: 0, dates: new Set(), tier: getBeltTier(0) };
      }
    };
    let beltSummary = getBeltSummary();

    const setStatus = (msg, tone)=>{
      if(!statusEl) return;
      statusEl.textContent = msg;
      statusEl.classList.toggle("success", tone === "success");
      statusEl.classList.toggle("warn", tone === "warn");
    };

    const startOfMonth = (date)=> new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = (date)=> new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startOfWeekSunday = (date)=>{
      const d = new Date(date);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0,0,0,0);
      return d;
    };
    const endOfWeekSunday = (date)=>{
      const d = startOfWeekSunday(date);
      d.setDate(d.getDate() + 6);
      return d;
    };
    const eachDayOfInterval = (start, end)=>{
      const days = [];
      const cursor = new Date(start);
      cursor.setHours(0,0,0,0);
      const endDay = new Date(end);
      endDay.setHours(0,0,0,0);
      while(cursor <= endDay){
        days.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    };
    const isSameDay = (a, b)=>{
      if(!a || !b) return false;
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    };
    const isSameMonth = (a, b)=> a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
    const isToday = (d)=> isSameDay(d, new Date());
    const formatHourLabel = (hour)=>{
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = ((hour + 11) % 12) + 1;
      return `${hour12}:00 ${ampm}`;
    };
    const addDaysToDate = (date, days)=>{
      const next = new Date(date);
      next.setDate(next.getDate() + days);
      return next;
    };
    const addMonthsToDate = (date, months)=>{
      const next = new Date(date);
      const day = next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + months);
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, daysInMonth));
      return next;
    };
    const addYearsToDate = (date, years)=>{
      const next = new Date(date);
      next.setFullYear(next.getFullYear() + years);
      return next;
    };
    const getDefaultRepeatUntil = (start, repeat)=>{
      if(repeat === "daily") return addDaysToDate(start, 30);
      if(repeat === "weekly") return addDaysToDate(start, 7 * 12);
      if(repeat === "monthly") return addMonthsToDate(start, 6);
      if(repeat === "yearly") return addYearsToDate(start, 3);
      return addMonthsToDate(start, 3);
    };
    const getSeriesStartDate = (seriesId)=>{
      if(!seriesId) return "";
      const seriesEvents = loadEvents().filter((ev)=>ev.seriesId === seriesId && ev.date);
      if(!seriesEvents.length) return "";
      return seriesEvents
        .map((ev)=>ev.date)
        .sort()[0];
    };
    const applySearchFilter = (list)=>{
      const term = searchTerm ? searchTerm.toLowerCase() : "";
      const now = new Date();
      return list.filter((ev)=>{
        if(term){
          const title = String(ev.title || "").toLowerCase();
          const desc = String(ev.description || "").toLowerCase();
          const date = String(ev.date || "").toLowerCase();
          if(!title.includes(term) && !desc.includes(term) && !date.includes(term)) return false;
        }
        if(selectedColors.size){
          const color = ev.color || "indigo";
          if(!selectedColors.has(color)) return false;
        }
        if(timeFilter !== "all"){
          const eventDate = new Date(`${ev.date}T${ev.time || "00:00"}`);
          if(isNaN(eventDate.getTime())) return false;
          if(timeFilter === "upcoming" && eventDate < now) return false;
          if(timeFilter === "past" && eventDate >= now) return false;
        }
        return true;
      });
    };
    const getPlannerRangeForView = ()=>{
      if(activeView === "week"){
        return {
          start: startOfWeekSunday(currentDate),
          end: endOfWeekSunday(currentDate)
        };
      }
      if(activeView === "agenda"){
        const today = new Date();
        today.setHours(0,0,0,0);
        return { start: today, end: today };
      }
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        start: startOfWeekSunday(monthStart),
        end: endOfWeekSunday(monthEnd)
      };
    };
    const refreshVisibleEvents = ()=>{
      const baseEvents = events.filter((ev)=> !isPlannerSeriesEvent(ev));
      const range = getPlannerRangeForView();
      const plannerEvents = buildPlannerEventsForRange(range.start, range.end);
      visibleEvents = applySearchFilter(baseEvents.concat(plannerEvents));
    };
    const getEventsForDate = (date, list = visibleEvents)=>{
      const key = formatDateKey(date);
      return list.filter((ev)=>ev.date === key);
    };
    const mergeEvents = (base, incoming)=>{
      const seen = new Set(base.map((ev)=>`${ev.title}|${ev.start}|${ev.time || ""}`));
      let added = 0;
      incoming.forEach((ev)=>{
        const key = `${ev.title}|${ev.start}|${ev.time || ""}`;
        if(!seen.has(key)){
          seen.add(key);
          base.push(ev);
          added += 1;
        }
      });
      return { merged: base, added };
    };
    const buildRecurringEvents = (baseEvent, repeat, untilValue)=>{
      const events = [];
      if(repeat === "none") return events;
      const hasTime = typeof baseEvent.time === "string" && baseEvent.time.trim() !== "";
      const startSeed = new Date(`${baseEvent.date}T${hasTime ? baseEvent.time : "00:00"}`);
      if(isNaN(startSeed.getTime())) return events;
      let untilDate = untilValue ? new Date(`${untilValue}T23:59:59`) : null;
      if(!untilDate || isNaN(untilDate.getTime())){
        untilDate = getDefaultRepeatUntil(startSeed, repeat);
        setStatus(`Repeat end not set. Using ${formatDateKey(untilDate)}.`, "warn");
      }
      const seriesId = (typeof baseEvent.seriesId === "string" && baseEvent.seriesId)
        ? baseEvent.seriesId
        : `series_${makeEventId()}`;
      const maxOccurrences = 500;
      const durationMinutes = Number(baseEvent.durationMinutes);
      const safeDuration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60;
      const endTime = typeof baseEvent.endTime === "string" ? baseEvent.endTime : "";
      let cursor = new Date(startSeed);
      let count = 0;
      while(cursor <= untilDate && count < maxOccurrences){
        const dateValue = formatDateKey(cursor);
        let startIso = "";
        let endIso = "";
        if(hasTime){
          const startDate = new Date(`${dateValue}T${baseEvent.time}`);
          let endDate = endTime ? new Date(`${dateValue}T${endTime}`) : null;
          if(!endDate || isNaN(endDate.getTime()) || endDate <= startDate){
            endDate = new Date(startDate.getTime() + safeDuration * 60000);
          }
          startIso = startDate.toISOString();
          endIso = endDate.toISOString();
        }
        const record = normalizeEventRecord({
          title: baseEvent.title,
          date: dateValue,
          time: hasTime ? baseEvent.time : "",
          start: startIso || undefined,
          end: endIso || undefined,
          allDay: !hasTime,
          description: baseEvent.description || "",
          color: baseEvent.color || "indigo",
          reminders: baseEvent.reminders || [],
          notified_reminders: [],
          recurrence: repeat,
          recurrence_until: formatDateKey(untilDate),
          seriesId
        }).record;
        if(record) events.push(record);
        if(repeat === "daily") cursor = addDaysToDate(cursor, 1);
        else if(repeat === "weekly") cursor = addDaysToDate(cursor, 7);
        else if(repeat === "monthly") cursor = addMonthsToDate(cursor, 1);
        else if(repeat === "yearly") cursor = addYearsToDate(cursor, 1);
        else break;
        count += 1;
      }
      return events;
    };

    const PLANNER_WEEK_MIGRATION_KEY = "planner_week_to_calendar_v1";
    const PLANNER_WEEK_REPEAT_WEEKS = 12;
    const PLANNER_DEFAULT_DURATION_MIN = 60;
    const PLANNER_WEEK_SERIES_PREFIX = "planner_week_";
    const plannerStartsWithTime = (value)=> /^\d{1,2}(?::\d{2})?\s*(?:AM|PM)?\b/i.test(String(value || "").trim());
    const getMondayStart = (date = new Date())=>{
      const d = new Date(date);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0,0,0,0);
      return d;
    };
    const parseTimeToken = (value)=>{
      const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
      if(!match) return null;
      return {
        hour: parseInt(match[1], 10),
        minute: parseInt(match[2] || "0", 10),
        meridiem: match[3] ? match[3].toUpperCase() : ""
      };
    };
    const applyMeridiem = (start, end)=>{
      if(!start.meridiem && end.meridiem){
        if(end.meridiem === "PM" && end.hour === 12 && start.hour < 12){
          start.meridiem = "AM";
        } else {
          start.meridiem = end.meridiem;
        }
      }
      if(start.meridiem && !end.meridiem){
        end.meridiem = start.meridiem;
      }
    };
    const to24Hour = (token)=>{
      let hour = token.hour;
      if(token.meridiem){
        hour = hour % 12;
        if(token.meridiem === "PM") hour += 12;
      }
      return { hour, minute: token.minute };
    };
    const formatTimeValue = (time)=> `${pad2(time.hour)}:${pad2(time.minute)}`;
    const computeDurationMinutes = (startTime, endTime)=>{
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      const diff = Math.round((end.getTime() - start.getTime()) / 60000);
      return diff > 0 ? diff : PLANNER_DEFAULT_DURATION_MIN;
    };
    const parsePlannerSegment = (segment)=>{
      const trimmed = String(segment || "").trim();
      if(!trimmed) return null;
      const rangeMatch = trimmed.match(/^(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)(?:\s*:?\s*)(.*)$/i);
      if(rangeMatch){
        const startToken = parseTimeToken(rangeMatch[1]);
        const endToken = parseTimeToken(rangeMatch[2]);
        const title = (rangeMatch[3] || "").trim() || trimmed;
        if(!startToken || !endToken){
          return { title, allDay: true };
        }
        applyMeridiem(startToken, endToken);
        const startTime = formatTimeValue(to24Hour(startToken));
        const endTime = formatTimeValue(to24Hour(endToken));
        const durationMinutes = computeDurationMinutes(startTime, endTime);
        return { title, startTime, endTime, durationMinutes };
      }
      const singleMatch = trimmed.match(/^(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)(?:\s*:?\s*)(.*)$/i);
      if(singleMatch){
        const startToken = parseTimeToken(singleMatch[1]);
        const title = (singleMatch[2] || "").trim() || trimmed;
        if(!startToken) return { title, allDay: true };
        const startTime = formatTimeValue(to24Hour(startToken));
        return { title, startTime, durationMinutes: PLANNER_DEFAULT_DURATION_MIN };
      }
      return { title: trimmed, allDay: true };
    };
    const parsePlannerLine = (line)=>{
      const segments = String(line || "").split(",").map(part=>part.trim()).filter(Boolean);
      const parsed = [];
      segments.forEach((segment)=>{
        if(!plannerStartsWithTime(segment)){
          if(parsed.length){
            parsed[parsed.length - 1].title += `, ${segment}`;
          } else {
            parsed.push({ title: segment, allDay: true });
          }
          return;
        }
        const entry = parsePlannerSegment(segment);
        if(entry) parsed.push(entry);
      });
      return parsed;
    };
    const PLANNER_EMOJI_RULES = [
      { emoji: "??", test: /\b(breakfast|lunch|dinner|meal)\b/i },
      { emoji: "??", test: /\b(sleep|night routine)\b/i },
      { emoji: "???", test: /\b(gym|workout|stretch|martial arts|jiu|jitsu|walk|jumping jacks|rehab|conditioning|weights|exercise)\b/i },
      { emoji: "??", test: /\b(wake|shower|morning|emails?)\b/i },
      { emoji: "??", test: /\b(free|relax|chill|me time|rest)\b/i },
      { emoji: "??", test: /\b(pomodoro|study|essay|essays|quiz|quizzes|lab|labs|assignments|textbook|coursera|discussion|posts|work|polish|notes|simulations|plan next week|plan)\b/i }
    ];
    const PLANNER_EMOJI_SET = new Set([...PLANNER_EMOJI_RULES.map(rule=>rule.emoji), "??"]);
    const addPlannerEmoji = (title)=>{
      const clean = String(title || "").trim();
      if(!clean) return clean;
      for(const emoji of PLANNER_EMOJI_SET){
        if(clean.includes(emoji)) return clean;
      }
      const match = PLANNER_EMOJI_RULES.find(rule=> rule.test.test(clean));
      const emoji = match ? match.emoji : "??";
      return `${emoji} ${clean}`;
    };
    const isPlannerSeriesEvent = (event)=> typeof event?.seriesId === "string"
      && event.seriesId.startsWith(PLANNER_WEEK_SERIES_PREFIX);
    const buildPlannerEventsForRange = (rangeStart, rangeEnd)=>{
      const results = [];
      const start = new Date(rangeStart);
      const end = new Date(rangeEnd);
      if(isNaN(start.getTime()) || isNaN(end.getTime())) return results;
      const days = eachDayOfInterval(start, end);
      const dayList = Array.isArray(dayOrder) && dayOrder.length ? dayOrder : plannerDayOrder;
      days.forEach((day)=>{
        const dayIdx = (day.getDay() + 6) % 7;
        const dayName = dayList[dayIdx];
        const dayLines = Array.isArray(data?.[dayName]) ? data[dayName] : [];
        if(!dayLines.length) return;
        const dateKey = formatDateKey(day);
        dayLines.forEach((line, lineIdx)=>{
          const segments = parsePlannerLine(line);
          segments.forEach((segment, segmentIdx)=>{
            if(!segment || !segment.title) return;
            const title = addPlannerEmoji(segment.title);
            let startIso = "";
            let endIso = "";
            if(segment.startTime){
              const startDate = new Date(`${dateKey}T${segment.startTime}`);
              let endDate = segment.endTime ? new Date(`${dateKey}T${segment.endTime}`) : null;
              if(!endDate || isNaN(endDate.getTime()) || endDate <= startDate){
                const durationMinutes = segment.durationMinutes || PLANNER_DEFAULT_DURATION_MIN;
                endDate = new Date(startDate.getTime() + durationMinutes * 60000);
              }
              startIso = startDate.toISOString();
              endIso = endDate.toISOString();
            }
            const seriesId = `${PLANNER_WEEK_SERIES_PREFIX}virtual_${dayIdx}_${lineIdx}_${segmentIdx}`;
            const normalized = normalizeEventRecord({
              title,
              date: dateKey,
              time: segment.startTime || "",
              start: startIso || undefined,
              end: endIso || undefined,
              allDay: !!segment.allDay,
              description: "",
              color: "indigo",
              reminders: [],
              recurrence: "none",
              recurrence_until: "",
              seriesId
            });
            if(normalized.record){
              normalized.record.plannerSample = true;
              results.push(normalized.record);
            }
          });
        });
      });
      return results;
    };
    const isPlannerSampleEvent = (event)=> !!event?.plannerSample;
    const warnPlannerSample = ()=>{
      if(typeof showToast === "function"){
        showToast("Sample schedule is read-only.", "warn");
      }
    };
    const buildPlannerWeekEvents = (repeatUntilKey)=>{
      const results = [];
      const weekStart = getMondayStart(new Date());
      const dayList = Array.isArray(dayOrder) && dayOrder.length ? dayOrder : plannerDayOrder;
      dayList.forEach((day, idx)=>{
        const dayLines = Array.isArray(data?.[day]) ? data[day] : [];
        if(!dayLines.length) return;
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + idx);
        const dateKey = formatDateKey(dayDate);
        dayLines.forEach((line, lineIdx)=>{
          const segments = parsePlannerLine(line);
          segments.forEach((segment, segmentIdx)=>{
            if(!segment || !segment.title) return;
            const seriesId = `${PLANNER_WEEK_SERIES_PREFIX}${idx}_${lineIdx}_${segmentIdx}`;
            const baseEvent = {
              title: addPlannerEmoji(segment.title),
              date: dateKey,
              time: segment.startTime || "",
              endTime: segment.endTime || "",
              durationMinutes: segment.durationMinutes || PLANNER_DEFAULT_DURATION_MIN,
              description: "",
              color: "indigo",
              reminders: [],
              allDay: !!segment.allDay,
              seriesId
            };
            const series = buildRecurringEvents(baseEvent, "weekly", repeatUntilKey);
            results.push(...series);
          });
        });
      });
      return results;
    };
    const getPlannerRepeatUntilKey = ()=>{
      const weekStart = getMondayStart(new Date());
      const repeatUntil = new Date(weekStart);
      repeatUntil.setDate(repeatUntil.getDate() + (PLANNER_WEEK_REPEAT_WEEKS * 7));
      return formatDateKey(repeatUntil);
    };
    const migratePlannerWeekToCalendar = ()=>{
      if(!hasStorage) return;
      if(localStorage.getItem(PLANNER_WEEK_MIGRATION_KEY) === "done") return;
      const repeatUntilKey = getPlannerRepeatUntilKey();
      const toImport = buildPlannerWeekEvents(repeatUntilKey);
      if(!toImport.length){
        localStorage.setItem(PLANNER_WEEK_MIGRATION_KEY, "done");
        return;
      }
      const mergedResult = mergeEvents(loadEvents(), toImport);
      events = mergedResult.merged;
      saveEvents(events);
      setStatus(`Moved weekly planner routine into calendar (${mergedResult.added} events).`, "success");
      localStorage.setItem(PLANNER_WEEK_MIGRATION_KEY, "done");
    };

    const setActiveColor = (color)=>{
      activeColor = CAL_EVENT_COLORS.includes(color) ? color : "indigo";
      if(!colorsWrap) return;
      colorsWrap.querySelectorAll(".calendar-adv-color").forEach((btn)=>{
        btn.classList.toggle("active", btn.dataset.color === activeColor);
      });
    };

    let calNotifyGestureSeen = false;
    const markCalGesture = ()=>{ calNotifyGestureSeen = true; document.removeEventListener("pointerdown", markCalGesture, true); };
    document.addEventListener("pointerdown", markCalGesture, true);
    const requestNotifyPermission = ()=>{
      if(!calNotifyGestureSeen) return;
      if(typeof Notification === "undefined") return;
      if(Notification.permission === "default"){
        try{ Notification.requestPermission(); }catch(e){}
      }
    };

    const showReminderToast = (event, label)=>{
      if(!reminderToast) return;
      reminderToast.textContent = `${event.title} - ${label}`;
      reminderToast.classList.add("show");
      setTimeout(()=> reminderToast.classList.remove("show"), 5000);
      if(typeof Notification === "function" && Notification.permission === "granted"){
        try{ new Notification(event.title, { body: label }); }catch(e){}
      }
    };

    const formatReminderLabel = (minutes)=>{
      if(minutes === 15) return "15 minutes before";
      if(minutes === 60) return "1 hour before";
      if(minutes === 120) return "2 hours before";
      if(minutes === 1440) return "1 day before";
      return `${minutes} minutes before`;
    };

    const checkReminders = ()=>{
      const now = new Date();
      let changed = false;
      events = loadEvents();
      events.forEach((event)=>{
        if(!event.date || !event.time || !Array.isArray(event.reminders) || !event.reminders.length) return;
        const eventDateTime = new Date(`${event.date}T${event.time}`);
        if(isNaN(eventDateTime.getTime())) return;
        event.reminders.forEach((reminderMinutes)=>{
          const reminderTime = new Date(eventDateTime.getTime() - reminderMinutes * 60000);
          const diff = Math.abs(now.getTime() - reminderTime.getTime());
          if(diff < 60000){
            if(!event.notified_reminders.includes(reminderMinutes)){
              showReminderToast(event, formatReminderLabel(reminderMinutes));
              event.notified_reminders.push(reminderMinutes);
              changed = true;
            }
          }
        });
      });
      if(changed){
        saveEvents(events);
      }
    };

    const parseIcsDate = (val)=>{
      let s = String(val || "").trim();
      s = s.split(";").pop().split("=").pop();
      s = s.replace(/[^0-9TzZ]/g, "").replace(/T/, "").replace(/Z/, "");
      if(s.length < 8) return null;
      const y = parseInt(s.slice(0,4), 10);
      const m = parseInt(s.slice(4,6), 10) - 1;
      const d = parseInt(s.slice(6,8), 10);
      if(s.length <= 8){
        return { date: new Date(y, m, d, 0, 0, 0), allDay: true };
      }
      const hh = parseInt(s.slice(8,10) || "0", 10);
      const mm = parseInt(s.slice(10,12) || "0", 10);
      const ss = parseInt(s.slice(12,14) || "0", 10);
      return { date: new Date(y, m, d, hh, mm, ss), allDay: false };
    };

    const parseIcsText = (text)=>{
      const clean = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
      const blocks = clean.split(/BEGIN:VEVENT/).slice(1).map((b)=>`BEGIN:VEVENT${b.split(/END:VEVENT/)[0]}END:VEVENT`);
      const parsed = [];
      blocks.forEach((block)=>{
        const lines = block.split(/\r?\n/);
        let dtstart = null;
        let dtend = null;
        let allDay = false;
        let summary = "";
        let description = "";
        let url = "";
        lines.forEach((line)=>{
          if(!line) return;
          if(line.startsWith("DTSTART")){
            const val = line.split(":").slice(1).join(":").trim();
            const parsedDate = parseIcsDate(val);
            if(parsedDate){
              dtstart = parsedDate.date;
              allDay = parsedDate.allDay;
            }
          } else if(line.startsWith("DTEND")){
            const val = line.split(":").slice(1).join(":").trim();
            const parsedDate = parseIcsDate(val);
            if(parsedDate) dtend = parsedDate.date;
          } else if(line.startsWith("SUMMARY")){
            summary = line.split(":").slice(1).join(":").trim().replace(/[<>]/g, "");
          } else if(line.startsWith("DESCRIPTION")){
            description = line.split(":").slice(1).join(":").trim().replace(/[<>]/g, "");
          } else if(line.startsWith("URL")){
            url = line.split(":").slice(1).join(":").trim();
          }
        });
        if(dtstart){
          const startIso = dtstart.toISOString();
          const endIso = (dtend || dtstart).toISOString();
          const normalized = normalizeEventRecord({
            start: startIso,
            end: endIso,
            allDay,
            title: summary || "(No title)",
            description,
            url,
            color: "indigo"
          });
          if(normalized.record) parsed.push(normalized.record);
        }
      });
      return parsed;
    };

    const escapeIcsValue = (value)=> (value || "").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    const formatIcsDate = (date)=> `${date.getFullYear()}${pad2(date.getMonth()+1)}${pad2(date.getDate())}`;
    const formatIcsTimestamp = (date)=> date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

    const buildIcs = (list)=>{
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        "PRODID:-//Planner//Calendar//EN"
      ];
      list.forEach((event)=>{
        const start = event.start ? new Date(event.start) : new Date(`${event.date}T${event.time || "00:00"}`);
        const end = event.end ? new Date(event.end) : start;
        if(isNaN(start)) return;
        const dtstamp = formatIcsTimestamp(new Date());
        if(event.allDay || !event.time){
          const endDateObj = event.end ? new Date(event.end) : new Date(start);
          if(isNaN(endDateObj.getTime()) || formatDateKey(endDateObj) === formatDateKey(start)){
            endDateObj.setDate(endDateObj.getDate() + 1);
          }
          const startDate = formatIcsDate(start);
          const endDate = formatIcsDate(endDateObj);
          lines.push(
            "BEGIN:VEVENT",
            `UID:${event.id || makeEventId()}`,
            `DTSTAMP:${dtstamp}`,
            `SUMMARY:${escapeIcsValue(event.title)}`,
            `DESCRIPTION:${escapeIcsValue(event.description || "")}`,
            `DTSTART;VALUE=DATE:${startDate}`,
            `DTEND;VALUE=DATE:${endDate}`,
            "END:VEVENT"
          );
        } else {
          const dateStr = formatIcsDate(start);
          const timeStr = `${pad2(start.getHours())}${pad2(start.getMinutes())}00`;
          lines.push(
            "BEGIN:VEVENT",
            `UID:${event.id || makeEventId()}`,
            `DTSTAMP:${dtstamp}`,
            `SUMMARY:${escapeIcsValue(event.title)}`,
            `DESCRIPTION:${escapeIcsValue(event.description || "")}`,
            `DTSTART:${dateStr}T${timeStr}`,
            "END:VEVENT"
          );
        }
      });
      lines.push("END:VCALENDAR");
      return lines.join("\r\n");
    };

    const openPanel = (date)=>{
      if(!panel || !overlay) return;
      selectedDate = new Date(date);
      renderPanel();
      panel.classList.add("is-open");
      overlay.classList.add("is-open");
      renderCalendar();
    };
    const closePanel = ()=>{
      panel?.classList.remove("is-open");
      overlay?.classList.remove("is-open");
    };
    const openModal = (date, time, event)=>{
      if(!modal || !form) return;
      const baseDate = date ? new Date(date) : new Date(currentDate);
      const dateValue = formatDateKey(baseDate);
      const isEdit = !!event;
      editingEventId = isEdit ? event.id : null;
      if(isEdit && event.seriesId){
        editingSeriesId = event.seriesId;
        editingSeriesEventDate = event.date || "";
        const seriesStart = getSeriesStartDate(event.seriesId);
        editingSeriesStart = seriesStart || event.date || "";
      } else {
        editingSeriesId = "";
        editingSeriesStart = "";
        editingSeriesEventDate = "";
      }
      if(modalTitle) modalTitle.textContent = isEdit ? "Edit event" : "New event";
      titleInput.value = isEdit ? event.title : "";
      descInput.value = isEdit ? (event.description || "") : "";
      dateInput.value = isEdit ? event.date : dateValue;
      timeInput.value = isEdit ? (event.time || "") : (time || "");
      if(repeatSelect) repeatSelect.value = isEdit && event.recurrence ? event.recurrence : "none";
      if(repeatUntilInput) repeatUntilInput.value = isEdit ? (event.recurrence_until || "") : "";
      modal.classList.add("is-open");
      setActiveColor(isEdit ? (event.color || "indigo") : "indigo");
      const reminderInputs = modal.querySelectorAll(".calendar-adv-reminders input");
      reminderInputs.forEach((input)=>{ input.checked = false; });
      if(isEdit && Array.isArray(event.reminders)){
        reminderInputs.forEach((input)=>{
          const val = parseInt(input.value, 10);
          input.checked = event.reminders.includes(val);
        });
      }
    };
    const closeModal = ()=>{
      modal?.classList.remove("is-open");
      editingEventId = null;
      editingSeriesId = "";
      editingSeriesStart = "";
      editingSeriesEventDate = "";
      if(modalTitle) modalTitle.textContent = "New event";
    };

    const deleteEvent = (eventOrId)=>{
      const list = loadEvents();
      const event = typeof eventOrId === "object"
        ? eventOrId
        : list.find((ev)=>ev.id === eventOrId);
      if(event && isPlannerSampleEvent(event)){
        warnPlannerSample();
        return;
      }
      if(event && event.seriesId){
        const seriesId = event.seriesId;
        const seriesCount = list.filter((ev)=>ev.seriesId === seriesId).length;
        events = list.filter((ev)=>ev.seriesId !== seriesId);
        saveEvents(events);
        renderCalendar();
        renderPanel();
        showToast(`Series removed (${seriesCount} events)`);
        return;
      }
      const id = event ? event.id : eventOrId;
      events = list.filter((ev)=>ev.id !== id);
      saveEvents(events);
      renderCalendar();
      renderPanel();
      showToast("Event removed");
    };

    const createEventCard = (event)=>{
      const card = document.createElement("div");
      card.className = "calendar-adv-event-card";
      card.style.borderLeft = `3px solid ${colorHex[event.color] || colorHex.indigo}`;
      const body = document.createElement("div");
      const isSample = isPlannerSampleEvent(event);
      const title = document.createElement("h4");
      title.textContent = event.title;
      body.appendChild(title);
      if(event.description){
        const desc = document.createElement("p");
        desc.textContent = event.description;
        body.appendChild(desc);
      }
      if(event.time){
        const timeLine = document.createElement("p");
        timeLine.textContent = `Time: ${event.time}`;
        body.appendChild(timeLine);
      }
      const actions = document.createElement("div");
      actions.className = "calendar-adv-event-actions";
      if(isSample){
        const note = document.createElement("span");
        note.textContent = "Sample schedule";
        actions.appendChild(note);
      } else {
        const edit = document.createElement("button");
        edit.className = "calendar-adv-edit";
        edit.type = "button";
        edit.textContent = "Edit";
        edit.addEventListener("click", (e)=>{
          e.stopPropagation();
          openModal(new Date(event.date), event.time, event);
        });
        const del = document.createElement("button");
        del.className = "calendar-adv-delete";
        del.type = "button";
        del.textContent = "Delete";
        del.addEventListener("click", (e)=>{
          e.stopPropagation();
          deleteEvent(event);
        });
        actions.appendChild(edit);
        actions.appendChild(del);
      }
      card.appendChild(body);
      card.appendChild(actions);
      return card;
    };

    const renderPanel = ()=>{
      if(!selectedDate || !panelTitle || !panelSub) return;
      events = loadEvents();
      refreshVisibleEvents();
      panelTitle.textContent = weekdayFormatter.format(selectedDate);
      panelSub.textContent = fullDateFormatter.format(selectedDate);
      const dayEvents = getEventsForDate(selectedDate).slice().sort((a, b)=>{
        const aTime = a.time || "";
        const bTime = b.time || "";
        if(!aTime && bTime) return -1;
        if(aTime && !bTime) return 1;
        return aTime.localeCompare(bTime);
      });
      const allDayEvents = dayEvents.filter((ev)=>!ev.time);
      if(allDayEl){
        allDayEl.innerHTML = "";
        const label = document.createElement("div");
        label.className = "calendar-adv-all-day-title";
        label.textContent = "All day";
        allDayEl.appendChild(label);
        if(allDayEvents.length){
          allDayEvents.forEach((event)=> allDayEl.appendChild(createEventCard(event)));
        } else {
          const empty = document.createElement("div");
          empty.className = "calendar-adv-time-empty";
          empty.textContent = "No all-day events";
          allDayEl.appendChild(empty);
        }
      }
      if(timeBlocksEl){
        timeBlocksEl.innerHTML = "";
        HOURS.forEach((hour)=>{
          const block = document.createElement("div");
          block.className = "calendar-adv-timeblock";
          const label = document.createElement("div");
          label.className = "calendar-adv-time-label";
          label.textContent = formatHourLabel(hour);
          const body = document.createElement("div");
          body.className = "calendar-adv-time-body";
          const hourEvents = dayEvents.filter((ev)=>{
            if(!ev.time) return false;
            const h = parseInt(ev.time.split(":")[0], 10);
            return h === hour;
          });
          if(hourEvents.length){
            hourEvents.forEach((event)=> body.appendChild(createEventCard(event)));
          } else {
            const empty = document.createElement("div");
            empty.className = "calendar-adv-time-empty";
            empty.textContent = "Add event";
            empty.addEventListener("click", ()=> openModal(selectedDate, `${pad2(hour)}:00`));
            body.appendChild(empty);
          }
          block.appendChild(label);
          block.appendChild(body);
          timeBlocksEl.appendChild(block);
        });
      }
    };

    const renderWeekdays = ()=>{
      weekdaysEl.innerHTML = "";
      weekdayLabels.forEach((label)=>{
        const el = document.createElement("div");
        el.className = "calendar-adv-weekday";
        el.textContent = label;
        weekdaysEl.appendChild(el);
      });
    };

    const renderMiniCalendar = ()=>{
      if(!miniDaysEl || !miniMonthEl || !miniYearEl) return;
      refreshVisibleEvents();
      miniMonthEl.textContent = monthFormatter.format(currentDate);
      miniYearEl.textContent = yearFormatter.format(currentDate);
      miniDaysEl.innerHTML = "";
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const gridStart = startOfWeekSunday(monthStart);
      const gridEnd = endOfWeekSunday(monthEnd);
      const days = eachDayOfInterval(gridStart, gridEnd);
      const eventDays = new Set(visibleEvents.map((ev)=>ev.date));
      days.forEach((day)=>{
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "calendar-mini-day";
        if(!isSameMonth(day, currentDate)) cell.classList.add("outside");
        if(isToday(day)) cell.classList.add("today");
        if(selectedDate && isSameDay(day, selectedDate)) cell.classList.add("selected");
        const dayKey = formatDateKey(day);
        if(eventDays.has(dayKey)) cell.classList.add("has-event");
        cell.textContent = day.getDate();
        cell.addEventListener("click", ()=>{
          currentDate = new Date(day);
          openPanel(day);
          renderCalendar();
        });
        miniDaysEl.appendChild(cell);
      });
    };

    const renderDays = ()=>{
      daysEl.innerHTML = "";
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const gridStart = startOfWeekSunday(monthStart);
      const gridEnd = endOfWeekSunday(monthEnd);
      const days = eachDayOfInterval(gridStart, gridEnd);
      days.forEach((day)=>{
        const cell = document.createElement("div");
        cell.className = "calendar-adv-day";
        if(!isSameMonth(day, currentDate)) cell.classList.add("outside");
        if(isToday(day)) cell.classList.add("today");
        if(selectedDate && isSameDay(day, selectedDate)) cell.classList.add("selected");
        const number = document.createElement("div");
        number.className = "calendar-adv-day-number";
        const badge = document.createElement("span");
        badge.textContent = day.getDate();
        number.appendChild(badge);
        cell.appendChild(number);
        const eventsWrap = document.createElement("div");
        eventsWrap.className = "calendar-adv-events";
        const dayKey = formatDateKey(day);
        if(beltSummary.dates.has(dayKey)){
          cell.classList.add("belt-log");
          cell.style.setProperty("--belt-color", beltSummary.tier.color);
          cell.style.setProperty("--belt-glow", beltSummary.tier.glow);
          badge.style.background = beltSummary.tier.color;
          badge.style.color = "#fff";
        }
        const dayEvents = getEventsForDate(day);
        dayEvents.slice(0, 3).forEach((event)=>{
          const chip = document.createElement("div");
          chip.className = "calendar-adv-event";
          const dot = document.createElement("span");
          dot.className = `calendar-adv-event-dot calendar-adv-dot-${event.color || "indigo"}`;
          const text = document.createElement("span");
          text.textContent = event.title;
          chip.appendChild(dot);
          chip.appendChild(text);
          chip.addEventListener("click", (e)=>{
            e.stopPropagation();
            openModal(day, event.time, event);
          });
          eventsWrap.appendChild(chip);
        });
        if(dayEvents.length > 3){
          const more = document.createElement("div");
          more.className = "calendar-adv-more";
          more.textContent = `+${dayEvents.length - 3} more`;
          eventsWrap.appendChild(more);
        }
        cell.appendChild(eventsWrap);
        cell.addEventListener("click", ()=> openPanel(day));
        daysEl.appendChild(cell);
      });
    };

    const renderWeekView = ()=>{
      if(!weekViewEl) return;
      refreshVisibleEvents();
      weekViewEl.innerHTML = "";
      const weekStart = startOfWeekSunday(currentDate);
      const weekEnd = endOfWeekSunday(currentDate);
      const days = eachDayOfInterval(weekStart, weekEnd);

      const header = document.createElement("div");
      header.className = "calendar-adv-week-header";
      const spacer = document.createElement("div");
      spacer.className = "calendar-adv-week-spacer";
      header.appendChild(spacer);
      days.forEach((day)=>{
        const head = document.createElement("div");
        head.className = "calendar-adv-week-head";
        const name = document.createElement("div");
        name.className = "calendar-adv-week-dayname";
        name.textContent = shortWeekdayFormatter.format(day);
        const date = document.createElement("div");
        date.className = "calendar-adv-week-date";
        date.textContent = monthDayFormatter.format(day);
        if(isToday(day)) date.classList.add("today");
        head.appendChild(name);
        head.appendChild(date);
        header.appendChild(head);
      });
      weekViewEl.appendChild(header);

      const body = document.createElement("div");
      body.className = "calendar-adv-week-body";
      const timeCol = document.createElement("div");
      timeCol.className = "calendar-adv-week-time";
      WEEK_HOURS.forEach((hour)=>{
        const row = document.createElement("div");
        row.className = "calendar-adv-week-time-row";
        row.style.height = `${WEEK_HOUR_HEIGHT}px`;
        row.textContent = `${pad2(hour)}:00`;
        timeCol.appendChild(row);
      });
      body.appendChild(timeCol);

      days.forEach((day)=>{
        const dayCol = document.createElement("div");
        dayCol.className = "calendar-adv-week-day";
        if(isToday(day)) dayCol.classList.add("today");
        dayCol.style.height = `${WEEK_HOURS.length * WEEK_HOUR_HEIGHT}px`;
        const hoursWrap = document.createElement("div");
        hoursWrap.className = "calendar-adv-week-hours";
        WEEK_HOURS.forEach((hour)=>{
          const row = document.createElement("div");
          row.className = "calendar-adv-week-hour";
          row.style.height = `${WEEK_HOUR_HEIGHT}px`;
          row.addEventListener("click", ()=> openModal(day, `${pad2(hour)}:00`));
          hoursWrap.appendChild(row);
        });
        dayCol.appendChild(hoursWrap);

        const dayEvents = getEventsForDate(day, visibleEvents);
        dayEvents.forEach((event)=>{
          if(!event.time) return;
          const parts = event.time.split(":").map((p)=> parseInt(p, 10));
          const hour = parts[0];
          const minutes = parts[1] || 0;
          if(Number.isNaN(hour)) return;
          const top = (hour * WEEK_HOUR_HEIGHT) + (minutes / 60) * WEEK_HOUR_HEIGHT;
          const item = document.createElement("div");
          item.className = "calendar-adv-week-event";
          item.style.top = `${top}px`;
          item.style.borderLeft = `3px solid ${colorHex[event.color] || colorHex.indigo}`;
          const title = document.createElement("div");
          title.className = "calendar-adv-week-event-title";
          title.textContent = event.title;
          const meta = document.createElement("div");
          meta.className = "calendar-adv-week-event-time";
          meta.textContent = event.time;
          item.appendChild(title);
          item.appendChild(meta);
          const isSample = isPlannerSampleEvent(event);
          if(isSample){
            item.classList.add("planner-sample");
            item.addEventListener("click", (e)=>{
              e.stopPropagation();
              warnPlannerSample();
            });
          } else {
            const del = document.createElement("button");
            del.className = "calendar-adv-week-event-delete";
            del.type = "button";
            del.textContent = "x";
            del.addEventListener("click", (e)=>{
              e.stopPropagation();
              deleteEvent(event);
            });
            item.appendChild(del);
            item.addEventListener("click", (e)=>{
              e.stopPropagation();
              openModal(day, event.time, event);
            });
          }
          dayCol.appendChild(item);
        });
        body.appendChild(dayCol);
      });
      weekViewEl.appendChild(body);
    };

    const renderAgendaView = ()=>{
      if(!agendaViewEl) return;
      refreshVisibleEvents();
      agendaViewEl.innerHTML = "";
      const now = new Date();
      const sorted = visibleEvents.slice().sort((a, b)=>{
        const aDate = new Date(`${a.date}T${a.time || "00:00"}`);
        const bDate = new Date(`${b.date}T${b.time || "00:00"}`);
        return aDate - bDate;
      });
      const todayKey = formatDateKey(now);
      const list = sorted.filter((event)=> event.date === todayKey);
      if(!list.length){
        const empty = document.createElement("div");
        empty.className = "calendar-adv-empty";
        empty.textContent = "No events today";
        agendaViewEl.appendChild(empty);
        return;
      }
      const grouped = {};
      list.forEach((event)=>{
        const key = event.date;
        if(!grouped[key]) grouped[key] = [];
        grouped[key].push(event);
      });
      const languageRegex = /\b(spanish|japanese|language|french|german|korean|chinese|latin|russian|persian)\b/i;
      const assignmentRegex = /\b(discussion|post|reply|case project|project|essay|writing|quiz|lab|assignment|module|chapter|exam|paper)\b/i;
      const getHaystack = (event)=> `${event.title || ""} ${event.description || ""}`;
      const isLanguageEvent = (event)=> languageRegex.test(getHaystack(event));
      const isAssignmentEvent = (event)=> assignmentRegex.test(getHaystack(event)) || isCourseAssignmentEvent(event);
      const getAgendaBucket = (event)=>{
        if(isPlannerSampleEvent(event)) return "sample";
        if(isLanguageEvent(event)) return "language";
        return "school";
      };
      const agendaDateLabel = (dateKey)=>{
        const d = new Date(dateKey);
        return `${shortWeekdayFormatter.format(d)} ${monthDayFormatter.format(d)}`;
      };
      const createAgendaCard = (event, date)=>{
        const card = document.createElement("div");
        card.className = "calendar-adv-agenda-card";
        const main = document.createElement("div");
        main.className = "calendar-adv-agenda-main";
        const dot = document.createElement("span");
        dot.className = `calendar-adv-agenda-dot dot-${event.color || "indigo"}`;
        const textWrap = document.createElement("div");
        const eventTitle = document.createElement("div");
        eventTitle.className = "calendar-adv-agenda-title";
        eventTitle.textContent = event.title;
        const meta = document.createElement("div");
        meta.className = "calendar-adv-agenda-meta";
        const baseMeta = event.time ? event.time : "All day";
        meta.textContent = event.date && event.date !== todayKey
          ? `${agendaDateLabel(event.date)} . ${baseMeta}`
          : baseMeta;
        textWrap.appendChild(eventTitle);
        textWrap.appendChild(meta);
        if(event.description){
          const desc = document.createElement("div");
          desc.className = "calendar-adv-agenda-desc";
          desc.textContent = event.description;
          textWrap.appendChild(desc);
        }
        main.appendChild(dot);
        main.appendChild(textWrap);
        const actions = document.createElement("div");
        actions.className = "calendar-adv-agenda-actions";
        const isSample = isPlannerSampleEvent(event);
        if(isSample){
          const note = document.createElement("span");
          note.textContent = "Sample schedule";
          actions.appendChild(note);
        } else {
          const del = document.createElement("button");
          del.className = "calendar-adv-agenda-delete";
          del.type = "button";
          del.textContent = "Delete";
          del.addEventListener("click", (e)=>{
            e.stopPropagation();
            deleteEvent(event);
          });
          actions.appendChild(del);
        }
        card.appendChild(main);
        card.appendChild(actions);
        card.addEventListener("click", ()=>{
          if(isSample){
            warnPlannerSample();
            return;
          }
          openModal(date, event.time, event);
        });
        return card;
      };
      Object.keys(grouped).sort().forEach((dateKey)=>{
        const group = document.createElement("div");
        group.className = "calendar-adv-agenda-group";
        const date = new Date(dateKey);
        const title = document.createElement("div");
        title.className = "calendar-adv-agenda-date";
        title.textContent = fullDateFormatter.format(date);
        group.appendChild(title);
        const columns = document.createElement("div");
        columns.className = "calendar-adv-agenda-columns";
        const buckets = { sample: [], language: [], school: [] };
        grouped[dateKey].forEach((event)=>{
          const bucket = getAgendaBucket(event);
          if(!buckets[bucket]) buckets[bucket] = [];
          buckets[bucket].push(event);
        });
        const weekStart = startOfWeekSunday(now);
        const weekEnd = endOfWeekSunday(now);
        const isInWeek = (dateKey)=>{
          const d = new Date(dateKey);
          d.setHours(0,0,0,0);
          return d >= weekStart && d <= weekEnd;
        };
        const weekAssignments = visibleEvents.filter((event)=>{
          if(!event || !event.date || !isInWeek(event.date)) return false;
          if(isPlannerSampleEvent(event)) return false;
          if(isLanguageEvent(event)) return false;
          return isAssignmentEvent(event);
        });
        if(weekAssignments.length){
          buckets.school = weekAssignments;
        }
        const columnDefs = [
          { id: "sample", title: "School week in effect", empty: "No schedule items" },
          { id: "language", title: "Languages", empty: "No language items" },
          { id: "school", title: "School assignments (this week)", empty: "No assignments" }
        ];
        columnDefs.forEach((col)=>{
          const colWrap = document.createElement("div");
          colWrap.className = "calendar-adv-agenda-col";
          const colTitle = document.createElement("div");
          colTitle.className = "calendar-adv-agenda-col-title";
          colTitle.textContent = col.title;
          colWrap.appendChild(colTitle);
          const items = document.createElement("div");
          items.className = "calendar-adv-agenda-items";
          const list = buckets[col.id] || [];
          if(!list.length){
            const empty = document.createElement("div");
            empty.className = "calendar-adv-agenda-empty";
            empty.textContent = col.empty;
            items.appendChild(empty);
          } else {
            if(col.id === "school"){
              const groupedByClass = {};
              list.forEach((event)=>{
                const meta = parseCourseMeta(event.title || "");
                const key = meta.courseId || meta.rawCode || "General";
                const label = meta.courseTitle ? `${key} - ${meta.courseTitle}` : key;
                if(!groupedByClass[key]){
                  groupedByClass[key] = { label, items: [] };
                }
                groupedByClass[key].items.push(event);
              });
              Object.keys(groupedByClass).sort().forEach((key)=>{
                const block = document.createElement("div");
                block.className = "calendar-adv-agenda-subgroup";
                const subTitle = document.createElement("div");
                subTitle.className = "calendar-adv-agenda-subtitle";
                subTitle.textContent = groupedByClass[key].label;
                const subItems = document.createElement("div");
                subItems.className = "calendar-adv-agenda-items";
                groupedByClass[key].items.forEach((event)=>{
                  subItems.appendChild(createAgendaCard(event, date));
                });
                block.appendChild(subTitle);
                block.appendChild(subItems);
                items.appendChild(block);
              });
            } else {
              list.forEach((event)=> items.appendChild(createAgendaCard(event, date)));
            }
          }
          colWrap.appendChild(items);
          columns.appendChild(colWrap);
        });
        group.appendChild(columns);
        agendaViewEl.appendChild(group);
      });
    };

    const renderCalendar = ()=>{
      events = loadEvents();
      refreshVisibleEvents();
      monthEl.textContent = monthFormatter.format(currentDate);
      yearEl.textContent = yearFormatter.format(currentDate);
      renderDays();
      renderMiniCalendar();
      if(activeView === "week") renderWeekView();
      if(activeView === "agenda") renderAgendaView();
    };

    const setActiveView = (view)=>{
      activeView = view || "month";
      if(activeView === "week"){
        const base = new Date();
        base.setHours(0,0,0,0);
        currentDate = new Date(base);
        selectedDate = new Date(base);
      }
      tabs.forEach((tab)=>{
        const isActive = tab.dataset.view === activeView;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      if(gridWrap) gridWrap.classList.toggle("hidden", activeView !== "month");
      if(weekViewEl) weekViewEl.classList.toggle("hidden", activeView !== "week");
      if(agendaViewEl) agendaViewEl.classList.toggle("hidden", activeView !== "agenda");
      renderCalendar();
    };

    const handleImportText = (text)=>{
      const parsed = parseIcsText(text);
      if(!parsed.length){
        setStatus("No events found in that file.", "warn");
        return;
      }
      events = loadEvents();
      const mergedResult = mergeEvents(events, parsed);
      events = mergedResult.merged;
      saveEvents(events);
      renderCalendar();
      setStatus(`Imported ${mergedResult.added} events from .ics`, "success");
    };

    const autoLoadIcsFiles = async ()=>{
      if(!autoFiles.length){
        setStatus("No auto .ics feeds configured.");
        return;
      }
      let merged = loadEvents();
      let totalAdded = 0;
      let loadedFiles = 0;
      for(const file of autoFiles){
        try{
          let text = null;
          if(typeof EMBEDDED_ICS === "object" && EMBEDDED_ICS && EMBEDDED_ICS[file]){
            text = EMBEDDED_ICS[file];
          } else {
            const res = await fetch(file, { cache: "no-store" });
            if(!res.ok) throw new Error(`HTTP ${res.status}`);
            text = await res.text();
          }
          const parsed = parseIcsText(text || "");
          const result = mergeEvents(merged, parsed);
          merged = result.merged;
          totalAdded += result.added;
          loadedFiles += 1;
        }catch(e){
          setStatus(`Auto-load failed for ${file}.`, "warn");
        }
      }
      if(loadedFiles){
        events = merged;
        saveEvents(events);
        renderCalendar();
        setStatus(`Auto-loaded ${loadedFiles} .ics feed(s). Added ${totalAdded} events.`, "success");
      }
    };

    const exportPlannerWeekIcs = ()=>{
      const repeatUntilKey = getPlannerRepeatUntilKey();
      const plannerEvents = buildPlannerWeekEvents(repeatUntilKey);
      if(!plannerEvents.length){
        setStatus("No weekly planner entries to export.", "warn");
        return;
      }
      const ics = buildIcs(plannerEvents);
      const startKey = formatDateKey(getMondayStart(new Date()));
      const fileName = `weekly-planner-${startKey}-to-${repeatUntilKey}.ics`;
      downloadBlob(ics, fileName, "text/calendar;charset=utf-8");
      setStatus(`Exported weekly planner to ${fileName}.`, "success");
    };
    const resyncPlannerWeekToCalendar = ()=>{
      const repeatUntilKey = getPlannerRepeatUntilKey();
      const plannerEvents = buildPlannerWeekEvents(repeatUntilKey);
      if(!plannerEvents.length){
        setStatus("No weekly planner entries to sync.", "warn");
        return;
      }
      const plannerTitles = new Set(plannerEvents.map(ev=>ev.title));
      const existing = loadEvents();
      const cleaned = existing.filter((ev)=>{
        const seriesId = typeof ev.seriesId === "string" ? ev.seriesId : "";
        if(seriesId.startsWith(PLANNER_WEEK_SERIES_PREFIX)) return false;
        const isWeekly = ev.recurrence === "weekly";
        const hasDesc = typeof ev.description === "string" && ev.description.trim() !== "";
        if(isWeekly && !hasDesc && plannerTitles.has(ev.title)) return false;
        return true;
      });
      const removedCount = existing.length - cleaned.length;
      const mergedResult = mergeEvents(cleaned, plannerEvents);
      events = mergedResult.merged;
      saveEvents(events);
      renderCalendar();
      setStatus(`Resynced weekly planner (${removedCount} removed, ${mergedResult.added} added).`, "success");
      localStorage.setItem(PLANNER_WEEK_MIGRATION_KEY, "done");
    };

    const plannerExportIcsBtn = document.getElementById("planner-export-ics");
    const plannerResyncBtn = document.getElementById("planner-resync-calendar");
    plannerExportIcsBtn?.addEventListener("click", exportPlannerWeekIcs);
    plannerResyncBtn?.addEventListener("click", resyncPlannerWeekToCalendar);

    migratePlannerWeekToCalendar();
    renderWeekdays();
    setActiveView(activeView);
    autoLoadIcsFiles();
    requestNotifyPermission();
    setInterval(checkReminders, 30000);
    checkReminders();

    renderCalendarPanel = ()=>{
      if(activeView === "week"){
        const today = new Date();
        today.setHours(0,0,0,0);
        currentDate = new Date(today);
        selectedDate = new Date(today);
      }
      renderCalendar();
    };
    const filterColorInputs = filterPanel
      ? Array.from(filterPanel.querySelectorAll("input[type=\"checkbox\"][value]"))
      : [];
    const filterTimeInputs = filterPanel
      ? Array.from(filterPanel.querySelectorAll("input[name=\"calendar-adv-time\"]"))
      : [];

    prevBtn?.addEventListener("click", ()=>{
      if(activeView === "week"){
        currentDate.setDate(currentDate.getDate() - 7);
      } else {
        currentDate.setMonth(currentDate.getMonth() - 1);
      }
      renderCalendar();
    });
    miniPrevBtn?.addEventListener("click", ()=>{
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });
    nextBtn?.addEventListener("click", ()=>{
      if(activeView === "week"){
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      renderCalendar();
    });
    miniNextBtn?.addEventListener("click", ()=>{
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });
    todayBtn?.addEventListener("click", ()=>{
      currentDate = new Date();
      selectedDate = new Date();
      renderCalendar();
      openPanel(selectedDate);
    });
    tabs.forEach((tab)=>{
      tab.addEventListener("click", ()=>{
        const view = tab.dataset.view || "month";
        setActiveView(view);
      });
    });
    addBtn?.addEventListener("click", ()=> openModal(selectedDate || currentDate));
    panelAdd?.addEventListener("click", ()=> openModal(selectedDate || currentDate));
    classesBtn?.addEventListener("click", ()=>{
      const win = window.open("class-dashboard.html", "class-dashboard");
      if(win){
        win.focus();
        try{ win.opener = null; }catch(e){}
      }
    });
    panelClose?.addEventListener("click", closePanel);
    overlay?.addEventListener("click", closePanel);
    importBtn?.addEventListener("click", ()=> importInput?.click());
    importInput?.addEventListener("change", (e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = ()=> handleImportText(String(reader.result || ""));
      reader.readAsText(file);
      importInput.value = "";
    });
    exportBtn?.addEventListener("click", ()=>{
      events = loadEvents();
      if(!events.length){
        setStatus("No events to export.", "warn");
        return;
      }
      const ics = buildIcs(events);
      const fileName = `calendar-${formatDateKey(new Date())}.ics`;
      downloadBlob(ics, fileName, "text/calendar;charset=utf-8");
      setStatus(`Exported ${events.length} events.`, "success");
    });
    searchInput?.addEventListener("input", ()=>{
      searchTerm = String(searchInput.value || "").trim().toLowerCase();
      renderCalendar();
      renderPanel();
    });
    filterBtn?.addEventListener("click", (e)=>{
      e.stopPropagation();
      if(filterPanel) filterPanel.classList.toggle("hidden");
    });
    filterPanel?.addEventListener("click", (e)=> e.stopPropagation());
    document.addEventListener("click", (e)=>{
      if(!filterPanel || filterPanel.classList.contains("hidden")) return;
      if(filterPanel.contains(e.target)) return;
      if(filterBtn && filterBtn.contains(e.target)) return;
      filterPanel.classList.add("hidden");
    });
    filterColorInputs.forEach((input)=>{
      input.addEventListener("change", ()=>{
        if(input.checked){
          selectedColors.add(input.value);
        } else {
          selectedColors.delete(input.value);
        }
        renderCalendar();
        renderPanel();
      });
    });
    filterClearColors?.addEventListener("click", ()=>{
      selectedColors.clear();
      filterColorInputs.forEach((input)=>{ input.checked = false; });
      renderCalendar();
      renderPanel();
    });
    filterTimeInputs.forEach((input)=>{
      input.addEventListener("change", ()=>{
        if(input.checked){
          timeFilter = input.value;
          renderCalendar();
          renderPanel();
        }
      });
    });
    filterClearAll?.addEventListener("click", ()=>{
      searchTerm = "";
      if(searchInput) searchInput.value = "";
      selectedColors.clear();
      filterColorInputs.forEach((input)=>{ input.checked = false; });
      timeFilter = "all";
      filterTimeInputs.forEach((input)=>{ input.checked = input.value === "all"; });
      renderCalendar();
      renderPanel();
    });
    colorsWrap?.addEventListener("click", (e)=>{
      const btn = e.target.closest(".calendar-adv-color");
      if(!btn) return;
      setActiveColor(btn.dataset.color);
    });
    modalClose?.addEventListener("click", closeModal);
    modalCancel?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape"){
        closeModal();
        closePanel();
      }
    });
    form?.addEventListener("submit", (e)=>{
      e.preventDefault();
      const title = normalizeTitle(titleInput.value || "");
      const dateVal = dateInput.value;
      if(!title || !dateVal){
        setStatus("Title and date are required.", "warn");
        return;
      }
      const reminders = [];
      modal.querySelectorAll(".calendar-adv-reminders input").forEach((input)=>{
        if(input.checked) reminders.push(parseInt(input.value, 10));
      });
      const repeat = repeatSelect ? repeatSelect.value : "none";
      const repeatUntil = repeatUntilInput ? repeatUntilInput.value : "";
      const baseEvent = {
        title,
        date: dateVal,
        time: timeInput.value || "",
        description: descInput.value || "",
        color: activeColor,
        reminders,
        notified_reminders: [],
        recurrence: repeat,
        recurrence_until: repeatUntil
      };
      events = loadEvents();
      const isSeriesEdit = editingEventId && editingSeriesId;
      if(isSeriesEdit){
        const seriesBaseDate = (editingSeriesStart && dateVal === editingSeriesEventDate)
          ? editingSeriesStart
          : dateVal;
        const seriesBaseEvent = { ...baseEvent, date: seriesBaseDate };
        events = events.filter((ev)=>ev.seriesId !== editingSeriesId);
        if(repeat !== "none"){
          const seriesEvents = buildRecurringEvents(seriesBaseEvent, repeat, repeatUntil);
          if(!seriesEvents.length){
            setStatus("Could not build recurring events.", "warn");
            return;
          }
          events = events.concat(seriesEvents);
          saveEvents(events);
          renderCalendar();
          renderPanel();
          closeModal();
          showToast(`Series updated (${seriesEvents.length} events)`);
          return;
        }
        const normalized = normalizeEventRecord(seriesBaseEvent);
        if(!normalized.record) return;
        events.push(normalized.record);
        saveEvents(events);
        renderCalendar();
        renderPanel();
        closeModal();
        showToast("Series converted to single event");
        return;
      }
      if(editingEventId){
        if(repeat !== "none"){
          events = events.filter((ev)=>ev.id !== editingEventId);
          const seriesEvents = buildRecurringEvents(baseEvent, repeat, repeatUntil);
          if(!seriesEvents.length){
            setStatus("Could not build recurring events.", "warn");
            return;
          }
          events = events.concat(seriesEvents);
          saveEvents(events);
          renderCalendar();
          renderPanel();
          closeModal();
          showToast(`Saved ${seriesEvents.length} events`);
          return;
        }
        const idx = events.findIndex((ev)=>ev.id === editingEventId);
        if(idx === -1) return;
        const updated = normalizeEventRecord({
          ...events[idx],
          ...baseEvent,
          id: editingEventId,
          recurrence: "none",
          recurrence_until: ""
        });
        if(!updated.record) return;
        events[idx] = updated.record;
        saveEvents(events);
        renderCalendar();
        renderPanel();
        closeModal();
        showToast("Event updated");
        return;
      }
      if(repeat !== "none"){
        const seriesEvents = buildRecurringEvents(baseEvent, repeat, repeatUntil);
        if(!seriesEvents.length){
          setStatus("Could not build recurring events.", "warn");
          return;
        }
        events = events.concat(seriesEvents);
        saveEvents(events);
        renderCalendar();
        renderPanel();
        closeModal();
        showToast(`Added ${seriesEvents.length} events`);
        return;
      }
      const normalized = normalizeEventRecord(baseEvent);
      if(!normalized.record) return;
      events.push(normalized.record);
      saveEvents(events);
      renderCalendar();
      renderPanel();
      closeModal();
      showToast("Event saved");
    });
    window.addEventListener("belttrackerchange", (e)=>{
      const detail = e.detail || {};
      if(Array.isArray(detail.dates)){
        beltSummary = {
          classCount: Number(detail.classCount) || 0,
          dates: new Set(detail.dates),
          tier: getBeltTier(Number(detail.classCount) || 0)
        };
      } else {
        beltSummary = getBeltSummary();
      }
      renderCalendar();
      renderPanel();
    });
    window.addEventListener("tabchange", (e)=>{
      if(e.detail?.id === "tab-calendar") renderCalendar();
    });
  })();

  (function initBeltTracker(){
    const tracker = document.getElementById("belt-tracker");
    if(!tracker) return;
    const toggle = document.getElementById("belt-tracker-toggle");
    const closeBtn = document.getElementById("belt-tracker-close");
    const countEl = document.getElementById("belt-tracker-count");
    const streakEl = document.getElementById("belt-tracker-streak");
    const restDots = document.getElementById("belt-tracker-rest-dots");
    const restHint = document.getElementById("belt-tracker-rest-hint");
    const restSlots = document.getElementById("belt-tracker-rest-slots");
    const progressBar = document.getElementById("belt-tracker-progress-bar");
    const progressFill = document.getElementById("belt-tracker-progress-fill");
    const progressText = document.getElementById("belt-tracker-progress-text");
    const progressBg = document.getElementById("belt-tracker-progress-bg");
    const addBtn = document.getElementById("belt-tracker-add");
    const restBtn = document.getElementById("belt-tracker-rest");
    const subBtn = document.getElementById("belt-tracker-sub");
    const resetBtn = document.getElementById("belt-tracker-reset");

    const BELT_GOAL = 100;
    const BELT_MAX_REST = 5;
    const BELT_ENTRIES_KEY = "belt-tracker-entries";
    const BELT_REST_KEY = "belt-tracker-rest-positions";
    let beltEntries = loadStoredEntries();
    let beltRestPositions = loadRestPositions();

    function safeLoad(key, fallback){
      try{
        const raw = localStorage.getItem(key);
        if(!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
      }catch(e){
        return fallback;
      }
    }

    function safeSave(key, value){
      try{
        localStorage.setItem(key, JSON.stringify(value));
      }catch(e){}
    }

    function loadStoredEntries(){
      const parsed = safeLoad(BELT_ENTRIES_KEY, []);
      return Array.isArray(parsed) ? parsed : [];
    }

    function generateRestPositions(){
      const positions = new Set();
      while(positions.size < BELT_MAX_REST){
        positions.add(Math.floor(Math.random() * BELT_GOAL) + 1);
      }
      return Array.from(positions).sort((a,b)=>a-b);
    }

    function loadRestPositions(){
      const parsed = safeLoad(BELT_REST_KEY, null);
      if(Array.isArray(parsed) && parsed.length){
        const cleaned = parsed
          .map(value => Math.round(Number(value)))
          .filter(value => Number.isFinite(value))
          .map(value => Math.min(Math.max(value, 1), BELT_GOAL));
        const positions = new Set(cleaned);
        while(positions.size < BELT_MAX_REST){
          positions.add(Math.floor(Math.random() * BELT_GOAL) + 1);
        }
        const normalized = Array.from(positions).slice(0, BELT_MAX_REST).sort((a,b)=>a-b);
        safeSave(BELT_REST_KEY, normalized);
        return normalized;
      }
      const fresh = generateRestPositions();
      safeSave(BELT_REST_KEY, fresh);
      return fresh;
    }

    function getClassCount(){
      return beltEntries.filter(entry => entry && entry.type === "class").length;
    }

    function getRestCount(){
      return beltEntries.filter(entry => entry && entry.type === "rest").length;
    }

    function calculateStreak(){
      if(!beltEntries.length) return 0;
      const uniqueDates = [...new Set(beltEntries.map(entry => entry?.date).filter(Boolean))].sort((a,b)=>{
        return new Date(b).getTime() - new Date(a).getTime();
      });
      if(!uniqueDates.length) return 0;
      let streak = 1;
      let currentDate = new Date(uniqueDates[0]);
      currentDate.setHours(0,0,0,0);
      for(let i=1;i<uniqueDates.length;i++){
        const nextDate = new Date(uniqueDates[i]);
        nextDate.setHours(0,0,0,0);
        const daysDiff = Math.round((currentDate.getTime() - nextDate.getTime()) / 86400000);
        if(daysDiff === 1){
          streak += 1;
          currentDate = nextDate;
        } else {
          break;
        }
      }
      return streak;
    }

    function setHint(text, tone){
      if(!restHint) return;
      restHint.textContent = text;
      restHint.classList.remove("success","warn","muted");
      if(tone) restHint.classList.add(tone);
    }

    function animateProgress(){
      if(progressBar) progressBar.classList.add("pop");
      if(progressFill) progressFill.classList.add("pulse");
      setTimeout(()=>{
        if(progressBar) progressBar.classList.remove("pop");
        if(progressFill) progressFill.classList.remove("pulse");
      }, 600);
    }

    function updateRestDots(used){
      if(!restDots) return;
      restDots.innerHTML = "";
      for(let i=0;i<BELT_MAX_REST;i++){
        const dot = document.createElement("div");
        dot.className = "belt-tracker-rest-dot" + (i < used ? " used" : "");
        restDots.appendChild(dot);
      }
    }

    function updateUI(){
      const classCount = getClassCount();
      const restCount = getRestCount();
      const streak = calculateStreak();
      const progressPercent = Math.min(100, (classCount / BELT_GOAL) * 100);
      const tier = getBeltTier(classCount);

      if(countEl) countEl.textContent = classCount;
      if(streakEl) streakEl.textContent = streak;
      if(tracker){
        tracker.style.setProperty("--belt-color", tier.color);
        tracker.style.setProperty("--belt-glow", tier.glow);
        tracker.dataset.belt = tier.token;
      }

      if(progressFill) progressFill.style.width = `${progressPercent}%`;
      if(progressText) progressText.textContent = `${classCount}/${BELT_GOAL}`;
      if(progressBg) progressBg.textContent = `${classCount}/${BELT_GOAL}`;
      if(progressBg) progressBg.style.display = progressPercent < 15 ? "block" : "none";
      if(progressText) progressText.style.display = progressPercent >= 15 ? "block" : "none";

      updateRestDots(restCount);

      if(restSlots){
        restSlots.textContent = `Slots: ${beltRestPositions.join(", ")}`;
      }

      const nextPosition = classCount + 1;
      const goalReached = classCount >= BELT_GOAL;

      if(addBtn) addBtn.disabled = goalReached;
      if(restBtn){
        restBtn.disabled = goalReached || restCount >= BELT_MAX_REST || !beltRestPositions.includes(nextPosition);
      }

      if(goalReached){
        setHint("Goal complete. Reset to start a new cycle.", "muted");
      } else if(restCount >= BELT_MAX_REST){
        setHint("All rest days used.", "muted");
      } else if(beltRestPositions.includes(nextPosition)){
        setHint(`Rest day available at position ${nextPosition}.`, "success");
      } else {
        const nextAvailable = beltRestPositions.find(pos => pos > nextPosition);
        if(nextAvailable){
          setHint(`Next rest day at position ${nextAvailable}.`, "warn");
        } else {
          setHint("No more rest days in this cycle.", "muted");
        }
      }

      safeSave(BELT_ENTRIES_KEY, beltEntries);
      const classDates = beltEntries.filter(entry => entry && entry.type === "class" && entry.date).map(entry => entry.date);
      const uniqueDates = Array.from(new Set(classDates));
      window.dispatchEvent(new CustomEvent("belttrackerchange", {
        detail: { dates: uniqueDates, classCount }
      }));
    }

    function addEntry(type){
      beltEntries.push({
        type,
        date: new Date().toISOString().split("T")[0],
        timestamp: Date.now()
      });
      updateUI();
      animateProgress();
    }

    function handleComplete(){
      if(typeof showCelebration === "function"){
        showCelebration("Goal complete!", "100 classes logged. Belt upgrade earned.");
      } else if(typeof launchConfetti === "function"){
        launchConfetti();
      }
    }

    toggle?.addEventListener("click", e=>{
      e.stopPropagation();
      tracker.classList.toggle("open");
      if(toggle){
        toggle.setAttribute("aria-expanded", tracker.classList.contains("open") ? "true" : "false");
      }
    });
    closeBtn?.addEventListener("click", e=>{
      e.stopPropagation();
      tracker.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("click", e=>{
      if(!tracker.contains(e.target)){
        tracker.classList.remove("open");
        toggle?.setAttribute("aria-expanded", "false");
      }
    });

    addBtn?.addEventListener("click", ()=>{
      const classCount = getClassCount();
      if(classCount >= BELT_GOAL) return;
      addEntry("class");
      if(classCount + 1 === BELT_GOAL){
        handleComplete();
      }
    });

    restBtn?.addEventListener("click", ()=>{
      const classCount = getClassCount();
      const restCount = getRestCount();
      const nextPosition = classCount + 1;
      if(restCount >= BELT_MAX_REST){
        setHint("All rest days used.", "muted");
        return;
      }
      if(!beltRestPositions.includes(nextPosition)){
        setHint(`Rest day not available at position ${nextPosition}.`, "warn");
        return;
      }
      addEntry("rest");
    });

    subBtn?.addEventListener("click", ()=>{
      if(!beltEntries.length) return;
      beltEntries.pop();
      updateUI();
    });

    resetBtn?.addEventListener("click", ()=>{
      if(!beltEntries.length) return;
      if(confirm("Reset belt tracker progress?")){
        beltEntries = [];
        updateUI();
      }
    });

    updateUI();
  })();

  function isCourseAssignmentEvent(ev){
    const title = String(ev?.title || "");
    if(/\[[^\]]+\]/.test(title)) return true;
    const url = String(ev?.url || "");
    return /include_contexts=course_/i.test(url);
  }

  function parseCourseMeta(title){
    const match = /\[(.+?)\]/.exec(title || "");
    const rawCode = match ? match[1].trim() : "General";
    const code = rawCode.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/");
    const courseTitle = (title || "").replace(match ? match[0] : "", "").trim() || title || "";
    const parts = code.split(/\s+/);
    const termKey = (parts[0] || "").toUpperCase();
    let term = "";
    if(termKey.includes("FA")) term = "fall";
    else if(termKey.includes("SP")) term = "spring";
    else if(termKey.includes("SU")) term = "summer";
    const courseId = parts.slice(1).join(" ").trim() || code;
    return { code, courseId, courseTitle, term };
  }

  function buildClassCoursesFromEvents(events){
    const list = [];
    const map = new Map();
    events.forEach(ev=>{
      if(!ev || !ev.title) return;
      const meta = parseCourseMeta(ev.title);
      if(!map.has(meta.courseId)){
        map.set(meta.courseId,{
          id: meta.courseId,
          code: meta.code,
          term: meta.term || "all",
          entries: []
        });
      }
      map.get(meta.courseId).entries.push({
        title: meta.courseTitle || ev.title,
        rawTitle: ev.title,
        due: ev.start,
        description: ev.description || "",
        url: ev.url || ""
      });
    });
    map.forEach(course=>{
      course.entries.sort((a,b)=> new Date(a.due).getTime() - new Date(b.due).getTime());
      list.push(course);
    });
    list.sort((a,b)=> a.id.localeCompare(b.id));
    return list;
  }

  function buildClassData(){
    try{
      let events = loadEvents();
      if(!Array.isArray(events) || !events.length){
        // try ICS-IMPORT feed if available
        if(typeof RAW_ICS !== "undefined"){
          const parsed = parseICSFeed(RAW_ICS);
          if(parsed.length){
            events = parsed;
            saveEvents(events);
          }
        }
        if(!events || !events.length){
          events = fallbackClassEvents;
        }
      }
      const courseOnly = Array.isArray(events) ? events.filter(isCourseAssignmentEvent) : [];
      if(courseOnly.length){
        events = courseOnly;
      }
      const now = Date.now();
      const futureWindow = 365*24*60*60*1000; // 12 months ahead to keep future terms
      const pastWindow = 180*24*60*60*1000;   // 6 months back
      events = events.filter(ev=>{
        const start = new Date(ev.start || ev.due || ev.date || "").getTime();
        if(!start || isNaN(start)) return false;
        // keep within a sensible window to avoid huge DOM/render cost
        return start >= now - pastWindow && start <= now + futureWindow;
      });
      // cap total to avoid freezes on very large .ics imports
      if(events.length > 1200){
        events.sort((a,b)=> new Date(a.start||0) - new Date(b.start||0));
        events = events.slice(-1200);
      }
      classCourses = buildClassCoursesFromEvents(events);
      if(!selectedCourseId && classCourses.length){
        selectedCourseId = classCourses[0].id;
      }
      if(!classCourses.length){
        console.warn("Class view: no courses found after parsing events", { eventsCount: events.length });
      }
    }catch(err){
      console.error("buildClassData error", err);
      classCourses = [];
    }
  }

  function getUpcomingAssignments(limit=4){
    const MIN_DUE = new Date("2024-11-24T00:00:00").getTime();
    let events = loadEvents();
    events = (Array.isArray(events) ? events : []).filter(ev=>{
      const title = normalizeTitle(ev?.title || "");
      if(!title || /\[object\s/i.test(title)) return false;
      if(!isCourseAssignmentEvent(ev)) return false;
      return ev && ev.start;
    });
    const hasRealEvents = Array.isArray(events) && events.length;
    if(!hasRealEvents){
      events = fallbackClassEvents;
    }
    const now = Date.now();
    const rangeStart = startOfWeek(currentWeek || new Date());
    rangeStart.setHours(0,0,0,0);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate()+6); // only the current week (Mon-Sun)
    rangeEnd.setHours(12,59,0,0); // treat Sunday 12:59pm as end-of-window
    const upcoming = [];
    const seen = new Set();
    events.forEach(ev=>{
      if(!ev || !ev.title || !ev.start) return;
      const title = normalizeTitle(ev.title);
      if(!title || /\[object\s/i.test(title)) return;
      const due = new Date(ev.start).getTime();
      if(isNaN(due)) return;
      if(due < MIN_DUE) return;
      const inWindow = due >= rangeStart.getTime() && due <= rangeEnd.getTime();
      if(!inWindow) return;
      const daysLeft = Math.ceil((due - now)/86400000);
      const key = `${title.toLowerCase()}-${due}`;
      if(seen.has(key)) return;
      seen.add(key);
      upcoming.push({
        title,
        due,
        description: normalizeTitle(ev.description || ""),
        daysLeft,
        inWindow
      });
    });
    const prioritized = upcoming.sort((a,b)=> a.due - b.due);
    return prioritized.slice(0, limit);
  }

  function makeDangerKey(item){
    return `${normalizeTitle(item.title||"").toLowerCase()}|${item.due||""}`;
  }
  function loadDangerBossDone(){
    try{
      const raw = JSON.parse(localStorage.getItem(DANGER_BOSS_KEY)||"[]");
      return new Set(Array.isArray(raw)?raw:[]);
    }catch(e){
      return new Set();
    }
  }
  function saveDangerBossDone(set){
    try{
      localStorage.setItem(DANGER_BOSS_KEY, JSON.stringify(Array.from(set||[])));
    }catch(e){}
  }
  function loadBossRewardWeek(){
    try{ return localStorage.getItem(BOSS_REWARD_KEY) || ""; }catch(e){ return ""; }
  }
  function saveBossRewardWeek(key){
    try{ localStorage.setItem(BOSS_REWARD_KEY, key); }catch(e){}
  }
  function loadBriefPrefs(){
    try{
      const raw = JSON.parse(localStorage.getItem(BRIEF_PREF_KEY)||"{}");
      return { enabled: raw.enabled!==false, tone: raw.tone || "heroic" };
    }catch(e){ return { enabled:true, tone:"heroic" }; }
  }
  function saveBriefPrefs(prefs){
    try{ localStorage.setItem(BRIEF_PREF_KEY, JSON.stringify(prefs||{})); }catch(e){}
  }
  function loadBriefLog(){
    try{
      const raw = JSON.parse(localStorage.getItem(BRIEF_KEY)||"[]");
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function saveBriefLog(list){
    try{ localStorage.setItem(BRIEF_KEY, JSON.stringify(list||[])); }catch(e){}
  }
  function loadBriefPrefs(){
    try{
      const raw = JSON.parse(localStorage.getItem(BRIEF_PREF_KEY)||"{}");
      return { enabled: raw.enabled!==false, tone: raw.tone || "heroic" };
    }catch(e){ return { enabled:true, tone:"heroic" }; }
  }
  function saveBriefPrefs(prefs){
    try{ localStorage.setItem(BRIEF_PREF_KEY, JSON.stringify(prefs||{})); }catch(e){}
  }
  function loadStabilityPrefs(){
    try{
      const raw = JSON.parse(localStorage.getItem(STABILITY_PREF_KEY)||"{}");
      return { enabled: raw.enabled!==false };
    }catch(e){ return { enabled:true }; }
  }
  function saveStabilityPrefs(prefs){
    try{ localStorage.setItem(STABILITY_PREF_KEY, JSON.stringify(prefs||{})); }catch(e){}
  }
  function loadStabilityState(){
    const today = startOfWeek(new Date()).toISOString(); // week-scoped
    try{
      const raw = JSON.parse(localStorage.getItem(STABILITY_KEY)||"{}");
      if(raw.week !== today){
        return { week: today, current:0, best: raw.best||0, lastDay:null };
      }
      return { week: today, current: raw.current||0, best: raw.best||0, lastDay: raw.lastDay||null };
    }catch(e){
      return { week: today, current:0, best:0, lastDay:null };
    }
  }
  function saveStabilityState(state){
    try{ localStorage.setItem(STABILITY_KEY, JSON.stringify(state||{})); }catch(e){}
  }
  function loadRepliesState(){
    const wk = startOfWeek(new Date()).toISOString();
    try{
      const raw = JSON.parse(localStorage.getItem(REPLIES_KEY)||"{}");
      if(raw.week !== wk){
        return { week:wk, needed:15, done:0, citations:false };
      }
      return {
        week:wk,
        needed: raw.needed || 15,
        done: Math.max(0, raw.done||0),
        citations: !!raw.citations
      };
    }catch(e){
      return { week:wk, needed:15, done:0, citations:false };
    }
  }
  function saveRepliesState(state){
    try{ localStorage.setItem(REPLIES_KEY, JSON.stringify(state||{})); }catch(e){}
  }
  function generateBriefEntry(threatScore, items){
    const prefs = loadBriefPrefs();
    if(!prefs.enabled) return null;
    const today = new Date().toDateString();
    const log = loadBriefLog();
    if(log[0]?.date === today) return log[0];
    const tone = prefs.tone || "heroic";
    const countSoon = threatScore.soon || 0;
    const countOver = threatScore.overdue || 0;
    const total = items.length;
    const streak = loadStabilityState().current || 0;
    const best = loadStabilityState().best || 0;
    const pick = (arr)=> arr[Math.floor(Math.random()*arr.length)];
    let text = "";
    if(countOver > 0 || threatScore.level === "red"){
      const critical = tone==="snarky"
        ? [
          "Critical breach risk! Overdue intel and ticking clocks. Move or get overrun.",
          "HQ screaming in the radio: missions overdue, power flickering. Fix it now.",
          "Walls rattling-missed ops let hostiles in. Patch the hole today."
        ]
        : [
          `Critical: ${countOver} overdue, ${countSoon} imminent. Base running on emergency power-engage all units.`,
          "Red alert: Overdue dispatches triggered alarms. Crews on emergency rotation.",
          "Command log: Breach reported due to missed missions. Mobilize counter-attack."
        ];
      text = pick(critical);
    } else if(threatScore.level === "orange"){
      const high = tone==="snarky"
        ? [
          "High alert. Multiple hostiles inbound. Stop polishing gear and deploy.",
          "Radar hot with pings. Missions due soon-move it.",
          "Pressure rising: ops stack up. Time to clear the queue."
        ]
        : [
          `High alert: ${countSoon} mission${countSoon===1?"":"s"} due soon. Teams prepping defenses.`,
          "Status: High. Multiple deadlines in range. Secure them before nightfall.",
          "Ops room: Several missions inbound. Dispatch teams now."
        ];
      text = pick(high);
    } else if(threatScore.level === "yellow"){
      const mid = tone==="snarky"
        ? [
          "Sensors ping mild chatter. A couple missions creeping closer-stay frosty.",
          "Elevated threat: not panic, but no nap either.",
          "Ops whispers: deadlines on the horizon. Line up your drills."
        ]
        : [
          `Elevated alert: ${countSoon} mission${countSoon===1?"":"s"} approaching. Crew running drills.`,
          "Threat: Caution. Deadlines in sight; keep teams ready.",
          "Status: Elevated. Prep a 45/15 sortie to stay ahead."
        ];
      text = pick(mid);
    } else {
      const good = tone==="snarky"
        ? [
          "All quiet. Crew is napping with one eye open-no hostiles in sight.",
          "Calm day. Scavenged snacks and ran light patrols.",
          "Nothing on radar. Enjoy the lull, but keep your boots on."
        ]
        : [
          "Day report: All clear. Missions wrapped; crew morale high and supplies intact.",
          "All quiet on the wasteland front. Systems humming; enjoy the reprieve.",
          "Ops log: No hostiles today. Crew rotated rest and light drills."
        ];
      text = pick(good);
    }
    if(streak >= 7){
      const milestone = tone==="snarky"
        ? "Streak intact-base upgrades rolling in."
        : "Streak strong; defenses reinforced.";
      text += ` ${milestone}`;
    }
    const entry = { date: today, text, level: threatScore.level, total, streak, best };
    log.unshift(entry);
    saveBriefLog(log.slice(0,50));
    return entry;
  }
  function renderBriefingStrip(threatScore, items){
    const strip = document.getElementById("daily-briefing");
    const logBtn = document.getElementById("briefing-view-log");
    const prefs = loadBriefPrefs();
    const entry = generateBriefEntry(threatScore, items||[]);
    if(!strip) return null;
    if(!prefs.enabled || !entry){
      strip.classList.add("hidden");
      return null;
    }
    strip.querySelector(".briefing-text").textContent = `Daily Briefing: ${entry.text}`;
    strip.classList.remove("hidden");
    logBtn?.addEventListener("click", renderBriefLog);
    return strip;
  }
  function renderBriefLog(){
    const container = document.getElementById("briefing-log");
    if(!container) return;
    const prefs = loadBriefPrefs();
    if(!prefs.enabled){
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }
    const log = loadBriefLog();
    container.innerHTML = "";
    if(!log.length){
      container.classList.add("hidden");
      return;
    }
    const list = document.createElement("div");
    list.className = "briefing-log-list";
    log.forEach(entry=>{
      const row = document.createElement("div");
      row.className = `briefing-row level-${entry.level}`;
      row.textContent = `${entry.date}: ${entry.text}`;
      list.append(row);
    });
    const close = document.createElement("button");
    close.className = "btn briefing-close";
    close.type = "button";
    close.textContent = "Close log";
    close.addEventListener("click", ()=> container.classList.add("hidden"));
    container.append(list, close);
    container.classList.toggle("hidden", false);
  }

  function recordStabilitySuccess(){
    const prefs = loadStabilityPrefs();
    if(!prefs.enabled) return;
    const todayStr = new Date().toDateString();
    const state = loadStabilityState();
    if(state.lastDay === todayStr) return;
    let current = state.current || 0;
    let best = state.best || 0;
    if(state.lastDay){
      const gap = Math.floor((new Date(todayStr).getTime() - new Date(state.lastDay).getTime())/86400000);
      if(gap === 1){
        current += 1;
      } else {
        current = 1;
      }
    } else {
      current = 1;
    }
    best = Math.max(best, current);
    saveStabilityState({ week: state.week, current, best, lastDay: todayStr });
  }

  function renderStabilityStrip(){
    const strip = document.getElementById("stability-strip");
    if(!strip) return null;
    const prefs = loadStabilityPrefs();
    if(!prefs.enabled){
      strip.classList.add("hidden");
      strip.innerHTML = "";
      return null;
    }
    const state = loadStabilityState();
    const day = state.current || 0;
    const best = state.best || 0;
    const milestones = [
      {day:1,label:"Base secured"},
      {day:3,label:"Power grid restored"},
      {day:5,label:"Perimeter fence rebuilt"},
      {day:7,label:"Watchtower operational"},
      {day:10,label:"Armory stocked"},
      {day:14,label:"Reinforced walls"},
      {day:21,label:"Automated turrets online"},
      {day:30,label:"Bunker unbreachable"}
    ];
    const next = milestones.find(m=> m.day>day) || milestones[milestones.length-1];
    const pct = Math.min(100, Math.round((day / (next.day||1))*100));
    strip.innerHTML = `
      <div class="stability-head">
        <div>Base Stability</div>
        <div class="stability-meta">${day} day streak � Best ${best}</div>
      </div>
      <div class="stability-bar"><span style="width:${pct}%;"></span></div>
      <div class="stability-note">${day>=next.day ? next.label : `Next: ${next.label} at day ${next.day}`}</div>
    `;
    strip.classList.remove("hidden");
    return strip;
  }
  function loadBriefPrefs(){
    try{
      const raw = JSON.parse(localStorage.getItem(BRIEF_PREF_KEY)||"{}");
      return { enabled: raw.enabled!==false, tone: raw.tone||"heroic" };
    }catch(e){ return { enabled:true, tone:"heroic" }; }
  }
  function saveBriefPrefs(prefs){
    try{ localStorage.setItem(BRIEF_PREF_KEY, JSON.stringify(prefs||{})); }catch(e){}
  }
  function loadBriefLog(){
    try{
      const raw = JSON.parse(localStorage.getItem(BRIEF_KEY)||"[]");
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function saveBriefLog(list){
    try{ localStorage.setItem(BRIEF_KEY, JSON.stringify(list||[])); }catch(e){}
  }

  var plannerDangerNode = null;
  var plannerCalendarNode = null;
  const dangerPanelTemplate = document.getElementById("panel-danger")?.innerHTML || "";
  const calendarPanelTemplate = document.getElementById("panel-calendar")?.innerHTML || "";
  function ensurePlannerDangerNode(){
    if(plannerDangerNode) return plannerDangerNode;
    const dangerPanel = document.getElementById("panel-danger");
    if(dangerPanel){
      dangerPanel.classList.remove("hidden");
      plannerDangerNode = dangerPanel;
    } else if(dangerPanelTemplate){
      const temp = document.createElement("section");
      temp.id = "panel-danger";
      temp.className = "planner-danger-shell";
      temp.innerHTML = dangerPanelTemplate;
      plannerDangerNode = temp;
    }
    if(dangerPanel) dangerPanel.remove();
    if(!plannerDangerNode){
      const fallback = document.createElement("div");
      fallback.className = "note";
      fallback.textContent = "Danger view is still loading. Try switching tabs or refreshing.";
      plannerDangerNode = fallback;
    }
    return plannerDangerNode;
  }
  function ensurePlannerCalendarNode(){
    if(plannerCalendarNode) return plannerCalendarNode;
    const calendarPanel = document.getElementById("panel-calendar");
    if(calendarPanel){
      calendarPanel.classList.remove("hidden");
      plannerCalendarNode = calendarPanel;
    } else if(calendarPanelTemplate){
      const temp = document.createElement("section");
      temp.id = "panel-calendar";
      temp.className = "planner-calendar-shell";
      temp.innerHTML = calendarPanelTemplate;
      plannerCalendarNode = temp;
    }
    if(calendarPanel) calendarPanel.remove();
    if(!plannerCalendarNode){
      const fallback = document.createElement("div");
      fallback.className = "note";
      fallback.textContent = "Calendar view is still loading. Try switching tabs or refreshing.";
      plannerCalendarNode = fallback;
    }
    return plannerCalendarNode;
  }
  const setPlannerPage = (next)=>{
    if(next === "danger" || next === "calendar"){
      plannerPage = next;
    } else {
      plannerPage = "story";
    }
    savePlannerPage(plannerPage);
    render();
  };
  function render(){
    if(!panel) panel = document.getElementById("panel-planner");
    if(!panel) return;
    if(isRenderingPlanner) return;
    isRenderingPlanner = true;
    try{
    panel.innerHTML = "";
    workloadExtras = [];
    updatePlannerViewButtons();
  const pageShell = el("div",{class:"planner-page-shell"});
  const switcher = el("div",{class:"planner-page-switch"});
  const storyBtn = el("button",{class:`btn tab ${plannerPage==="story" ? "active" : ""}`,type:"button","aria-pressed":plannerPage==="story" ? "true" : "false"},"Story mode");
  const dangerBtn = el("button",{class:`btn tab ${plannerPage==="danger" ? "active" : ""}`,type:"button","aria-pressed":plannerPage==="danger" ? "true" : "false"},"Danger view");
  const calendarBtn = el("button",{class:`btn tab ${plannerPage==="calendar" ? "active" : ""}`,type:"button","aria-pressed":plannerPage==="calendar" ? "true" : "false"},"Calendar");
  storyBtn.addEventListener("click", ()=> setPlannerPage("story"));
  dangerBtn.addEventListener("click", ()=> setPlannerPage("danger"));
  calendarBtn.addEventListener("click", ()=> setPlannerPage("calendar"));
  switcher.append(storyBtn, dangerBtn, calendarBtn);
  const storyPage = el("div",{class:`planner-page ${plannerPage==="story" ? "is-active" : ""}`,id:"planner-story-page"});
  const dangerPage = el("div",{class:`planner-page ${plannerPage==="danger" ? "is-active" : ""}`,id:"planner-danger-page"});
  const calendarPage = el("div",{class:`planner-page ${plannerPage==="calendar" ? "is-active" : ""}`,id:"planner-calendar-page"});
  const dangerNode = ensurePlannerDangerNode();
  if(dangerNode && dangerNode.parentElement !== dangerPage){
    dangerPage.append(dangerNode);
  }
  const calendarNode = ensurePlannerCalendarNode();
  if(calendarNode && calendarNode.parentElement !== calendarPage){
    calendarPage.append(calendarNode);
  }
  pageShell.append(switcher, storyPage, dangerPage, calendarPage);
  panel.append(pageShell);
  renderDangerZone();
  updateStoryModeCard();
  renderRpgHUD();
  if(plannerViewMode === "class"){
      try{
        buildClassData();
        const dash = typeof renderClassDashboard === "function" ? renderClassDashboard() : null;
        if(dash){
          if(storyModeCard){
            storyModeCard.style.display = "";
            storyModeCard.remove();
            storyPage.append(storyModeCard);
          }
          storyPage.append(dash);
          return;
        }
      }catch(err){
        console.error("Class view failed", err);
      }
      // fallback UI if no dashboard rendered
      const msg = document.createElement("div");
      msg.className = "note";
      msg.textContent = "No class data to display. Try importing your .ics again or open the Calendar tab.";
      storyPage.append(msg);
      return;
  }
  if(storyModeCard){
    const showStory = plannerPage === "story";
    storyModeCard.style.display = showStory ? "" : "none";
    if(storyModeHome && storyModeCard.parentElement !== storyModeHome){
      storyModeHome.append(storyModeCard);
    }
  }
  renderWellnessIntoPopover();
  placeReflectionInPlanner();
    const grid = el("div",{class:"grid"});
    plannerDayOrder.forEach(day=>{
      const cardAttrs = {class:"card","data-day":day};
      if(editMode && allowDayDrag) cardAttrs.draggable = "true";
      const card = el("div",cardAttrs);
      if(editMode && allowDayDrag) card.classList.add("day-draggable");
      const dayBadge = el("div",{class:"day", contentEditable: editMode ? "true" : "false"}, getDayLabel(day));
      const toggleBtn = el("button",{class:"day-toggle",type:"button","aria-label":`Toggle ${getDayLabel(day)}`},"??");
      const toggle = (evt)=>{
        if(evt) evt.stopPropagation();
        card.classList.toggle("collapsed");
      };
      toggleBtn.addEventListener("click", toggle);
      if(editMode){
        dayBadge.setAttribute("spellcheck","false");
        dayBadge.addEventListener("click",e=> e.stopPropagation());
        dayBadge.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); dayBadge.blur(); } });
        dayBadge.addEventListener("blur",()=>{
          const changed = setDayLabel(day, dayBadge.textContent || "");
          dayBadge.textContent = getDayLabel(day);
          if(changed) render();
        });
      } else {
        dayBadge.addEventListener("click", toggle);
      }
      if(editMode && allowDayDrag){
        card.addEventListener("dragstart",e=>{
          dragPayload = {type:"day", day};
          clearDayDropTargets();
          card.classList.add("day-dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", JSON.stringify(dragPayload));
        });
        card.addEventListener("dragend",()=>{
          dragPayload = null;
          card.classList.remove("day-dragging");
          clearDayDropTargets();
        });
        card.addEventListener("dragover",e=>{
          const payload = dragPayload || safeParse(e.dataTransfer.getData("text/plain"));
          if(payload?.type !== "day") return;
          e.preventDefault();
          card.classList.add("day-drop-target");
        });
        card.addEventListener("dragleave",()=> card.classList.remove("day-drop-target"));
        card.addEventListener("drop",e=>{
          const payload = dragPayload || safeParse(e.dataTransfer.getData("text/plain"));
          card.classList.remove("day-drop-target");
          if(payload?.type !== "day") return;
          e.preventDefault();
          reorderPlannerDays(payload.day, day);
        });
      } else {
        card.removeAttribute("draggable");
        card.classList.remove("day-draggable","day-dragging","day-drop-target");
      }
      card.append(
        dayBadge,
        toggleBtn,
        buildDay(day)
      );
      grid.append(card);
    });
    storyPage.append(grid);
    renderWellnessIntoPopover();
    updateDayToggleButton();
    placeReflectionInPlanner();
    } finally {
      isRenderingPlanner = false;
    }
  }

  updateDayDragToggle();
  focusTodayBtn?.addEventListener("click", focusTodayCard);
  toggleDaysBtn?.addEventListener("click", toggleAllDayCards);
  dayDragToggle?.addEventListener("click",()=>{
    allowDayDrag = !allowDayDrag;
    saveDayDragAllowed(allowDayDrag);
    updateDayDragToggle();
    render();
  });
  // assignments UI removed
  weekViewToggle?.addEventListener("click",()=>{
    plannerViewMode = "calendar";
    updatePlannerViewButtons();
    render();
    if(typeof window.activateTab === "function"){
      window.activateTab("tab-calendar");
    }
  });
  classViewToggle?.addEventListener("click",()=>{
    plannerViewMode = "class";
    updatePlannerViewButtons();
    render();
  });

  function handleDropEvent(e, targetDay){
    if(!editMode) return;
    e.preventDefault();
    const payload = dragPayload || safeParse(e.dataTransfer.getData("text/plain"));
    if(!payload || payload.day==null || payload.idx==null) return;
    const rows = Array.from(e.currentTarget.querySelectorAll(".row"));
    let targetIdx = rows.length;
    const hover = e.target.closest(".row");
    if(hover){
      targetIdx = parseInt(hover.getAttribute("data-idx") || "0",10);
      const rect = hover.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height/2;
      if(after) targetIdx += 1;
    }
    moveEntry(payload.day, payload.idx, targetDay, targetIdx);
    dragPayload = null;
  }

  function moveEntry(fromDay, fromIdx, toDay, toIdx){
    if(!Array.isArray(data[fromDay])) data[fromDay] = [];
    if(!Array.isArray(data[toDay])) data[toDay] = [];
    if(fromIdx < 0 || fromIdx >= data[fromDay].length) return;
    if(toIdx == null || isNaN(toIdx)) toIdx = data[toDay].length;
    const [item] = data[fromDay].splice(fromIdx,1);
    if(item===undefined) return;
    if(fromDay === toDay && fromIdx < toIdx) toIdx -= 1;
    toIdx = Math.max(0, Math.min(toIdx, data[toDay].length));
    data[toDay].splice(toIdx,0,item);
    saveData(data);
    render();
  }

  function buildDay(day){
  const wrap = el("div",{class:"content"});
  wrap.append(el("div",{class:"title"},"Activities"));
  const listWrap = el("div",{class:"planner-day","data-day":day});
  listWrap.addEventListener("dragover",e=>{ if(!editMode) return; e.preventDefault(); });
  listWrap.addEventListener("drop",e=>handleDropEvent(e, day));
  (data[day]||[]).forEach((line,idx)=>{
    if(day==="Sunday" && isWorkloadEntry(line)){
      const due = extractDue(line);
      const daysLeft = due ? Math.ceil((due.getTime() - Date.now())/86400000) : 0;
      workloadExtras.push({ title: line, due: due ? due.getTime() : null, daysLeft, inWindow:true });
      return;
    }
    listWrap.append(row(day, idx, line));
  });
  const add = el("button",{ class:"addrow", disabled: !editMode, onclick:()=>{ (data[day]=data[day]||[]).push(". Add a new item."); saveData(data); render(); } },"? Add item");
  wrap.append(listWrap, add);
  wrap.append(el("div",{style:"margin-top:12px;font-weight:600;color:#6b21a8"},"Today's Mood"));
  const m = el("div",{class:"mood","aria-label":"Today's mood selector","role":"group"});
  moodOptions.forEach((option,i)=>{
    const selected = mood[day]===i;
    const s = el("span",{ role:"button", tabindex:"0", "aria-pressed": selected ? "true" : "false", "aria-label": `${option.label} mood`, class: selected ? "sel" : "" },option.emoji);
    s.addEventListener("click",()=>{
      mood[day]=i;
      saveMood(mood);
      render();
    });
    s.addEventListener("keydown",e=>{
      if(e.key==="Enter" || e.key===" " ){
        e.preventDefault();
        s.click();
      }
    });
    m.append(s);
  });
  wrap.append(m);
  return wrap;
}


  function buildJournalCard(){
    const card = el("div",{class:"journal-card"});
    card.append(el("h3",null,"Mood journal"), el("p",{class:"help"},"Capture how you're feeling and we'll keep it synced with the Notes tab."));
    const form = el("form",{class:"journal-form"});
    const rowWrap = el("div",{class:"journal-row"});
    const moodSelect = el("select",{id:"journal-mood"});
    ["Grateful","Motivated","Calm","Tired","Overwhelmed","Focused"].forEach(m=>{ moodSelect.append(el("option",{value:m},m)); });
    const titleInput = el("input",{type:"text",id:"journal-title",placeholder:"Optional title or tag"});
    rowWrap.append(moodSelect,titleInput);
    const textArea = el("textarea",{id:"journal-text",rows:"4",placeholder:"Write a few sentences about your mood..."});
    const submit = el("button",{type:"submit"},"Save entry");
    form.append(rowWrap,textArea,submit);
    form.addEventListener("submit",e=>{
      e.preventDefault();
      const moodValue = moodSelect.value;
      const titleValue = titleInput.value.trim() || moodValue;
      const textValue = textArea.value.trim();
      if(!textValue){
        showToast("Please write a short entry first.","warn");
        return;
      }
      const entry = { id: Date.now(), mood: moodValue, title: titleValue, text: textValue, created: new Date().toISOString() };
      moodEntries.unshift(entry);
      saveJournal(moodEntries);
      addNoteFromMood(entry);
      titleInput.value = "";
      textArea.value = "";
      showToast("Mood saved!");
      render();
    });
    card.append(form);
    const feed = el("div",{class:"journal-feed"});
    if(!moodEntries.length){
      feed.append(el("div",{class:"journal-empty"},"No entries yet. Write your first reflection above."));
    } else {
      moodEntries.slice(0,5).forEach(entry=>{
        const item = el("div",{class:"journal-entry"});
        item.append(
          el("h4",null,entry.title || entry.mood),
          el("div",{class:"meta"}, `${new Date(entry.created || Date.now()).toLocaleString()} - ${entry.mood}`),
          el("p",null,entry.text)
        );
        feed.append(item);
      });
      if(moodEntries.length>5){
        feed.append(el("div",{class:"journal-empty"},`Showing latest 5 of ${moodEntries.length} entries.`));
      }
    }
    card.append(feed);
    return card;
  }

  function getSuggestionTag(){
    if(moodEnergyState.energy==="low" || moodEnergyState.mood==="tired") return "read";
    if(moodEnergyState.energy==="high" || moodEnergyState.mood==="energized") return "push";
    return "neutral";
  }

  function buildJournalSection(){
    const section = el("div",{class:"wellness-section"});
    section.append(el("h3",null,"Mood journal"), el("p",{class:"help"},"Capture how you're feeling and we'll keep it synced with the Notes tab."));
    const form = el("form",{class:"journal-form"});
    const rowWrap = el("div",{class:"journal-row"});
    const moodSelect = el("select",{id:"journal-mood"});
    ["Grateful","Motivated","Calm","Tired","Overwhelmed","Focused"].forEach(m=>{ moodSelect.append(el("option",{value:m},m)); });
    const titleInput = el("input",{type:"text",id:"journal-title",placeholder:"Optional title or tag"});
    rowWrap.append(moodSelect,titleInput);
    const textArea = el("textarea",{id:"journal-text",rows:"4",placeholder:"Write a few sentences about your mood..."});
    const submit = el("button",{type:"submit"},"Save entry");
    form.append(rowWrap,textArea,submit);
    form.addEventListener("submit",e=>{
      e.preventDefault();
      const moodValue = moodSelect.value;
      const titleValue = titleInput.value.trim() || moodValue;
      const textValue = textArea.value.trim();
      if(!textValue){
        showToast("Please write a short entry first.","warn");
        return;
      }
      const entry = { id: Date.now(), mood: moodValue, title: titleValue, text: textValue, created: new Date().toISOString() };
      moodEntries.unshift(entry);
      saveJournal(moodEntries);
      addNoteFromMood(entry);
      titleInput.value = "";
      textArea.value = "";
      showToast("Mood saved!");
      render();
    });
    section.append(form);
    const feed = el("div",{class:"journal-feed"});
    if(!moodEntries.length){
      feed.append(el("div",{class:"journal-empty"},"No entries yet. Write your first reflection above."));
    } else {
      moodEntries.slice(0,5).forEach(entry=>{
        const item = el("div",{class:"journal-entry"});
        item.append(
          el("h4",null,entry.title || entry.mood),
          el("div",{class:"meta"}, `${new Date(entry.created || Date.now()).toLocaleString()} - ${entry.mood}`),
          el("p",null,entry.text)
        );
        feed.append(item);
      });
      if(moodEntries.length>5){
        feed.append(el("div",{class:"journal-empty"},`Showing latest 5 of ${moodEntries.length} entries.`));
      }
    }
    section.append(feed);
    return section;
  }

  function buildWellnessCard(){
    const card = el("div",{class:"journal-card wellness-card"});
    card.append(el("h3",null,"Mood + Weekly review"), el("p",{class:"help"},"Track how you feel and log your weekly reflection together."));
    const wrap = el("div",{class:"wellness-wrap"});
    wrap.append(buildJournalSection());
    const reflectionSlot = el("div",{class:"wellness-section wellness-reflection-slot"});
    wrap.append(reflectionSlot);
    card.append(wrap);
    return card;
  }

  function renderWellnessIntoPopover(){
    if(!levelWellnessSlot) return;
    levelWellnessSlot.innerHTML = "";
    const card = buildWellnessCard();
    card.classList.add("compact");
    levelWellnessSlot.append(card);
  }

  function row(day, idx, text){
    const safeText = (typeof text === "string") ? text : (text && text.title) ? String(text.title) : "";
    const tag = tagFrom(safeText);
    const attrs = {class:"row","data-tag":tag,"data-idx":idx};
    if(editMode) attrs.draggable = "true";
    const r = el("div",attrs);
    if(editMode){
      r.addEventListener("dragstart",e=>{ dragPayload = {day, idx}; r.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", JSON.stringify(dragPayload)); });
      r.addEventListener("dragend",()=>{ dragPayload = null; r.classList.remove("dragging"); });
      const ta = el("textarea",{value:safeText});
      ta.addEventListener("input",e=>{ data[day][idx]=ta.value; saveData(data); r.setAttribute("data-tag",tagFrom(ta.value)); });
      const rm = el("button",{class:"remove",title:"Remove",onclick:()=>{ data[day].splice(idx,1); saveData(data); addXP(5); render(); }},"?");
      r.append(ta,rm);
    } else {
      const suggestion = getSuggestionTag();
      const read = el("div",{class:`read ${suggestion}`},safeText);
      const rm = el("button",{class:"remove",title:"Remove",disabled:true},"?");
      r.append(read,rm);
    }
    return r;
  }

  function tagFrom(t){
  // Emoji-based tags
  if (t.includes("??")) return "blue";      // Study/Work
  if (t.includes("???")) return "green";    // Exercise
  if (t.includes("??")) return "red";      // Meals
  if (t.includes("??")) return "amber";    // Free/Break
  if (t.includes("??") || t.includes("??")) return "violet"; // Morning/Night

  // Text-based fallback based on your energy
  if (moodEnergyState.energy === "low" &&
      /read|review|organize|notes/i.test(t)) return "read";

  if (moodEnergyState.energy === "high" &&
      /essay|lab|study|exam|quiz|project/i.test(t)) return "push";

  // Time or hash-based fallback to keep rows colorful
  const palette = ["blue","green","red","amber","violet"];
  const timeMatch = t.match(/(\d{1,2})\s*[:.]?\s*(\d{0,2})?\s*(am|pm)?/i);
  if(timeMatch){
    const hour = parseInt(timeMatch[1],10) || 0;
    return palette[hour % palette.length];
  }
  let hash = 0;
  for(let i=0;i<t.length;i++){ hash = (hash + t.charCodeAt(i)) % palette.length; }
  return palette[hash];
}



  function addNoteFromMood(entry){
    if(notesData.some(n=>n && n.linkedId===entry.id)) return;
    notesData.unshift({
      id: entry.id,
      linkedId: entry.id,
      title: entry.title || entry.mood || "Mood entry",
      body: entry.text || "",
      tag: "Mood journal",
      created: entry.created || new Date().toISOString()
    });
    saveNotes(notesData);
    renderNotesFeed();
  }

  function renderNotesFeed(){
    const feed = document.getElementById("notes-feed");
    if(!feed) return;
    feed.innerHTML = "";
    if(!notesData.length){
      feed.append(el("div",{class:"notes-empty"},"No notes yet. Mood entries and ChatGPT imports will appear here."));
      return;
    }
    notesData.forEach(note=>{
      const card = el("div",{class:"note-entry"});
      card.append(
        el("h4",null,note.title || "Untitled"),
        el("div",{class:"note-meta"}, `${new Date(note.created || Date.now()).toLocaleString()}${note.tag ? "." + note.tag : "."}`),
        el("p",null,note.body || "")
      );
      feed.append(card);
    });
  }

  function el(tag, attrs, ...children){
    const n = document.createElement(tag);
    const isAttrObject = attrs && typeof attrs === "object" && !Array.isArray(attrs) && !(attrs instanceof Node);
    const kids = isAttrObject ? children : [attrs, ...children];
    if(isAttrObject){
      for(const k in attrs){
        if(k==="class") n.className = attrs[k];
        else if(k==="value") n.value = attrs[k];
        else if(k==="disabled"){ if(attrs[k]) n.setAttribute("disabled",""); }
        else if(k==="onclick") n.addEventListener("click", attrs[k]);
        else n.setAttribute(k, attrs[k]);
      }
    }
    const append = (child)=>{
      if(child==null || child===false) return;
      if(Array.isArray(child)){
        child.forEach(append);
      } else if(child instanceof Node){
        n.append(child);
      } else {
        n.append(document.createTextNode(String(child)));
      }
    };
    kids.forEach(append);
    return n;
  }

  function safeParse(raw){ try{ return raw ? JSON.parse(raw) : null; }catch(e){ return null; } }
  function splitCSVLine(line){
    const result = [];
    let current = "";
    let inQuotes = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(ch === '"' && line[i+1] === '"'){ current += '"'; i++; continue; }
      if(ch === '"'){ inQuotes = !inQuotes; continue; }
      if(ch === "," && !inQuotes){ result.push(current); current = ""; continue; }
      current += ch;
    }
    result.push(current);
    return result;
  }

  function parseChatGPTJSON(text){
    try{
      const parsed = JSON.parse(text);
      return normalizeChatGPTPayload(parsed);
    }catch(e){
      return [];
    }
  }

  function normalizeChatGPTPayload(payload){
    let raw = [];
    if(Array.isArray(payload)) raw = payload;
    else if(Array.isArray(payload.messages)) raw = payload.messages;
    else if(Array.isArray(payload.items)) raw = payload.items;
    else if(payload.data && Array.isArray(payload.data)) raw = payload.data;
    else if(payload.mapping && typeof payload.mapping === "object"){
      raw = Object.values(payload.mapping).map(node=>node && node.message).filter(Boolean);
    }
    const cleaned = [];
    raw.forEach(item=>{
      const msg = item.message || item;
      if(!msg) return;
      const role = msg.role || msg.author?.role || msg.sender || "assistant";
      let content = "";
      if(typeof msg.content === "string") content = msg.content;
      else if(Array.isArray(msg.content)) content = msg.content.map(part=>typeof part==="string"?part:(part.text||part.value||"")).join("\n");
      else if(msg.content && Array.isArray(msg.content.parts)) content = msg.content.parts.map(part=>typeof part==="string"?part:(part.text||part.value||"")).join("\n");
      else if(msg.body) content = msg.body;
      if(content){
        cleaned.push({role, content});
      }
    });
    return cleaned;
  }

  function addChatGPTMessages(messages){
    if(!messages.length) return false;
    const stamp = Date.now();
    messages.forEach((msg,idx)=>{
      const body = (msg.content || "").trim();
      if(!body) return;
      notesData.unshift({
        id: `chatgpt-${stamp}-${idx}`,
        title: `ChatGPT (${msg.role})`,
        body,
        tag: "ChatGPT import",
        created: new Date().toISOString()
      });
    });
    saveNotes(notesData);
    renderNotesFeed();
    return true;
  }

  const viewControls = document.querySelector(".view-controls");
  const inlinePlannerControls = document.querySelector(".inline-views");
  const plannerExports = document.querySelector(".planner-exports");
  const editToggleWrap = document.getElementById("chk-edit")?.parentElement;
  const setPlannerSkin = (on)=>{
    document.body.classList.toggle("planner-active", !!on);
  };
  const setViewControlsVisible = (visible)=>{
    if(!viewControls) return;
    viewControls.style.display = visible ? "" : "none";
  };
  const setPlannerInlineControlsVisible = (visible)=>{
    if(!inlinePlannerControls) return;
    inlinePlannerControls.style.display = visible ? "" : "none";
    inlinePlannerControls.setAttribute("aria-hidden", visible ? "false" : "true");
  };
  const setPlannerExportsVisible = (visible)=>{
    if(!plannerExports) return;
    plannerExports.style.display = visible ? "" : "none";
    plannerExports.setAttribute("aria-hidden", visible ? "false" : "true");
  };
  const setEditToggleVisible = (visible)=>{
    if(!editToggleWrap) return;
    editToggleWrap.style.display = visible ? "" : "none";
  };

  // Quest Log (To-Do Task) - Danger view inspired
  const QUEST_KEY = "planner_quest_log_v1";
  const QUEST_DRAG_KEY = "planner_quest_drag_v1";
  const QUEST_BRIEFS = [
    "Pick the ugliest task and win the day by finishing it first.",
    "Stack a 25-minute focus block on the top quest, then log the win.",
    "Threat rising: clear two quick quests before adding anything new.",
    "Call in backup: delegate or defer one item so the backlog cools off.",
    "Streak idea: complete one quest before checking messages.",
    "XP path: three small quests today beat one big quest undone."
  ];
  let questTasks = loadQuestTasks();
  let questBriefIdx = 0;
  let questBound = false;
  let questDragBound = false;
  let questDrag = { x:0, y:0 };

  function loadQuestTasks(){
    if(!hasStorage) return [];
    try{
      const raw = JSON.parse(localStorage.getItem(QUEST_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function saveQuestTasks(list){
    if(!hasStorage) return;
    try{ localStorage.setItem(QUEST_KEY, JSON.stringify(list||[])); }catch(e){}
  }
  function loadQuestDrag(){
    if(!hasStorage) return { x:0, y:0 };
    try{
      const raw = JSON.parse(localStorage.getItem(QUEST_DRAG_KEY));
      if(raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) return raw;
    }catch(e){}
    return { x:0, y:0 };
  }
  function saveQuestDrag(pos){
    if(!hasStorage) return;
    try{ localStorage.setItem(QUEST_DRAG_KEY, JSON.stringify(pos)); }catch(e){}
  }
  function applyQuestDrag(pos){
    const pane = document.getElementById("quest-pane");
    if(!pane) return;
    const x = Number.isFinite(pos.x) ? pos.x : 0;
    const y = Number.isFinite(pos.y) ? pos.y : 0;
    questDrag = { x, y };
    pane.style.transform = (x || y) ? `translate(${x}px, ${y}px)` : "";
  }
  function renderQuestBrief(force){
    const text = document.getElementById("quest-briefing-text");
    if(!text) return;
    if(force) questBriefIdx = Math.floor(Math.random()*QUEST_BRIEFS.length);
    text.textContent = QUEST_BRIEFS[questBriefIdx % QUEST_BRIEFS.length];
    questBriefIdx = (questBriefIdx + 1) % QUEST_BRIEFS.length;
  }
  function spawnQuestXp(){
    const pop = document.createElement("div");
    pop.className = "quest-xp-pop";
    pop.textContent = "+5 XP";
    document.body.append(pop);
    setTimeout(()=> pop.remove(), 1000);
  }
  function renderQuestLog(){
    const activeWrap = document.getElementById("quest-active");
    const doneWrap = document.getElementById("quest-completed");
    const columns = document.getElementById("quest-columns");
    const empty = document.getElementById("quest-empty");
    if(!activeWrap || !doneWrap) return;
    const active = questTasks.filter(t=>!t.completed);
    const done = questTasks.filter(t=>t.completed);
    const xp = done.length * 5;
    const xpEl = document.getElementById("quest-xp");
    if(xpEl) xpEl.textContent = `${xp} XP`;
    const activeCount = document.getElementById("quest-active-count");
    const doneCount = document.getElementById("quest-completed-count");
    if(activeCount) activeCount.textContent = `Active: ${active.length}`;
    if(doneCount) doneCount.textContent = `Completed: ${done.length}`;
    const progress = document.getElementById("quest-progress");
    const pct = questTasks.length ? Math.round(done.length * 100 / questTasks.length) : 0;
    if(progress) progress.style.width = `${pct}%`;
    const threat = document.getElementById("quest-threat");
    if(threat){
      let cls = "quest-chip-green";
      let label = "Threat: Low";
      if(active.length >= 6){ cls = "quest-chip-red"; label = "Threat: Critical"; }
      else if(active.length >= 3){ cls = "quest-chip-orange"; label = "Threat: Rising"; }
      threat.className = `quest-chip ${cls}`;
      threat.textContent = label;
    }
    if(empty && columns){
      const has = questTasks.length > 0;
      empty.style.display = has ? "none" : "";
      columns.style.display = has ? "grid" : "none";
    }
    const renderList = (container, list, completed)=>{
      container.innerHTML = "";
      if(!list.length){
        container.innerHTML = `<div class="note" style="padding:8px 10px;">${completed?"No completed quests yet.":"No active quests."}</div>`;
        return;
      }
      list.forEach(task=>{
        const row = document.createElement("div");
        row.className = `quest-item${task.completed ? " completed":""}`;
        row.dataset.taskId = task.id;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `quest-checkbox ${task.completed ? "on":""}`;
        btn.textContent = task.completed ? "?" : "";
        btn.addEventListener("click", ()=> toggleQuest(task.id));
        const body = document.createElement("div");
        body.style.flex = "1";
        const text = document.createElement("div");
        text.className = "quest-text";
        text.textContent = task.text;
        const time = document.createElement("div");
        time.className = "quest-time";
        const stamp = new Date(task.completed ? task.completedAt : task.createdAt);
        time.textContent = `${task.completed ? "Completed" : "Created"} ${stamp.toLocaleString()}`;
        body.append(text, time);
        const actions = document.createElement("div");
        actions.className = "quest-actions";
        const del = document.createElement("button");
        del.type = "button";
        del.className = "quest-delete";
        del.textContent = "?";
        del.addEventListener("click", ()=> deleteQuest(task.id));
        actions.append(del);
        row.append(btn, body, actions);
        container.append(row);
      });
    };
    renderList(activeWrap, active, false);
    renderList(doneWrap, done, true);
  }
  function addQuest(text){
    if(!text) return;
    const task = {
      id:`quest-${Date.now()}`,
      text: text.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: ""
    };
    questTasks = [task, ...questTasks].slice(0, 999);
    saveQuestTasks(questTasks);
    renderQuestLog();
  }
  function toggleQuest(id){
    const idx = questTasks.findIndex(t=>t.id===id);
    if(idx<0) return;
    const t = questTasks[idx];
    const completed = !t.completed;
    questTasks[idx] = { ...t, completed, completedAt: completed ? new Date().toISOString() : "" };
    saveQuestTasks(questTasks);
    renderQuestLog();
    if(completed) spawnQuestXp();
  }
  function deleteQuest(id){
    questTasks = questTasks.filter(t=>t.id!==id);
    saveQuestTasks(questTasks);
    renderQuestLog();
  }
  function initQuestDrag(){
    if(questDragBound) return;
    const pane = document.getElementById("quest-pane");
    const handle = document.getElementById("quest-briefing");
    if(!pane || !handle) return;
    questDrag = loadQuestDrag();
    applyQuestDrag(questDrag);
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startRect = null;
    let startDrag = { x:0, y:0 };
    const clamp = (val, min, max)=> Math.min(Math.max(val, min), max);
    const onPointerDown = (e)=>{
      if(e.button !== 0) return;
      if(e.target.closest("button, a, input, textarea, select")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startRect = pane.getBoundingClientRect();
      startDrag = { ...questDrag };
      pane.classList.add("quest-dragging");
      if(typeof handle.setPointerCapture === "function"){
        handle.setPointerCapture(e.pointerId);
      }
      e.preventDefault();
    };
    const onPointerMove = (e)=>{
      if(!dragging || !startRect) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const pad = 16;
      const minDx = pad - startRect.left;
      const maxDx = window.innerWidth - pad - (startRect.left + startRect.width);
      const minDy = pad - startRect.top;
      const maxDy = window.innerHeight - pad - (startRect.top + startRect.height);
      const clampedDx = clamp(dx, minDx, maxDx);
      const clampedDy = clamp(dy, minDy, maxDy);
      applyQuestDrag({ x: startDrag.x + clampedDx, y: startDrag.y + clampedDy });
    };
    const onPointerUp = (e)=>{
      if(!dragging) return;
      dragging = false;
      pane.classList.remove("quest-dragging");
      if(typeof handle.releasePointerCapture === "function"){
        try{ handle.releasePointerCapture(e.pointerId); }catch(err){}
      }
      saveQuestDrag(questDrag);
    };
    handle.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    questDragBound = true;
  }
  function bindQuestUI(){
    if(questBound) return;
    const form = document.getElementById("quest-form");
    const input = document.getElementById("quest-input");
    const refresh = document.getElementById("quest-refresh");
    if(form){
      form.addEventListener("submit", e=>{
        e.preventDefault();
        if(!input || !input.value.trim()) return;
        addQuest(input.value);
        input.value = "";
      });
    }
    refresh?.addEventListener("click", ()=> renderQuestBrief(true));
    renderQuestLog();
    renderQuestBrief(true);
    initQuestDrag();
    questBound = true;
  }

  const map = { "tab-planner":"panel-planner", "tab-pomodoro":"panel-pomodoro", "tab-habits":"panel-habits", "tab-notes":"panel-notes", "tab-workout":"panel-workout", "tab-settings":"panel-settings" };
  const activateTab = (id)=>{
    if(!map[id]) return;
    Object.keys(map).forEach(k=>{
      const tabBtn = document.getElementById(k);
      const pn = document.getElementById(map[k]);
      if(tabBtn) tabBtn.setAttribute("aria-selected", k===id ? "true" : "false");
      if(pn) pn.classList.toggle("hidden", k!==id);
    });
    setViewControlsVisible(id==="tab-planner");
    setPlannerInlineControlsVisible(id==="tab-planner");
    setPlannerExportsVisible(id==="tab-calendar");
    setEditToggleVisible(id==="tab-planner");
    setPlannerSkin(id==="tab-planner");
    if(id==="tab-calendar") renderCalendarPanel();
    if(id==="tab-notes") renderNotesFeed();
    if(id==="tab-habits") renderHabits();
    if(id==="tab-danger"){
      renderDangerZone();
      bindQuestUI();
      if(typeof renderGhosts==="function") renderGhosts();
    }
    window.document.documentElement.dataset.activeTab = id;
    window.dispatchEvent(new CustomEvent("tabchange",{detail:{id}}));
  };
  window.activateTab = activateTab;

  const initQuickMenu = ()=>{
    const menuWrap = document.querySelector(".floating-rail");
    const toggle = document.getElementById("rail-toggle");
    const panel = document.getElementById("rail-menu");
    if(!menuWrap || !toggle || !panel) return;
    if(window.__quickMenuInit) return;
    window.__quickMenuInit = true;

    const items = Array.from(panel.querySelectorAll("[data-target]"));
    let activeTabId = document.documentElement.dataset.activeTab || items[0]?.dataset.target || "tab-planner";
    document.documentElement.dataset.activeTab = activeTabId;
    let isQuickMenuOpen = true;

    const syncActive = (id = activeTabId)=>{
      items.forEach((btn)=>{
        btn.classList.toggle("is-active", btn.dataset.target === id);
      });
    };
    const setQuickMenuOpen = (open, focusMenu = false)=>{
      const willOpen = !!open;
      if(!willOpen && panel.contains(document.activeElement)){
        try{ toggle.focus({preventScroll:true}); }catch(e){}
      }
      isQuickMenuOpen = willOpen;
      menuWrap.classList.toggle("open", isQuickMenuOpen);
      toggle.setAttribute("aria-expanded", isQuickMenuOpen ? "true" : "false");
      panel.setAttribute("aria-hidden", isQuickMenuOpen ? "false" : "true");
      toggle.setAttribute("aria-label", isQuickMenuOpen ? "Close quick menu" : "Open quick menu");
      if(isQuickMenuOpen && focusMenu){
        try{ items[0]?.focus({ preventScroll:true }); }catch(e){}
      }
    };
    const closeMenu = ()=> setQuickMenuOpen(false);
    const toggleMenu = ()=>{
      const willOpen = !isQuickMenuOpen;
      setQuickMenuOpen(willOpen, willOpen);
    };

    toggle.addEventListener("click",(e)=>{
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });
    panel.addEventListener("click",(e)=> e.stopPropagation());
    document.addEventListener("click",(e)=>{
      if(!menuWrap.contains(e.target)) closeMenu();
    });
    document.addEventListener("keydown",(e)=>{
      if(e.key === "Escape") closeMenu();
    });
    items.forEach((btn)=>{
      btn.addEventListener("click",(e)=>{
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.target;
        if(id && typeof window.activateTab === "function"){
          window.activateTab(id);
        }
        closeMenu();
      });
    });
    window.addEventListener("tabchange",(e)=>{
      const id = e.detail?.id;
      if(id){
        activeTabId = id;
        syncActive(id);
      }
    });
    syncActive(activeTabId);
    setQuickMenuOpen(true);
  };
  initQuickMenu();

  Object.keys(map).forEach(id=>{
    const btn = document.getElementById(id);
    if(!btn) return;
    btn.addEventListener("click",()=>activateTab(id));
  });
  bindQuestUI();
  activateTab("tab-planner");

  // Timer restore prompt
  setTimeout(()=> {
    try{
      const microRaw = localStorage.getItem("planner_countdown_state_v1");
      const laundryRaw = localStorage.getItem("planner_laundry_state_v1");
      const pomoRaw = localStorage.getItem("planner_pomo_state_v1");
      const candidates = [];
      const parse = (raw)=>{ try{ return raw ? JSON.parse(raw) : null; }catch(e){ return null; } };
      const m = parse(microRaw);
      const l = parse(laundryRaw);
      const p = parse(pomoRaw);
      if(m && (m.running || m.remaining > 0)) candidates.push("Micro timer");
      if(l && (l.running || l.remaining > 0)) candidates.push("Laundry timer");
      if(p && (p.running || p.secondsLeft > 0)) candidates.push("Pomodoro");
      if(!candidates.length) return;
      const list = candidates.join(", ");
      const ok = confirm(`Restore timers? Found active states for: ${list}.`);
      if(ok){
        if(m && typeof window.__plannerRestoreMicro === "function") window.__plannerRestoreMicro();
        if(l && typeof window.__plannerRestoreLaundry === "function") window.__plannerRestoreLaundry();
        if(p && typeof window.__plannerRestorePomo === "function") window.__plannerRestorePomo();
      }
    }catch(e){}
  }, 800);

  renderNotesFeed();
  renderRoadmapEditor();
  renderSkillVisualizer();
  const skillEditToggle = document.getElementById("skill-edit-toggle");
  if(skillEditToggle){
    skillEditToggle.addEventListener("click",()=>{
      const board = document.getElementById("skill-progress-board");
      if(!board) return;
      const editing = board.classList.toggle("is-editing");
      skillEditToggle.textContent = editing ? "Done" : "Edit Progress";
      renderSkillVisualizer();
    });
  }
  const notesExportBtn = document.getElementById("notes-export");
  if(notesExportBtn) notesExportBtn.addEventListener("click",()=>{
    if(!notesData.length){ showToast("No notes to export.","warn"); return; }
    const blob = new Blob([JSON.stringify(notesData,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notes.json";
    a.click();
    URL.revokeObjectURL(url);
  });
  const notesClearBtn = document.getElementById("notes-clear");
  if(notesClearBtn) notesClearBtn.addEventListener("click",()=>{
    if(!notesData.length) return;
    if(confirm("Clear all saved notes?")){
      notesData = [];
      saveNotes(notesData);
      renderNotesFeed();
    }
  });
  const notesImportFile = document.getElementById("notes-import-file");
  if(notesImportFile) notesImportFile.addEventListener("change",e=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const messages = parseChatGPTJSON(String(reader.result||""));
      if(messages.length){
        addChatGPTMessages(messages);
        showToast(`Imported ${messages.length} messages.`);
      } else {
        showToast("No ChatGPT messages found.","warn");
      }
      notesImportFile.value = "";
    };
    reader.readAsText(file);
  });
  const notesChatBtn = document.getElementById("notes-chatgpt-btn");
  if(notesChatBtn) notesChatBtn.addEventListener("click",()=>{
    const input = document.getElementById("notes-chatgpt-text");
    if(!input) return;
    const raw = input.value.trim();
    if(!raw){ showToast("Paste ChatGPT JSON first.","warn"); return; }
    const messages = parseChatGPTJSON(raw);
    if(messages.length){
      addChatGPTMessages(messages);
      showToast(`Imported ${messages.length} messages.`);
      input.value = "";
    }else{
      showToast("No ChatGPT messages found.","warn");
    }
  });

  function initWorkoutTab(){
    const container = document.querySelector(".workout-tab");
    if(!container) return null;
    const cells = Array.from(document.querySelectorAll(".workout-editable"));
    if(!cells.length) return null;
    const defaults = cells.map(cell => cell.innerHTML);
    const toggle = document.getElementById("workout-edit-toggle");
    const saveBtn = document.getElementById("workout-save");
    const resetBtn = document.getElementById("workout-reset");
    const note = document.getElementById("workout-storage-note");
    if(note) note.textContent = hasStorage ? "" : "Browser storage is blocked - workout edits last until you close this tab.";
    const setEditMode = (on)=>{
      cells.forEach(cell => cell.setAttribute("contenteditable", on ? "true" : "false"));
      container.classList.toggle("workout-edit-on", !!on);
      if(toggle) toggle.checked = !!on;
    };
    const load = ()=>{
      if(!hasStorage) return;
      try{
        const raw = localStorage.getItem(WORKOUT_KEY);
        if(!raw) return;
        const data = JSON.parse(raw);
        if(Array.isArray(data) && data.length === cells.length){
          data.forEach((html, idx)=>{ cells[idx].innerHTML = html; });
        }
      }catch(e){}
    };
    const save = ()=>{
      if(!hasStorage){ showToast("Storage blocked - not saved","warn"); return; }
      const payload = cells.map(cell => cell.innerHTML);
      localStorage.setItem(WORKOUT_KEY, JSON.stringify(payload));
      showToast("Workout tab saved");
    };
    const reset = (silent)=>{
      if(hasStorage) localStorage.removeItem(WORKOUT_KEY);
      defaults.forEach((html, idx)=>{ cells[idx].innerHTML = html; });
      if(!silent) showToast("Workout tab reset");
    };
    toggle && toggle.addEventListener("change",e=>setEditMode(e.target.checked));
    saveBtn && saveBtn.addEventListener("click",save);
    resetBtn && resetBtn.addEventListener("click",()=>{
      if(confirm("Reset workout section to the default text?")){
        reset();
        setEditMode(false);
      }
    });
    load();
    setEditMode(false);
    return { resetToDefault: reset, setEditMode };
  }

  function initExerciseLibrary(){
    const btn = document.getElementById("workout-library-btn");
    if(!btn) return;
    const target = EXERCISE_LIBRARY_PATH;
    const openLibrary = ()=>{
      const popup = window.open(target, "exerciseLibrary", "noopener,noreferrer,width=1280,height=900,scrollbars=yes,resizable=yes");
      if(!popup){
        showToast("Allow pop-ups to open the exercise library.","warn");
        return;
      }
      popup.focus();
    };
    btn.addEventListener("click", openLibrary);
  }

  function renderRoutinesGrid(){
    const grid = document.getElementById("routines-grid");
    if(!grid) return;
    grid.innerHTML = "";
    const filtered = routinesState.filter(r => routineFilter==="all" || r.category === routineFilter);
    if(!filtered.length){
      const p = document.createElement("p");
      p.className = "note";
      p.textContent = "No routines in this filter yet.";
      grid.append(p);
      return;
    }
    filtered.forEach(routine=>{
      const card = document.createElement("article");
      card.className = `routine-card v2 ${routine.category}${routine.open ? " open":""}`;
      card.dataset.routineId = routine.id;

      const top = document.createElement("div");
      top.className = "routine-top";
      const title = document.createElement("h5");
      title.textContent = routine.title;
      const chevron = document.createElement("span");
      chevron.className = "routine-chevron";
      chevron.textContent = routine.open ? "?" : ">";
      top.append(title, chevron);

      const tag = document.createElement("span");
      const badgeClass = {
        strength:"badge-strength",
        core:"badge-core",
        skills:"badge-skills",
        recovery:"badge-recovery"
      }[routine.category] || "badge-strength";
      tag.className = `routine-tag ${badgeClass}`;
      tag.textContent = routine.tag || routine.category;

      const body = document.createElement("div");
      body.className = "routine-body";
      const ul = document.createElement("ul");
      routine.items.forEach(item=>{
        const li = document.createElement("li");
        li.textContent = item;
        ul.append(li);
      });
      body.append(ul);

      const toggle = ()=>{
        routinesState = routinesState.map(r=> r.id===routine.id ? {...r, open: !r.open} : r);
        const openMap = routinesState.reduce((acc,r)=>{ acc[r.id] = r.open; return acc; },{});
        saveRoutinePrefs(openMap, routineFilter);
        renderRoutinesGrid();
      };
      top.addEventListener("click", toggle);
      chevron.addEventListener("click", e=>{ e.stopPropagation(); toggle(); });

      card.append(top, tag, body);
      grid.append(card);
    });
  }

  function initRoutineFilters(){
    const chips = Array.from(document.querySelectorAll(".routine-chip"));
    if(!chips.length) return;
    const setActive = (filter)=>{
      routineFilter = filter;
      chips.forEach(chip=>{
        const f = (chip.textContent||"").trim().toLowerCase();
        chip.classList.toggle("active", f === filter);
      });
      saveRoutinePrefs(routinesState.reduce((acc,r)=>{ acc[r.id]=r.open; return acc; },{}), routineFilter);
      renderRoutinesGrid();
    };
    chips.forEach(chip=>{
      const filter = (chip.textContent||"").trim().toLowerCase();
      chip.addEventListener("click", ()=> setActive(filter));
    });
    const prefs = loadRoutinePrefs();
    // Force close Leg Day & Technique Saturday by default
    if(prefs.openMap){
      prefs.openMap["leg-day"] = false;
      prefs.openMap["technique-saturday"] = false;
    }
    routinesState = defaultRoutines.map(normalizeRoutine).map(r=>{
      if(prefs.openMap && Object.prototype.hasOwnProperty.call(prefs.openMap, r.id)){
        return {...r, open: !!prefs.openMap[r.id]};
      }
      return r;
    });
    const initialFilter = chips.some(c => (c.textContent||"").trim().toLowerCase() === prefs.filter) ? prefs.filter : "all";
    setActive(initialFilter);
  }

  function initRoutinesLibrary(){
    if(!document.getElementById("routines-grid")) return;
    initRoutineFilters();
  }

  function initTrainingDashboard(){
    const dashboard = document.getElementById("training-dashboard");
    if(!dashboard) return;
    const tabs = Array.from(dashboard.querySelectorAll(".td-tab"));
    const views = {};
    Array.from(dashboard.querySelectorAll(".td-view")).forEach(view=>{
      const key = view.id.replace(/^td-/, "").replace(/-view$/, "");
      views[key] = view;
    });

    // Move existing Weekly Goals and Body Heat Map into the dashboard views
    const goalsView = document.getElementById("td-goals-view");
    const heatView = document.getElementById("td-heat-view");
    const trackerView = document.getElementById("td-tracker-view");
    const skillsView = document.getElementById("td-skills-view");
    const legacyTwoUp = document.querySelector(".workout-two-up");
    if(legacyTwoUp){
      const goalsCard = legacyTwoUp.querySelector(".workout-goals-card");
      const heatCard = legacyTwoUp.querySelector(".workout-heat-card");
      if(goalsCard && goalsView) goalsView.appendChild(goalsCard);
      if(heatCard && heatView) heatView.appendChild(heatCard);
      if(!legacyTwoUp.querySelector(".workout-section")) legacyTwoUp.remove();
    }
    const trackerCard = document.querySelector(".workout-tracker-card");
    if(trackerCard && trackerView){
      trackerView.appendChild(trackerCard);
      const trackerContainer = trackerCard.parentElement;
      if(trackerContainer && !trackerContainer.querySelector(".workout-section")){
        trackerContainer.remove();
      }
    }
    const skillsCard = document.getElementById("skill-progress-board");
    if(skillsCard && skillsView){
      skillsView.appendChild(skillsCard);
      const skillsContainer = skillsCard.parentElement;
      if(skillsContainer && !skillsContainer.querySelector(".workout-section")){
        skillsContainer.remove();
      }
    }

    const setActive = (key)=>{
      tabs.forEach(btn=>{
        const match = btn.dataset.view === key;
        btn.classList.toggle("active", match);
        btn.setAttribute("aria-selected", match ? "true" : "false");
      });
      Object.entries(views).forEach(([k,el])=>{
        if(!el) return;
        el.classList.toggle("hidden", k !== key);
      });
      if(key === "routines") renderRoutinesGrid();
      if(key === "skills") renderSkillVisualizer();
    };
    tabs.forEach(btn=>{
      btn.addEventListener("click", ()=> setActive(btn.dataset.view));
    });
    setActive("planner");
  }

  const workoutController = initWorkoutTab();
  initExerciseLibrary();
  initTrainingDashboard();
  initRoutinesLibrary();
  function initWorkoutDragAndDrop(){
    const cells = Array.from(document.querySelectorAll(".workout-editable"));
    if(!cells.length) return;
    let source = null;
    cells.forEach(cell=>{
      cell.setAttribute("draggable","true");
      cell.addEventListener("dragstart",e=>{
        source = cell;
        cell.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      cell.addEventListener("dragend",()=>{
        cell.classList.remove("dragging");
        source = null;
      });
      cell.addEventListener("dragover",e=>e.preventDefault());
      cell.addEventListener("drop",e=>{
        e.preventDefault();
        if(!source || source===cell) return;
        const temp = source.innerHTML;
        source.innerHTML = cell.innerHTML;
        cell.innerHTML = temp;
        if(hasStorage){
          const payload = Array.from(document.querySelectorAll(".workout-editable")).map(c=>c.innerHTML);
          localStorage.setItem(WORKOUT_KEY, JSON.stringify(payload));
        }
      });
    });
  }
  initWorkoutDragAndDrop();
  initChatbot();
  const notifyBtn = document.getElementById("btn-notify");
  const notifyStatus = document.getElementById("notify-status");
  const wakeLockToggle = document.getElementById("wake-lock-toggle");
  const wakeLockStatus = document.getElementById("wake-lock-status");
  const persistBtn = document.getElementById("btn-persist");
  const persistStatus = document.getElementById("persist-status");
  const setPersistStatus = (msg)=>{ if(persistStatus) persistStatus.textContent = msg; };
  const updateWakeLockStatus = ()=>{
    if(!wakeLockStatus) return;
    if(!("wakeLock" in navigator)){
      wakeLockStatus.textContent = "Wake Lock isn't supported in this browser.";
      wakeLockToggle?.setAttribute("disabled", "true");
      return;
    }
    wakeLockToggle?.removeAttribute("disabled");
    wakeLockStatus.textContent = wakeLockEnabled
      ? "Wake lock is on. Timers will keep your screen awake."
      : "Wake lock is off. Timers won't keep your screen awake.";
  };
  function updateNotificationStatus(){
    if(!notifyStatus) return;
    if(!("Notification" in window)){
      notifyStatus.textContent = "This browser does not support push notifications.";
      notifyBtn?.setAttribute("disabled","true");
      return;
    }
    notifyBtn?.removeAttribute("disabled");
    const state = Notification.permission;
    if(state === "granted"){
      notifyStatus.textContent = "Push reminders are on. We'll ping you gently when you drift.";
    } else if(state === "denied"){
      notifyStatus.textContent = "Notifications are blocked. Re-enable them in your browser settings.";
    } else {
      notifyStatus.textContent = "Click the button to enable planner push reminders.";
    }
  }
  async function updatePersistStatus(){
    if(!persistStatus || !navigator.storage || !navigator.storage.persisted){
      setPersistStatus("Your browser may clear data if storage gets low.");
      return;
    }
    try{
      const granted = await navigator.storage.persisted();
      setPersistStatus(granted ? "Persistent storage is already enabled on this browser." : "Persistent storage hasn't been enabled yet.");
    }catch(e){
      setPersistStatus("Unable to check persistent storage status.");
    }
  }
  if(persistBtn){
    persistBtn.addEventListener("click",async ()=>{
      if(!navigator.storage || !navigator.storage.persist){
        setPersistStatus("Persistent storage is not supported in this browser.");
        showToast("Persistent storage isn't supported here.","warn");
        return;
      }
      try{
        const granted = await navigator.storage.persist();
        setPersistStatus(granted ? "Persistent storage granted. Your data is safer now." : "Request was denied by the browser.");
        showToast(granted ? "Persistent storage enabled!" : "Browser denied the request.", granted ? undefined : "warn");
      }catch(err){
        setPersistStatus("Could not enable persistent storage.");
        showToast("Persistent storage request failed.","warn");
      }
    });
  }
  notifyBtn?.addEventListener("click",()=>{
    if(!("Notification" in window)){
      showToast("Notifications not supported in this browser.","warn");
      updateNotificationStatus();
      return;
    }
    notifyBtn.disabled = true;
    const finalize = (result)=>{
      notifyBtn.disabled = false;
      updateNotificationStatus();
      if(result === "granted"){
        startStudyNag(false);
        showToast("Push reminders enabled!");
      } else if(result === "denied"){
        showToast("Notifications blocked by the browser.","warn");
      } else {
        showToast("Notification permission unchanged.","warn");
      }
    };
    try{
      const request = Notification.requestPermission();
      if(request && typeof request.then === "function"){
        request.then(finalize).catch(()=>{ notifyBtn.disabled = false; showToast("Notification request failed.","warn"); });
      } else {
        finalize(Notification.permission);
      }
    }catch(err){
      notifyBtn.disabled = false;
      showToast("Notification request failed.","warn");
    }
  });
  if(wakeLockToggle){
    wakeLockToggle.checked = !!wakeLockEnabled;
    wakeLockToggle.addEventListener("change", ()=>{
      setWakeLockEnabled(wakeLockToggle.checked);
      updateWakeLockStatus();
      if(!wakeLockEnabled){
        showToast("Wake lock disabled. Timers won't keep the screen awake.","warn");
      } else {
        showToast("Wake lock enabled for timers.");
      }
    });
  }
  window.addEventListener("storage", (event)=>{
    if(event.key === WAKE_LOCK_KEY){
      wakeLockEnabled = event.newValue !== "false";
      window.plannerWakeLockEnabled = wakeLockEnabled;
      if(wakeLockToggle) wakeLockToggle.checked = wakeLockEnabled;
      if(!wakeLockEnabled) releasePlannerWakeLock();
      updateWakeLockStatus();
    }
  });
  updateWakeLockStatus();
  plannerExportJSON?.addEventListener("click",()=>{
    downloadBlob(JSON.stringify(data,null,2),"planner.json","application/json");
    showToast("Planner exported");
  });
  plannerExportCSV?.addEventListener("click",()=>{
    const lines = ["Day,Entry"];
    dayOrder.forEach(day=>{
      (data[day]||[""]).forEach(entry=>{
        lines.push(`"${day.replace(/"/g,'""')}","${String(entry||"").replace(/"/g,'""')}"`);
      });
    });
    downloadBlob(lines.join("\n"),"planner.csv","text/csv");
    showToast("Planner CSV exported");
  });
  plannerImportCSV?.addEventListener("change",e=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const text = String(reader.result||"").trim();
      if(!text){ showToast("CSV file was empty","warn"); return; }
      const rows = text.split(/\r?\n/).slice(1);
      if(!rows.length){ showToast("CSV missing rows","warn"); return; }
      const next = deepCopy(sample);
      let imported = 0;
      rows.forEach(line=>{
        if(!line) return;
        const [dayCell="", entryCell=""] = splitCSVLine(line).map(s=>s.trim());
        if(dayOrder.includes(dayCell)){
          next[dayCell].push(entryCell);
          imported++;
        }
      });
      if(!imported){ showToast("No valid rows in CSV","warn"); return; }
      data = next;
      saveData(data);
      render();
      showToast(`Imported ${imported} entries`);
      plannerImportCSV.value = "";
    };
    reader.readAsText(file);
  });
  updatePersistStatus();
  updateNotificationStatus();
  startStudyNag(false);

  // Stability toggle hookup
  (function initStabilityPrefs(){
    const toggle = document.getElementById("stability-toggle");
    if(toggle){
      const prefs = loadStabilityPrefs();
      toggle.checked = prefs.enabled;
      toggle.addEventListener("change", ()=>{
        prefs.enabled = toggle.checked;
        saveStabilityPrefs(prefs);
        renderStabilityStrip();
        renderDangerZone();
      });
    }
  })();

  // Daily briefing prefs
  (function initBriefPrefsUI(){
    const toggle = document.getElementById("bunker-log-toggle");
    const toneSel = document.getElementById("bunker-log-tone");
    const prefs = loadBriefPrefs();
    if(toggle){
      toggle.checked = prefs.enabled;
      toggle.addEventListener("change", ()=>{
        prefs.enabled = toggle.checked;
        saveBriefPrefs(prefs);
        renderBriefingStrip({level:"green", detail:""}, []);
        renderBriefLog();
        renderDangerZone();
      });
    }
    if(toneSel){
      toneSel.value = prefs.tone || "heroic";
      toneSel.addEventListener("change", ()=>{
        prefs.tone = toneSel.value;
        saveBriefPrefs(prefs);
        renderDangerZone();
      });
    }
  })();

  function initChatbot(){
    const toggle = document.getElementById("chatbot-toggle");
    const panel = document.getElementById("chatbot-panel");
    const form = document.getElementById("chatbot-form");
    const input = document.getElementById("chatbot-input");
    const log = document.getElementById("chatbot-messages");
    const suggestBtn = document.getElementById("chatbot-suggest");
    const nudge = document.getElementById("chatbot-nudge");
    if(!toggle || !panel || !form || !input || !log || !suggestBtn) return;
    const replies = [
      { keywords:["plan","schedule","routine"], response:"Build your week around two anchor days and keep heavy strength away from the recovery day so energy stays high." },
      { keywords:["motivation","burnout","tired","lazy"], response:"Aim for five focused minutes. Once you move, momentum wakes up the motivation you were waiting for." },
      { keywords:["workout","training","exercise","lifting"], response:"Alternate push, pull, and skill practice. Leave a rep in reserve so tomorrow still feels inviting." },
      { keywords:["habit","streak","consistency"], response:"Stack the habit on top of an existing ritual and track it visibly. Checkmarks wire in the win." },
      { keywords:["focus","study","pomodoro","distraction"], response:"Try a 45/15 focus block, jot distractions instantly, and review them after each break so your brain trusts you." }
    ];
    const updateNudge = (force=false)=>{
      if(!nudge) return;
      const tip = generateDailySuggestion(force);
      if(tip){
        nudge.textContent = tip;
        nudge.classList.add("show");
      } else {
        nudge.classList.remove("show");
      }
    };
    const hideNudge = ()=> nudge?.classList.remove("show");
    appendMessage("bot","Hey! I'm your AI training buddy. Ask about workouts, focus, or staying consistent.");
    const dayTip = generateDailySuggestion();
    if(dayTip) appendMessage("bot", dayTip);
    toggle.addEventListener("click",()=>{
      panel.classList.toggle("hidden");
      if(!panel.classList.contains("hidden")){
        input.focus();
        hideNudge();
      } else {
        updateNudge(false);
      }
    });
    form.addEventListener("submit",e=>{
      e.preventDefault();
      const message = input.value.trim();
      if(!message) return;
      appendMessage("user", message);
      input.value = "";
      setTimeout(()=>appendMessage("bot", buildReply(message)), 350);
    });
    function appendMessage(role, text){
      const bubble = document.createElement("div");
      bubble.className = `chatbot-message ${role}`;
      bubble.textContent = text;
      log.appendChild(bubble);
      log.scrollTop = log.scrollHeight;
    }
        function buildReply(message){
      const lower = message.toLowerCase();
      const formatDue = (item)=>{
        const d = new Date(item.due);
        const dateLabel = d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
        const delta = item.daysLeft;
        const suffix = delta >= 0 ? `${delta} day${delta===1?"":"s"} left` : `${Math.abs(delta)} day${Math.abs(delta)===1?"":"s"} late`;
        return `${item.title} - ${dateLabel} (${suffix})`;
      };
      const upcoming = getUpcomingAssignments(3);
      const nextDeadline = upcoming[0];
      const freezeLine = (streakFreeze.charges||0) > 0
        ? `You have ${streakFreeze.charges} Streak Freeze${streakFreeze.charges===1?"":"s"} stocked - tap it if you miss a day.`
        : "Buy a Streak Freeze (50 XP) before your busiest day so one miss won't break your streak.";
      const actionPlan = ()=>{
        const pieces = [];
        if(nextDeadline){
          pieces.push(`1) Start ${formatDue(nextDeadline)} with a 10-minute outline + rubric check.`);
          pieces.push("2) Block 45 minutes for the hardest part, then 10 minutes to polish.");
        } else {
          pieces.push("1) Pick the toughest task and outline 3 bullets.");
        }
        const pct = Math.round(calcHabitProgress());
        pieces.push(`3) Habits ${pct}% done. ${streakFreeze.charges ? "Freeze is ready if you slip." : "Mark one now so you don't need a freeze."}`);
        return pieces.join(" ");
      };

      if(["freeze","shield","skip day"].some(k=>lower.includes(k))) return freezeLine;
      if(["deadline","due","assignment","danger","class","calendar"].some(k=>lower.includes(k))){
        if(!upcoming.length) return "I don't see any imported deadlines in this window. Try importing your .ics and pick the right week.";
        return `Next up: ${upcoming.map(formatDue).join(" | ")}. Take the earliest one and do a 10-minute starter task right now.`;
      }
      if(["plan","schedule","routine","next","what now"].some(k=>lower.includes(k))){
        return actionPlan();
      }
      if(["motivation","burnout","tired","lazy"].some(k=>lower.includes(k))){
        const energy = moodEnergyState.energy || "medium";
        const quickFix = energy==="low" ? "Do 90s of deep breathing + water, then 5-minute tidy to warm up." : "Walk for 3 minutes, then start the smallest step (open doc, title it, jot 3 bullets).";
        return `${quickFix} ${freezeLine}`;
      }
      if(["pomodoro","timer","break"].some(k=>lower.includes(k))){
        return "Run a 45/15 block. During breaks: posture reset, water, one stretch. Your timer beeps every 30s on breaks to keep you honest.";
      }
      if(["habit","streak","consistency","routine"].some(k=>lower.includes(k))){
        const pct = Math.round(calcHabitProgress());
        return `Habits are ${pct}% complete. Check one thing off now, then bank the Streak Freeze before a hectic day. ${freezeLine}`;
      }
      if(["workout","training","lifting","exercise"].some(k=>lower.includes(k))){
        const energy = moodEnergyState.energy || "medium";
        return energy==="low"
          ? "Energy's low: do a 10-minute mobility/reset and one 'win' set (pushups or hangs). Save heavy work for tomorrow."
          : "Stack skills first, then strength. Stop 1 rep before failure so you can train again tomorrow.";
      }
      if(["mood","energy","tired","sleep"].some(k=>lower.includes(k))){
        return "Micro-fix: water + 90s box-breathing + 5-minute tidy/errand. If still foggy, take a brisk 5-minute walk before the next task.";
      }

      const rule = replies.find(entry => entry.keywords.some(key=>lower.includes(key)));
      if(rule) return rule.response;
      if(["hi","hello","hey"].some(greet=>lower.includes(greet))) return "Hey there! What's one win you can chase today?";
      return generateDailySuggestion(true);
    }
    suggestBtn.addEventListener("click",()=>{
      appendMessage("bot", generateDailySuggestion(true));
    });
    updateNudge(false);
    window.addEventListener("tabchange", ()=>updateNudge(true));
  }

  function loadCoachState(){
    if(hasStorage){
      try{
        const raw = JSON.parse(localStorage.getItem(COACH_KEY));
        if(raw && typeof raw === "object") return raw;
      }catch(e){}
    }
    return { last:null,lastMsg:"" };
  }
    function generateDailySuggestion(forceFresh=false){
    const today = new Date().toDateString();
    if(!forceFresh && coachState.last === today && coachState.lastMsg) return coachState.lastMsg;
    let suggestion = "";
    const habitPct = calcHabitProgress();
    const nextDeadline = getUpcomingAssignments(1)[0];
    if(nextDeadline){
      const due = new Date(nextDeadline.due);
      const days = Math.max(0, Math.ceil((due.getTime() - Date.now())/86400000));
      const freezeMsg = (streakFreeze.charges||0) > 0 ? "Freeze stocked if you miss a habit today." : "Stock a Streak Freeze (50 XP) if you expect a messy day.";
      suggestion = `Next due: ${nextDeadline.title} on ${due.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})} (${days===0?"today":days+"d"}). Do a 15-minute outline + rubric check, then block 45 minutes tomorrow. ${freezeMsg}`;
    } else if(habitPct < 40){
      suggestion = `Habit completion is at ${habitPct}%. Pick one anchor habit and celebrate a single win today.`;
    } else {
      const laggingSkill = skillProgressState.find(skill => (skill.level||0) < skill.stages.length-1);
      if(laggingSkill){
        const currentStage = laggingSkill.stages[laggingSkill.level] || laggingSkill.stages[0];
        const nextStage = laggingSkill.stages[Math.min(laggingSkill.level+1, laggingSkill.stages.length-1)];
        suggestion = `For ${laggingSkill.title}, you're on ${currentStage}. Spend 10 minutes drilling toward ${nextStage} today.`;
      } else {
        const latestMood = moodEntries[0];
        if(latestMood){
          const days = Math.floor((Date.now() - new Date(latestMood.created || Date.now()).getTime())/86400000);
          if(days >= 2){
            suggestion = `It's been ${days} days since your last mood log. Drop a quick entry before you train.`;
          }
        }
        if(!suggestion){
          const phase = roadmapState[0];
          if(phase && phase.focus && phase.focus.length){
            suggestion = `Roadmap reminder: "${phase.focus[0]}". Lock that in before moving on.`;
          } else {
            suggestion = "Schedule looks balanced. Use one long break to film handstand form and review checkpoints.";
          }
        }
      }
    }
    coachState = { last: today, lastMsg: suggestion };
    if(hasStorage) localStorage.setItem(COACH_KEY, JSON.stringify(coachState));
    return suggestion;
  }
  document.getElementById("btn-reset").addEventListener("click",()=>{
    if(hasStorage){
      localStorage.removeItem(S_KEY);
      localStorage.removeItem(M_KEY);
      localStorage.removeItem(E_KEY);
      localStorage.removeItem(J_KEY);
      localStorage.removeItem(NOTES_KEY);
      localStorage.removeItem("habits-data");
      localStorage.removeItem(HABIT_HISTORY_KEY);
      localStorage.removeItem(STREAK_FREEZE_KEY);
    }
    data = deepCopy(sample);
    mood = {};
    moodEntries = [];
    notesData = [];
    habitsState = defaultHabits.map(normalizeHabit);
    editMode = true;
    document.getElementById("chk-edit").checked = true;
    saveData(data);
    saveMood(mood);
    saveJournal(moodEntries);
    saveNotes(notesData);
    saveHabits(habitsState);
    if(workoutController){
      workoutController.resetToDefault(true);
      workoutController.setEditMode(false);
    }
    roadmapState = loadRoadmap();
    skillProgressState = loadSkillProgress();
    routinesState = defaultRoutines.map(normalizeRoutine);
    routineFilter = "all";
    coachState = loadCoachState();
    streakFreeze = loadStreakFreeze();
    habitHistory = {};
    renderRoadmapEditor();
    renderSkillVisualizer();
    renderRoutinesGrid();
    render();
    renderNotesFeed();
    renderHabits();
    updateHabitStreakPanel();
    updateStreakFreezeBar();
    showToast("Reset complete");
  });
})();




