// Pomodoro Daily/Weekly Challenges (gamified quests)
(function(){
  const STORAGE_KEY = "planner_pomo_challenges";
  const hasStorage = (()=>{ try{ localStorage.setItem("__pomo_chal","1"); localStorage.removeItem("__pomo_chal"); return true; }catch(e){ return false; }})();
  const todayKey = ()=> new Date().toISOString().slice(0,10);
  const weekKey = ()=>{
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - (day-1));
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  };

  const challenges = {
    daily: [
      { id:"d-4-pomos", title:"Daily Focus 4", desc:"Complete 4 Pomodoro sessions today.", reward:20 },
      { id:"d-hard-2", title:"Hard Mode", desc:"Do 2 Pomodoros on your hardest subject.", reward:20 },
      { id:"d-break-move", title:"Move + Focus", desc:"Finish 3 Pomodoros and log 1 active break.", reward:15 },
      { id:"d-write-1", title:"Write & Reflect", desc:"Log 1 Pomodoro with a note about what you learned.", reward:10 }
    ],
    weekly: [
      { id:"w-20-pomos", title:"20 Cycle Sprint", desc:"Complete 20 Pomodoro sessions this week.", reward:50 },
      { id:"w-breaks-5", title:"Active Week", desc:"Log 5 active breaks this week.", reward:35 },
      { id:"w-streak-5", title:"Keep the Chain", desc:"Maintain a 5-day study streak this week.", reward:40 }
    ]
  };

  function loadState(){
    if(!hasStorage) return null;
    try{
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return raw && typeof raw==="object" ? raw : null;
    }catch(e){ return null; }
  }
  function saveState(state){
    if(!hasStorage) return;
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state||{})); }catch(e){}
  }

  function pickChallenge(list){
    return list[Math.floor(Math.random()*list.length)];
  }

  function ensureState(){
    const stored = loadState() || {};
    const today = todayKey();
    const thisWeek = weekKey();
    if(stored.date !== today){
      stored.date = today;
      stored.daily = { ...pickChallenge(challenges.daily), status:"pending", claimed:false };
    }
    if(stored.week !== thisWeek){
      stored.week = thisWeek;
      stored.weekly = { ...pickChallenge(challenges.weekly), status:"pending", claimed:false };
    }
    saveState(stored);
    return stored;
  }

  function awardXP(amount){
    try{
      if(typeof window.addXP === "function") window.addXP(amount);
    }catch(e){}
  }

  function renderCard(){
    const state = ensureState();
    const aside = document.querySelector("#panel-pomodoro .pomo-side") || document.getElementById("panel-pomodoro") || document.body;
    if(!aside) return;
    let card = document.getElementById("pomo-challenges");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "pomo-challenges";
    card.className = "pomo-side-card";

    const makeBlock = (data, label)=>{
      const wrap = document.createElement("div");
      wrap.style.border = "1px solid var(--border,#2d2d2d)";
      wrap.style.borderRadius = "10px";
      wrap.style.padding = "8px";
      wrap.style.marginTop = "6px";
      const head = document.createElement("div");
      head.style.display = "flex";
      head.style.justifyContent = "space-between";
      head.style.alignItems = "center";
      head.style.gap = "8px";
      head.innerHTML = `<strong>${label}</strong><span class="note">${data.status==="done" ? "Ready to claim" : data.status}</span>`;
      const title = document.createElement("div");
      title.style.fontWeight = "600";
      title.textContent = data.title;
      const desc = document.createElement("div");
      desc.className = "note";
      desc.textContent = data.desc;
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      const doneBtn = document.createElement("button");
      doneBtn.className = "pomo-btn ghost";
      doneBtn.type = "button";
      doneBtn.textContent = data.status==="done" ? "Completed" : "Mark done";
      doneBtn.disabled = data.status==="done";
      doneBtn.addEventListener("click",()=>{
        data.status = "done";
        saveState(state);
        renderCard();
      });
      const claimBtn = document.createElement("button");
      claimBtn.className = "pomo-btn primary";
      claimBtn.type = "button";
      claimBtn.textContent = data.claimed ? `Claimed (+${data.reward} XP)` : `Claim +${data.reward} XP`;
      claimBtn.disabled = data.claimed || data.status!=="done";
      claimBtn.addEventListener("click",()=>{
        if(data.claimed || data.status!=="done") return;
        data.claimed = true;
        awardXP(data.reward);
        saveState(state);
        renderCard();
      });
      actions.append(doneBtn, claimBtn);
      wrap.append(head, title, desc, actions);
      return wrap;
    };

    const title = document.createElement("div");
    title.style.display = "flex";
    title.style.justifyContent = "space-between";
    title.style.alignItems = "center";
    title.style.gap = "8px";
    title.innerHTML = `<h3 style="margin:0;">Daily & Weekly Quests</h3><button class="pomo-btn ghost" id="pomo-quest-refresh" type="button">New quests</button>`;

    card.append(title, makeBlock(state.daily, "Daily"), makeBlock(state.weekly, "Weekly"));
    aside.append(card);

    document.getElementById("pomo-quest-refresh")?.addEventListener("click", ()=>{
      state.daily = { ...pickChallenge(challenges.daily), status:"pending", claimed:false, date: todayKey() };
      state.weekly = { ...pickChallenge(challenges.weekly), status:"pending", claimed:false, week: weekKey() };
      state.date = todayKey();
      state.week = weekKey();
      saveState(state);
      renderCard();
    });
  }

  document.addEventListener("DOMContentLoaded", renderCard);
})();

