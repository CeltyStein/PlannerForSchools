
(function(){
  const dayOrder = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const moods = ['😴','🙁','😐','🙂','😊','😎','🤩'];
  const buttonSelector = "button, .tab";
  let audioCtx = null;
  function ensureAudio(){
    if(audioCtx) return audioCtx;
    try{
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }catch(e){
      audioCtx = null;
    }
    return audioCtx;
  }
  function playClickTone(){
    const ctx = ensureAudio();
    if(!ctx) return;
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
      "1–4 AM: 🟦 Discussion Posts (Pomodoro)\n  • 1:00–1:25 Focus → 1:25–1:30 🟩 Jumping Jacks\n  • 1:30–1:55 Focus → 1:55–2:00 🟩 JJs\n  • 2:00–2:25 Focus → 2:25–2:30 🟩 JJs\n  • 2:30–2:55 Focus → 2:55–3:25 🟪 BIG BREAK 🌳 Walk/Stretch",
      "5–6 AM: 🟦 Easier Essays",
      "6 AM: 🟨 Wake, shower, breakfast",
      "7–9 AM: 🟦 Finish Essays (Pomodoro cycles)",
      "9–12 PM: 🟦 Polish Essays (Pomodoro cycles)",
      "12 PM: 🔴 Lunch + Coursera",
      "1–5 PM: 🟦 Quizzes/Labs/Assignments (Pomodoro cycles w/ breaks)",
      "5–6 PM: 🔴 Dinner",
      "6–7 PM: 🟦 Labs/Simulations",
      "7–8:30 PM: 🟦 Labs/Simulations",
      "8:30–9 PM: 🟨 Emails (7:30–8) → 🌙 Night Routine",
      "9 PM–2 AM: 🟦 Essay writing"
    ],
    Tuesday: [
      "6 AM: 🟨 Wake, shower, breakfast",
      "7–9 AM: 🟧 Chill Skills",
      "9–12 PM: 🟧 Chill Skills",
      "12 PM: 🔴 Lunch",
      "1–5 PM: 🟪 Relax (Manga, Anime)",
      "5–6 PM: 🔴 Dinner",
      "6–7 PM: 🟪 Free",
      "7–8:30 PM: 🟨 Emails (7:30–8)",
      "8:30–9 PM: 🌙 Night Routine",
      "9–11 PM: 🌙 Sleep"
    ],
    Wednesday: [
      "6 AM: 🟧 Technique workout + calligraphy",
      "7–9 AM: 🟪 Relax",
      "9–12 PM: 🟦 Work",
      "12 PM: 🔴 Lunch (Spanish/Japanese)",
      "1–5 PM: 🟦 Work",
      "5–6 PM: 🔴 Dinner + rehab stretch",
      "6–7 PM: 🟩 Martial Arts",
      "7–8:30 PM: 🟩 Gym (weights/conditioning)",
      "8:30–9 PM: 🌙 Night Routine",
      "9–11 PM: 🌙 Sleep"
    ],
    Thursday: [
      "6 AM: 🟨 Wake, shower, breakfast",
      "7–9 AM: 🟦 Polish Essays (Pomodoro)",
      "9–12 PM: 🟦 Check assignments → finish",
      "12 PM: 🔴 Lunch",
      "1–5 PM: 🟦 Study Notes (Pomodoro cycles)",
      "5–6 PM: 🔴 Dinner",
      "6–7 PM: 🟩 Martial Arts",
      "7–8:30 PM: 🟩 Gym (weights/conditioning, Pomodoro optional)",
      "8:30–9 PM: 🌙 Shower + Night Routine → Sleep",
      "9–11 PM: 🌙 Sleep"
    ],
    Friday: [
      "6 AM: 🟨 Wake, shower, breakfast",
      "7–9 AM: 🟦 Reply to Posts (Pomodoro)",
      "9–12 PM: 🟦 PC Support Labs & Quizzes (Pomodoro)",
      "12 PM: 🔴 Lunch",
      "1–5 PM: 🟦 Textbook Study (Pomodoro cycles)",
      "5–6 PM: 🔴 Dinner",
      "6–7 PM: 🟩 Gym (weights)",
      "7–8:30 PM: 🟩 Jiu-Jitsu",
      "8:30–9 PM: 🌙 Night Routine",
      "9–11 PM: 🌙 Sleep"
    ],
    Saturday: [
      "6 AM: 🟨 Wake, shower, breakfast",
      "7–9 AM: 🟧 Me Time Skills",
      "9–12 PM: 🟦 Textbook Studies (Pomodoro)",
      "12 PM: 🔴 Lunch",
      "1–5 PM: 🟦 Textbook Studies (Pomodoro cycles)",
      "5–6 PM: 🔴 Dinner",
      "6–7 PM: 🟦 Textbook Studies",
      "7–8:30 PM: 🟦 Textbook Studies",
      "8:30–9 PM: 🌙 Night Routine",
      "9–11 PM: 🌙 Sleep"
    ],
    Sunday: [
      "6 AM: 🟨 Wake, shower, breakfast",
      "7–9 AM: 🟦 PC Textbook Studies (Pomodoro)",
      "9–12 PM: 🟦 PC Textbook Studies (Pomodoro)",
      "12 PM: 🔴 Lunch",
      "1–5 PM: 🟦 PC Studies 1–2 → 🟪 Rest",
      "5–6 PM: 🔴 Dinner",
      "6–7 PM: 🟪 Free",
      "7–8:30 PM: 🟨 Plan next week",
      "8:30–9 PM: 🌙 Night Routine",
      "9–11 PM: 🌙 Sleep"
    ]
  };

  const HABIT_CATEGORIES = [
    { id: "study", label: "🟦 Study/Work", emoji: "🟦" },
    { id: "exercise", label: "🟩 Exercise", emoji: "🟩" },
    { id: "meals", label: "🔴 Meals", emoji: "🔴" },
    { id: "admin", label: "🟨 Morning/Admin", emoji: "🟨" },
    { id: "free", label: "🟪 Free/Breaks", emoji: "🟪" },
    { id: "night", label: "🌙 Night", emoji: "🌙" },
    { id: "none", label: "— None", emoji: "•" },
  ];
  const defaultHabits = [
    { name: "Spanish/French", cat: "study" },
    { name: "Stretch", cat: "exercise" },
    { name: "Guitar/Violin", cat: "study" },
    { name: "Calligraphy/Shorthand", cat: "study" },
    { name: "Japanese", cat: "study" },
    { name: "Technique", cat: "study" },
    { name: "Sewing", cat: "study" },
    { name: "Coding", cat: "study" },
    { name: "Night routine", cat: "night" },
  ];
  const blankWeek = () => [false,false,false,false,false,false,false];
  const habitCatById = (id) => HABIT_CATEGORIES.find(c => c.id === id) || HABIT_CATEGORIES[HABIT_CATEGORIES.length-1];
  const normalizeHabit = (h={}) => ({
    name: h.name || "New habit",
    cat: habitCatById(h.cat || "none").id,
    days: Array.from({length:7}, (_,i)=> !!(h.days && h.days[i]))
  });

  // storage detection
  const hasStorage = (()=>{ try { const k="__t"; localStorage.setItem(k,"1"); localStorage.removeItem(k); return true; } catch(e){ return false; } })();
  const S_KEY="planner_v3_data"; const M_KEY="planner_v3_mood"; const E_KEY="planner_v3_edit";
  const J_KEY="planner_v3_journal"; const NOTES_KEY="planner_v3_notes";
  const WORKOUT_KEY="planner_v3_workout";

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
  function importScheduleFrom(payload){
    if(!payload || typeof payload !== "object") return false;
    const source = (payload.schedule && typeof payload.schedule === "object") ? payload.schedule : payload;
    let changed = false;
    const next = deepCopy(sample);
    dayOrder.forEach(day=>{
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
  let mood = loadMood();
  let editMode = hasStorage ? (localStorage.getItem(E_KEY) === "1") : true;
  let moodEntries = loadJournal();
  let notesData = loadNotes();
  let habitsState = loadHabits();
  if(!Array.isArray(habitsState)){
    habitsState = defaultHabits.map(normalizeHabit);
  } else {
    habitsState = habitsState.map(normalizeHabit);
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
  storageNote.textContent = hasStorage ? "" : "Browser storage is blocked — changes last until you close this tab.";
  const toast = document.getElementById("toast");
  function showToast(msg, cls){ toast.textContent = msg; toast.className = "toast " + (cls||""); requestAnimationFrame(()=>{ toast.classList.add("show"); }); setTimeout(()=>{ toast.classList.remove("show"); }, 1200); }

  const chk = document.getElementById("chk-edit");
  chk.checked = !!editMode;
  chk.addEventListener("change",()=>{ editMode = chk.checked; if(hasStorage) localStorage.setItem(E_KEY, editMode ? "1":"0"); render(); });

  const btnSave = document.getElementById("btn-save");
  btnSave.addEventListener("click",()=>{ if(!hasStorage){ showToast("Storage blocked — not saved", "warn"); return; } saveData(data); saveMood(mood); localStorage.setItem(E_KEY, editMode ? "1":"0"); showToast("Saved to browser"); });
  const plannerImportInput = document.getElementById("planner-import-file");
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

  const panel = document.getElementById("panel-planner");
  render();

  const habitListEl = document.getElementById("habits-list");
  const habitProgressEl = document.getElementById("habits-progress");
  const habitAddBtn = document.getElementById("habit-add");
  const habitResetWeekBtn = document.getElementById("habit-reset-week");
  const habitSaveBtn = document.getElementById("habit-save");
  const habitExportBtn = document.getElementById("habit-export");
  const habitImportInput = document.getElementById("habit-import");
  function calcHabitProgress(){
    const total = habitsState.length * 7;
    const done = habitsState.reduce((acc,h)=>acc + h.days.filter(Boolean).length, 0);
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
      const cat = habitCatById(habit.cat);
      const row = el("div",{class:"habit-row"});
      const info = el("div",{class:"habit-info"});
      const chip = el("span",{class:"chip"},cat.emoji || "•");
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
      row.append(info);
      const daysWrap = el("div",{class:"habit-days"});
      dayOrder.forEach((dayLabel, dayIdx)=>{
        const btn = el("button",{type:"button",class:`habit-day ${habit.days[dayIdx]?"on":""}`,title:dayLabel}, dayLabel[0]);
        btn.addEventListener("click",()=>{
          habitsState[idx].days[dayIdx] = !habitsState[idx].days[dayIdx];
          renderHabits();
        });
        daysWrap.append(btn);
      });
      row.append(daysWrap);
      const actions = el("div",{style:"display:flex;gap:8px;flex-wrap:wrap;align-items:center;"});
      const removeBtn = el("button",{class:"btn",type:"button"},"🗑 Remove");
      removeBtn.addEventListener("click",()=>{
        habitsState.splice(idx,1);
        renderHabits();
      });
      actions.append(removeBtn);
      row.append(actions);
      habitListEl.append(row);
    });
  }
  function saveHabitsNow(message=true){
    saveHabits(habitsState);
    if(message) showToast("Habits saved!");
  }
  habitAddBtn?.addEventListener("click",()=>{
    habitsState.push(normalizeHabit({name:"New habit", cat:"none"}));
    renderHabits();
  });
  habitResetWeekBtn?.addEventListener("click",()=>{
    habitsState = habitsState.map(h=>({...h, days: blankWeek()}));
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
  (function initBreakChecks(){
    const boxes = document.querySelectorAll(".pomo-pill input[type='checkbox']");
    boxes.forEach(box=>{
      const pill = box.closest(".pomo-pill");
      if(!pill) return;
      pill.classList.toggle("done", box.checked);
      box.addEventListener("change",()=>{ pill.classList.toggle("done", box.checked); });
    });
  })();

  (function initPomodoro(){
    const durationLabel = document.getElementById("pomo-durations");
    const timeEl = document.getElementById("pomo-time");
    if(!durationLabel || !timeEl) return;

    let FOCUS_MIN = 52;
    const SHORT_BREAK_MIN = 17;
    const LONG_BREAK_MIN = 30;
    const TOTAL_CYCLES = 4;
    const tasks = [
      "30-minute ab workout — hollow holds, leg raises, bicycle crunches, planks",
      "100 Push Plan — break it into four rounds of 25 with strict form",
      "Front split stretches — lunge pulses, hamstring folds, quad openers",
      "Recovery walk — light stroll and deep breathing between rounds"
    ];
    const autoStartEnabled = true;
    let cycle = 1;
    let cyclesCompleted = 0;
    let mode = "focus";
    let secondsLeft = FOCUS_MIN * 60;
    let running = false;
    let timerId = null;
    let startedAt = null;
    let beepCtx = null;

    const circleEl = document.getElementById("pomo-circle");
    const modeLabel = document.getElementById("pomo-mode");
    const modeHint = document.getElementById("pomo-mode-hint");
    const cycleEl = document.getElementById("pomo-cycle");
    const completedEl = document.getElementById("pomo-complete");
    const startBtn = document.getElementById("pomo-start");
    const skipBtn = document.getElementById("pomo-skip");
    const resetBtn = document.getElementById("pomo-reset");
    const dots = [1,2,3,4].map(n=>document.getElementById("pomo-dot"+n));
    const taskText = document.getElementById("pomo-task");
    const shuffleBtn = document.getElementById("pomo-shuffle");
    const focusInput = document.getElementById("pomo-focus-input");
    const isTypingTarget = el => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

    function updateDurationLabel(){
      durationLabel.textContent = `${FOCUS_MIN}-min focus • ${SHORT_BREAK_MIN}-min short breaks • ${LONG_BREAK_MIN}-min final break`;
    }

    function playBeep(){
      try{
        if(!beepCtx){
          beepCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const osc = beepCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, beepCtx.currentTime);
        osc.connect(beepCtx.destination);
        osc.start();
        osc.stop(beepCtx.currentTime + 0.35);
      }catch(e){
        console.warn("Audio beep failed", e);
      }
    }

    function notifyStage(){
      playBeep();
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

    function pad(n){ return String(n).padStart(2,"0"); }
    function fmt(sec){ const m = Math.floor(sec/60); const s = sec%60; return `${pad(m)}:${pad(s)}`; }
    function totalFor(which){
      if(which==="focus") return FOCUS_MIN*60;
      if(which==="short") return SHORT_BREAK_MIN*60;
      if(which==="long") return LONG_BREAK_MIN*60;
      return 0;
    }

    function updateRender(){
      const total = totalFor(mode);
      const pct = total ? ((total - secondsLeft) / total) * 100 : 0;
      const limited = Math.min(100, Math.max(0, pct));
      if(circleEl){
        const degrees = (limited / 100) * 360;
        circleEl.style.setProperty("--deg", `${degrees}deg`);
      }
      timeEl.textContent = fmt(secondsLeft);
      document.title = `${timeEl.textContent} • ${modeLabel.textContent} — Pomodoro`;
    }

    function updateCycleUI(){
      cycleEl.textContent = cycle;
      completedEl.textContent = cyclesCompleted;
      dots.forEach((dot, idx)=>{ if(dot) dot.classList.toggle("on", idx < cycle); });
    }

    function setMode(newMode){
      mode = newMode;
      const label = mode === "focus" ? "Focus" : mode === "short" ? "Short Break" : "Long Break";
      modeLabel.textContent = label;
      modeHint.textContent = mode === "focus"
        ? `Focus for ${FOCUS_MIN} minutes.`
        : mode === "short"
          ? `Rest for ${SHORT_BREAK_MIN} minutes.`
          : `Relax for ${LONG_BREAK_MIN} minutes.`;
      secondsLeft = totalFor(mode);
      startedAt = null;
      updateRender();
      if(mode !== "focus"){
        suggestTask(true);
      }
      notifyStage();
    }

    function nextStage(){
      if(mode === "focus"){
        cyclesCompleted++;
        if(cycle < TOTAL_CYCLES){
          setMode("short");
        } else {
          setMode("long");
        }
      } else if(mode === "short"){
        cycle++;
        setMode("focus");
      } else {
        resetAll();
        return;
      }
      updateCycleUI();
      if(autoStartEnabled){
        start();
      }
    }

    function tick(){
      if(!running) return;
      if(!startedAt) startedAt = Date.now();
      const now = Date.now();
      const elapsed = Math.floor((now - startedAt) / 1000);
      const total = totalFor(mode);
      secondsLeft = Math.max(0, total - elapsed);
      updateRender();
      if(secondsLeft <= 0){
        running = false;
        startBtn.textContent = "Start";
        nextStage();
        startedAt = null;
      } else {
        timerId = requestAnimationFrame(tick);
      }
    }

    function start(){
      if(running) return;
      running = true;
      startedAt = Date.now() - (totalFor(mode) - secondsLeft) * 1000;
      startBtn.textContent = "Pause";
      timerId = requestAnimationFrame(tick);
    }

    function pause(){
      if(!running) return;
      running = false;
      startBtn.textContent = "Start";
      cancelAnimationFrame(timerId);
      const now = Date.now();
      const elapsed = Math.floor((now - startedAt) / 1000);
      secondsLeft = Math.max(0, totalFor(mode) - elapsed);
      startedAt = null;
      updateRender();
    }

    function resetAll(){
      pause();
      cycle = 1;
      cyclesCompleted = 0;
      updateCycleUI();
      setMode("focus");
    }

    function skip(){
      pause();
      nextStage();
    }

    function suggestTask(force){
      if(!taskText) return;
      if(!force && mode === "focus") return;
      const pick = tasks[Math.floor(Math.random() * tasks.length)];
      const [title, detail=""] = pick.split(" — ");
      taskText.innerHTML = `<strong>${title}</strong> — ${detail}`;
    }

    startBtn.addEventListener("click", ()=>{ running ? pause() : start(); });
    skipBtn.addEventListener("click", skip);
    resetBtn.addEventListener("click", resetAll);
    shuffleBtn.addEventListener("click", ()=>suggestTask(true));
    focusInput.addEventListener("input", e=>{
      const val = parseInt(e.target.value, 10);
      if(!isNaN(val) && val >= 1 && val <= 120){
        FOCUS_MIN = val;
        updateDurationLabel();
        if(mode === "focus"){
          secondsLeft = FOCUS_MIN * 60;
          startedAt = null;
          updateRender();
          modeHint.textContent = `Focus for ${FOCUS_MIN} minutes.`;
        }
      }
    });

    document.addEventListener("keydown", e=>{
      if(isTypingTarget(e.target)) return;
      if(e.code === "Space"){
        e.preventDefault();
        running ? pause() : start();
      }
      if(e.key && e.key.toLowerCase() === "r") resetAll();
      if(e.key && e.key.toLowerCase() === "n") skip();
      if(e.key && e.key.toLowerCase() === "s") suggestTask(true);
    });

    updateDurationLabel();
    updateCycleUI();
    setMode("focus");
    suggestTask(true);
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
    if(!rangeEl || !gridEl) return;

    const CAL_KEY = "planner-calendar-events";
    let week = startOfWeek(new Date());
    const pad = n => String(n).padStart(2,"0");
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    function startOfWeek(date){
      const d = new Date(date);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0,0,0,0);
      return d;
    }

    function loadEvents(){
      try{
        const raw = localStorage.getItem(CAL_KEY);
        return raw ? JSON.parse(raw) : [];
      }catch(e){
        return [];
      }
    }

    function saveEvents(evts){
      localStorage.setItem(CAL_KEY, JSON.stringify(evts));
    }

    function parseICS(text){
      function unfold(str){ return str.replace(/\r\n[ \t]/g,"").replace(/\n[ \t]/g,""); }
      function parseDate(val){
        const s = String(val).trim();
        const y = parseInt(s.slice(0,4),10);
        const m = parseInt(s.slice(4,6),10) - 1;
        const d = parseInt(s.slice(6,8),10);
        if(s.length <= 8){
          return { date: new Date(y,m,d,0,0,0), allDay: true };
        }
        const hh = parseInt(s.slice(9,11)||"0",10);
        const mm = parseInt(s.slice(11,13)||"0",10);
        const ss = parseInt(s.slice(13,15)||"0",10);
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
          }
        });
        if(dtstart){
          events.push({
            start: dtstart.toISOString(),
            end: (dtend || dtstart).toISOString(),
            allDay,
            title: summary || "(No title)",
            description: description || ""
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

    renderCalendarPanel = function(){
      const events = loadEvents();
      if(dateInput){
        dateInput.value = `${week.getFullYear()}-${pad(week.getMonth()+1)}-${pad(week.getDate())}`;
      }
      const end = new Date(week);
      end.setDate(week.getDate()+6);
      rangeEl.textContent = `${week.toLocaleDateString(undefined,{month:"short",day:"numeric"})} – ${end.toLocaleDateString(undefined,{month:"short",day:"numeric"})}`;
      const showAll = showAllChk ? showAllChk.checked : true;
      const compact = compactChk ? compactChk.checked : false;
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
      for(let i=0;i<7;i++){
        const col = document.createElement("div");
        col.className = "cal-col";
        for(let h=0; h<=24; h++){
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
    };

    prevBtn && prevBtn.addEventListener("click", ()=>{ week.setDate(week.getDate()-7); renderCalendarPanel(); });
    nextBtn && nextBtn.addEventListener("click", ()=>{ week.setDate(week.getDate()+7); renderCalendarPanel(); });
    dateInput && dateInput.addEventListener("change", e=>{
      const val = e.target.value;
      if(!val) return;
      const next = new Date(val);
      if(!isNaN(next)) week = startOfWeek(next);
      renderCalendarPanel();
    });
    showAllChk && showAllChk.addEventListener("change", renderCalendarPanel);
    compactChk && compactChk.addEventListener("change", renderCalendarPanel);
    clearBtn && clearBtn.addEventListener("click", ()=>{
      if(confirm("Clear all imported events?")){
        localStorage.removeItem(CAL_KEY);
        renderCalendarPanel();
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
            alert(`Imported ${imported.length} events.`);
            renderCalendarPanel();
          } else {
            alert("No events found in that file.");
          }
        }catch(err){
          alert("Could not read calendar file.");
        }
        importInput.value = "";
      };
      reader.readAsText(file);
    });

    renderCalendarPanel();
  })();

  function render(){
    panel.innerHTML = "";
    const grid = el("div",{class:"grid"});
    dayOrder.forEach(day=>{
      const card = el("div",{class:"card"});
      card.append(
        el("div",{class:"day"},day),
        buildDay(day)
      );
      grid.append(card);
    });
    panel.append(grid, buildJournalCard());
  }

  function buildDay(day){ const wrap = el("div",{class:"content"}); wrap.append(el("div",{class:"title"},"Activities")); const listWrap = el("div"); (data[day]||[]).forEach((line,idx)=>{ listWrap.append(row(day, idx, line)); }); const add = el("button",{ class:"addrow", disabled: !editMode, onclick:()=>{ (data[day]=data[day]||[]).push("• Add a new item…"); saveData(data); render(); } },"➕ Add item"); wrap.append(listWrap, add); wrap.append(el("div",{style:"margin-top:12px;font-weight:600;color:#6b21a8"},"Today's Mood")); const m = el("div",{class:"mood"}); ['😭','😢','☹️','😐','🙂','😊','😍'].forEach((emo,i)=>{ const s = el("span",{ class: (mood[day]===i)?"sel":"", onclick:()=>{ mood[day]=i; saveMood(mood); render(); } },emo); m.append(s); }); wrap.append(m); return wrap; }

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

  function row(day, idx, text){ const tag = tagFrom(text); const r = el("div",{class:"row","data-tag":tag}); if(editMode){ const ta = el("textarea",{value:text}); ta.addEventListener("input",e=>{ data[day][idx]=ta.value; saveData(data); r.setAttribute("data-tag",tagFrom(ta.value)); }); const rm = el("button",{class:"remove",title:"Remove",onclick:()=>{ data[day].splice(idx,1); saveData(data); render(); }},"✕"); r.append(ta,rm); } else { const read = el("div",{class:"read"},text); const rm = el("button",{class:"remove",title:"Remove",disabled:true},"✕"); r.append(read,rm); } return r; }

  function tagFrom(t){ if(t.includes("🟦")) return "blue"; if(t.includes("🟩")) return "green"; if(t.includes("🔴")) return "red"; if(t.includes("🟨")) return "amber"; if(t.includes("🟪") || t.includes("🌙")) return "violet"; return ""; }

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
        el("div",{class:"note-meta"}, `${new Date(note.created || Date.now()).toLocaleString()}${note.tag ? " • " + note.tag : ""}`),
        el("p",null,note.body || "")
      );
      feed.append(card);
    });
  }

  function el(tag, attrs, text){ const n = document.createElement(tag); if(attrs) for(const k in attrs){ if(k==="class") n.className = attrs[k]; else if(k==="value") n.value = attrs[k]; else if(k==="disabled") { if(attrs[k]) n.setAttribute("disabled",""); } else if(k==="onclick") n.addEventListener("click", attrs[k]); else n.setAttribute(k, attrs[k]); } if(text!=null) n.textContent = text; return n; }

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

  const map = { "tab-planner":"panel-planner", "tab-pomodoro":"panel-pomodoro", "tab-habits":"panel-habits", "tab-notes":"panel-notes", "tab-workout":"panel-workout", "tab-settings":"panel-settings", "tab-calendar":"panel-calendar" };
  Object.keys(map).forEach(id=>{ const btn = document.getElementById(id); btn.addEventListener("click",()=>{ Object.keys(map).forEach(k=>{ document.getElementById(k).setAttribute("aria-selected", k===id ? "true":"false"); const pid = map[k]; const pn = document.getElementById(pid); pn.classList.toggle("hidden", k!==id); }); if(id==="tab-calendar") renderCalendarPanel(); if(id==="tab-notes") renderNotesFeed(); if(id==="tab-habits") renderHabits(); }); });

  renderNotesFeed();
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
      if(!hasStorage){ showToast("Storage blocked — not saved","warn"); return; }
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

const workoutController = initWorkoutTab();
  initChatbot();
  const persistBtn = document.getElementById("btn-persist");
  const persistStatus = document.getElementById("persist-status");
  const setPersistStatus = (msg)=>{ if(persistStatus) persistStatus.textContent = msg; };
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
  updatePersistStatus();

  function initChatbot(){
    const toggle = document.getElementById("chatbot-toggle");
    const panel = document.getElementById("chatbot-panel");
    const form = document.getElementById("chatbot-form");
    const input = document.getElementById("chatbot-input");
    const log = document.getElementById("chatbot-messages");
    if(!toggle || !panel || !form || !input || !log) return;
    const replies = [
      { keywords:["plan","schedule","routine"], response:"Build your week around two anchor days and keep heavy strength away from the recovery day so energy stays high." },
      { keywords:["motivation","burnout","tired","lazy"], response:"Aim for five focused minutes. Once you move, momentum wakes up the motivation you were waiting for." },
      { keywords:["workout","training","exercise","lifting"], response:"Alternate push, pull, and skill practice. Leave a rep in reserve so tomorrow still feels inviting." },
      { keywords:["habit","streak","consistency"], response:"Stack the habit on top of an existing ritual and track it visibly. Checkmarks wire in the win." },
      { keywords:["focus","study","pomodoro","distraction"], response:"Try a 45/15 focus block, jot distractions instantly, and review them after each break so your brain trusts you." }
    ];
    appendMessage("bot","Hey! I'm your AI training buddy. Ask about workouts, focus, or staying consistent.");
    toggle.addEventListener("click",()=>{
      panel.classList.toggle("hidden");
      if(!panel.classList.contains("hidden")) input.focus();
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
      const rule = replies.find(entry => entry.keywords.some(key=>lower.includes(key)));
      if(rule) return rule.response;
      if(["hi","hello","hey"].some(greet=>lower.includes(greet))) return "Hey there! What's one win you can chase today?";
      return `Noted on "${message}". Breathe, hydrate, and keep logging the reps so future-you can see the arc.`;
    }
  }

  document.getElementById("btn-reset").addEventListener("click",()=>{
    if(hasStorage){
      localStorage.removeItem(S_KEY);
      localStorage.removeItem(M_KEY);
      localStorage.removeItem(E_KEY);
      localStorage.removeItem(J_KEY);
      localStorage.removeItem(NOTES_KEY);
      localStorage.removeItem("habits-data");
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
    render();
    renderNotesFeed();
    renderHabits();
    showToast("Reset complete");
  });
})();
