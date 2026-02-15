(function initPomoPostFlow(){
  const BREAK_CHOICES = [
    "10 jumping jacks",
    "5-minute stretch (neck/shoulders/wrists)",
    "Wall sit 45s",
    "Calf raises x20",
    "Hip flexor stretch",
    "10 slow air squats",
    "Plank 30-45s",
    "Box breathing 10 cycles"
  ];
  const REFLECT_KEY = "planner_pomo_reflections";
  const CHECKPOINT_KEY = "planner_pomo_self_explain";
  let flowActive = false;
  let reordering = false;
  let layoutPending = false;
  let suppressLayout = false;
  let reflectDebounce = null;

  function injectStyles(){
    if(document.getElementById("pomo-flow-styles")) return;
    const style = document.createElement("style");
    style.id = "pomo-flow-styles";
    style.textContent = `
      #pomo-flow-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:9999;}
      .pomo-flow-modal{background:#0f172a;color:#e5e7eb;border-radius:14px;padding:16px;max-width:520px;width:92%;box-shadow:0 20px 50px rgba(0,0,0,.45);border:1px solid #1f2937;}
      .pomo-flow-steps{display:flex;gap:6px;margin-bottom:10px;}
      .pomo-flow-step{flex:1;height:30px;border-radius:999px;background:#1f2937;position:relative;overflow:hidden;}
      .pomo-flow-step.on::after{content:"";position:absolute;inset:0;background:#22c55e;}
      .pomo-flow-section{display:none;gap:8px;flex-direction:column;}
      .pomo-flow-section.active{display:flex;}
      .pomo-flow-actions{display:flex;justify-content:space-between;gap:8px;margin-top:12px;}
      .pomo-flow-btn{padding:8px 12px;border-radius:10px;border:1px solid #334155;background:#111827;color:inherit;cursor:pointer;}
      .pomo-flow-btn.primary{background:#22c55e;color:#0b1a12;border-color:#16a34a;}
      .pomo-flow-btn.ghost{background:transparent;}
      .pomo-flow-breaks{display:flex;flex-wrap:wrap;gap:8px;}
      .pomo-flow-chip{border:1px solid #334155;border-radius:999px;padding:6px 10px;cursor:pointer;background:#111827;}
      .pomo-flow-chip.sel{border-color:#22c55e;background:#0f2a1c;}
      .pomo-flow-error{color:#f87171;font-size:12px;min-height:14px;}
      #pomo-reflection-card{border:1px solid var(--border,#2d2d2d);border-radius:12px;padding:12px;margin-top:12px;background:rgba(255,255,255,0.02);}
      #pomo-reflection-card textarea{width:100%;min-height:80px;border-radius:10px;border:1px solid var(--border,#2d2d2d);background:#0f172a;color:inherit;padding:8px;}
      #pomo-reflection-card button{margin-top:6px;}
      .pomo-flow-section h3{margin:0;font-size:16px;color:#e5e7eb;}
      .pomo-flow-desc{font-size:12px;color:#9ca3af;margin:2px 0 6px;}
      .pomo-flow-field{display:flex;flex-direction:column;gap:4px;}
      .pomo-flow-input, .pomo-flow-textarea{
        width:100%;
        max-width:100%;
        min-width:0;
        padding:10px 12px;
        border-radius:12px;
        border:1px solid #334155;
        background:#0b1220;
        color:#e5e7eb;
        font-size:13px;
        box-sizing:border-box;
      }
      .pomo-flow-input:focus, .pomo-flow-textarea:focus{outline:2px solid #22c55e;border-color:#22c55e;}
      .pomo-flow-textarea{min-height:90px;resize:vertical;}
      #pomo-flow-overlay textarea, #pomo-flow-overlay input{box-sizing:border-box;max-width:100%;}
    `;
    document.head.append(style);
  }

  function addQuickNote(text){
    if(!text) return;
    try{
      const key = "planner_pomo_quick_notes";
      const raw = JSON.parse(localStorage.getItem(key)) || { scratch:"", entries:[] };
      const list = Array.isArray(raw.entries) ? raw.entries : [];
      raw.entries = [text, ...list].slice(0,50);
      localStorage.setItem(key, JSON.stringify(raw));
      window.dispatchEvent(new CustomEvent("pomoQuickNoteAdded",{ detail:{ text, ts: Date.now() } }));
    }catch(e){}
  }

  function saveReflection(text){
    try{
      const raw = JSON.parse(localStorage.getItem(REFLECT_KEY)) || [];
      const trimmed = (text || "").trim();
      if(!trimmed) return raw;
      raw.unshift({ ts: Date.now(), text: trimmed });
      const next = raw.slice(0,50);
      localStorage.setItem(REFLECT_KEY, JSON.stringify(next));
      renderReflectionLog(next);
      return next;
    }catch(e){}
    return [];
  }

  function saveCheckpoint(entry){
    try{
      const raw = JSON.parse(localStorage.getItem(CHECKPOINT_KEY)) || [];
      raw.unshift(entry);
      const next = raw.slice(0, 30);
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(next));
      return next;
    }catch(e){}
    return [];
  }

  function reorderPomodoroAside(){
    if(suppressLayout) return;
    const aside = document.querySelector("#panel-pomodoro .pomo-side");
    if(!aside) return;
    const breakIdeasCard = aside.querySelector(".pomo-side-card");
    const goalsCard = document.getElementById("pomo-goals-card");
    const questsCard = document.getElementById("pomo-challenges");
    const logCard = document.getElementById("pomo-log-card");
    const quickCard = document.getElementById("pomo-quick-card");
    const analytics = document.getElementById("pomo-analytics");
    const reflection = document.getElementById("pomo-reflection-card");
    const breakCard = document.getElementById("pomo-break-card");
    const studyStreak = document.getElementById("pomo-study-streak");
    const focusStreak = document.getElementById("pomo-streak-card");
    const planCard = document.getElementById("pomo-plan-card");
    const themeCard = document.getElementById("pomo-theme-card");
    [breakCard, studyStreak, focusStreak, planCard].forEach(card=>{
      if(card && !card.classList.contains("pomo-side-card")) card.classList.add("pomo-side-card");
    });
    const ordered = [
      breakIdeasCard,
      goalsCard,
      questsCard,
      logCard,
      reflection,
      breakCard,
      quickCard,
      studyStreak,
      focusStreak,
      planCard,
      analytics,
      themeCard
    ].filter(Boolean);
    if(!ordered.length) return;
    const current = Array.from(aside.children).filter(el=> ordered.includes(el));
    const sameOrder = current.length === ordered.length && current.every((el, idx)=> el === ordered[idx]);
    if(sameOrder) return;
    suppressLayout = true;
    reordering = true;
    ordered.forEach(card=> aside.append(card));
    reordering = false;
    suppressLayout = false;
  }

  function moveShortcutsCard(){
    const matches = Array.from(document.querySelectorAll(".pomo-side-card h3")).filter(h=> /Shortcuts/i.test(h.textContent||""));
    if(!matches.length) return;
    const keepCard = matches[0]?.closest(".pomo-side-card");
    matches.slice(1).forEach(h=> h.closest(".pomo-side-card")?.remove());
    const laundry = document.getElementById("laundry-shell");
    const parent = laundry?.parentElement;
    if(keepCard && parent && keepCard.parentElement !== parent){
      parent.insertBefore(keepCard, laundry.nextSibling);
    }
  }

  function loadReflections(){
    try{
      const raw = JSON.parse(localStorage.getItem(REFLECT_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){}
    return [];
  }

  function renderReflectionLog(list){
    const logEl = document.getElementById("pomo-reflection-log");
    const entries = Array.isArray(list) ? list : loadReflections();
    if(!logEl) return;
    if(!entries.length){
      logEl.innerHTML = `<div class="note" style="font-size:12px;">No reflections logged yet.</div>`;
      return;
    }
    logEl.innerHTML = entries.slice(0,6).map(entry=>{
      const when = entry.ts ? new Date(entry.ts).toLocaleString() : "";
      return `<div class="note" style="padding:6px 8px;border-radius:10px;border:1px solid #2d343c;background:rgba(255,255,255,.03);color:#e5e7eb;"><small style="display:block;color:#9ca3af;">${when}</small>${entry.text}</div>`;
    }).join("");
  }

  function ensureReflectionCard(){
    const aside = document.querySelector("#panel-pomodoro .pomo-side");
    if(!aside) return;
    let card = document.getElementById("pomo-reflection-card");
    if(card) return card;
    card = document.createElement("div");
    card.id = "pomo-reflection-card";
    card.className = "pomo-side-card";
    card.innerHTML = `
      <h3 style="margin-top:0;">Session reflection</h3>
      <textarea id="pomo-reflection-text" placeholder="How did that session go? What to adjust next?"></textarea>
      <div class="note" style="font-size:12px;margin-top:4px;">Required after each session in the post-flow. Reflections auto-save.</div>
      <div id="pomo-reflection-log" style="margin-top:8px;display:grid;gap:6px;"></div>
    `;
    aside.append(card);
    const input = card.querySelector("#pomo-reflection-text");
    if(input){
      input.addEventListener("input", ()=>{
        clearTimeout(reflectDebounce);
        reflectDebounce = setTimeout(()=> saveReflection(input.value), 500);
      });
      input.addEventListener("blur", ()=> saveReflection(input.value));
    }
    renderReflectionLog();
    return card;
  }

  function openFlow(detail){
    if(flowActive) return;
    flowActive = true;
    window.__pomoFlowActive = true;
    injectStyles();
    ensureReflectionCard();
    document.getElementById("explain-card")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "pomo-flow-overlay";
    const modal = document.createElement("div");
    modal.className = "pomo-flow-modal";
    const stepsBar = document.createElement("div");
    stepsBar.className = "pomo-flow-steps";
    const errors = document.createElement("div");
    errors.className = "pomo-flow-error";

    const state = {
      breakTaken: null,
      breakPick: "",
      breakNote: "",
      goals: "",
      quests: "",
      activity: "",
      reflection: "",
      quick: "",
      topic: "",
      learned: "",
      fuzzy: ""
    };

    const sections = [];
    const stepEls = [];
    ["Break ideas","Goals & planning","Daily/weekly quests","Log activity","Session reflection","Active break","Quick notes","Self explain"].forEach(()=> {
      const step = document.createElement("div");
      step.className = "pomo-flow-step";
      stepsBar.append(step);
      stepEls.push(step);
    });

    function setStep(idx){
      sections.forEach((sec,i)=> sec.classList.toggle("active", i===idx));
      stepEls.forEach((step,i)=> step.classList.toggle("on", i<=idx));
      errors.textContent = "";
    }

    // Step 0: break check
    const breakSection = document.createElement("div");
    breakSection.className = "pomo-flow-section active";
    breakSection.innerHTML = `
      <h3 style="margin:0;">Did you take a break?</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="pomo-flow-btn ghost" data-break-answer="yes">Yes</button>
        <button type="button" class="pomo-flow-btn ghost" data-break-answer="no">No</button>
      </div>
      <div id="pomo-flow-break-picker" style="display:none;flex-direction:column;gap:8px;margin-top:6px;">
        <div class="pomo-flow-breaks"></div>
        <textarea id="pomo-flow-break-note" rows="2" placeholder="What did you do on your break?" style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:inherit;"></textarea>
      </div>
    `;
    const picker = breakSection.querySelector("#pomo-flow-break-picker");
    const chipWrap = breakSection.querySelector(".pomo-flow-breaks");
    BREAK_CHOICES.forEach(txt=>{
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "pomo-flow-chip";
      chip.textContent = txt;
      chip.addEventListener("click", ()=>{
        state.breakPick = txt;
        chipWrap.querySelectorAll(".pomo-flow-chip").forEach(c=> c.classList.remove("sel"));
        chip.classList.add("sel");
      });
      chipWrap.append(chip);
    });
    breakSection.querySelectorAll("[data-break-answer]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const answer = btn.getAttribute("data-break-answer");
        state.breakTaken = answer === "yes";
        picker.style.display = state.breakTaken ? "flex" : "none";
      });
    });

    // Step 1: goals
    const goalsSection = document.createElement("div");
    goalsSection.className = "pomo-flow-section";
    goalsSection.innerHTML = `
      <h3 style="margin:0;">Goals & planning</h3>
      <textarea id="pomo-flow-goals" rows="2" placeholder="Daily/weekly targets or mini-plan for next cycles..." style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:inherit;"></textarea>
    `;

    // Step 2: quests
    const questSection = document.createElement("div");
    questSection.className = "pomo-flow-section";
    questSection.innerHTML = `
      <h3 style="margin:0;">Daily/weekly quests</h3>
      <textarea id="pomo-flow-quests" rows="2" placeholder="Which quest are you chasing? Mark progress or pick one." style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:inherit;"></textarea>
    `;

    // Step 3: activity log
    const logSection = document.createElement("div");
    logSection.className = "pomo-flow-section";
    logSection.innerHTML = `
      <h3 style="margin:0;">What did you work on?</h3>
      <textarea id="pomo-flow-activity" rows="3" placeholder="Describe the focus session output..." style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:inherit;"></textarea>
    `;

    // Step 4: reflection
    const reflectionSection = document.createElement("div");
    reflectionSection.className = "pomo-flow-section";
    reflectionSection.innerHTML = `
      <h3 style="margin:0;">Session reflection</h3>
      <textarea id="pomo-flow-reflection" rows="3" placeholder="Wins, struggles, adjustments for next round..." style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:inherit;"></textarea>
    `;

    // Step 5: active break confirm
    const activeBreakSection = document.createElement("div");
    activeBreakSection.className = "pomo-flow-section";
    activeBreakSection.innerHTML = `
      <h3 style="margin:0;">Log your active break</h3>
      <p class="note" style="margin:0;">Confirm the break you took (or pick one) so it’s logged.</p>
      <div class="pomo-flow-breaks"></div>
      <textarea id="pomo-flow-active-note" rows="2" placeholder="Add any detail about the break you’ll log..." style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:inherit;"></textarea>
    `;
    const activeBreakChips = activeBreakSection.querySelector(".pomo-flow-breaks");
    BREAK_CHOICES.forEach(txt=>{
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "pomo-flow-chip";
      chip.textContent = txt;
      chip.addEventListener("click", ()=>{
        state.breakPick = txt;
        [activeBreakChips, chipWrap].forEach(wrap=>{
          wrap?.querySelectorAll(".pomo-flow-chip").forEach(c=> c.classList.remove("sel"));
        });
        chip.classList.add("sel");
      });
      activeBreakChips.append(chip);
    });

    // Step 6: quick note
    const notesSection = document.createElement("div");
    notesSection.className = "pomo-flow-section";
    notesSection.innerHTML = `
      <h3 style="margin:0;">Quick note</h3>
      <textarea id="pomo-flow-note" rows="3" placeholder="Capture any stray thought or reminder..." style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:inherit;"></textarea>
    `;

    // Step 7: self-explain checkpoint
    const checkpointSection = document.createElement("div");
    checkpointSection.className = "pomo-flow-section";
    checkpointSection.innerHTML = `
      <h3>Self-explain checkpoint</h3>
      <p class="pomo-flow-desc">Lock in what you learned and what still needs clarity.</p>
      <div class="pomo-flow-field">
        <label class="pomo-flow-desc" for="pomo-flow-topic">Topic (optional)</label>
        <input id="pomo-flow-topic" class="pomo-flow-input" placeholder="e.g., Chain rule practice set">
      </div>
      <div class="pomo-flow-field">
        <label class="pomo-flow-desc" for="pomo-flow-learned">What did you just learn?</label>
        <textarea id="pomo-flow-learned" class="pomo-flow-textarea" placeholder="Explain the concept in your own words..."></textarea>
      </div>
      <div class="pomo-flow-field">
        <label class="pomo-flow-desc" for="pomo-flow-fuzzy">What still feels fuzzy?</label>
        <textarea id="pomo-flow-fuzzy" class="pomo-flow-textarea" placeholder="List gaps, confusions, or next reps you need..."></textarea>
      </div>
    `;

    sections.push(breakSection, goalsSection, questSection, logSection, reflectionSection, activeBreakSection, notesSection, checkpointSection);

    const controls = document.createElement("div");
    controls.className = "pomo-flow-actions";
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "pomo-flow-btn ghost";
    backBtn.textContent = "Back";
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "pomo-flow-btn primary";
    nextBtn.textContent = "Next";
    controls.append(backBtn, nextBtn);

    function validate(stepIdx){
      errors.textContent = "";
      if(stepIdx === 0){
        if(state.breakTaken === null){
          errors.textContent = "Pick Yes or No.";
          return false;
        }
        if(state.breakTaken){
          state.breakNote = (breakSection.querySelector("#pomo-flow-break-note")?.value || "").trim();
          if(!state.breakPick){
            errors.textContent = "Select a break you took.";
            return false;
          }
          if(!state.breakNote){
            errors.textContent = "Describe your break.";
            return false;
          }
        }
      } else if(stepIdx === 1){
        state.goals = (goalsSection.querySelector("#pomo-flow-goals")?.value || "").trim();
        if(!state.goals){
          errors.textContent = "Write your goal or plan.";
          return false;
        }
      } else if(stepIdx === 2){
        state.quests = (questSection.querySelector("#pomo-flow-quests")?.value || "").trim();
        if(!state.quests){
          errors.textContent = "Note a quest you’re targeting.";
          return false;
        }
      } else if(stepIdx === 3){
        state.activity = (logSection.querySelector("#pomo-flow-activity")?.value || "").trim();
        if(!state.activity){
          errors.textContent = "Log what you actually did.";
          return false;
        }
      } else if(stepIdx === 4){
        state.reflection = (reflectionSection.querySelector("#pomo-flow-reflection")?.value || "").trim();
        if(!state.reflection){
          errors.textContent = "Add a short reflection.";
          return false;
        }
      } else if(stepIdx === 5){
        state.breakNote = (activeBreakSection.querySelector("#pomo-flow-active-note")?.value || "").trim();
        if(!state.breakPick){
          errors.textContent = "Pick the break you’ll log.";
          return false;
        }
        if(!state.breakNote){
          errors.textContent = "Add a quick note about the break.";
          return false;
        }
      } else if(stepIdx === 6){
        state.quick = (notesSection.querySelector("#pomo-flow-note")?.value || "").trim();
        if(!state.quick){
          errors.textContent = "Add a quick note.";
          return false;
        }
      } else if(stepIdx === 7){
        state.topic = (checkpointSection.querySelector("#pomo-flow-topic")?.value || "").trim();
        state.learned = (checkpointSection.querySelector("#pomo-flow-learned")?.value || "").trim();
        state.fuzzy = (checkpointSection.querySelector("#pomo-flow-fuzzy")?.value || "").trim();
        if(!state.learned){
          errors.textContent = "Write what you learned.";
          return false;
        }
        if(!state.fuzzy){
          errors.textContent = "Note what’s still fuzzy.";
          return false;
        }
      }
      return true;
    }

    let stepIdx = 0;
    function go(delta){
      const next = stepIdx + delta;
      if(next < 0 || next >= sections.length) return;
      if(delta > 0 && !validate(stepIdx)) return;
      stepIdx = next;
      nextBtn.textContent = stepIdx === sections.length-1 ? "Finish" : "Next";
      setStep(stepIdx);
    }

    backBtn.addEventListener("click", ()=> go(-1));
    nextBtn.addEventListener("click", ()=>{
      if(!validate(stepIdx)) return;
      if(stepIdx === sections.length-1){
        finalize();
      } else {
        go(1);
      }
    });

    function finalize(){
      const checkpointTs = Date.now();
      if(typeof window.__pomoLogBreakMove === "function"){
        window.__pomoLogBreakMove(state.breakPick || BREAK_CHOICES[0], state.breakNote || state.quick || "Break logged");
      }
      addQuickNote(state.goals);
      addQuickNote(state.quests);
      if(typeof window.__pomoLogSave === "function"){
        window.__pomoLogSave(state.activity);
      }
      saveReflection(state.reflection);
      addQuickNote(state.quick);
      saveCheckpoint({
        ts: checkpointTs,
        topic: state.topic || "",
        learned: state.learned,
        fuzzy: state.fuzzy
      });
      try{
        window.dispatchEvent(new CustomEvent("pomoCheckpointSaved",{ detail:{
          ts: checkpointTs,
          topic: state.topic || "",
          learned: state.learned,
          fuzzy: state.fuzzy
        }}));
      }catch(e){}
      try{
        const refInput = document.getElementById("pomo-reflection-text");
        if(refInput) refInput.value = state.reflection;
        renderReflectionLog();
      }catch(e){}
      close();
    }

    function close(){
      flowActive = false;
      window.__pomoFlowActive = false;
      overlay.remove();
    }

    modal.append(
      stepsBar,
      breakSection,
      goalsSection,
      questSection,
      logSection,
      reflectionSection,
      activeBreakSection,
      notesSection,
      checkpointSection,
      errors,
      controls
    );
    overlay.append(modal);
    document.body.append(overlay);
    setStep(0);
  }

  function setupLayoutWatcher(){
    const aside = document.querySelector("#panel-pomodoro .pomo-side");
    if(!aside) return;
    const obs = new MutationObserver(()=>{
      if(suppressLayout || reordering) return;
      if(layoutPending) return;
      layoutPending = true;
      requestAnimationFrame(()=>{
        layoutPending = false;
        reorderPomodoroAside();
      });
    });
    obs.observe(aside, { childList:true });
    reorderPomodoroAside();
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    injectStyles();
    ensureReflectionCard();
    renderReflectionLog();
    setupLayoutWatcher();
    moveShortcutsCard();
  });
  window.addEventListener("pomoCycleFinished", e=>{
    window.__pomoFlowActive = true;
    openFlow(e?.detail);
  });
  window.addEventListener("pomoQuickNoteAdded", reorderPomodoroAside);
})();