// Pomodoro Analytics Dashboard (hours, cycles, breaks, subjects)
(function(){
  const LOG_KEY = "planner_pomo_activity_log";
  const BREAK_KEY = "planner_pomo_breaks";
  const DAY = 86400000;
  const startOfWeek = (date)=>{ const d=new Date(date); const day=d.getDay()||7; d.setDate(d.getDate()-(day-1)); d.setHours(0,0,0,0); return d; };
  const startOfMonth = (date)=>{ const d=new Date(date); d.setDate(1); d.setHours(0,0,0,0); return d; };

  function loadLog(){
    try{
      const raw = JSON.parse(localStorage.getItem(LOG_KEY));
      return Array.isArray(raw) ? raw.filter(e=>e && e.ts) : [];
    }catch(e){ return []; }
  }
  function loadBreaks(){
    try{
      const raw = JSON.parse(localStorage.getItem(BREAK_KEY));
      return raw && typeof raw==="object" ? raw : { count:0, week:"", lastSuggestion:"" };
    }catch(e){ return { count:0, week:"" }; }
  }

  function aggregate(){
    const entries = loadLog();
    const breaks = loadBreaks();
    const now = new Date();
    const thisWeek = startOfWeek(now);
    const lastWeek = new Date(thisWeek); lastWeek.setDate(thisWeek.getDate()-7);
    const thisMonth = startOfMonth(now);
    const byDay = {};
    const subjects = {};
    entries.forEach(e=>{
      const ts = new Date(e.ts);
      if(isNaN(ts)) return;
      const dayKey = ts.toISOString().slice(0,10);
      const mins = e.focusMins ? Number(e.focusMins) : 50;
      const subj = e.subject || "General";
      if(!byDay[dayKey]) byDay[dayKey] = { cycles:0, mins:0 };
      byDay[dayKey].cycles += 1;
      byDay[dayKey].mins += mins;
      subjects[subj] = (subjects[subj]||0) + mins;
    });
    const hours = (mins)=> Math.round((mins/60)*10)/10;
    const sumRange = (from,to)=> Object.entries(byDay).reduce((acc,[k,v])=>{
      const d = new Date(k+"T00:00:00");
      if(d>=from && d<to){ acc.cycles += v.cycles; acc.mins += v.mins; }
      return acc;
    }, { cycles:0, mins:0 });
    const thisWeekAgg = sumRange(thisWeek, new Date(thisWeek.getTime()+7*DAY));
    const lastWeekAgg = sumRange(lastWeek, thisWeek);
    const thisMonthAgg = sumRange(thisMonth, new Date(thisMonth.getFullYear(), thisMonth.getMonth()+1,1));
    return { byDay, subjects, hours, thisWeekAgg, lastWeekAgg, thisMonthAgg, breaks };
  }

  function renderBars(container, data){
    container.innerHTML = "";
    const maxVal = Math.max(1, ...data.map(d=>d.value));
    data.forEach(item=>{
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "80px 1fr 50px";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      const label = document.createElement("div"); label.textContent = item.label;
      const barWrap = document.createElement("div"); barWrap.style.height="8px"; barWrap.style.borderRadius="999px"; barWrap.style.background="rgba(255,255,255,0.06)";
      const bar = document.createElement("span"); bar.style.display="block"; bar.style.height="100%"; bar.style.borderRadius="999px"; bar.style.background="#10b981"; bar.style.width = `${Math.round((item.value/maxVal)*100)}%`;
      barWrap.append(bar);
      const val = document.createElement("div"); val.textContent = item.suffix ? `${item.value}${item.suffix}` : item.value;
      row.append(label, barWrap, val);
      container.append(row);
    });
  }

  function renderChart(){
    const aside = document.querySelector("#panel-pomodoro .pomo-side") || document.getElementById("panel-pomodoro") || document.body;
    if(!aside) return;
    let card = document.getElementById("pomo-analytics");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "pomo-analytics";
    card.className = "pomo-side-card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <h3 style="margin:0;">Study Analytics</h3>
        <button class="pomo-btn ghost" id="pomo-analytics-refresh" type="button">Refresh</button>
      </div>
      <div class="note" style="margin:6px 0;">Hours, cycles, breaks, and subjects at a glance.</div>
      <div id="pomo-analytics-summary"></div>
      <div style="margin-top:10px;">
        <strong>Last 7 days (cycles)</strong>
        <div id="pomo-analytics-cycles"></div>
      </div>
      <div style="margin-top:10px;">
        <strong>Last 7 days (hours)</strong>
        <div id="pomo-analytics-hours"></div>
      </div>
      <div style="margin-top:10px;">
        <strong>Top subjects (hours)</strong>
        <div id="pomo-analytics-subjects"></div>
      </div>
    `;
    aside.append(card);

    function update(){
      const { byDay, subjects, hours, thisWeekAgg, lastWeekAgg, thisMonthAgg, breaks } = aggregate();
      const summary = document.getElementById("pomo-analytics-summary");
      if(summary){
        const delta = thisWeekAgg.mins - lastWeekAgg.mins;
        const trend = delta>=0 ? `+${hours(delta)}h vs last week` : `${hours(delta)}h vs last week`;
        summary.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
            <div class="pomo-badge"><div class="info"><div class="name">This week</div><div class="meta">${hours(thisWeekAgg.mins)}h • ${thisWeekAgg.cycles} cycles</div></div></div>
            <div class="pomo-badge"><div class="info"><div class="name">Last week</div><div class="meta">${hours(lastWeekAgg.mins)}h • ${lastWeekAgg.cycles} cycles</div></div></div>
            <div class="pomo-badge"><div class="info"><div class="name">This month</div><div class="meta">${hours(thisMonthAgg.mins)}h</div></div></div>
            <div class="pomo-badge"><div class="info"><div class="name">Breaks logged</div><div class="meta">${breaks.count||0} this week</div></div></div>
          </div>
          <div class="note" style="margin-top:6px;">${trend}</div>
        `;
      }
      const days = [];
      for(let i=6;i>=0;i--){
        const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
        const key = d.toISOString().slice(0,10);
        const val = byDay[key] || { cycles:0, mins:0 };
        days.push({ label:d.toLocaleDateString(undefined,{weekday:"short"}), cycles:val.cycles, hours:hours(val.mins) });
      }
      const cyclesHost = document.getElementById("pomo-analytics-cycles");
      const hoursHost = document.getElementById("pomo-analytics-hours");
      const subjectsHost = document.getElementById("pomo-analytics-subjects");
      if(cyclesHost) renderBars(cyclesHost, days.map(d=>({ label:d.label, value:d.cycles })));
      if(hoursHost) renderBars(hoursHost, days.map(d=>({ label:d.label, value:d.hours, suffix:"h" })));
      if(subjectsHost){
        const top = Object.entries(subjects).sort((a,b)=> b[1]-a[1]).slice(0,6).map(([label,mins])=>({ label, value:hours(mins), suffix:"h" }));
        subjectsHost.innerHTML = top.length ? "" : "No subject data yet.";
        if(top.length) renderBars(subjectsHost, top);
      }
    }
    update();
    document.getElementById("pomo-analytics-refresh")?.addEventListener("click", update);
  }

  document.addEventListener("DOMContentLoaded", renderChart);
})();

// Pomodoro Goals & Planning (daily/weekly targets + simple schedule)
(function(){
  const LOG_KEY = "planner_pomo_activity_log";
  const GOAL_KEY = "planner_pomo_goals";
  const PLAN_KEY = "planner_pomo_focus_plan";
  const DAY = 86400000;
  const startOfDay = (d)=>{ const n=new Date(d); n.setHours(0,0,0,0); return n; };

  const defaultGoals = ()=>({ daily:8, weekly:40, updated: Date.now() });
  const loadGoals = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem(GOAL_KEY));
      return raw && typeof raw==="object" ? { ...defaultGoals(), ...raw } : defaultGoals();
    }catch(e){ return defaultGoals(); }
  };
  const saveGoals = (g)=>{
    try{ localStorage.setItem(GOAL_KEY, JSON.stringify(g||defaultGoals())); }catch(e){}
  };
  const loadPlan = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem(PLAN_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  };
  const savePlan = (list)=>{
    try{ localStorage.setItem(PLAN_KEY, JSON.stringify(list||[])); }catch(e){}
  };
  const loadLog = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem(LOG_KEY));
      return Array.isArray(raw) ? raw.filter(e=>e && e.ts) : [];
    }catch(e){ return []; }
  };

  function aggregateCounts(){
    const entries = loadLog();
    const today = startOfDay(new Date());
    const weekStart = (()=>{ const d=startOfDay(new Date()); const w=d.getDay()||7; d.setDate(d.getDate()-(w-1)); return d; })();
    let daily = 0, weekly = 0;
    entries.forEach(e=>{
      const ts = new Date(e.ts);
      if(isNaN(ts)) return;
      const day = startOfDay(ts);
      if(day.getTime() === today.getTime()) daily += 1;
      if(day >= weekStart) weekly += 1;
    });
    return { daily, weekly };
  }

  function renderGoals(){
    const host = document.querySelector("#panel-pomodoro .pomo-side") || document.getElementById("panel-pomodoro") || document.body;
    if(!host) return;
    let card = document.getElementById("pomo-goals-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "pomo-goals-card";
    card.className = "pomo-side-card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <h3 style="margin:0;">Goals & Planning</h3>
        <button class="pomo-btn ghost" id="pomo-goal-refresh" type="button">Refresh</button>
      </div>
      <div class="pomo-plan-form" style="margin:8px 0;">
        <input type="number" id="pomo-goal-daily" min="1" max="40" placeholder="Daily goal (cycles)" style="width:150px;">
        <input type="number" id="pomo-goal-weekly" min="1" max="200" placeholder="Weekly goal (cycles)" style="width:170px;">
        <button class="pomo-btn primary" id="pomo-goal-save" type="button">Save goals</button>
      </div>
      <div id="pomo-goal-progress"></div>
      <div style="margin-top:10px;">
        <strong>Plan sessions</strong>
        <div class="note" style="font-size:12px;">Quick notes like "3-5pm: 4 Pomos Chemistry".</div>
        <div id="pomo-plan-list" class="pomo-plan-checklist" style="margin-top:6px;"></div>
        <div class="pomo-plan-actions" style="margin-top:6px;">
          <input type="text" id="pomo-plan-entry" placeholder="e.g., 3-5pm: 4 Pomos for Chem" style="flex:1;min-width:220px;padding:8px 10px;border-radius:10px;border:1px solid var(--border,#2d2d2d);background:#0f172a;color:inherit;">
          <button class="pomo-btn ghost" id="pomo-plan-add" type="button">Add</button>
        </div>
      </div>
      <div class="note" id="pomo-goal-reminder" style="margin-top:6px;"></div>
    `;
    host.append(card);

    const goals = loadGoals();
    const plan = loadPlan();
    const dailyInput = document.getElementById("pomo-goal-daily");
    const weeklyInput = document.getElementById("pomo-goal-weekly");
    const saveBtn = document.getElementById("pomo-goal-save");
    const refreshBtn = document.getElementById("pomo-goal-refresh");
    const progress = document.getElementById("pomo-goal-progress");
    const reminder = document.getElementById("pomo-goal-reminder");
    const planList = document.getElementById("pomo-plan-list");
    const planInput = document.getElementById("pomo-plan-entry");
    const planAdd = document.getElementById("pomo-plan-add");

    dailyInput.value = goals.daily;
    weeklyInput.value = goals.weekly;

    function renderPlanList(){
      planList.innerHTML = "";
      if(!plan.length){
        planList.innerHTML = "<li class='note'>No sessions planned.</li>";
        return;
      }
      plan.forEach((item, idx)=>{
        const li = document.createElement("li");
        li.textContent = item;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pomo-btn ghost";
        btn.style.marginLeft = "8px";
        btn.textContent = "Remove";
        btn.addEventListener("click", ()=>{
          plan.splice(idx,1);
          savePlan(plan);
          renderPlanList();
        });
        li.append(btn);
        planList.append(li);
      });
    }

    function renderProgress(){
      const { daily, weekly } = aggregateCounts();
      const dailyPct = Math.min(100, Math.round((daily / goals.daily)*100));
      const weeklyPct = Math.min(100, Math.round((weekly / goals.weekly)*100));
      progress.innerHTML = `
        <div style="margin-top:4px;">
          <div><strong>Today</strong> ${daily}/${goals.daily} (${dailyPct}%)</div>
          <div class="pomo-subject-progress"><span style="width:${dailyPct}%;background:${dailyPct>=100?"#10b981":"#3b82f6"};"></span></div>
        </div>
        <div style="margin-top:6px;">
          <div><strong>This week</strong> ${weekly}/${goals.weekly} (${weeklyPct}%)</div>
          <div class="pomo-subject-progress"><span style="width:${weeklyPct}%;background:${weeklyPct>=100?"#10b981":"#3b82f6"};"></span></div>
        </div>
      `;
      const dailyLeft = Math.max(0, goals.daily - daily);
      if(dailyLeft > 0){
        reminder.textContent = `Reminder: ${dailyLeft} Pomodoros left to hit today's goal.`;
      } else {
        reminder.textContent = "Daily goal reached! 🎉";
      }
    }

    renderPlanList();
    renderProgress();

    saveBtn?.addEventListener("click", ()=>{
      goals.daily = Math.max(1, Math.min(40, Number(dailyInput.value||8)));
      goals.weekly = Math.max(1, Math.min(200, Number(weeklyInput.value||40)));
      goals.updated = Date.now();
      saveGoals(goals);
      renderProgress();
    });
    refreshBtn?.addEventListener("click", renderProgress);
    planAdd?.addEventListener("click", ()=>{
      const val = (planInput?.value||"").trim();
      if(!val) return;
      plan.unshift(val);
      savePlan(plan);
      planInput.value = "";
      renderPlanList();
    });
  }

  document.addEventListener("DOMContentLoaded", renderGoals);
})();

