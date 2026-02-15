(function initChoreHabits(){
  const STORAGE_KEY = "planner_chore_habits_v1";
  const LEGACY_KEY = "planner_chores_text";

  const weeklyEdit = document.getElementById("chore-weekly-edit");
  const monthlyEdit = document.getElementById("chore-monthly-edit");
  const weeklyLog = document.getElementById("chore-weekly-log");
  const monthlyLog = document.getElementById("chore-monthly-log");
  const weeklyStatus = document.getElementById("chore-weekly-status");
  const monthlyStatus = document.getElementById("chore-monthly-status");
  const weeklySummary = document.getElementById("chore-weekly-summary");
  const monthlySummary = document.getElementById("chore-monthly-summary");
  const weeklyReset = document.getElementById("chore-weekly-reset");
  const monthlyReset = document.getElementById("chore-monthly-reset");
  if(!weeklyEdit || !monthlyEdit || !weeklyLog || !monthlyLog) return;

  const parseLines = (val="")=> val.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const weekKey = ()=>{
    const d = new Date();
    d.setHours(0,0,0,0);
    const start = new Date(d);
    start.setDate(start.getDate() - start.getDay()); // Sunday start
    return start.toISOString().slice(0,10);
  };
  const monthKey = ()=>{
    const d = new Date();
    d.setDate(1);
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,7); // YYYY-MM
  };

  const defaultState = ()=>({
    weekly:["Laundry","Bathroom reset","Grocery run"],
    monthly:["Fridge clear + wipe","Deep clean desk"],
    weeklyDone:{},
    monthlyDone:{}
  });

  const migrateLegacy = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem(LEGACY_KEY)||"null");
      if(raw && typeof raw === "object"){
        return {
          weekly: parseLines(raw.weekly||""),
          monthly: [...parseLines(raw.biweekly||""), ...parseLines(raw.once||"")],
          weeklyDone:{},
          monthlyDone:{}
        };
      }
    }catch(e){}
    return null;
  };

  const loadState = ()=>{
    const legacy = migrateLegacy();
    try{
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
      if(raw && typeof raw === "object"){
        return {
          weekly: Array.isArray(raw.weekly)? raw.weekly : (legacy?.weekly || defaultState().weekly),
          monthly: Array.isArray(raw.monthly)? raw.monthly : (legacy?.monthly || defaultState().monthly),
          weeklyDone: raw.weeklyDone && typeof raw.weeklyDone==="object" ? raw.weeklyDone : {},
          monthlyDone: raw.monthlyDone && typeof raw.monthlyDone==="object" ? raw.monthlyDone : {}
        };
      }
    }catch(e){}
    return legacy || defaultState();
  };

  const saveState = (state)=>{
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state||defaultState())); }catch(e){}
  };

  const state = loadState();

  const scrubDoneMaps = ()=>{
    const wKey = weekKey();
    const mKey = monthKey();
    state.weeklyDone[wKey] = state.weeklyDone[wKey] || {};
    state.monthlyDone[mKey] = state.monthlyDone[mKey] || {};
  };
  scrubDoneMaps();

  const setNote = (el, text)=>{ if(el) el.textContent = text||""; };

  const renderLists = ()=>{
    weeklyEdit.value = state.weekly.join("\n");
    monthlyEdit.value = state.monthly.join("\n");
  };

  const renderLog = ()=>{
    const wKey = weekKey();
    const mKey = monthKey();
    const weeklyDone = state.weeklyDone[wKey] || {};
    const monthlyDone = state.monthlyDone[mKey] || {};

    weeklyLog.innerHTML = "";
    monthlyLog.innerHTML = "";

    if(!state.weekly.length){
      weeklyLog.innerHTML = `<p class="note">Add weekly chores to track them here.</p>`;
    }
    if(!state.monthly.length){
      monthlyLog.innerHTML = `<p class="note">Add monthly chores to track them here.</p>`;
    }

    const makeRow = (name, done, type)=>{
      const row = document.createElement("div");
      row.className = `chore-pill${done ? " done" : ""}`;
      const label = document.createElement("div");
      label.innerHTML = `<strong>${name}</strong><small>${type==="week"?"Once this week":"Once this month"}</small>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = done ? "Undo" : "Mark done";
      btn.addEventListener("click", ()=>{
        const key = type==="week" ? wKey : mKey;
        const map = type==="week" ? state.weeklyDone : state.monthlyDone;
        map[key] = map[key] || {};
        map[key][name] = !map[key][name];
        saveState(state);
        renderLog();
        summarize();
      });
      row.append(label, btn);
      return row;
    };

    state.weekly.forEach(name=>{
      weeklyLog.appendChild(makeRow(name, !!weeklyDone[name], "week"));
    });
    state.monthly.forEach(name=>{
      monthlyLog.appendChild(makeRow(name, !!monthlyDone[name], "month"));
    });
  };

  const summarize = ()=>{
    const wKey = weekKey();
    const mKey = monthKey();
    const weeklyDone = state.weeklyDone[wKey] || {};
    const monthlyDone = state.monthlyDone[mKey] || {};
    const weeklyCount = Object.values(weeklyDone).filter(Boolean).length;
    const monthlyCount = Object.values(monthlyDone).filter(Boolean).length;
    setNote(weeklySummary, state.weekly.length ? `${weeklyCount}/${state.weekly.length} logged this week` : "");
    setNote(monthlySummary, state.monthly.length ? `${monthlyCount}/${state.monthly.length} logged this month` : "");
  };

  const persistLists = ()=>{
    state.weekly = parseLines(weeklyEdit.value);
    state.monthly = parseLines(monthlyEdit.value);
    // clean done maps to drop removed items
    const wKey = weekKey();
    const mKey = monthKey();
    state.weeklyDone[wKey] = (state.weeklyDone[wKey]||{});
    state.monthlyDone[mKey] = (state.monthlyDone[mKey]||{});
    Object.keys(state.weeklyDone[wKey]).forEach(k=>{ if(!state.weekly.includes(k)) delete state.weeklyDone[wKey][k]; });
    Object.keys(state.monthlyDone[mKey]).forEach(k=>{ if(!state.monthly.includes(k)) delete state.monthlyDone[mKey][k]; });
    saveState(state);
    renderLog();
    summarize();
    setNote(weeklyStatus, "Saved");
    setNote(monthlyStatus, "Saved");
    setTimeout(()=>{ setNote(weeklyStatus,""); setNote(monthlyStatus,""); }, 1200);
  };

  weeklyEdit.addEventListener("blur", persistLists);
  monthlyEdit.addEventListener("blur", persistLists);

  weeklyReset?.addEventListener("click", ()=>{
    const wKey = weekKey();
    state.weeklyDone[wKey] = {};
    saveState(state);
    renderLog();
    summarize();
    setNote(weeklyStatus, "Week reset");
    setTimeout(()=> setNote(weeklyStatus,""), 1200);
  });

  monthlyReset?.addEventListener("click", ()=>{
    const mKey = monthKey();
    state.monthlyDone[mKey] = {};
    saveState(state);
    renderLog();
    summarize();
    setNote(monthlyStatus, "Month reset");
    setTimeout(()=> setNote(monthlyStatus,""), 1200);
  });

  renderLists();
  renderLog();
  summarize();
})();
