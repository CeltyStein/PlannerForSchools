(function(){
  // Pixel the PUP mascot (local asset)
  const mascotPng = "Pixel the PUP.png";

  function wrapNotificationWithMascot(icon){
    if(typeof window.Notification !== "function") return;
    const Native = window.Notification;
    const MascotNotification = function(title, options){
      const opts = Object.assign({}, options);
      if(!opts.icon) opts.icon = icon;
      return new Native(title, opts);
    };
    MascotNotification.requestPermission = Native.requestPermission.bind(Native);
    Object.defineProperty(MascotNotification, "permission", {
      get: () => Native.permission
    });
    MascotNotification.prototype = Native.prototype;
    window.Notification = MascotNotification;
  }

  function injectMascotCard(){
    const card = document.querySelector(".card-notify");
    if(!card) return;
    const existing = card.querySelector(".mascot-wrap");
    if(existing) return;
    const wrap = document.createElement("div");
    wrap.className = "mascot-wrap";
    const img = document.createElement("img");
    img.className = "mascot-art";
    img.src = mascotPng;
    img.alt = "Pixel the PUP mascot";
    const copy = document.createElement("div");
    copy.className = "mascot-copy";
    copy.textContent = "Pixel the PUP will tag along on your push reminders as the app icon.";
    wrap.append(img, copy);
    card.append(wrap);
  }

  function initMascot(){
    wrapNotificationWithMascot(mascotPng);
    injectMascotCard();
  }

  // ---------------------------------------------
  // Coach upgrade (simulated “ChatGPT-like” logic)
  // ---------------------------------------------
  function ready(fn){
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function stripEvents(node){
    const clone = node.cloneNode(true);
    node.replaceWith(clone);
    return clone;
  }

  function gatherContext(){
    const ctx = {};
    ctx.habitsProgress = (document.getElementById("habits-progress")?.textContent || "").trim();
    ctx.mood = document.getElementById("mood-select")?.value || "neutral";
    ctx.energy = document.getElementById("energy-select")?.value || "medium";
    ctx.storyStage = (document.getElementById("story-mode-stage")?.textContent || "").trim();
    ctx.freezeCount = parseInt((document.getElementById("freeze-count")?.textContent || "0"), 10) || 0;
    ctx.integrationHints = Array.from(document.querySelectorAll("[data-integration]:checked")).map(el=>el.dataset.integration);
    ctx.reflectionMeta = (document.getElementById("reflection-meta")?.textContent || "").trim();
    ctx.nextDeadlines = Array.from(document.querySelectorAll(".danger-item .danger-title")).map(el=>{
      const title = el.textContent.trim();
      const status = el.parentElement?.querySelector(".danger-status")?.textContent?.trim() || "";
      return `${title} (${status})`;
    }).slice(0,3);
    ctx.tasksToday = Array.from(document.querySelectorAll('.class-assignment-title')).slice(0,3).map(el=>el.textContent.trim());
    return ctx;
  }

  function summarizeContext(ctx){
    const bits = [];
    if(ctx.habitsProgress) bits.push(ctx.habitsProgress);
    if(ctx.nextDeadlines?.length) bits.push(`Upcoming: ${ctx.nextDeadlines.join(" | ")}`);
    if(ctx.tasksToday?.length) bits.push(`Classes: ${ctx.tasksToday.join(" | ")}`);
    bits.push(`Mood ${ctx.mood}, Energy ${ctx.energy}`);
    if(ctx.freezeCount) bits.push(`${ctx.freezeCount} Freeze ready`);
    if(ctx.storyStage) bits.push(`Story: ${ctx.storyStage}`);
    return bits.join(" • ");
  }

  function smartPlan(ctx, message){
    const lower = message.toLowerCase();
    const steps = [];
    const deadlines = ctx.nextDeadlines && ctx.nextDeadlines.length ? ctx.nextDeadlines : ctx.tasksToday;
    if(deadlines && deadlines.length){
      steps.push(`1) Start: ${deadlines[0]} — do a 10-min outline or first 3 bullets.`);
    } else {
      steps.push("1) Pick one item and define a 10-min starter (outline, list sources, or open the doc).");
    }
    steps.push("2) Run a 45/15 focus block. During breaks: water + posture reset.");
    steps.push("3) Log a reflection line after the block; note what felt easier than last week.");
    if(ctx.freezeCount) steps.push(`Bonus: Freeze stocked (${ctx.freezeCount}). Keep streaks clean and use only if you must.`);
    if(ctx.integrationHints?.length) steps.push(`Ambient cue: keep ${ctx.integrationHints[0]} enabled so the plan follows you.`);
    return steps.join(" ");
  }

    function butlerSnark(){
    try{
      const pct = calcCompletionPercent();
      return buildButlerLine(pct);
    }catch(e){
      return "";
    }
  }

  function pickSarcasm(){
    const lines = [
      "Reminder: scrolling isn't studying-open the doc.",
      "Your future self is side-eyeing you. Do the thing.",
      "Congrats on opening the chat. Now open the assignment.",
      "Coffee tastes better after a finished task. Just saying.",
      "If procrastination burned calories you'd be shredded. Work time."
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function pickCoachLine(){
    // Build 4000+ unique mixes to keep replies fresh.
    if(!pickCoachLine.cache){
      const leadIns = [
        "Do this now:",
        "Micro-plan:",
        "Next 15 minutes:",
        "Immediate move:",
        "Low-friction start:"
      ];
      const actions = [
        "outline 3 bullets and turn one into a messy paragraph",
        "copy the prompt into your doc and answer under each part",
        "highlight the verbs in the rubric and respond to the first one",
        "write your thesis in 12 words, then add two supports",
        "draft the body before the intro; evidence first",
        "drop [SOURCE] placeholders and keep drafting",
        "build a checklist from the prompt and tick one box",
        "add headings/subheadings so the skeleton exists",
        "write topic sentences for every planned paragraph",
        "translate bullets into numbered steps with time boxes",
        "add one citation and keep moving",
        "do a 5-minute brain dump, zero editing",
        "solve one example by hand, then paste the steps",
        "create a table/figure and describe it in two sentences",
        "write the conclusion first so you know the destination",
        "pair every claim with a source—no orphans"
      ];
      const guards = [
        "ban tab switching until the timer ends",
        "use [TODO] tags instead of stopping to research",
        "if stuck, write the worst version possible",
        "stop mid-sentence so restarting is easy",
        "cap research at 15 minutes before drafting",
        "keep only sources + doc open; close the rest",
        "set a 'good enough' bar to dodge perfection traps",
        "use active voice and delete one filler sentence",
        "time-box to 20 minutes and ship a draft"
      ];
      const payoffs = [
        "then stretch for 2 minutes and come back",
        "then reward with a tiny break only if the draft exists",
        "then skim once aloud to catch the weird bits",
        "then move to the next rubric verb",
        "then snapshot/save so you don't lose progress",
        "then add one transition sentence for flow",
        "then refactor one paragraph to be 4 lines max",
        "then paste the prompt up top for alignment"
      ];
      const combos = [];
      leadIns.forEach(a=>actions.forEach(b=>guards.forEach(c=>payoffs.forEach(d=>{
        combos.push(`${a} ${b}; ${c}; ${d}.`);
      }))));
      pickCoachLine.cache = combos;
    }
    const pool = pickCoachLine.cache;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function buildCoachIdea(){
    if(!buildCoachIdea.pool){
      const actions = [
        "Plan a study block for", "Break down", "Ask for help with", "Refine a thesis for", "Create a rubric checklist for",
        "Draft an outline for", "Schedule practice problems for", "Find sources for", "Summarize a reading for", "Time-box a draft for",
        "Improve focus during", "Build a habit stack around", "Prevent procrastination on", "Balance energy for", "Track progress on",
        "Design flashcards for", "Create a review loop for", "Set checkpoints for", "Automate reminders for", "Pair a reward with",
        "Handle burnout during", "Split into phases for", "Run a Pomodoro on", "Do a quick brain dump on", "Make a decision about",
        "Set up accountability for", "Estimate effort for", "Debug problems in", "Build momentum on", "Reduce scope of",
        "Polish writing style for", "Draft intros/conclusions for", "Handle citations for", "Turn notes into prose for", "Make a TL;DR for",
        "Outline risks for", "Gather evidence for", "Mock a Q&A for", "Storyboard visuals for", "Script a walkthrough for"
      ];
      const subjects = [
        "labs", "essays", "quizzes", "presentations", "credit bureau checks", "budgeting tasks",
        "weekly chores", "coding assignments", "video edits", "pyrography practice", "calligraphy drills",
        "embroidery projects", "workout planning", "sleep routine", "social time", "shopping list",
        "fridge clean-up", "bathroom clean-up", "laundry", "hair care", "job applications",
        "resume updates", "portfolio polish", "habit tracking", "energy journaling", "note taking",
        "class readings", "practice exams", "research papers", "group projects", "deadlines due this week",
        "overdue items", "next week prep", "review sessions", "flashcard creation", "mock interviews",
        "meeting prep", "data analysis", "slide decks", "debugging sessions", "code reviews"
      ];
      const goals = [
        "finish in under 45 minutes", "avoid distractions", "keep momentum high", "stay within a 2-hour cap",
        "hit an A-level rubric", "reduce stress", "ship a draft today", "meet the Sunday deadline",
        "avoid all-nighters", "protect sleep", "earn bonus XP", "finish before social plans",
        "batch related tasks", "avoid context switching", "use active recall", "get feedback early",
        "leave time to revise", "lock in citations", "simplify scope", "feel confident turning it in",
        "beat procrastination", "stay energized", "avoid perfectionism", "practice explaining concepts",
        "keep the browser tabs under control", "stay accountable", "stick to Pomodoro timing", "finish with a clean checklist",
        "minimize app switching", "make it fun", "pair it with music", "stay hydrated", "earn a break after",
        "align with the rubric", "de-risk the hardest part", "surface open questions", "create a clean handoff"
      ];
      const constraints = [
        "with a 20/5 timer", "with no phone", "with only one tab open", "with noise-cancelling on",
        "standing for the first 5 minutes", "after a 3-minute walk", "with a written checklist",
        "in a quiet corner", "using flashcards", "using handwritten notes", "with a single source open",
        "with VS Code zen mode", "using a paper notebook", "with a water bottle nearby", "after a stretch break",
        "using pen + paper only", "with a single playlist on repeat", "after a quick stretch", "in 2 back-to-back pomodoros"
      ];
      const tones = [
        "Keep it tactical.", "Stay calm and execute.", "Ship, then polish.", "Speed first, then accuracy.", "One draft now, refine later.",
        "Minimal tabs, maximal focus.", "Avoid rabbit holes.", "Keep scope tiny.", "Record blockers as you go.", "Stay in motion."
      ];
      const pool = [];
      actions.forEach(a=>{
        subjects.forEach(s=>{
          goals.forEach(g=>{
            constraints.forEach(c=>{
              tones.forEach(t=>{
                pool.push(`${a} ${s} to ${g} ${c}. ${t}`);
              });
            });
          });
        });
      });
      buildCoachIdea.pool = pool; // millions of combinations available
    }
    const pool = buildCoachIdea.pool;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function coachReply(message, ctx){
    const lower = message.toLowerCase();
    const header = summarizeContext(ctx);
    const snark = butlerSnark();
    const addSnark = snark ? ` Butler says: ${snark}` : "";
    const poke = pickSarcasm();
    const coachLine = pickCoachLine();
    if(!message.trim()) return `I can be more helpful if you tell me what you need. ${header}`;
    if(["deadline","due","assignment","class","calendar"].some(k=>lower.includes(k))){
      return `${header}  -> Move on the earliest deadline now. ${smartPlan(ctx, message)} ${coachLine} ${addSnark} ${poke}`;
    }
    if(["habit","streak","consistency","routine"].some(k=>lower.includes(k))){
      return `${header}  -> Mark one habit in the next 5 minutes, then a 45/15 block. ${smartPlan(ctx, message)} ${coachLine} ${addSnark} ${poke}`;
    }
    if(["energy","tired","sleep","burnout","motivation"].some(k=>lower.includes(k))){
      return `${header}  -> Micro-reset: water + 90s breathing + 5-min tidy. Then ${smartPlan(ctx, message)} ${coachLine} ${addSnark} ${poke}`;
    }
    if(["voice","widget","email","tab","integration"].some(k=>lower.includes(k))){
      return `${header}  -> Enable one ambient cue (new-tab, widget, or voice shortcut) so the planner follows you. Then ${smartPlan(ctx, message)} ${coachLine} ${addSnark} ${poke}`;
    }
    if(["reflect","journal","review","week"].some(k=>lower.includes(k))){
      return `${header}  -> Write 3 lines: win, friction, next improvement. Then ${smartPlan(ctx, message)} ${coachLine} ${addSnark} ${poke}`;
    }
    return `${header}  -> Here's your next move: ${smartPlan(ctx, message)} ${coachLine} ${addSnark} ${poke}`;
  }

  function upgradeCoach(){
    const form = document.getElementById("chatbot-form");
    const log = document.getElementById("chatbot-messages");
    let suggestBtn = document.getElementById("chatbot-suggest");
    let ideasBtn = document.getElementById("chatbot-ideas");
    if(!form || !log || !suggestBtn) return;
    const newForm = stripEvents(form);
    const newInput = newForm.querySelector("#chatbot-input") || newForm.querySelector("input");
    suggestBtn = stripEvents(suggestBtn);
    ideasBtn = ideasBtn ? stripEvents(ideasBtn) : null;
    if(!newInput) return;
    const appendMessage = (role, text)=>{
      const bubble = document.createElement("div");
      bubble.className = `chatbot-message ${role}`;
      bubble.textContent = text;
      log.appendChild(bubble);
      log.scrollTop = log.scrollHeight;
    };
    const runCoach = (msg)=>{
      const ctx = gatherContext();
      const answer = coachReply(msg, ctx);
      appendMessage("bot", answer);
    };
    const showThinking = ()=>{
      const bubble = document.createElement("div");
      bubble.className = "chatbot-message bot thinking";
      bubble.setAttribute("aria-label","Thinking");
      [1,2,3].forEach(i=>{
        const dot = document.createElement("span");
        dot.className = `dot dot-${i}`;
        dot.setAttribute("aria-hidden","true");
        bubble.appendChild(dot);
      });
      const sr = document.createElement("span");
      sr.className = "sr-only";
      sr.textContent = "Thinking";
      bubble.appendChild(sr);
      log.appendChild(bubble);
      log.scrollTop = log.scrollHeight;
      return ()=> bubble.remove();
    };
    const respondWithDelay = (msg)=>{
      const cleanup = showThinking();
      const delay = 15000; // fixed 15s think time
      setTimeout(()=>{
        cleanup();
        runCoach(msg);
      }, delay);
    };
    newForm.addEventListener("submit", e=>{
      e.preventDefault();
      const msg = newInput.value.trim();
      if(!msg) return;
      appendMessage("user", msg);
      newInput.value = "";
      respondWithDelay(msg);
    });
    suggestBtn.addEventListener("click", ()=>{
      respondWithDelay("daily suggestion");
    });
    if(ideasBtn){
      ideasBtn.addEventListener("click", ()=>{
        const idea = buildCoachIdea();
        newInput.value = idea;
        newInput.focus();
        appendMessage("bot", `Try asking: "${idea}"`);
      });
    }
  }

  function initCoachNudge(){
    const widget = document.getElementById("chatbot-widget");
    const toggle = document.getElementById("chatbot-toggle");
    const panel = document.getElementById("chatbot-panel");
    if(!widget || !toggle) return;
    let nudge = document.getElementById("chatbot-nudge");
    if(!nudge){
      nudge = document.createElement("div");
      nudge.id = "chatbot-nudge";
      nudge.className = "chatbot-nudge";
      widget.insertBefore(nudge, toggle);
    }
    const suggestions = {
      "tab-planner": "Peek at today’s top deadline and run a 45/15.",
      "tab-pomodoro": "Start a 45/15 and mark one habit after.",
      "tab-habits": "Tap a habit now—keep the streak alive.",
      "tab-notes": "Add a 2-sentence summary from your last study block.",
      "tab-workout": "Schedule tomorrow’s session before you forget.",
      "tab-settings": "Turn on notifications so deadlines ping you.",
      "tab-calendar": "Import your .ics to keep Danger Zone accurate.",
      "tab-danger": "Strike a task to blast the boss and earn XP.",
      default: "Ask the coach for a quick plan or habit nudge."
    };
    const setNudge = (tabId)=>{
      const msg = suggestions[tabId] || suggestions.default;
      nudge.textContent = msg;
      nudge.classList.add("show");
    };
    const active = document.querySelector('button[aria-selected="true"]');
    if(active) setNudge(active.id);
    document.querySelectorAll('button[id^="tab-"]').forEach(btn=>{
      btn.addEventListener("click", ()=> setNudge(btn.id));
    });
    toggle.addEventListener("click", ()=> nudge.classList.remove("show"));
    setInterval(()=>{
      if(panel && panel.classList.contains("hidden")){
        nudge.classList.add("show");
      }
    }, 45000);
  }

  window.plannerExtras = window.plannerExtras || {};
  window.plannerExtras.loaded = true;
  ready(()=>{ initMascot(); upgradeCoach(); initCoachNudge(); });

  // -------------------------------
  // Intel + Wins UI
  // -------------------------------

  function injectDailyIntel(host){
    const target = host || document.getElementById("assignments-modal-body") || document.querySelector(".view-controls") || document.querySelector("header");
    if(!target) return;
    if(target.querySelector("#daily-intel-card")) return;
    const card = document.createElement("div");
    card.id = "daily-intel-card";
    card.className = "daily-intel-card";
    card.innerHTML = `
      <div class="daily-intel-head">
        <div>
          <div class="smart-chip">Daily Intel</div>
          <strong>Morning brief</strong>
        </div>
        <button class="btn" id="intel-refresh" type="button">Update</button>
      </div>
      <ul class="intel-list"></ul>
      <div class="note" style="font-size:12px;">Voice shortcut: say “Start focus mission” to jump to Pomodoro.</div>
    `;
    target.append(card);
    card.querySelector("#intel-refresh").addEventListener("click", ()=> renderDailyIntel(card));
    renderDailyIntel(card);
  }

  function renderDailyIntel(scope){
    const root = scope || document.getElementById("daily-intel-card");
    const list = root?.querySelector(".intel-list");
    if(!list) return;
    list.innerHTML = "";
    const ctx = gatherContext();
    const items = [];
    if(ctx.nextDeadlines && ctx.nextDeadlines.length){
      items.push(`${ctx.nextDeadlines.length} deadline(s) incoming: ${ctx.nextDeadlines[0]}`);
    } else if(ctx.tasksToday && ctx.tasksToday.length){
      items.push(`Top class task: ${ctx.tasksToday[0]}`);
    } else {
      items.push("No imported deadlines yet—import your .ics to see intel.");
    }
    if(ctx.habitsProgress) items.push(ctx.habitsProgress);
    items.push(`Mood ${ctx.mood}, Energy ${ctx.energy}`);
    if(ctx.freezeCount) items.push(`Streak Freeze stocked: ${ctx.freezeCount}`);
    if(ctx.storyStage) items.push(`Story stage: ${ctx.storyStage}`);
    items.slice(0,4).forEach(text=>{
      const li = document.createElement("li");
      li.textContent = text;
      list.append(li);
    });
  }

  function initVoiceShortcut(){
    const card = document.getElementById("daily-intel-card");
    const btn = card?.querySelector(".intel-voice-btn");
    const startFocus = ()=>{
      document.getElementById("tab-pomodoro")?.click();
      document.getElementById("tab-pomodoro")?.scrollIntoView({behavior:"smooth"});
    };
    if(btn){
      btn.addEventListener("click", startFocus);
    }
    // Experimental: keyboard shortcut as "voice" stand-in.
    document.addEventListener("keydown", e=>{
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==="p"){
        startFocus();
      }
    });
  }

  function buildWinsReel(){
    const overlay = document.createElement("div");
    overlay.className = "wins-overlay";
    overlay.innerHTML = `
      <div class="wins-card">
        <h3>Weekly Wins Reel</h3>
        <ul class="wins-list"></ul>
        <button class="wins-close" type="button">Close</button>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = overlay.querySelector(".wins-close");
    close.addEventListener("click", ()=> overlay.classList.remove("show"));
    overlay.addEventListener("click", e=>{ if(e.target===overlay) overlay.classList.remove("show"); });
    return overlay;
  }

  function gatherWins(){
    const wins = [];
    const ctx = gatherContext();
    if(ctx.habitsProgress) wins.push(`Habit momentum: ${ctx.habitsProgress}`);
    if(ctx.nextDeadlines && ctx.nextDeadlines.length) wins.push(`You kept pace with ${ctx.nextDeadlines.length} deadline(s).`);
    if(ctx.freezeCount) wins.push(`Freeze shield ready (${ctx.freezeCount})—streak is safe.`);
    const reflections = (document.getElementById("reflection-input")?.value || "").trim();
    if(reflections) wins.push(`Reflection noted: ${reflections.slice(0,120)}${reflections.length>120?"...":""}`);
    const story = ctx.storyStage ? `Story stage: ${ctx.storyStage}` : "";
    if(story) wins.push(story);
    return wins.length ? wins : ["Log a reflection to build your wins reel.", "Complete one habit and one task to unlock more highlights."];
  }

  function initWinsButton(){
    let overlay = document.querySelector(".wins-overlay");
    if(!overlay) overlay = buildWinsReel();
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.type = "button";
    btn.id = "wins-reel-btn";
    btn.textContent = "Show Wins Reel";
    const target = document.getElementById("reflection-card") || document.getElementById("integration-card");
    if(target && !document.getElementById("wins-reel-btn")){
      target.append(btn);
    }
    btn.addEventListener("click", ()=>{
      const list = overlay.querySelector(".wins-list");
      list.innerHTML = "";
      gatherWins().forEach(text=>{
        const li = document.createElement("li");
        li.textContent = text;
        list.append(li);
      });
      overlay.classList.add("show");
    });
  }

  ready(()=>{
    // daily intel is now injected via Assignments modal to keep it scoped
    initVoiceShortcut();
    initWinsButton();
  });

  window.plannerIntel = { injectDailyIntel, renderDailyIntel };

  // -------------------------------
  // Boss Assignments (Outline/Draft/Polish)
  // -------------------------------

  const bossStorageKey = "planner_boss_board";
  const bossPhases = ["Outline","Draft","Polish"];
  const lootPool = [
    "Pixel pup cheers unlocked!",
    "Freeze shield tip: save one before finals week.",
    "Mascot drops a victory sticker for this class.",
    "Quick reward: take a 5-minute victory lap.",
    "XP prompt: add a reflection line about what went well."
  ];

  function loadBossProgress(){
    try{
      const raw = JSON.parse(localStorage.getItem(bossStorageKey));
      return raw && typeof raw === "object" ? raw : {};
    }catch(e){ return {}; }
  }
  function saveBossProgress(data){
    try{ localStorage.setItem(bossStorageKey, JSON.stringify(data||{})); }catch(e){}
  }
  const bossProgress = loadBossProgress();

  function slugify(text=""){
    return text.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"") || "boss";
  }

  function getBigAssignments(limit=3){
    const danger = Array.from(document.querySelectorAll(".danger-item .danger-title")).map(el=>el.textContent.trim());
    const classes = Array.from(document.querySelectorAll(".class-assignment-title")).map(el=>el.textContent.trim());
    const merged = danger.concat(classes).filter(Boolean);
    return merged.slice(0, limit);
  }

  function renderBossBoard(){
    const panel = document.getElementById("assignments-modal-body") || document.getElementById("danger-zone")?.parentElement;
    if(!panel) return;
    let board = panel.querySelector("#boss-board");
    if(!board){
      board = document.createElement("div");
      board.id = "boss-board";
      board.style.marginTop = "12px";
      board.style.padding = "14px";
      board.style.border = "1px solid #e2e8f0";
      board.style.borderRadius = "16px";
      board.style.background = "#fdf2f8";
      board.style.boxShadow = "0 12px 20px rgba(0,0,0,.08)";
      panel.append(board);
    }
    const assignments = getBigAssignments();
    board.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-size:11px;letter-spacing:.08em;font-weight:700;color:#be123c;text-transform:uppercase;">Boss Fights</div>
          <strong>Outline → Draft → Polish</strong>
        </div>
        <button class="btn" id="boss-refresh" type="button">Refresh</button>
      </div>
      <div id="boss-list" style="display:flex;flex-direction:column;gap:10px;margin-top:10px;"></div>
    `;
    board.querySelector("#boss-refresh").addEventListener("click", renderBossBoard);
    const list = board.querySelector("#boss-list");
    if(!assignments.length){
      list.innerHTML = `<div class="note">No big assignments found yet. Import your .ics or add class data.</div>`;
      return;
    }
    assignments.forEach(title=>{
      const id = slugify(title);
      const state = bossProgress[id] || { done: {} };
      const row = document.createElement("div");
      row.style.padding = "10px";
      row.style.borderRadius = "12px";
      row.style.border = "1px solid #f5d0e6";
      row.style.background = "#fff";
      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      header.style.gap = "8px";
      const hTitle = document.createElement("strong");
      hTitle.textContent = title;
      const loot = document.createElement("span");
      loot.style.fontSize = "12px";
      loot.style.color = "#be123c";
      loot.textContent = state.lastLoot ? `Loot: ${state.lastLoot}` : "";
      header.append(hTitle, loot);
      const phasesWrap = document.createElement("div");
      phasesWrap.style.display = "flex";
      phasesWrap.style.gap = "8px";
      bossPhases.forEach(phase=>{
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.type = "button";
        const isDone = !!state.done?.[phase];
        btn.textContent = `${phase}${isDone ? " ✓" : ""}`;
        btn.style.background = isDone ? "#22c55e" : "#ede9fe";
        btn.style.color = isDone ? "#0b1727" : "#6b21a8";
        btn.addEventListener("click",()=>{
          const now = Date.now();
          const updated = bossProgress[id] || { done:{} };
          updated.done = updated.done || {};
          updated.done[phase] = !updated.done[phase];
          updated.lastLoot = updated.done[phase] ? lootPool[Math.floor(Math.random()*lootPool.length)] : "";
          updated.touched = now;
          bossProgress[id] = updated;
          saveBossProgress(bossProgress);
          notifyMascot(title, phase, updated.done[phase]);
          renderBossBoard();
        });
        phasesWrap.append(btn);
      });
      row.append(header, phasesWrap);
      list.append(row);
    });
  }

  function notifyMascot(title, phase, completed){
    const msg = completed
      ? `Pixel pup: ${phase} cleared for "${title}". Keep pushing!`
      : `Undid ${phase} for "${title}". Reset the mission when ready.`;
    if(typeof Notification === "function" && Notification.permission === "granted"){
      try{ new Notification("Boss progress", { body: msg, icon: mascotPng }); }catch(e){}
    }
  }

  window.plannerBoss = { renderBossBoard };

  // -------------------------------
  // Daily Lesson (5-minute win)
  // -------------------------------

  const MINI_KEY = "planner_mini_session_done";

  function isTodayDone(){
    try{
      const val = JSON.parse(localStorage.getItem(MINI_KEY));
      if(!val || !val.date) return false;
      const today = new Date().toDateString();
      return val.date === today && !!val.done;
    }catch(e){ return false; }
  }
  function setTodayDone(){
    try{
      localStorage.setItem(MINI_KEY, JSON.stringify({ date:new Date().toDateString(), done:true }));
    }catch(e){}
  }

  function renderMiniSession(host){
    const panel = host || document.getElementById("assignments-modal-body");
    if(!panel) return;
    let box = panel.querySelector("#mini-session");
    if(!box){
      box = document.createElement("div");
      box.id = "mini-session";
      box.className = "mini-session";
      panel.append(box);
    }
    const done = isTodayDone();
    const stepsHtml = `
      <ul class="mini-steps">
        <li>Review 1 assignment</li>
        <li>Do 1 Pomodoro</li>
        <li>Log mood</li>
      </ul>
    `;
    const status = done ? `<div class="mini-done">✅ Mini-session complete! +10 XP</div>` : "";
    box.innerHTML = `
      <div class="mini-head">
        <div>
          <div class="smart-chip">Today's 5-minute win</div>
          <strong>Daily lesson</strong>
        </div>
        <button class="btn" id="mini-start" type="button">${done ? "Done" : "Start mini-session"}</button>
      </div>
      ${stepsHtml}
      ${status}
    `;
    const btn = box.querySelector("#mini-start");
    if(btn){
      btn.disabled = done;
      btn.addEventListener("click", runMiniSession);
    }
  }

  function runMiniSession(){
    const steps = [
      ()=> { document.getElementById("focus-today")?.click(); document.getElementById("panel-planner")?.scrollIntoView({behavior:"smooth"}); },
      ()=> { document.getElementById("tab-pomodoro")?.click(); },
      ()=> { document.getElementById("tab-planner")?.click(); document.getElementById("mood-select")?.focus(); }
    ];
    let idx = 0;
    const next = ()=>{
      if(idx >= steps.length){
        completeMiniSession();
        return;
      }
      steps[idx++]();
      setTimeout(next, 600);
    };
    next();
  }

  function completeMiniSession(){
    setTodayDone();
    renderMiniSession(document.getElementById("assignments-modal-body"));
    if(typeof window.addXP === "function"){
      try{ window.addXP(10); }catch(e){}
    }
    if(typeof Notification === "function" && Notification.permission === "granted"){
      try{ new Notification("Mini-session complete!", { body:"+10 XP. Keep the streak alive.", icon: mascotPng }); }catch(e){}
    }
    toastMini("Mini-session complete! +10 XP");
  }

  function toastMini(msg){
    const toast = document.getElementById("toast");
    if(!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(()=>toast.classList.remove("show"), 1200);
  }

  window.plannerMini = { renderMiniSession };

  // -------------------------------
  // Subject Tracks (Duolingo-style)
  // -------------------------------

  const TRACK_KEY = "planner_subject_tracks";
  function loadTracks(){
    try{
      const raw = JSON.parse(localStorage.getItem(TRACK_KEY));
      return raw && typeof raw === "object" ? raw : {};
    }catch(e){ return {}; }
  }
  function saveTracks(data){
    try{ localStorage.setItem(TRACK_KEY, JSON.stringify(data||{})); }catch(e){}
  }
  const trackState = loadTracks();

  function getCoursesForTracks(){
    try{
      const data = localStorage.getItem("planner-calendar-events");
      const events = data ? JSON.parse(data) : [];
      const courses = {};
      events.forEach(ev=>{
        if(!ev?.title) return;
        const title = String(ev.title);
        const weekMatch = title.match(/week\s*(\d+)/i);
        const week = weekMatch ? Number(weekMatch[1]) : null;
        const codeMatch = title.match(/\[(.*?)\]/);
        const courseId = codeMatch ? codeMatch[1].split(" ").slice(1).join(" ").trim() || codeMatch[1] : "Course";
        if(!courses[courseId]) courses[courseId] = new Set();
        if(week) courses[courseId].add(week);
      });
      return Object.entries(courses).map(([id, weeksSet])=>{
        const weeks = Array.from(weeksSet).filter(Number.isFinite).sort((a,b)=>a-b);
        if(!weeks.length) weeks.push(1,2,3);
        return { id, weeks };
      });
    }catch(e){
      return [];
    }
  }

  function renderTracks(){
    const holder = document.createElement("div");
    holder.id = "track-wrapper";
    const courses = getCoursesForTracks();
    if(!courses.length){
      holder.innerHTML = `<div class="note">Import your .ics to see course tracks.</div>`;
      return holder;
    }
    courses.forEach(course=>{
      const card = document.createElement("div");
      card.className = "track-card";
      const head = document.createElement("div");
      head.className = "track-title";
      const title = document.createElement("strong");
      title.textContent = course.id;
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "btn";
      reset.textContent = "Reset track";
      reset.addEventListener("click",()=>{
        delete trackState[course.id];
        saveTracks(trackState);
        renderClassTracks();
      });
      head.append(title, reset);
      card.append(head);
      const nodes = document.createElement("div");
      nodes.className = "track-nodes";
      course.weeks.forEach(week=>{
        const node = document.createElement("div");
        node.className = "track-node";
        const label = document.createElement("strong");
        label.textContent = `Week ${week}`;
        node.append(label);
        const dots = document.createElement("div");
        dots.className = "track-dots";
        const level = trackState[course.id]?.[week] || 0;
        for(let i=1;i<=3;i++){
          const dot = document.createElement("span");
          dot.className = `track-dot${i<=level?" on":""}`;
          dot.title = i===1 ? "Skimmed" : i===2 ? "Took notes" : "Practice/Lab";
          dot.addEventListener("click",()=>{
            if(!trackState[course.id]) trackState[course.id] = {};
            trackState[course.id][week] = i;
            saveTracks(trackState);
            renderClassTracks();
          });
          dots.append(dot);
        }
        node.append(dots);
        nodes.append(node);
      });
      card.append(nodes);
      holder.append(card);
    });
    return holder;
  }

  function renderClassTracks(){
    // Tracks UI removed per request; keep this to clean up any old wrapper.
    const existing = document.getElementById("track-wrapper");
    if(existing) existing.remove();
  }

  // Track UI disabled.
  document.getElementById("tab-pomodoro")?.removeEventListener("click", renderClassTracks);

  // -------------------------------
  // "Tomorrow is Ready" Checklist
  // -------------------------------

  const PREP_KEY = "planner_prep_tomorrow";

  function loadPrep(){
    try{
      const raw = JSON.parse(localStorage.getItem(PREP_KEY));
      if(raw && raw.date === new Date().toDateString()) return raw;
    }catch(e){}
    return { date: new Date().toDateString(), items: { priorities:false, blocks:false, pomodoro:false, mood:false } };
  }
  function savePrep(state){
    try{ localStorage.setItem(PREP_KEY, JSON.stringify(state)); }catch(e){}
  }

  let prepState = loadPrep();

  function renderPrepCard(){
    const panel = document.getElementById("assignments-modal-body");
    if(!panel) return;
    const existing = panel.querySelector("#prep-card");
    if(existing) existing.remove();
    const now = new Date();
    if(now.getHours() < 20) return; // show only after 8pm
    const card = document.createElement("div");
    card.id = "prep-card";
    card.className = "prep-card";
    const doneAll = Object.values(prepState.items).every(Boolean);
    card.innerHTML = `
      <div class="prep-head">
        <div>
          <div class="smart-chip">Prep for Tomorrow</div>
          <strong>Nightly checklist</strong>
        </div>
        <button class="btn" id="prep-reset" type="button">Reset</button>
      </div>
      <div class="prep-list">
        ${renderPrepItem("priorities","Pick 1-3 top priorities for tomorrow", prepState.items.priorities)}
        ${renderPrepItem("blocks","Assign them to time blocks", prepState.items.blocks)}
        ${renderPrepItem("pomodoro","Choose tomorrow's first Pomodoro task", prepState.items.pomodoro)}
        ${renderPrepItem("mood","Pick a mood intention (calm / focused / playful)", prepState.items.mood)}
      </div>
      ${doneAll ? `<div class="prep-done">🌙 Tomorrow is ready. Future you says thanks.</div>` : `<div class="prep-note">Finish the checklist to lock in tomorrow's plan.</div>`}
    `;
    panel.append(card);
    card.querySelector("#prep-reset").addEventListener("click", ()=>{
      prepState = { date:new Date().toDateString(), items:{ priorities:false, blocks:false, pomodoro:false, mood:false } };
      savePrep(prepState);
      renderPrepCard();
    });
    card.querySelectorAll("input[data-prep]").forEach(box=>{
      box.addEventListener("change",()=>{
        const key = box.dataset.prep;
        prepState.items[key] = box.checked;
        prepState.date = new Date().toDateString();
        savePrep(prepState);
        renderPrepCard();
      });
    });
  }

  function renderPrepItem(key, label, checked){
    return `
      <label class="prep-item">
        <input type="checkbox" data-prep="${key}" ${checked?"checked":""}>
        <span>${label}</span>
      </label>
    `;
  }

  ready(()=> renderPrepCard());

  // -------------------------------
  // Gremlin + Time Ghosts
  // -------------------------------

  // Gremlin removed
// Time Ghosts of unfinished tasks
  function getGhostTasks(limit=500){
    try{
      const raw = JSON.parse(localStorage.getItem("planner-calendar-events")||"[]");
      const now = Date.now();
      const ghosts = raw.filter(ev=>{
        if(!ev?.start) return false;
        const due = new Date(ev.start).getTime();
        return !isNaN(due) && due < (now - 86400000);
      }).slice(0, limit);
      return ghosts;
    }catch(e){
      return [];
    }
  }

  function initGhostDrag(ghost){
    const handle = ghost.querySelector(".ghost-head");
    if(!handle) return ()=>{};
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let width = 0;
    let height = 0;
    let pointerId = null;
    const clamp = (val, min, max)=> Math.min(Math.max(val, min), max);

    const onPointerDown = (e)=>{
      if(e.button !== 0) return;
      if(e.target.closest("button, a")) return;
      dragging = true;
      const rect = ghost.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      width = rect.width;
      height = rect.height;
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.right = "auto";
      ghost.style.bottom = "auto";
      ghost.classList.add("dragging");
      if(typeof handle.setPointerCapture === "function"){
        handle.setPointerCapture(pointerId);
      }
      e.preventDefault();
    };

    const onPointerMove = (e)=>{
      if(!dragging) return;
      const pad = 8;
      const maxX = Math.max(pad, window.innerWidth - width - pad);
      const maxY = Math.max(pad, window.innerHeight - height - pad);
      const nextX = clamp(originX + (e.clientX - startX), pad, maxX);
      const nextY = clamp(originY + (e.clientY - startY), pad, maxY);
      ghost.style.left = `${nextX}px`;
      ghost.style.top = `${nextY}px`;
    };

    const onPointerUp = ()=>{
      if(!dragging) return;
      dragging = false;
      ghost.classList.remove("dragging");
      if(pointerId !== null && typeof handle.releasePointerCapture === "function"){
        try{
          handle.releasePointerCapture(pointerId);
        }catch(err){}
      }
      pointerId = null;
    };

    handle.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return ()=>{
      handle.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }

  function renderGhosts(){
    document.querySelectorAll(".floating-ghost").forEach(el=>el.remove());
    const rows = Array.from(document.querySelectorAll(".danger-item"));
    const pending = rows
      .filter(row=>{
        const btn = row.querySelector(".danger-done-btn");
        return btn && btn.textContent.toLowerCase().includes("strike");
      })
      .map(row=> row.querySelector(".danger-title")?.textContent?.trim())
      .filter(Boolean);
    if(!pending.length) return;
    const ghost = document.createElement("div");
    ghost.className = "floating-ghost";
    ghost.style.top = `${10 + Math.random()*70}vh`;
    ghost.style.left = `${5 + Math.random()*70}vw`;
    const list = pending.slice(0,6).map(item=>`<li>${item}</li>`).join("");
    ghost.innerHTML = `
      <div class="ghost-head">
        <div class="ghost-head-text">👻 Unfinished missions</div>
        <button class="ghost-close" aria-label="Dismiss unfinished missions">✕</button>
      </div>
      <div class="ghost-body">
        <ul>${list}</ul>
        ${pending.length>6 ? `<div class="ghost-more">+${pending.length-6} more</div>` : ""}
        <a href="#" class="ghost-danger-link" aria-label="Open Danger View">Open Danger View</a>
      </div>
    `;
    document.body.appendChild(ghost);
    const removeDrag = initGhostDrag(ghost);
    const dangerLink = ghost.querySelector(".ghost-danger-link");
    const closeBtn = ghost.querySelector(".ghost-close");
    const cleanup = ()=>{
      removeDrag();
      if(ghost.parentElement) ghost.remove();
    };
    dangerLink?.addEventListener("click", (e)=>{
      e.preventDefault();
      const dangerTab = document.getElementById("tab-danger");
      dangerTab?.click();
      cleanup();
    });
    closeBtn?.addEventListener("click", (e)=>{
      e.preventDefault();
      cleanup();
    });
    setTimeout(cleanup, 45000);
  }

  ready(()=>{
    
    renderGhosts();
  });

  window.renderGhosts = renderGhosts;
})();