// Session Reflection & Mood Tracking (post-Pomodoro prompt + log)
(function(){
  const REFLECT_KEY = "planner_pomo_reflections";
  const MOOD_KEY = "planner_pomo_mood";

  const hasStorage = (()=>{ try{ localStorage.setItem("__pomo_reflect","1"); localStorage.removeItem("__pomo_reflect"); return true; }catch(e){ return false; }})();
  const loadReflections = ()=>{
    if(!hasStorage) return [];
    try{ const raw = JSON.parse(localStorage.getItem(REFLECT_KEY)); return Array.isArray(raw)?raw:[]; }catch(e){ return []; }
  };
  const saveReflections = (list)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(REFLECT_KEY, JSON.stringify(list||[])); }catch(e){}
  };
  const loadMood = ()=>{
    if(!hasStorage) return {};
    try{ const raw = JSON.parse(localStorage.getItem(MOOD_KEY)); return raw && typeof raw==="object" ? raw : {}; }catch(e){ return {}; }
  };
  const saveMood = (m)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(MOOD_KEY, JSON.stringify(m||{})); }catch(e){}
  };

  function renderUI(){
    const host = document.querySelector("#panel-pomodoro .pomo-side") || document.getElementById("panel-pomodoro") || document.body;
    if(!host) return;
    let card = document.getElementById("pomo-reflect-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "pomo-reflect-card";
    card.className = "pomo-side-card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <h3 style="margin:0;">Session Reflection</h3>
        <button class="pomo-btn ghost" id="pomo-reflect-open" type="button">Log</button>
      </div>
      <div class="note" style="font-size:12px;">Capture how each session felt to spot patterns.</div>
      <div id="pomo-reflect-list" class="pomo-plan-checklist" style="margin-top:6px;max-height:140px;overflow:auto;"></div>
    `;
    host.append(card);

    const list = document.getElementById("pomo-reflect-list");
    const reflections = loadReflections();
    if(list){
      list.innerHTML = "";
      reflections.slice(0,5).forEach(r=>{
        const li = document.createElement("li");
        li.textContent = `${new Date(r.ts).toLocaleString()} - ${"★".repeat(r.rating||0)} ${r.mood||""} ${r.note||""}`;
        list.append(li);
      });
      if(!reflections.length){
        const li = document.createElement("li");
        li.className = "note";
        li.textContent = "No reflections yet.";
        list.append(li);
      }
    }

    document.getElementById("pomo-reflect-open")?.addEventListener("click", openModal);
  }

  function openModal(){
    if(document.getElementById("pomo-reflect-modal")) return;
    const overlay = document.createElement("div");
    overlay.id = "pomo-reflect-modal";
    Object.assign(overlay.style, {
      position:"fixed", inset:"0", background:"rgba(0,0,0,0.45)", zIndex:"9999",
      display:"flex", alignItems:"center", justifyContent:"center"
    });
    const card = document.createElement("div");
    Object.assign(card.style, {
      background:"#0f172a", color:"#e5e7eb", padding:"14px", borderRadius:"12px",
      maxWidth:"380px", width:"92%", boxShadow:"0 10px 30px rgba(0,0,0,0.35)"
    });
    card.innerHTML = `
      <h3 style="margin:0 0 6px 0;">How was this session?</h3>
      <div style="margin:6px 0;">Mood:
        <select id="pomo-reflect-mood">
          <option value="focused">Focused</option>
          <option value="productive">Productive</option>
          <option value="neutral" selected>Neutral</option>
          <option value="distracted">Distracted</option>
          <option value="tired">Tired</option>
        </select>
      </div>
      <div style="margin:6px 0;">Productivity:
        <span id="pomo-reflect-stars" style="cursor:pointer;">☆☆☆☆☆</span>
      </div>
      <textarea id="pomo-reflect-note" rows="3" placeholder="One-line note: wins or challenges" style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#111827;color:#e5e7eb;"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
        <button class="pomo-btn ghost" id="pomo-reflect-cancel" type="button">Cancel</button>
        <button class="pomo-btn primary" id="pomo-reflect-save" type="button">Save</button>
      </div>
    `;
    overlay.append(card);
    document.body.append(overlay);

    const moodSel = card.querySelector("#pomo-reflect-mood");
    const starWrap = card.querySelector("#pomo-reflect-stars");
    const noteInput = card.querySelector("#pomo-reflect-note");
    const moodState = loadMood();
    if(moodState?.last) moodSel.value = moodState.last;
    let rating = 0;
    const renderStars = ()=>{
      starWrap.textContent = "★★★★★".split("").map((s,i)=> i<rating ? "★" : "☆").join("");
    };
    starWrap.addEventListener("click",(e)=>{
      const rect = starWrap.getBoundingClientRect();
      const pos = e.clientX - rect.left;
      const frac = pos / rect.width;
      rating = Math.max(1, Math.min(5, Math.ceil(frac*5)));
      renderStars();
    });
    renderStars();

    card.querySelector("#pomo-reflect-cancel")?.addEventListener("click", ()=> overlay.remove());
    card.querySelector("#pomo-reflect-save")?.addEventListener("click", ()=>{
      const reflections = loadReflections();
      const entry = {
        ts: new Date().toISOString(),
        mood: moodSel.value,
        rating,
        note: (noteInput.value||"").trim()
      };
      reflections.unshift(entry);
      saveReflections(reflections.slice(0,50));
      saveMood({ last: moodSel.value });
      overlay.remove();
      renderUI();
    });
  }

  document.addEventListener("DOMContentLoaded", renderUI);
})();

// Pomodoro Themes & Avatar Unlocks (cosmetic gamification)
(function(){
  const THEME_KEY = "planner_pomo_theme";
  const AVATAR_KEY = "planner_pomo_avatar";
  const XP_KEY = "planner_v3_rpg"; // existing XP storage from main app (if available)
  const themes = [
    { id:"default", name:"Default", desc:"Calm gradient", minLevel:1, bg:"linear-gradient(135deg,#1e293b,#0f172a)", accent:"#38bdf8" },
    { id:"space", name:"Space Mission", desc:"Starfield vibes", minLevel:5, bg:"radial-gradient(circle at 20% 20%,#1e3a8a,#0b132b 60%)", accent:"#f97316" },
    { id:"forest", name:"Forest Focus", desc:"Green canopy", minLevel:8, bg:"linear-gradient(160deg,#14532d,#0b3a1f)", accent:"#4ade80" },
    { id:"rpg", name:"RPG Forge", desc:"Steel + ember", minLevel:12, bg:"linear-gradient(160deg,#111827,#3b0a0a)", accent:"#f59e0b" }
  ];
  const avatars = [
    { id:"sprout", name:"Sprout", desc:"Level 1+", minLevel:1, icon:"🌱" },
    { id:"rookie", name:"Rookie", desc:"Level 5+", minLevel:5, icon:"🧑‍🚀" },
    { id:"knight", name:"Knight", desc:"Level 10+", minLevel:10, icon:"🛡️" },
    { id:"dragon", name:"Dragon", desc:"Level 15+", minLevel:15, icon:"🐉" }
  ];

  const hasStorage = (()=>{ try{ localStorage.setItem("__pomo_theme","1"); localStorage.removeItem("__pomo_theme"); return true; }catch(e){ return false; }})();
  const loadTheme = ()=> hasStorage ? localStorage.getItem(THEME_KEY) || "default" : "default";
  const saveTheme = (id)=>{ if(hasStorage) try{ localStorage.setItem(THEME_KEY,id); }catch(e){} };
  const loadAvatar = ()=> hasStorage ? localStorage.getItem(AVATAR_KEY) || "sprout" : "sprout";
  const saveAvatar = (id)=>{ if(hasStorage) try{ localStorage.setItem(AVATAR_KEY,id); }catch(e){} };

  const getLevel = ()=>{
    try{
      const raw = localStorage.getItem(XP_KEY);
      if(!raw) return 1;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed.level==="number" ? parsed.level : 1;
    }catch(e){ return 1; }
  };

  function applyTheme(themeId, avatarId){
    const panel = document.getElementById("panel-pomodoro");
    const theme = themes.find(t=>t.id===themeId) || themes[0];
    if(panel){
      panel.style.background = theme.bg;
      panel.style.setProperty("--pomo-accent", theme.accent);
    }
    const avatarEl = document.getElementById("pomo-avatar");
    const avatar = avatars.find(a=>a.id===avatarId) || avatars[0];
    if(avatarEl) avatarEl.textContent = avatar.icon;
  }

  function renderThemePicker(){
    const host = document.querySelector("#panel-pomodoro .pomo-side") || document.getElementById("panel-pomodoro") || document.body;
    if(!host) return;
    let card = document.getElementById("pomo-theme-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "pomo-theme-card";
    card.className = "pomo-side-card";
    const level = getLevel();
    const currentTheme = loadTheme();
    const currentAvatar = loadAvatar();
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <h3 style="margin:0;">Themes & Avatar</h3>
        <div id="pomo-avatar" style="font-size:24px;">🙂</div>
      </div>
      <div class="note" style="font-size:12px;margin-bottom:6px;">Unlock looks as you level up.</div>
      <div id="pomo-theme-options" style="display:grid;gap:6px;"></div>
      <div id="pomo-avatar-options" style="display:grid;gap:6px;margin-top:8px;"></div>
    `;
    host.append(card);

    const themeWrap = card.querySelector("#pomo-theme-options");
    const avatarWrap = card.querySelector("#pomo-avatar-options");
    if(themeWrap){
      themes.forEach(t=>{
        const btn = document.createElement("button");
        btn.className = "pomo-btn ghost";
        btn.type = "button";
        btn.style.justifyContent = "space-between";
        btn.textContent = `${t.name} (${t.desc})`;
        if(level < t.minLevel){
          btn.disabled = true;
          btn.title = `Reach level ${t.minLevel} to unlock`;
        }
        if(t.id === currentTheme) btn.classList.add("on");
        btn.addEventListener("click", ()=>{
          if(level < t.minLevel) return;
          saveTheme(t.id);
          applyTheme(t.id, loadAvatar());
          renderThemePicker();
        });
        themeWrap.append(btn);
      });
    }
    if(avatarWrap){
      avatars.forEach(a=>{
        const btn = document.createElement("button");
        btn.className = "pomo-btn ghost";
        btn.type = "button";
        btn.textContent = `${a.icon} ${a.name}`;
        if(level < a.minLevel){
          btn.disabled = true;
          btn.title = `Reach level ${a.minLevel} to unlock`;
        }
        if(a.id === currentAvatar) btn.classList.add("on");
        btn.addEventListener("click", ()=>{
          if(level < a.minLevel) return;
          saveAvatar(a.id);
          applyTheme(loadTheme(), a.id);
          renderThemePicker();
        });
        avatarWrap.append(btn);
      });
    }
    applyTheme(currentTheme, currentAvatar);
  }

  document.addEventListener("DOMContentLoaded", renderThemePicker);
})();

// Quick Notes & Distraction Log in Pomodoro tab
(function(){
  const NOTES_KEY = "planner_pomo_quick_notes";
  const DISTRACT_KEY = "planner_pomo_distractions";
  const hasStorage = (()=>{ try{ localStorage.setItem("__pomo_quick","1"); localStorage.removeItem("__pomo_quick"); return true; }catch(e){ return false; }})();
  const loadNotes = ()=>{
    if(!hasStorage) return { scratch:"", entries:[] };
    try{
      const raw = JSON.parse(localStorage.getItem(NOTES_KEY));
      if(raw && typeof raw==="object") return { scratch: raw.scratch||"", entries: Array.isArray(raw.entries)?raw.entries:[] };
    }catch(e){}
    return { scratch:"", entries:[] };
  };
  const saveNotes = (state)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(NOTES_KEY, JSON.stringify(state||{scratch:"", entries:[]})); }catch(e){}
  };
  const announceNote = (text)=>{
    const val = (text || "").trim();
    if(!val) return;
    try{
      window.dispatchEvent(new CustomEvent("pomoQuickNoteAdded", {
        detail: { text: val, ts: Date.now() }
      }));
    }catch(e){}
  };
  const loadDistractions = ()=>{
    if(!hasStorage) return [];
    try{
      const raw = JSON.parse(localStorage.getItem(DISTRACT_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  };
  const saveDistractions = (list)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(DISTRACT_KEY, JSON.stringify(list||[])); }catch(e){}
  };

  function renderQuickNotes(){
    const host = document.querySelector("#panel-pomodoro .pomo-side") || document.getElementById("panel-pomodoro") || document.body;
    if(!host) return;
    let card = document.getElementById("pomo-quick-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "pomo-quick-card";
    card.className = "pomo-side-card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <h3 style="margin:0;">Quick Notes</h3>
        <button class="pomo-btn ghost" id="pomo-note-save" type="button">Save</button>
      </div>
      <div class="note" style="font-size:12px;">Park stray thoughts so you stay focused.</div>
      <textarea id="pomo-note-scratch" rows="3" placeholder="Jot ideas / errands here" style="width:100%;padding:8px;border-radius:10px;border:1px solid var(--border,#2d2d2d);background:#0f172a;color:inherit;margin-top:6px;"></textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;">
        <button class="pomo-btn primary" id="pomo-note-add" type="button">Add to list</button>
        <button class="pomo-btn ghost" id="pomo-note-clear" type="button">Clear pad</button>
      </div>
      <div id="pomo-note-list" class="pomo-plan-checklist" style="margin-top:6px;max-height:120px;overflow:auto;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
        <strong>Distractions</strong>
        <button class="pomo-btn danger" id="pomo-distract-btn" type="button">I got distracted</button>
      </div>
      <div id="pomo-distract-meta" class="note" style="font-size:12px;margin-top:4px;"></div>
    `;
    host.append(card);

    const state = loadNotes();
    const scratch = document.getElementById("pomo-note-scratch");
    const addBtn = document.getElementById("pomo-note-add");
    const saveBtn = document.getElementById("pomo-note-save");
    const clearBtn = document.getElementById("pomo-note-clear");
    const list = document.getElementById("pomo-note-list");
    const distractBtn = document.getElementById("pomo-distract-btn");
    const distractMeta = document.getElementById("pomo-distract-meta");
    const distractions = loadDistractions();

    function renderList(){
      if(!list) return;
      list.innerHTML = "";
      state.entries.slice(0,10).forEach((item, idx)=>{
        const li = document.createElement("li");
        li.textContent = item;
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "pomo-btn ghost";
        rm.style.marginLeft = "8px";
        rm.textContent = "Remove";
        rm.addEventListener("click", ()=>{
          state.entries.splice(idx,1);
          saveNotes(state);
          renderList();
        });
        li.append(rm);
        list.append(li);
      });
      if(!state.entries.length){
        const li = document.createElement("li");
        li.className = "note";
        li.textContent = "No saved notes.";
        list.append(li);
      }
    }

    function renderDistractions(){
      if(!distractMeta) return;
      const today = new Date().toISOString().slice(0,10);
      const todayCount = distractions.filter(d=>d.startsWith(today)).length;
      distractMeta.textContent = `Today: ${todayCount} distractions logged • Total: ${distractions.length}`;
    }

    if(scratch) scratch.value = state.scratch || "";
    renderList();
    renderDistractions();

    saveBtn?.addEventListener("click", ()=>{
      state.scratch = (scratch?.value||"");
      saveNotes(state);
      announceNote(state.scratch);
    });
    clearBtn?.addEventListener("click", ()=>{
      if(scratch) scratch.value = "";
      state.scratch = "";
      saveNotes(state);
    });
    addBtn?.addEventListener("click", ()=>{
      const val = (scratch?.value||"").trim();
      if(!val) return;
      state.entries.unshift(val);
      state.scratch = "";
      if(scratch) scratch.value = "";
      saveNotes(state);
      renderList();
      announceNote(val);
    });
    distractBtn?.addEventListener("click", ()=>{
      const stamp = new Date().toISOString();
      distractions.unshift(stamp);
      saveDistractions(distractions);
      renderDistractions();
    });
  }

  document.addEventListener("DOMContentLoaded", renderQuickNotes);
})();

// Theme/Font/Layout settings (Settings tab enhancements)
(function(){
  const PREF_KEY = "planner_ui_prefs";
  const hasStorage = (()=>{ try{ localStorage.setItem("__ui_prefs","1"); localStorage.removeItem("__ui_prefs"); return true; }catch(e){ return false; }})();
  const loadPrefs = ()=>{
    if(!hasStorage) return {};
    try{
      const raw = JSON.parse(localStorage.getItem(PREF_KEY));
      return raw && typeof raw==="object" ? raw : {};
    }catch(e){ return {}; }
  };
  const savePrefs = (prefs)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(PREF_KEY, JSON.stringify(prefs||{})); }catch(e){}
  };

  const viewToTabId = (val)=> val && val.startsWith("tab-") ? val : `tab-${val||"planner"}`;
  const tabIdToOption = (val)=> val && val.startsWith("tab-") ? val.replace("tab-","") : (val||"planner");

  function applyPrefs(prefs){
    const root = document.documentElement;
    root.style.removeProperty("--bg");
    root.style.removeProperty("--fg");
    document.body.style.removeProperty("fontSize");
    if(prefs.theme === "light"){
      root.style.setProperty("--bg","#f8fafc");
      root.style.setProperty("--fg","#0f172a");
    } else if(prefs.theme === "dark"){
      root.style.setProperty("--bg","#0b1220");
      root.style.setProperty("--fg","#e5e7eb");
    } else if(prefs.theme === "custom" && prefs.bgImage){
      root.style.setProperty("--bg", `url(${prefs.bgImage})`);
    }
    if(prefs.fontSize){
      const size = Math.max(12, Math.min(22, Number(prefs.fontSize)));
      root.style.setProperty("--base-font", `${size}px`);
      document.body.style.fontSize = `${size}px`;
    }
  }

  function renderSettings(){
    const themeSel = document.getElementById("theme-select");
    const bgInput = document.getElementById("bg-url");
    const fontInput = document.getElementById("font-size");
    const viewSel = document.getElementById("default-view");
    const saveBtn = document.getElementById("btn-save-display");
    if(!themeSel || !bgInput || !fontInput || !viewSel || !saveBtn) return;

    let status = document.getElementById("display-status");
    if(!status){
      status = document.createElement("div");
      status.id = "display-status";
      status.className = "note";
      status.style.marginTop = "6px";
      saveBtn.insertAdjacentElement("afterend", status);
    }

    const prefs = loadPrefs();
    const allowedThemes = new Set(Array.from(themeSel.options||[]).map(o=>o.value));
    const themePref = allowedThemes.has(prefs.theme) ? prefs.theme : (allowedThemes.has("system") ? "system" : themeSel.value);
    themeSel.value = themePref;
    bgInput.value = prefs.bgImage || "";
    const fontPref = prefs.fontSize ? Math.max(12, Math.min(22, Number(prefs.fontSize))) : (fontInput.defaultValue || "");
    fontInput.value = fontPref;
    const viewPref = tabIdToOption(prefs.defaultView) || "planner";
    const allowedViews = new Set(Array.from(viewSel.options||[]).map(o=>o.value));
    viewSel.value = allowedViews.has(viewPref) ? viewPref : (allowedViews.values().next().value || "planner");

    saveBtn.addEventListener("click", ()=>{
      const fontSize = fontInput.value ? Math.max(12, Math.min(22, Number(fontInput.value))) : "";
      const next = {
        theme: themeSel.value || "system",
        bgImage: (bgInput.value||"").trim(),
        fontSize,
        defaultView: viewToTabId(viewSel.value || "planner")
      };
      savePrefs(next);
      applyPrefs(next);
      if(status) status.textContent = "Display preferences saved.";
    });

    applyPrefs(prefs);
  }

  function applyDefaultView(){
    const prefs = loadPrefs();
    let id = viewToTabId(prefs.defaultView || "tab-planner");
    let btn = document.getElementById(id);
    if(!btn && id === "tab-quests"){
      id = "tab-danger";
      btn = document.getElementById(id);
    }
    if(!btn){
      id = "tab-planner";
      btn = document.getElementById(id);
    }
    if(btn) btn.click();
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    renderSettings();
    applyDefaultView();
  });
})();

// Sync, Offline, Backups, Export (Settings tab)
(function(){
  const CLOUD_KEY = "planner_cloud_snapshot";       // mock cloud cache
  const BACKUP_KEY = "planner_backups";             // list of backups
  const QUEUE_KEY = "planner_sync_queue";           // offline queue
  const MAX_BACKUPS = 5;

  const hasStorage = (()=>{ try{ localStorage.setItem("__sync_test","1"); localStorage.removeItem("__sync_test"); return true; }catch(e){ return false; }})();

  const collectLocalData = ()=>{
    const snapshot = {};
    if(!hasStorage) return snapshot;
    Object.keys(localStorage).forEach(k=>{
      if(k.startsWith("planner")){ // scope to app keys
        snapshot[k] = localStorage.getItem(k);
      }
    });
    return snapshot;
  };
  const restoreSnapshot = (snap)=>{
    if(!hasStorage || !snap || typeof snap!=="object") return;
    Object.entries(snap).forEach(([k,v])=>{
      try{ localStorage.setItem(k, v); }catch(e){}
    });
  };

  const loadBackups = ()=>{
    if(!hasStorage) return [];
    try{
      const raw = JSON.parse(localStorage.getItem(BACKUP_KEY));
      return Array.isArray(raw)?raw:[];
    }catch(e){ return []; }
  };
  const saveBackups = (list)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(BACKUP_KEY, JSON.stringify(list||[])); }catch(e){}
  };

  const loadQueue = ()=>{
    if(!hasStorage) return [];
    try{
      const raw = JSON.parse(localStorage.getItem(QUEUE_KEY));
      return Array.isArray(raw)?raw:[];
    }catch(e){ return []; }
  };
  const saveQueue = (list)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(QUEUE_KEY, JSON.stringify(list||[])); }catch(e){}
  };

  function makeBackup(){
    const backups = loadBackups();
    const snapshot = collectLocalData();
    backups.unshift({ ts: Date.now(), data: snapshot });
    while(backups.length > MAX_BACKUPS) backups.pop();
    saveBackups(backups);
    return backups;
  }

  function exportData(){
    const data = collectLocalData();
    const blob = new Blob([JSON.stringify(data,null,2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planner-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function syncNow(statusEl){
    const snapshot = collectLocalData();
    if(!navigator.onLine){
      const q = loadQueue();
      q.push({ ts: Date.now(), data: snapshot });
      saveQueue(q);
      if(statusEl) statusEl.textContent = "Offline: queued for sync.";
      return;
    }
    try{
      localStorage.setItem(CLOUD_KEY, JSON.stringify({ ts: Date.now(), data: snapshot }));
      const cloud = JSON.parse(localStorage.getItem(CLOUD_KEY) || "{}");
      if(cloud.data) restoreSnapshot(cloud.data);
      if(statusEl) statusEl.textContent = "Synced with cloud.";
    }catch(e){
      if(statusEl) statusEl.textContent = "Sync failed.";
    }
  }

  function flushQueue(statusEl){
    if(!navigator.onLine) return;
    const q = loadQueue();
    if(!q.length) return;
    const latest = q[q.length-1];
    restoreSnapshot(latest.data);
    localStorage.removeItem(QUEUE_KEY);
    syncNow(statusEl);
  }

  function renderSyncCard(){
    const status = document.getElementById("backup-status");
    const syncBtn = document.getElementById("sync-now");
    const backupBtn = document.getElementById("create-backup");
    const exportBtn = document.getElementById("download-export");
    const row = syncBtn?.closest(".settings-row") || backupBtn?.closest(".settings-row") || status?.closest(".settings-row");
    if(!row || (!syncBtn && !backupBtn && !exportBtn)) return;

    // Build a single backup list inside the Control Center row instead of a duplicate card.
    let backupList = document.getElementById("backup-list");
    if(!backupList){
      const wrap = document.createElement("div");
      wrap.style.marginTop = "10px";
      const title = document.createElement("strong");
      title.textContent = "Backups";
      backupList = document.createElement("ul");
      backupList.id = "backup-list";
      backupList.className = "pomo-plan-checklist";
      wrap.append(title, backupList);
      row.appendChild(wrap);
    }

    const renderBackups = (list, message)=>{
      backupList.innerHTML = "";
      if(!list.length){
        const li = document.createElement("li");
        li.className = "note";
        li.textContent = "No backups yet.";
        backupList.append(li);
      } else {
        list.forEach((b, idx)=>{
          const li = document.createElement("li");
          const date = new Date(b.ts).toLocaleString();
          li.textContent = `Backup ${idx+1} - ${date}`;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn";
          btn.style.marginLeft = "8px";
          btn.textContent = "Restore";
          btn.addEventListener("click", ()=>{
            restoreSnapshot(b.data);
            if(status) status.textContent = `Restored backup from ${date}`;
          });
          li.append(btn);
          backupList.append(li);
        });
      }
      if(status) status.textContent = message || (list.length ? `Saved backups: ${list.length}` : "No backups yet.");
    };

    renderBackups(loadBackups());

    syncBtn?.addEventListener("click", ()=> syncNow(status));
    backupBtn?.addEventListener("click", ()=>{
      const list = makeBackup();
      renderBackups(list, "Backup created.");
    });
    exportBtn?.addEventListener("click", exportData);

    flushQueue(status);
    window.addEventListener("online", ()=> flushQueue(status));
  }

  document.addEventListener("DOMContentLoaded", renderSyncCard);
})();

// Workout Type Tracker (workout tab)
(function(){
  const STORAGE_KEY = "workout-graph-log-v1";
  const BADGE_KEY = "workout-graph-badges-v1";
  const GOAL_KEY = "workout-goals-v1";
  const MAX_ENTRIES = 999;
  const WINDOW_DAYS = 7;
  const TYPES = [
    { key:"chest", label:"Chest", color:"#ef4444" },
    { key:"back", label:"Back", color:"#3b82f6" },
    { key:"abs", label:"Abs", color:"#f59e0b" },
    { key:"arms_shoulders", label:"Arms & Shoulders", color:"#8b5cf6" },
    { key:"legs_calfs", label:"Legs & Calfs", color:"#10b981" },
    { key:"push", label:"Push", color:"#ec4899" },
    { key:"pull", label:"Pull", color:"#06b6d4" }
  ];

  const grid = document.getElementById("workout-graph-grid");
  const form = document.getElementById("workout-graph-form");
  const messageEl = document.getElementById("workout-graph-message");
  const saveBtn = document.getElementById("workout-graph-save");
  const canvas = document.getElementById("workout-graph-canvas");
  const activityGrid = document.getElementById("workout-activity-grid");
  const ctx = canvas?.getContext?.("2d");
  const streakEl = document.getElementById("wg-streak");
  const daysEl = document.getElementById("wg-days");
  const weeklyStreakEl = document.getElementById("wg-weekly-streak");
  const topTypeEl = document.getElementById("wg-top-type");
  const dayLabelEl = document.getElementById("workout-day-label");
  const resetBtn = document.getElementById("workout-graph-reset");
  const badgesEl = document.getElementById("workout-badges");
  const goalTargetInput = document.getElementById("wg-goal-target");
  const goalPrInput = document.getElementById("wg-goal-pr");
  const goalTypesWrap = document.getElementById("wg-goal-types");
  const goalSaveBtn = document.getElementById("wg-goal-save");
  const goalResetBtn = document.getElementById("wg-goal-reset");
  const goalStatus = document.getElementById("wg-goal-status");
  const goalMeta = document.getElementById("wg-goal-meta");
  const goalBar = document.getElementById("wg-goal-bar");
  const goalFocusNote = document.getElementById("wg-goal-focus-note");
  const goalPrNote = document.getElementById("wg-goal-pr-note");

  if(!grid || !form) return;

  const state = {
    selected: new Set(),
    log: loadData(),
    badges: loadBadges(),
    goals: loadGoals()
  };

  function todayKey(){ return new Date().toISOString().slice(0,10); }
  function lastNDates(n){
    const days = [];
    for(let i=n-1;i>=0;i--){
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0,10));
    }
    return days;
  }
  function weekStart(dateStr){
    const d = new Date(dateStr);
    if(isNaN(d)) return null;
    const day = (d.getDay()+6)%7; // Monday as start
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0,10);
  }
  function loadData(){
    try{
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(raw) ? raw.filter(r=>r?.date).slice(-MAX_ENTRIES) : [];
    }catch(e){ return []; }
  }
  function saveData(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.log.slice(-MAX_ENTRIES))); }catch(e){}
  }
  function loadBadges(){
    try{
      const raw = JSON.parse(localStorage.getItem(BADGE_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function saveBadges(){
    try{ localStorage.setItem(BADGE_KEY, JSON.stringify(state.badges||[])); }catch(e){}
  }
  function defaultGoals(){ return { weeklyTarget:3, focusTypes:[], pr:"" }; }
  function loadGoals(){
    try{
      const raw = JSON.parse(localStorage.getItem(GOAL_KEY));
      if(raw && typeof raw==="object") return { ...defaultGoals(), ...raw };
    }catch(e){}
    return defaultGoals();
  }
  function saveGoals(){
    try{ localStorage.setItem(GOAL_KEY, JSON.stringify(state.goals||defaultGoals())); }catch(e){}
  }

  function setMessage(text, type){
    if(!messageEl) return;
    messageEl.textContent = text||"";
    messageEl.classList.remove("success","error");
    if(type) messageEl.classList.add(type);
  }
  function setDayLabel(){
    if(!dayLabelEl) return;
    const now = new Date();
    const label = now.toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric" });
    dayLabelEl.textContent = `${label} — Select your workouts`;
  }
  function setDayLabel(){
    if(!dayLabelEl) return;
    const now = new Date();
    const label = now.toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric" });
    dayLabelEl.textContent = `${label} - Select your workouts`;
  }

  function syncSelectionFromToday(){
    const today = todayKey();
    const todayEntry = state.log.find(e=>e.date === today);
    state.selected = new Set(todayEntry?.types || []);
    renderOptions();
  }

  function renderOptions(){
    grid.querySelectorAll("[data-type]").forEach(btn=>{
      const type = btn.dataset.type;
      const isOn = state.selected.has(type);
      btn.classList.toggle("active", isOn);
      const box = btn.querySelector(".workout-checkbox");
      if(box) box.textContent = "";
    });
  }

  function toggleType(type){
    if(state.selected.has(type)){
      state.selected.delete(type);
    }else{
      state.selected.add(type);
    }
    renderOptions();
  }

  function computeStreak(){
    const datesWithLogs = new Set(
      state.log.filter(e=>Array.isArray(e.types) && e.types.length).map(e=>e.date)
    );
    const days = lastNDates(WINDOW_DAYS).reverse(); // newest first
    let streak = 0;
    for(const date of days){
      if(datesWithLogs.has(date)) streak += 1;
      else break;
    }
    return streak;
  }

  function computeWeeklyStreak(){
    const weeks = new Set();
    state.log.forEach(entry=>{
      if(Array.isArray(entry.types) && entry.types.length){
        const w = weekStart(entry.date);
        if(w) weeks.add(w);
      }
    });
    let streak = 0;
    let cursor = weekStart(todayKey());
    while(cursor && weeks.has(cursor)){
      streak += 1;
      const d = new Date(cursor);
      d.setDate(d.getDate() - 7);
      cursor = d.toISOString().slice(0,10);
    }
    return streak;
  }

  function totalLogged(){
    return state.log.filter(e=>Array.isArray(e.types) && e.types.length).length;
  }

  function fullWeekLogged(){
    const recentDays = new Set(lastNDates(WINDOW_DAYS));
    const loggedDays = new Set(state.log.filter(e=>Array.isArray(e.types) && e.types.length && recentDays.has(e.date)).map(e=>e.date));
    return loggedDays.size === WINDOW_DAYS;
  }

  function computeTopType(){
    const windowDays = new Set(lastNDates(WINDOW_DAYS));
    const counts = {};
    state.log.filter(entry=>windowDays.has(entry.date)).forEach(entry=>{
      (entry.types||[]).forEach(t=>{ counts[t] = (counts[t]||0)+1; });
    });
    const best = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    return best ? TYPES.find(t=>t.key===best[0])?.label || best[0] : "-";
  }

  function currentWeekDaysLogged(){
    const thisWeek = weekStart(todayKey());
    if(!thisWeek) return 0;
    const start = new Date(thisWeek);
    const end = new Date(thisWeek); end.setDate(end.getDate()+6);
    const days = new Set();
    state.log.forEach(entry=>{
      const d = new Date(entry.date);
      if(d>=start && d<=end && Array.isArray(entry.types) && entry.types.length){
        days.add(entry.date);
      }
    });
    return days.size;
  }

  function updateSummary(){
    if(streakEl) streakEl.textContent = `${computeStreak()} days`;
    const recentDays = new Set(lastNDates(WINDOW_DAYS));
    const logged = state.log.filter(e=>recentDays.has(e.date) && Array.isArray(e.types) && e.types.length).length;
    if(daysEl) daysEl.textContent = `${logged} / ${WINDOW_DAYS}`;
    if(weeklyStreakEl) weeklyStreakEl.textContent = `${computeWeeklyStreak()} wks`;
    if(topTypeEl) topTypeEl.textContent = computeTopType();
    renderBadges();
  }

  function ensureCanvasSize(){
    if(!canvas || !ctx) return false;
    const rect = canvas.getBoundingClientRect();
    if(!rect.width || !rect.height) return false;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(300, rect.width * dpr);
    canvas.height = Math.max(200, rect.height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return true;
  }

  function renderActivityGrid(){
    if(!activityGrid) return;
    const thisWeekStart = weekStart(todayKey());
    if(!thisWeekStart) return;
    const days = [];
    const start = new Date(thisWeekStart);
    for(let i=0;i<7;i++){
      const d = new Date(start);
      d.setDate(start.getDate()+i);
      days.push(d.toISOString().slice(0,10));
    }
    activityGrid.innerHTML = "";
    const todayIso = todayKey();
    days.forEach(dateStr=>{
      const entry = state.log.find(e=>e.date === dateStr);
      const has = Array.isArray(entry?.types) && entry.types.length>0;
      const day = new Date(dateStr+"T00:00:00");
      const col = document.createElement("div");
      col.className = "activity-day" + (todayIso===dateStr ? " today" : "");
      const label = document.createElement("div");
      label.className = "activity-day-label";
      label.textContent = day.toLocaleDateString(undefined,{ weekday:"short"});
      const slots = document.createElement("div");
      slots.className = "activity-slots";
      TYPES.forEach(t=>{
        const slot = document.createElement("div");
        slot.className = "activity-slot";
        if(entry?.types?.includes(t.key)){
          slot.classList.add("on", t.key);
        }
        slots.append(slot);
      });
      const dot = document.createElement("div");
      dot.className = "activity-dot" + (has ? " on" : "");
      col.append(label, slots, dot);
      activityGrid.append(col);
    });
  }

  function drawChart(){
    if(activityGrid){
      renderActivityGrid();
      return;
    }
    if(!ensureCanvasSize()) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0,0,width,height);

    const days = lastNDates(WINDOW_DAYS);
    const dayMap = new Map(state.log.map(e=>[e.date,e]));
    const padding = 36;
    const graphW = width - padding*2;
    const graphH = height - padding*2;
    const rowH = graphH / TYPES.length;
    const spacing = days.length>1 ? graphW / (days.length-1) : graphW;

    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(226,232,240,.9)";
    ctx.strokeStyle = "rgba(255,255,255,.12)";

    TYPES.forEach((type, idx)=>{
      const y = padding + idx*rowH + rowH/2;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width-padding, y);
      ctx.stroke();
      ctx.fillText(type.label, 12, y);
    });

    TYPES.forEach((type, idx)=>{
      const y = padding + idx*rowH + rowH/2;
      ctx.fillStyle = type.color;
      for(let i=0;i<days.length;i++){
        const x = padding + i*spacing;
        const entry = dayMap.get(days[i]);
        const has = entry && entry.types?.includes(type.key);
        const r = has ? 7 : 3;
        ctx.globalAlpha = has ? 1 : 0.25;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    ctx.fillStyle = "rgba(226,232,240,.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const interval = Math.max(1, Math.ceil(days.length/4));
    for(let i=0;i<days.length;i+=interval){
      const date = new Date(days[i]);
      const label = `${date.getMonth()+1}/${date.getDate()}`;
      const x = padding + i*spacing;
      ctx.fillText(label, x, height - padding + 6);
    }
  }

  function saveToday(){
    const today = todayKey();
    if(!state.selected.size){
      setMessage("Pick at least one type before saving.", "error");
      return;
    }
    const entry = {
      date: today,
      types: Array.from(state.selected),
      ts: Date.now()
    };
    const idx = state.log.findIndex(e=>e.date === today);
    if(idx >= 0){
      state.log[idx] = entry;
    }else{
      state.log.push(entry);
    }
    saveData();
    updateSummary();
    drawChart();
    setMessage("Saved. Chart updated!", "success");
    evaluateBadges();
    saveBadges();
    renderGoals();
    try{
      window.dispatchEvent(new CustomEvent("workout-log-updated"));
      if(typeof window.refreshWorkoutHeatMap === "function"){
        window.refreshWorkoutHeatMap();
      }
    }catch(e){}
  }

  // Badges
  const BADGES = [
    { id:"first", label:"Novice", emoji:"🌟", test:()=> totalLogged() >= 1, text:"First workout logged!" },
    { id:"five", label:"Consistency", emoji:"🏅", test:()=> totalLogged() >= 5, text:"5 workouts logged." },
    { id:"ten", label:"Strength", emoji:"💪", test:()=> totalLogged() >= 10, text:"10 workouts logged." },
    { id:"perfect-week", label:"Perfect Week", emoji:"🔥", test:()=> fullWeekLogged(), text:"Logged all 7 days this week." },
    { id:"weekly-streak-2", label:"Momentum", emoji:"🚀", test:()=> computeWeeklyStreak() >= 2, text:"2-week streak!" },
    { id:"goal-hit", label:"Goal Crusher", emoji:"🎯", test:()=> {
      const target = Math.max(0, Number(state.goals?.weeklyTarget||0));
      return target>0 && currentWeekDaysLogged() >= target;
    }, text:"Hit your weekly target." }
  ];

  function evaluateBadges(){
    const unlocked = new Set(state.badges||[]);
    BADGES.forEach(b=>{ if(b.test()) unlocked.add(b.id); });
    state.badges = Array.from(unlocked);
  }

  function renderBadges(){
    if(!badgesEl) return;
    badgesEl.innerHTML = "";
    const unlocked = new Set(state.badges||[]);
    const display = BADGES.filter(b=>unlocked.has(b.id));
    if(!display.length){
      const empty = document.createElement("div");
      empty.className = "note";
      empty.textContent = "Badges appear here as you log workouts.";
      badgesEl.append(empty);
      return;
    }
    display.forEach(b=>{
      const pill = document.createElement("div");
      pill.className = "badge-pill";
      pill.innerHTML = `<span class="badge-emoji">${b.emoji}</span><span>${b.label}</span>`;
      pill.title = b.text;
      badgesEl.append(pill);
    });
  }

  grid.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-type]");
    if(!btn) return;
    toggleType(btn.dataset.type);
  });

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    saveToday();
  });

  resetBtn?.addEventListener("click", ()=>{
    const thisWeek = weekStart(todayKey());
    if(!thisWeek) return;
    state.log = state.log.filter(entry=>weekStart(entry.date) !== thisWeek);
    state.selected.clear();
    saveData();
    evaluateBadges();
    saveBadges();
    renderOptions();
    updateSummary();
    drawChart();
    renderGoals();
    setMessage("This week's log was reset.", "success");
  });

  // Goals UI/logic
  function renderGoals(){
    if(goalTargetInput) goalTargetInput.value = state.goals.weeklyTarget;
    if(goalPrInput) goalPrInput.value = state.goals.pr || "";
    if(goalTypesWrap){
      goalTypesWrap.querySelectorAll(".goal-chip").forEach(chip=>{
        const type = chip.getAttribute("data-goal-type");
        chip.classList.toggle("active", !!state.goals.focusTypes?.includes(type));
      });
    }
    const target = Math.max(0, Number(state.goals.weeklyTarget||0));
    const logged = currentWeekDaysLogged();
    const pct = target>0 ? Math.min(100, Math.round((logged/target)*100)) : 0;
    if(goalMeta) goalMeta.textContent = `${logged} / ${target || 0} days`;
    if(goalBar) goalBar.style.width = `${pct}%`;
    if(goalFocusNote){
      const focus = (state.goals.focusTypes||[]).map(key=>TYPES.find(t=>t.key===key)?.label||key);
      goalFocusNote.textContent = focus.length ? `Focus: ${focus.join(", ")}` : "Focus: None set";
    }
    if(goalPrNote) goalPrNote.textContent = state.goals.pr ? `PR note: ${state.goals.pr}` : "PR note: -";
  }

  goalTypesWrap?.addEventListener("click", e=>{
    const chip = e.target.closest(".goal-chip");
    if(!chip) return;
    const type = chip.getAttribute("data-goal-type");
    const set = new Set(state.goals.focusTypes||[]);
    if(set.has(type)) set.delete(type); else set.add(type);
    state.goals.focusTypes = Array.from(set);
    renderGoals();
  });

  goalSaveBtn?.addEventListener("click", ()=>{
    const tgt = Math.max(1, Math.min(14, parseInt(goalTargetInput?.value||state.goals.weeklyTarget||1,10)));
    state.goals.weeklyTarget = tgt;
    state.goals.pr = (goalPrInput?.value||"").trim();
    saveGoals();
    evaluateBadges();
    saveBadges();
    renderGoals();
    if(goalStatus) goalStatus.textContent = "Goals saved.";
  });

  goalResetBtn?.addEventListener("click", ()=>{
    state.goals = defaultGoals();
    saveGoals();
    evaluateBadges();
    saveBadges();
    renderGoals();
    if(goalStatus) goalStatus.textContent = "Goals reset.";
  });

  setDayLabel();
  syncSelectionFromToday();
  evaluateBadges();
  updateSummary();
  renderGoals();
  drawChart();
  setTimeout(drawChart, 120);
  document.getElementById("tab-workout")?.addEventListener("click", ()=> setTimeout(drawChart, 60));
  window.addEventListener("resize", drawChart);
})();

// Multi-alert reminders (Settings tab)
(function(){
  const ALERT_KEY = "planner_alert_prefs";
  const ALERT_STATE_KEY = "planner_alert_state";
  const CAL_KEY = "planner-calendar-events";
  const hasStorage = (()=>{ try{ localStorage.setItem("__alert_test","1"); localStorage.removeItem("__alert_test"); return true; }catch(e){ return false; }})();
  const loadAlertPrefs = ()=>{
    if(!hasStorage) return { leadTimes:[1440, 60, 0], snooze: 10, repeat:false };
    try{
      const raw = JSON.parse(localStorage.getItem(ALERT_KEY));
      if(raw && typeof raw==="object") return { leadTimes:[1440,60,0], snooze:10, repeat:false, ...raw };
    }catch(e){}
    return { leadTimes:[1440, 60, 0], snooze:10, repeat:false };
  };
  const saveAlertPrefs = (p)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(ALERT_KEY, JSON.stringify(p||{})); }catch(e){}
  };

  const loadAlertState = ()=>{
    if(!hasStorage) return { sent:new Set(), repeat:{} };
    try{
      const raw = JSON.parse(localStorage.getItem(ALERT_STATE_KEY));
      return {
        sent: new Set(Array.isArray(raw?.sent)?raw.sent:[]),
        repeat: raw?.repeat || {}
      };
    }catch(e){ return { sent:new Set(), repeat:{} }; }
  };
  const saveAlertState = (state)=>{
    if(!hasStorage) return;
    try{
      localStorage.setItem(ALERT_STATE_KEY, JSON.stringify({
        sent: Array.from(state.sent||[]),
        repeat: state.repeat || {}
      }));
    }catch(e){}
  };

  const loadEvents = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem(CAL_KEY));
      return Array.isArray(raw) ? raw.filter(ev=>ev && ev.start && ev.title) : [];
    }catch(e){ return []; }
  };

  function maybeNotify(title, body){
    if(typeof Notification === "undefined") return;
    if(Notification.permission === "granted"){
      try{ new Notification(title,{ body }); }catch(e){}
    } else if(Notification.permission !== "denied"){
      Notification.requestPermission().then(p=>{ if(p==="granted") maybeNotify(title, body); });
    }
  }

  function startAlertLoop(){
    const prefs = loadAlertPrefs();
    const state = loadAlertState();
    const LEADS = prefs.leadTimes || [1440,60,0];
    const SNOOZE = Math.max(5, prefs.snooze||10);
    const REPEAT_MAX = 3;
    const check = ()=>{
      const now = Date.now();
      const events = loadEvents().filter(ev=>{
        const due = new Date(ev.start).getTime();
        return due && due > now - 2*24*60*60*1000 && due < now + 14*24*60*60*1000;
      });
      events.forEach(ev=>{
        const due = new Date(ev.start).getTime();
        LEADS.forEach(lead=>{
          const key = `${ev.title}|${ev.start}|${lead}`;
          const triggerAt = due - lead*60*1000;
          if(now >= triggerAt && !state.sent.has(key)){
            const mins = Math.max(0, Math.round((due - now)/60000));
            maybeNotify("Reminder: " + ev.title, lead===0 ? "Due now" : `Due in ${mins} min`);
            state.sent.add(key);
          }
        });
        if(prefs.repeat){
          const repeatKey = `${ev.title}|${ev.start}|repeat`;
          const count = state.repeat[repeatKey] || 0;
          if(now >= due && count < REPEAT_MAX){
            const lastSentKey = `${repeatKey}|${count}`;
            if(!state.sent.has(lastSentKey)){
              maybeNotify("Reminder (repeat): " + ev.title, "Still due. Please finish or snooze.");
              state.sent.add(lastSentKey);
              state.repeat[repeatKey] = count + 1;
            }
          }
        }
      });
      saveAlertState(state);
    };
    check();
    setInterval(check, Math.max(60*1000, (prefs.snooze||10)*60*1000));
  }

  function renderAlertCard(){
    const leadsInput = document.getElementById("alert-leads");
    const snoozeInput = document.getElementById("alert-snooze");
    const repeatInput = document.getElementById("alert-repeat");
    const saveBtn = document.getElementById("alert-save");
    if(!leadsInput || !snoozeInput || !repeatInput || !saveBtn) return;

    let status = document.getElementById("alert-status");
    if(!status){
      status = document.createElement("div");
      status.id = "alert-status";
      status.className = "note";
      status.style.marginTop = "6px";
      saveBtn.insertAdjacentElement("afterend", status);
    }

    const prefs = loadAlertPrefs();
    leadsInput.value = (prefs.leadTimes || []).join(",");
    snoozeInput.value = prefs.snooze;
    repeatInput.checked = !!prefs.repeat;

    saveBtn.addEventListener("click", ()=>{
      const leadTimes = (leadsInput.value||"")
        .split(",")
        .map(s=> parseInt(s.trim(),10))
        .filter(n=>!isNaN(n) && n>=0)
        .slice(0,5);
      const snooze = Math.max(5, Math.min(120, parseInt(snoozeInput.value||10,10)));
      const repeat = !!repeatInput.checked;
      const next = { leadTimes: leadTimes.length?leadTimes:[1440,60,0], snooze, repeat };
      saveAlertPrefs(next);
      if(status) status.textContent = "Alert preferences saved.";
    });
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    renderAlertCard();
    startAlertLoop();
  });
})();

// Workout tab PDF export (Settings tab button)
(function(){
  function initWorkoutPrint(){
    const btn = document.getElementById("workout-pdf-btn");
    const workout = document.getElementById("panel-workout");
    if(!btn || !workout) return;

    btn.addEventListener("click", ()=>{
      const wasHidden = workout.classList.contains("hidden");
      if(wasHidden) workout.classList.remove("hidden");
      document.body.classList.add("print-workout");
      setTimeout(()=>{
        window.print();
        setTimeout(()=>{
          document.body.classList.remove("print-workout");
          if(wasHidden) workout.classList.add("hidden");
        }, 80);
      }, 40);
    });
  }
  document.addEventListener("DOMContentLoaded", initWorkoutPrint);
})();
