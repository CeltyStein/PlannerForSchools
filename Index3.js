(function(){
  // Cold Start Check-in (pre-test before studying)
  const PRETEST_KEY = "planner_pretest_entries";

  function loadPretests(){
    try{
      const raw = JSON.parse(localStorage.getItem(PRETEST_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function savePretests(list){
    try{ localStorage.setItem(PRETEST_KEY, JSON.stringify(list||[])); }catch(e){}
  }

  function renderPretestCard(host){
    const anchor = host || document.getElementById("assignments-modal-body");
    if(!anchor) return;
    let card = anchor.querySelector("#pretest-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "pretest-card";
    card.style.marginTop = "12px";
    card.style.padding = "12px";
    card.style.borderRadius = "14px";
    card.style.border = "1px solid #e2e8f0";
    card.style.background = "#fff";
    card.style.boxShadow = "0 10px 18px rgba(0,0,0,.08)";

    const entries = loadPretests();
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div>
          <div class="smart-chip">Cold Start Check-in</div>
          <strong>Pre-test before studying</strong>
        </div>
        <button class="btn" id="pretest-save" type="button">Save pre-test</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:8px;">
        <input id="pretest-topic" type="text" placeholder="Topic (e.g., CIS-601 – PQC Week 12)" style="padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;">
        <textarea id="pretest-know" placeholder="One thing you think you know" style="padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;min-height:60px;"></textarea>
        <textarea id="pretest-main" placeholder="What you think the main idea will be" style="padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;min-height:60px;"></textarea>
        <textarea id="pretest-define" placeholder="Define a key term (best guess)" style="padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;min-height:60px;"></textarea>
      </div>
      <div style="margin-top:10px;">
        <div><strong>Recent check-ins</strong></div>
        <div id="pretest-list" style="display:flex;flex-direction:column;gap:8px;margin-top:6px;"></div>
      </div>
    `;
    anchor.append(card);
    card.querySelector("#pretest-save").addEventListener("click", saveEntry);
    renderPretestList(entries);
  }

  function saveEntry(){
    const topic = document.getElementById("pretest-topic")?.value.trim() || "";
    const know = document.getElementById("pretest-know")?.value.trim() || "";
    const main = document.getElementById("pretest-main")?.value.trim() || "";
    const def = document.getElementById("pretest-define")?.value.trim() || "";
    if(!topic || !know || !main || !def){
      toast("Fill all pre-test prompts first.");
      return;
    }
    const list = loadPretests();
    list.unshift({
      id: `${topic}-${Date.now()}`,
      topic,
      know,
      main,
      def,
      created: Date.now(),
      post: ""
    });
    savePretests(list);
    clearInputs();
    renderPretestList(list);
    toast("Pre-test saved. Study, then log what you learned.");
  }

  function renderPretestList(list){
    const container = document.getElementById("pretest-list");
    if(!container) return;
    container.innerHTML = "";
    const recent = list.slice(0,5);
    if(!recent.length){
      container.innerHTML = `<div class="note">No pre-tests yet. Log one before you start a topic.</div>`;
      return;
    }
    recent.forEach(item=>{
      const row = document.createElement("div");
      row.style.border = "1px solid #e2e8f0";
      row.style.borderRadius = "12px";
      row.style.padding = "10px";
      row.innerHTML = `
        <div style="font-weight:700;">${item.topic}</div>
        <div class="note">You thought: ${item.know}</div>
        <div class="note">Main idea guess: ${item.main}</div>
        <div class="note">Definition guess: ${item.def}</div>
        <textarea data-post="${item.id}" placeholder="After studying: what you actually learned" style="margin-top:6px;padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;min-height:50px;">${item.post||""}</textarea>
        <button class="btn" data-save-post="${item.id}" type="button">Save post-reflection</button>
      `;
      container.append(row);
      row.querySelector(`[data-save-post="${item.id}"]`)?.addEventListener("click",()=>{
        const txt = row.querySelector(`[data-post="${item.id}"]`)?.value.trim() || "";
        const list = loadPretests();
        const idx = list.findIndex(e=>e.id===item.id);
        if(idx>=0){
          list[idx].post = txt;
          savePretests(list);
          toast("Post-reflection saved");
        }
      });
    });
  }

  function clearInputs(){
    ["pretest-topic","pretest-know","pretest-main","pretest-define"].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.value = "";
    });
  }

  // toast utility kept global

  // -------------------------------
  // Blur-to-Reveal for key facts
  // -------------------------------
  const FACT_KEY = "planner_key_facts";
  const FACT_MODE_KEY = "planner_fact_mode";

  function loadFacts(){
    try{
      const raw = JSON.parse(localStorage.getItem(FACT_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function saveFacts(list){
    try{ localStorage.setItem(FACT_KEY, JSON.stringify(list||[])); }catch(e){}
  }
  function loadFactMode(){
    try{ return localStorage.getItem(FACT_MODE_KEY) === "quiz"; }catch(e){ return false; }
  }
  function saveFactMode(on){
    try{ localStorage.setItem(FACT_MODE_KEY, on ? "quiz" : "study"); }catch(e){}
  }

  function renderFactCard(host){
    const anchor = host || document.getElementById("assignments-modal-body");
    if(!anchor) return;
    let card = anchor.querySelector("#fact-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "fact-card";
    card.className = "fact-card";
    const facts = loadFacts();
    const quiz = loadFactMode();
    card.innerHTML = `
      <div class="fact-head">
        <div><div class="smart-chip">Blur-to-Reveal</div><strong>Key facts & formulas</strong></div>
        <label class="emoji-toggle"><input type="checkbox" id="fact-mode" ${quiz?"checked":""}> Quiz mode</label>
      </div>
      <div class="fact-form">
        <input id="fact-input" type="text" placeholder="Definition of hash function">
        <button class="btn" id="fact-add" type="button">Add fact</button>
      </div>
      <div class="fact-list">
        ${facts.length ? facts.map(f=> renderFactItem(f, quiz)).join("") : "<div class='note'>No key facts yet. Add one to start quizzing.</div>"}
      </div>
    `;
    anchor.append(card);
    card.querySelector("#fact-mode")?.addEventListener("change", e=>{
      saveFactMode(e.target.checked);
      renderFactCard(anchor);
    });
    card.querySelector("#fact-add")?.addEventListener("click", ()=>{
      const val = card.querySelector("#fact-input")?.value.trim() || "";
      if(!val) return;
      const list = loadFacts();
      list.unshift({ id:`fact-${Date.now()}`, text: val });
      saveFacts(list);
      renderFactCard(anchor);
    });
    card.querySelectorAll("[data-reveal]")?.forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const target = card.querySelector(`[data-text='${btn.dataset.reveal}']`);
        if(target) target.classList.remove("fact-blur");
      });
    });
  }

  function renderFactItem(fact, quiz){
    const text = `<span class="fact-text ${quiz ? "fact-blur" : ""}" data-text="${fact.id}">${fact.text}</span>`;
    const revealBtn = quiz ? `<button class="btn" type="button" data-reveal="${fact.id}">Reveal</button>` : "";
    return `<div class="fact-item">${text}${revealBtn}</div>`;
  }

  // -------------------------------
  // Self-Explanation Checkpoints (Pomodoro)
  // -------------------------------
  const STUDY_LOG_KEY = "planner_study_log";
  function loadStudyLog(){
    try{
      const raw = JSON.parse(localStorage.getItem(STUDY_LOG_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function saveStudyLog(list){
    try{ localStorage.setItem(STUDY_LOG_KEY, JSON.stringify(list||[])); }catch(e){}
  }
  function addStudyEntry(entry){
    const list = loadStudyLog();
    list.unshift(entry);
    saveStudyLog(list);
    renderStudyLogCard(document.getElementById("assignments-modal-body"));
  }

  function renderStudyLogCard(host){
    const anchor = host || document.getElementById("assignments-modal-body");
    if(!anchor) return;
    let card = anchor.querySelector("#study-log-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "study-log-card";
    card.style.marginTop = "12px";
    card.style.padding = "12px";
    card.style.border = "1px solid #e2e8f0";
    card.style.borderRadius = "14px";
    card.style.background = "#fff";
    card.style.boxShadow = "0 10px 18px rgba(0,0,0,.08)";
    const entries = loadStudyLog().slice(0,6);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div><div class="smart-chip">Study Log</div><strong>Past explainers</strong></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">
        ${entries.length ? entries.map(renderStudyEntry).join("") : "<div class='note'>No checkpoints yet. Finish a focus block to log one.</div>"}
      </div>
    `;
    anchor.append(card);
  }

  function renderStudyEntry(item){
    const date = new Date(item.ts||Date.now()).toLocaleString();
    return `
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px;">
        <div style="font-weight:700;">${item.topic || "Session"} - ${date}</div>
        <div class="note">Learned: ${item.learned || "n/a"}</div>
        <div class="note">Fuzzy: ${item.fuzzy || "n/a"}</div>
      </div>
    `;
  }

  function showExplanationPrompt(){
    if(window.__pomoFlowActive) return;
    if(document.getElementById("explain-card")) return;
    const anchor = document.querySelector(".pomo-card") || document.querySelector("header");
    if(!anchor) return;
    const card = document.createElement("div");
    card.id = "explain-card";
    card.style.position = "relative";
    card.style.marginTop = "12px";
    card.style.padding = "12px";
    card.style.border = "1px solid #e2e8f0";
    card.style.borderRadius = "14px";
    card.style.background = "#f8fafc";
    card.style.boxShadow = "0 10px 18px rgba(0,0,0,.08)";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>Checkpoint: self-explain</strong>
        <button class="btn" id="explain-close" type="button">Skip</button>
      </div>
      <input id="explain-topic" type="text" placeholder="Topic (optional)" style="width:100%;padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;margin-top:6px;">
      <textarea id="explain-learned" placeholder="What did you just learn?" style="width:100%;min-height:60px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;margin-top:6px;"></textarea>
      <textarea id="explain-fuzzy" placeholder="What still feels fuzzy?" style="width:100%;min-height:60px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;margin-top:6px;"></textarea>
      <button class="btn" id="explain-save" type="button" style="margin-top:8px;">Save checkpoint</button>
    `;
    if(anchor.classList.contains("pomo-side")){
      anchor.append(card);
    } else {
      anchor.parentElement.insertBefore(card, anchor.nextSibling);
    }
    card.querySelector("#explain-close")?.addEventListener("click", ()=> card.remove());
    card.querySelector("#explain-save")?.addEventListener("click", ()=>{
      const topic = card.querySelector("#explain-topic")?.value.trim() || "";
      const learned = card.querySelector("#explain-learned")?.value.trim() || "";
      const fuzzy = card.querySelector("#explain-fuzzy")?.value.trim() || "";
      addStudyEntry({ ts: Date.now(), topic, learned, fuzzy });
      card.remove();
      toast("Checkpoint saved");
      try{
        window.dispatchEvent(new CustomEvent("pomoCheckpointSaved",{ detail:{ ts: Date.now() }}));
      }catch(e){}
    });
  }

  function initPomodoroObserver(){
    const modeEl = document.getElementById("pomo-mode");
    if(!modeEl) return;
    let prev = (modeEl.textContent||"").toLowerCase();
    const obs = new MutationObserver(()=>{
      const current = (modeEl.textContent||"").toLowerCase();
      if(prev.includes("focus") && current.includes("break")){
        showExplanationPrompt();
      }
      prev = current;
    });
    obs.observe(modeEl, { childList:true, subtree:true, characterData:true });
  }

  function handleExternalCheckpoint(e){
    const detail = e?.detail || {};
    if(!detail.learned && !detail.fuzzy && !detail.topic) return;
    addStudyEntry({
      ts: detail.ts || Date.now(),
      topic: detail.topic || "",
      learned: detail.learned || "",
      fuzzy: detail.fuzzy || ""
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", ()=>{
      initPomodoroObserver();
      window.addEventListener("pomoCheckpointRequired", showExplanationPrompt);
      window.addEventListener("pomoCheckpointSaved", handleExternalCheckpoint);
    });
  } else {
    initPomodoroObserver();
    window.addEventListener("pomoCheckpointRequired", showExplanationPrompt);
    window.addEventListener("pomoCheckpointSaved", handleExternalCheckpoint);
  }

  // -------------------------------
  // Notes Sketch Area (images + captions)
  // -------------------------------
  const SKETCH_KEY = "planner_sketches";
  function loadSketches(){
    try{
      const raw = JSON.parse(localStorage.getItem(SKETCH_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function saveSketches(list){
    try{ localStorage.setItem(SKETCH_KEY, JSON.stringify(list||[])); }catch(e){}
  }

  function renderSketchCard(host){
    const anchor = host || document.getElementById("assignments-modal-body");
    if(!anchor) return;
    let card = anchor.querySelector("#sketch-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "sketch-card";
    card.style.marginTop = "12px";
    card.style.padding = "12px";
    card.style.border = "1px solid #e2e8f0";
    card.style.borderRadius = "14px";
    card.style.background = "#fff";
    card.style.boxShadow = "0 10px 18px rgba(0,0,0,.08)";
    const items = loadSketches().slice(0,6);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div><div class="smart-chip">Visuals</div><strong>Sketch area</strong></div>
        <button class="btn" id="sketch-add" type="button">Add image</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:8px;">
        <input id="sketch-url" type="text" placeholder="Image URL" style="padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;">
        <input id="sketch-caption" type="text" placeholder="Caption (e.g., RSA flowchart)" style="padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;">
        <select id="sketch-tag" style="padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;">
          <option value="concept">Concept map</option>
          <option value="process">Process</option>
          <option value="example">Example</option>
        </select>
      </div>
      <div id="sketch-list" style="display:flex;flex-direction:column;gap:8px;margin-top:10px;"></div>
    `;
    anchor.append(card);
    const listEl = card.querySelector("#sketch-list");
    if(!items.length){
      listEl.innerHTML = `<div class="note">No visuals yet. Add an image URL + caption.</div>`;
    } else {
      listEl.innerHTML = items.map(renderSketchItem).join("");
    }
    card.querySelector("#sketch-add")?.addEventListener("click", ()=>{
      const url = card.querySelector("#sketch-url")?.value.trim();
      const caption = card.querySelector("#sketch-caption")?.value.trim() || "Untitled";
      const tag = card.querySelector("#sketch-tag")?.value || "concept";
      if(!url){
        toast("Need an image URL");
        return;
      }
      const next = loadSketches();
      next.unshift({ id:`sk-${Date.now()}`, url, caption, tag, created: Date.now() });
      saveSketches(next);
      card.querySelector("#sketch-url").value = "";
      card.querySelector("#sketch-caption").value = "";
      renderSketchCard(anchor);
      toast("Visual saved");
    });
  }

  function renderSketchItem(item){
    return `
      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px;display:flex;gap:10px;">
        <div style="flex:0 0 60px;height:60px;background:#f1f5f9;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
          <img src="${item.url}" alt="${item.caption}" style="max-width:100%;max-height:100%;object-fit:cover;">
        </div>
        <div style="flex:1;">
          <div style="font-weight:700;">${item.caption}</div>
          <div class="note">${item.tag}</div>
        </div>
      </div>
    `;
  }

  // no automatic render; invoked inside Assignments modal
  // -------------------------------
  // Confidence vs Performance Tracker
  // -------------------------------
  const CONF_KEY = "planner_confidence_log";
  function loadConfidence(){
    try{
      const raw = JSON.parse(localStorage.getItem(CONF_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function saveConfidence(list){
    try{ localStorage.setItem(CONF_KEY, JSON.stringify(list||[])); }catch(e){}
  }

  function renderConfidenceCard(host){
    const anchor = host || document.getElementById("assignments-modal-body");
    if(!anchor) return;
    let card = anchor.querySelector("#conf-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "conf-card";
    card.style.marginTop = "12px";
    card.style.padding = "12px";
    card.style.border = "1px solid #e2e8f0";
    card.style.borderRadius = "14px";
    card.style.background = "#fff";
    card.style.boxShadow = "0 10px 18px rgba(0,0,0,.08)";
    const entries = loadConfidence().slice(0,6);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div><div class="smart-chip">Metacognition</div><strong>Confidence vs. performance</strong></div>
        <button class="btn" id="conf-save" type="button">Save entry</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:6px;">
        <input id="conf-topic" type="text" placeholder="Task/Topic (e.g., CIS-602 quiz)">
        <input id="conf-pre" type="number" min="1" max="5" placeholder="Confidence before (1-5)">
        <input id="conf-post" type="number" min="1" max="5" placeholder="Confidence after (1-5)">
        <input id="conf-perf" type="number" min="1" max="5" placeholder="Actual performance (optional)">
      </div>
      <div id="conf-list" style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
        ${entries.length ? entries.map(renderConfItem).join("") : "<div class='note'>No entries yet. Log one before/after a task.</div>"}
      </div>
      <div class="note">Calibration hint: large gaps between pre/after vs. performance show where you over/underestimate.</div>
    `;
    anchor.append(card);
    card.querySelector("#conf-save")?.addEventListener("click", ()=>{
      const topic = card.querySelector("#conf-topic")?.value.trim() || "";
      const pre = Number(card.querySelector("#conf-pre")?.value || 0);
      const post = Number(card.querySelector("#conf-post")?.value || 0);
      const perf = Number(card.querySelector("#conf-perf")?.value || 0);
      if(!topic || pre<1 || pre>5 || post<1 || post>5){
        toast("Need topic + pre/post confidence (1-5)");
        return;
      }
      const list = loadConfidence();
      list.unshift({ id:`conf-${Date.now()}`, topic, pre, post, perf: perf||null, ts: Date.now() });
      saveConfidence(list);
      ["conf-topic","conf-pre","conf-post","conf-perf"].forEach(id=>{ const el = card.querySelector("#"+id); if(el) el.value=""; });
      renderConfidenceCard(anchor);
      toast("Confidence entry saved");
    });
  }

  function renderConfItem(item){
    const delta = item.perf ? item.perf - item.post : null;
    const deltaText = delta!=null ? `Perf - after = ${delta > 0 ? "+"+delta : delta}` : "Perf: n/a";
    return `
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px;">
        <div style="font-weight:700;">${item.topic}</div>
        <div class="note">Before: ${item.pre} • After: ${item.post} • ${item.perf ? "Actual: "+item.perf : "Actual: n/a"} • ${deltaText}</div>
      </div>
    `;
  }

  // -------------------------------
  // End-of-Day Reflection (Shutdown)
  // -------------------------------
  const EOD_KEY = "planner_eod_messages";
  function loadEOD(){
    try{
      const raw = JSON.parse(localStorage.getItem(EOD_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function saveEOD(list){
    try{ localStorage.setItem(EOD_KEY, JSON.stringify(list||[])); }catch(e){}
  }

  function renderShutdownModal(){
    if(document.getElementById("shutdown-modal")) return;
    const overlay = document.createElement("div");
    overlay.id = "shutdown-modal";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,.45)";
    overlay.style.zIndex = "200";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.padding = "16px";
    card.style.borderRadius = "14px";
    card.style.maxWidth = "520px";
    card.style.width = "90%";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>Shutdown reflection</strong>
        <button class="btn" id="shutdown-close" type="button">Close</button>
      </div>
      <textarea id="eod-understand" placeholder="What concept do you understand better now?" style="width:100%;min-height:60px;margin-top:8px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;"></textarea>
      <textarea id="eod-review" placeholder="What should tomorrow you review again?" style="width:100%;min-height:60px;margin-top:8px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;"></textarea>
      <textarea id="eod-twenty" placeholder="If you had 20 minutes tomorrow, what's the most important thing?" style="width:100%;min-height:60px;margin-top:8px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;"></textarea>
      <button class="btn" id="shutdown-save" type="button" style="margin-top:10px;">Save message to Future You</button>
    `;
    overlay.append(card);
    document.body.append(overlay);
    card.querySelector("#shutdown-close")?.addEventListener("click", ()=> overlay.remove());
    card.querySelector("#shutdown-save")?.addEventListener("click", ()=>{
      const entry = {
        ts: Date.now(),
        understand: card.querySelector("#eod-understand")?.value.trim() || "",
        review: card.querySelector("#eod-review")?.value.trim() || "",
        twenty: card.querySelector("#eod-twenty")?.value.trim() || ""
      };
      if(!entry.understand && !entry.review && !entry.twenty){
        toast("Add at least one note for Future You");
        return;
      }
      const list = loadEOD();
      list.unshift(entry);
      saveEOD(list);
      toast("Message saved for Future You");
      overlay.remove();
      renderEODBanner();
    });
  }

  function renderEODBanner(){
    const anchor = document.querySelector(".view-controls");
    if(!anchor) return;
    let banner = document.getElementById("eod-banner");
    if(banner) banner.remove();
    const list = loadEOD();
    if(!list.length) return;
    const pick = list[Math.floor(Math.random()*Math.min(3, list.length))];
    banner = document.createElement("div");
    banner.id = "eod-banner";
    banner.style.marginTop = "10px";
    banner.style.padding = "10px";
    banner.style.borderRadius = "12px";
    banner.style.border = "1px solid #e2e8f0";
    banner.style.background = "#ecfeff";
    banner.innerHTML = `
      <div><strong>Message from Past You</strong></div>
      <div class="note">Understood: ${pick.understand || "n/a"}</div>
      <div class="note">Review: ${pick.review || "n/a"}</div>
      <div class="note">20-minute priority: ${pick.twenty || "n/a"}</div>
    `;
    anchor.parentElement.insertBefore(banner, anchor.nextSibling);
  }

  function initShutdownButton(){
    const btn = document.getElementById("btn-shutdown");
    if(btn){
      btn.addEventListener("click", renderShutdownModal);
    }
    renderEODBanner();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initShutdownButton);
  } else {
    initShutdownButton();
  }

  // -------------------------------
  // Submission Check / Quota Templates / Audit
  // -------------------------------
  const SUBMISSION_KEY = "planner_submission_state";
  const CAL_KEY = "planner-calendar-events";

  function loadSubmission(){
    try{
      const raw = JSON.parse(localStorage.getItem(SUBMISSION_KEY));
      return raw && typeof raw === "object" ? raw : {};
    }catch(e){ return {}; }
  }
  function saveSubmission(state){
    try{ localStorage.setItem(SUBMISSION_KEY, JSON.stringify(state||{})); }catch(e){}
  }
  let submissionState = loadSubmission();

  function getAssignmentsWindow(){
    try{
      const raw = JSON.parse(localStorage.getItem(CAL_KEY)||"[]");
      const now = Date.now();
      const in7 = now + 7*24*60*60*1000;
      return raw.filter(ev=>{
        const due = new Date(ev.start||"").getTime();
        if(!due) return false;
        return (due <= in7) || (due < now); // next 7 days + overdue
      }).slice(0,25);
    }catch(e){ return []; }
  }

  function guessType(title=""){
    const t = title.toLowerCase();
    if(t.includes("discussion")) return "discussion";
    if(t.includes("lab") || t.includes("project") || t.includes("extra")) return "lab";
    if(t.includes("quiz") || t.includes("exam") || t.includes("test")) return "quiz";
    return "generic";
  }

  function defaultSteps(type){
    if(type==="discussion") return { main:false, posted:false, replies:0, repliesTarget:3, verified:false };
    if(type==="lab" || type==="extra") return { work:false, upload:false, proof:false, verified:false };
    if(type==="quiz") return { work:false, submitted:false };
    return { work:false, submitted:false };
  }

  function isComplete(type, steps){
    if(type==="discussion") return steps.main && steps.posted && steps.replies>= (steps.repliesTarget||3) && steps.verified;
    if(type==="lab") return steps.work && steps.upload && steps.verified;
    if(type==="quiz") return steps.work && steps.submitted;
    return steps.submitted || steps.work;
  }

  function mergeStateFor(ev){
    const id = `${ev.title||"task"}-${ev.start||""}`;
    if(!submissionState[id]){
      const type = guessType(ev.title||"");
      submissionState[id] = { id, title: ev.title||"Assignment", due: ev.start||"", type, steps: defaultSteps(type), flagged:false };
    }
    return submissionState[id];
  }

  function renderSubmissionPanel(host){
    const anchor = host || document.getElementById("assignments-modal-body");
    if(!anchor) return;
    let card = anchor.querySelector("#submission-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "submission-card";
    card.style.marginTop = "12px";
    card.style.padding = "12px";
    card.style.border = "1px solid #e2e8f0";
    card.style.borderRadius = "14px";
    card.style.background = "#fff";
    card.style.boxShadow = "0 10px 18px rgba(0,0,0,.08)";
    const assignments = getAssignmentsWindow().map(mergeStateFor);
    const list = assignments.filter(item=>{
      const due = new Date(item.due||"").getTime();
      const now = Date.now();
      const overdue = due && due < now;
      return overdue || !isComplete(item.type, item.steps);
    });
    if(!list.length){
      card.innerHTML = `<div class="smart-chip">Submission Check</div><strong>All clear</strong>`;
      anchor.append(card);
      return;
    }
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div><div class="smart-chip">Submission Check</div><strong>Did I actually turn it in?</strong></div>
      </div>
      <div id="submission-list" style="display:flex;flex-direction:column;gap:8px;margin-top:8px;"></div>
    `;
    anchor.append(card);
    const listEl = card.querySelector("#submission-list");
    list.forEach(item=>{
      const due = new Date(item.due||"");
      const overdue = due.getTime() && due.getTime() < Date.now();
      const row = document.createElement("div");
      row.style.border = "1px solid #e2e8f0";
      row.style.borderRadius = "12px";
      row.style.padding = "8px";
      row.style.background = overdue ? "#fef2f2" : "#f8fafc";
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div><strong>${item.title}</strong> <span class="note">${due ? due.toLocaleDateString() : ""}</span></div>
          <select data-type="${item.id}" class="btn" style="padding:4px 8px;">
            <option value="discussion" ${item.type==="discussion"?"selected":""}>Discussion</option>
            <option value="lab" ${item.type==="lab"?"selected":""}>Lab / Extra</option>
            <option value="extra" ${item.type==="extra"?"selected":""}>Extra credit</option>
            <option value="quiz" ${item.type==="quiz"?"selected":""}>Quiz</option>
            <option value="generic" ${item.type==="generic"?"selected":""}>Other</option>
          </select>
        </div>
        <div>${renderSteps(item)}</div>
      `;
      listEl.append(row);
      row.querySelector(`[data-type="${item.id}"]`)?.addEventListener("change", e=>{
        const type = e.target.value;
        item.type = type;
        item.steps = defaultSteps(type);
        saveSubmission(submissionState);
        renderSubmissionPanel(anchor);
      });
      row.querySelectorAll("input[data-step]")?.forEach(cb=>{
        cb.addEventListener("change", ()=>{
          const step = cb.dataset.step;
          item.steps[step] = cb.checked;
          saveSubmission(submissionState);
          renderSubmissionPanel(anchor);
        });
      });
      row.querySelectorAll("button[data-reply]")?.forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const delta = Number(btn.dataset.reply);
          item.steps.replies = Math.max(0, (item.steps.replies||0) + delta);
          saveSubmission(submissionState);
          renderSubmissionPanel(anchor);
        });
      });
    });
    saveSubmission(submissionState);
  }

  function renderSteps(item){
    const s = item.steps || {};
    if(item.type==="discussion"){
      const replies = s.replies || 0;
      const target = s.repliesTarget || 3;
      const good = replies >= target;
      return `
        <label><input type="checkbox" data-step="main" ${s.main?"checked":""}> Wrote main post</label><br>
        <label><input type="checkbox" data-step="posted" ${s.posted?"checked":""}> Posted in LMS</label><br>
        <span style="color:${good?"#16a34a":"#dc2626"};">Replies: ${replies} / ${target}</span> <button class="btn" data-reply="1" type="button">+</button> <button class="btn" data-reply="-1" type="button">-</button><br>
        <label><input type="checkbox" data-step="verified" ${s.verified?"checked":""}> Verified “Complete” in LMS</label>
      `;
    }
    if(item.type==="lab" || item.type==="extra"){
      return `
        <label><input type="checkbox" data-step="work" ${s.work?"checked":""}> Did the work</label><br>
        <label><input type="checkbox" data-step="upload" ${s.upload?"checked":""}> Uploaded correct file(s)</label><br>
        <label><input type="checkbox" data-step="verified" ${s.verified?"checked":""}> Saw submission/attempt recorded</label><br>
        <label><input type="checkbox" data-step="proof" ${s.proof?"checked":""}> Took screenshot/note (optional)</label>
      `;
    }
    if(item.type==="quiz"){
      return `
        <label><input type="checkbox" data-step="work" ${s.work?"checked":""}> Completed quiz</label><br>
        <label><input type="checkbox" data-step="submitted" ${s.submitted?"checked":""}> Verified submitted</label>
      `;
    }
    return `
      <label><input type="checkbox" data-step="work" ${s.work?"checked":""}> Done</label><br>
      <label><input type="checkbox" data-step="submitted" ${s.submitted?"checked":""}> Marked submitted</label>
    `;
  }

  // Nightly audit modal
  function openAuditModal(){
    if(document.getElementById("audit-modal")) return;
    const overlay = document.createElement("div");
    overlay.id = "audit-modal";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,.5)";
    overlay.style.zIndex = "210";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.padding = "14px";
    card.style.borderRadius = "14px";
    card.style.maxWidth = "520px";
    card.style.width = "90%";
    const tasks = getAuditTasks();
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>Submission Audit</strong>
        <button class="btn" id="audit-close" type="button">Close</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
        ${tasks.length ? tasks.map(renderAuditRow).join("") : "<div class='note'>No tasks in the last/next day.</div>"}
      </div>
    `;
    overlay.append(card);
    document.body.append(overlay);
    card.querySelector("#audit-close")?.addEventListener("click", ()=> overlay.remove());
    card.querySelectorAll("[data-audit]")?.forEach(sel=>{
      sel.addEventListener("change", ()=>{
        const id = sel.dataset.audit;
        const val = sel.value;
        if(submissionState[id]){
          submissionState[id].flagged = val === "missing";
          saveSubmission(submissionState);
          renderSubmissionPanel(document.getElementById("assignments-modal-body"));
        }
      });
    });
  }

  function getAuditTasks(){
    const now = Date.now();
    const yesterday = now - 24*60*60*1000;
    const tomorrow = now + 24*60*60*1000;
    const events = getAssignmentsWindow();
    return events.filter(ev=>{
      const due = new Date(ev.start||"").getTime();
      return due >= yesterday && due <= tomorrow;
    }).map(mergeStateFor);
  }

  function renderAuditRow(item){
    return `
      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px;">
        <div><strong>${item.title}</strong> <span class="note">${item.due ? new Date(item.due).toLocaleString() : ""}</span></div>
        <div class="note">All parts submitted?</div>
        <select data-audit="${item.id}" class="btn" style="padding:4px 8px;">
          <option value="ok">✅ Yes, fully submitted</option>
          <option value="missing" ${item.flagged?"selected":""}>⚠️ Still missing something</option>
        </select>
      </div>
    `;
  }

  function initAuditButton(){
    document.getElementById("btn-audit")?.addEventListener("click", openAuditModal);
  }

  // Reply Radar (discussions only)
  function renderReplyRadar(){
    const anchor = document.querySelector(".view-controls");
    if(!anchor) return;
    let card = document.getElementById("reply-radar");
    if(card) card.remove();
    const items = Object.values(submissionState).filter(it=>it.type==="discussion");
    if(!items.length) return;
    card = document.createElement("div");
    card.id = "reply-radar";
    card.className = "radar-card";
    const pending = items.filter(it=> (it.steps?.replies||0) < (it.steps?.repliesTarget||3));
    if(!pending.length){
      card.innerHTML = `<div class="radar-item"><strong>Reply Radar</strong><span class="note">🎉 All discussion reply quotas met for this week!</span></div>`;
    }else{
      card.innerHTML = `<div><strong>Reply Radar</strong></div>`;
      pending.forEach(it=>{
        const replies = it.steps?.replies || 0;
        const target = it.steps?.repliesTarget || 3;
        const row = document.createElement("div");
        row.className = "radar-item";
        row.innerHTML = `<span>${it.title}</span><span>${replies} / ${target} replies</span>`;
        card.append(row);
      });
    }
    anchor.parentElement.insertBefore(card, anchor.nextSibling);
  }

  // Extra credit queue
  function renderExtraCredit(){
    const anchor = document.querySelector(".view-controls");
    if(!anchor) return;
    let card = document.getElementById("extra-credit");
    if(card) card.remove();
    const items = Object.values(submissionState).filter(it=>it.type==="extra");
    if(!items.length) return;
    card = document.createElement("div");
    card.id = "extra-credit";
    card.className = "radar-card";
    card.innerHTML = `<div><strong>⭐ Extra Credit Queue</strong></div>`;
    items.forEach(it=>{
      const row = document.createElement("div");
      row.className = "radar-item";
      row.innerHTML = `<span>${it.title}</span><span class="note">${it.due ? new Date(it.due).toLocaleDateString() : "No strict due"}</span>
        <div style="display:flex;gap:6px;">
          <button class="btn" data-extra-keep="${it.id}" type="button">Keep</button>
          <button class="btn" data-extra-hide="${it.id}" type="button">Archive</button>
        </div>`;
      card.append(row);
    });
    anchor.parentElement.insertBefore(card, anchor.nextSibling);
    card.querySelectorAll("[data-extra-hide]")?.forEach(btn=>{
      btn.addEventListener("click",()=>{
        const id = btn.dataset.extraHide;
        if(submissionState[id]) delete submissionState[id];
        saveSubmission(submissionState);
        renderSubmissionPanel(document.getElementById("assignments-modal-body"));
        renderExtraCredit();
        renderReplyRadar();
      });
    });
    card.querySelectorAll("[data-extra-keep]")?.forEach(btn=>{
      btn.addEventListener("click",()=>{ toast("Keeping this extra credit item"); });
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", ()=>{
      initAuditButton();
      renderReplyRadar();
      renderExtraCredit();
    });
  } else {
    initAuditButton();
    renderReplyRadar();
    renderExtraCredit();
  }

  // -------------------------------
  // PACER system
  // -------------------------------
  const PACER_KEY = "planner_pacer_cards";
  const PACER_REVIEW_KEY = "planner_pacer_review";
  function loadPacer(){
    try{
      const raw = JSON.parse(localStorage.getItem(PACER_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  }
  function savePacer(list){
    try{ localStorage.setItem(PACER_KEY, JSON.stringify(list||[])); }catch(e){}
  }

  function renderPacerPanel(host){
    const anchor = host || document.getElementById("assignments-modal-body");
    if(!anchor) return;
    let card = anchor.querySelector("#pacer-card");
    if(card) card.remove();
    card = document.createElement("div");
    card.id = "pacer-card";
    card.style.marginTop = "12px";
    card.style.padding = "12px";
    card.style.border = "1px solid #e2e8f0";
    card.style.borderRadius = "14px";
    card.style.background = "#fff";
    card.style.boxShadow = "0 10px 18px rgba(0,0,0,.08)";
    const list = loadPacer();
    const filtered = list.filter(l=> !isPacerComplete(l));
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div><div class="smart-chip">PACER</div><strong>Concept capture</strong></div>
        <button class="btn" id="pacer-add" type="button">Save PACER</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:6px;">
        <input id="pacer-topic" type="text" placeholder="Topic/Reading">
        <input id="pacer-course" type="text" placeholder="Course (optional)">
        <input id="pacer-c" type="text" placeholder="Concept (C)">
        <input id="pacer-p" type="text" placeholder="Procedure (P)">
        <input id="pacer-a" type="text" placeholder="Analogy (A)">
        <input id="pacer-e" type="text" placeholder="Evidence (E)">
        <input id="pacer-r" type="text" placeholder="Reference (R)">
      </div>
      <div style="margin-top:8px;"><label><input type="checkbox" id="pacer-filter"> Show only un-PACERed</label></div>
      <div id="pacer-list" style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
        ${(document.getElementById("pacer-filter")?.checked ? filtered : list).map(renderPacerItem).join("") || "<div class='note'>No PACER cards yet.</div>"}
      </div>
    `;
    anchor.append(card);
    card.querySelector("#pacer-add")?.addEventListener("click", ()=>{
      const topic = card.querySelector("#pacer-topic")?.value.trim() || "";
      if(!topic){ toast("Need a topic"); return; }
      const entry = {
        id:`pacer-${Date.now()}`,
        topic,
        course: card.querySelector("#pacer-course")?.value.trim() || "",
        c: card.querySelector("#pacer-c")?.value.trim() || "",
        p: card.querySelector("#pacer-p")?.value.trim() || "",
        a: card.querySelector("#pacer-a")?.value.trim() || "",
        e: card.querySelector("#pacer-e")?.value.trim() || "",
        r: card.querySelector("#pacer-r")?.value.trim() || "",
        status: "new",
        created: Date.now(),
        nextReview: Date.now()
      };
      const list = loadPacer();
      list.unshift(entry);
      savePacer(list);
      toast("PACER saved");
      renderPacerPanel(anchor);
    });
    card.querySelector("#pacer-filter")?.addEventListener("change", ()=> renderPacerPanel(anchor));
  }

  function isPacerComplete(item){
    return !!(item.c && item.p && item.a && item.e && item.r);
  }

  function renderPacerItem(item){
    const filled = ["c","p","a","e","r"].filter(k=>item[k]).length;
    const pct = Math.round((filled/5)*100);
    const color = pct===100 ? "#a855f7" : pct>=60 ? "#f59e0b" : "#94a3b8";
    return `
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:8px;display:flex;justify-content:space-between;gap:8px;">
        <div>
          <div><strong>${item.topic}</strong> <span class="note">${item.course||""}</span></div>
          <div class="note">C:${item.c? "✓":"·"} P:${item.p?"✓":"·"} A:${item.a?"✓":"·"} E:${item.e?"✓":"·"} R:${item.r?"✓":"·"}</div>
          <div class="note">Status: ${item.status||"new"}</div>
        </div>
        <div style="min-width:80px;text-align:right;color:${color};font-weight:700;">${filled}/5</div>
      </div>
    `;
  }

  // PACER mode quick overlay
  function openPacerOverlay(){
    if(document.getElementById("pacer-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "pacer-overlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,.4)";
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
      if(!topic){ toast("Need a topic"); return; }
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
      const list = loadPacer();
      list.unshift(entry);
      savePacer(list);
      renderPacerPanel(document.getElementById("assignments-modal-body"));
      toast("PACER chunk saved");
    });
  }

  function initPacerButton(){
    document.getElementById("btn-pacer-mode")?.addEventListener("click", openPacerOverlay);
  }

  // PACER review deck
  function getDuePacer(limit=5){
    const now = Date.now();
    return loadPacer().filter(p=> !p.nextReview || p.nextReview <= now).slice(0, limit);
  }
  function schedulePacer(id, rating){
    const list = loadPacer();
    const idx = list.findIndex(p=>p.id===id);
    if(idx<0) return;
    const delays = { "again":1, "hard":3, "good":7, "easy":14 };
    const statusMap = { "again":"new", "hard":"learning", "good":"learning", "easy":"comfortable" };
    const addDays = delays[rating] || 3;
    list[idx].status = statusMap[rating] || "learning";
    list[idx].nextReview = Date.now() + addDays*24*60*60*1000;
    savePacer(list);
  }
  function renderPacerReview(){
    const anchor = document.querySelector(".pomo-card") || document.querySelector(".view-controls");
    if(!anchor) return;
    const existing = document.getElementById("pacer-review");
    if(existing) existing.remove();
    const due = getDuePacer();
    if(!due.length) return;
    const card = document.createElement("div");
    card.id = "pacer-review";
    card.style.marginTop = "10px";
    card.style.padding = "10px";
    card.style.border = "1px solid #e2e8f0";
    card.style.borderRadius = "12px";
    card.style.background = "#f8fafc";
    card.innerHTML = `
      <div><strong>PACER review</strong> <span class="note">Recall without peeking</span></div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">
        ${due.map(d=>`
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px;">
            <div><strong>${d.topic}</strong></div>
            <div class="note">Status: ${d.status||"new"}</div>
            <button class="btn" data-rate="${d.id}" data-score="again">Forgot</button>
            <button class="btn" data-rate="${d.id}" data-score="good">Got it</button>
            <button class="btn" data-rate="${d.id}" data-score="easy">Easy</button>
          </div>
        `).join("")}
      </div>
    `;
    anchor.parentElement.insertBefore(card, anchor.nextSibling);
    card.querySelectorAll("[data-rate]")?.forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.dataset.rate;
        const score = btn.dataset.score;
        schedulePacer(id, score);
        card.remove();
      });
    });
  }

  // PACER radar heatmap (simplified)
  function renderPacerRadar(){
    const anchor = document.querySelector(".view-controls");
    if(!anchor) return;
    const container = document.getElementById("pacer-radar") || document.createElement("div");
    container.id = "pacer-radar";
    container.className = "radar-card";
    const data = loadPacer();
    if(!data.length){ container.innerHTML=""; return; }
    const courses = {};
    data.forEach(p=>{
      const c = p.course || "General";
      if(!courses[c]) courses[c] = {c:0,p:0,a:0,e:0,r:0,total:0};
      ["c","p","a","e","r"].forEach(k=>{ if(p[k]) courses[c][k]++; });
      courses[c].total +=1;
    });
    container.innerHTML = `<div><strong>PACER Radar</strong></div>`;
    Object.entries(courses).forEach(([course, val])=>{
      const weakest = Object.entries(val).filter(([k])=>k!=="total").sort((a,b)=>a[1]-b[1])[0];
      const row = document.createElement("div");
      row.className = "radar-item";
      row.innerHTML = `${course} — Weakest: ${weakest?weakest[0].toUpperCase():""} (${weakest?weakest[1]:0})`;
      container.append(row);
    });
    anchor.parentElement.insertBefore(container, anchor.nextSibling);
  }

  // Reminder: assignments without PACER
  function pacerReminderForAssignments(){
    const now = Date.now();
    const soon = now + 3*24*60*60*1000;
    try{
      const events = JSON.parse(localStorage.getItem(CAL_KEY)||"[]");
      const list = events.filter(ev=>{
        const due = new Date(ev.start||"").getTime();
        return due && due <= soon;
      });
      const pacer = loadPacer();
      const missing = list.filter(ev=> !pacer.some(p=>p.topic && p.topic.includes(ev.title||"")));
      if(missing.length){
        toast(`PACER reminder: capture a concept from ${missing[0].title}`);
      }
    }catch(e){}
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", ()=>{
      initPacerButton();
      renderPacerRadar();
      pacerReminderForAssignments();
    });
  } else {
    initPacerButton();
    renderPacerRadar();
    pacerReminderForAssignments();
  }

  // -------------------------------
  // Study Plan Template Generator
  // -------------------------------
  function openStudyPlanModal(){
    if(document.getElementById("study-plan-modal")) return;
    const overlay = document.createElement("div");
    overlay.id = "study-plan-modal";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,.45)";
    overlay.style.zIndex = "230";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.padding = "14px";
    card.style.borderRadius = "14px";
    card.style.maxWidth = "520px";
    card.style.width = "90%";
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
      <div style="margin-top:8px;">
        <label><input type="checkbox" id="plan-generate-pacer"> Generate PACER task for each day</label>
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
      const makePacer = card.querySelector("#plan-generate-pacer")?.checked;
      createStudyPlan(name, days, chapters, hours, makePacer);
      overlay.remove();
      toast("Study plan tasks added");
    });
  }

  function createStudyPlan(name, days, chapters, hours, makePacer){
    // simple spread of chapters across days
    const tasksPerDay = Math.ceil(chapters / days);
    const plannerRaw = localStorage.getItem("planner_v3_data");
    let planner = {};
    try{ planner = JSON.parse(plannerRaw)||{}; }catch(e){ planner = {}; }
    const dayOrder = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const start = new Date();
    for(let i=0;i<days;i++){
      const date = new Date(start);
      date.setDate(start.getDate()+i);
      const dayName = dayOrder[(date.getDay()+6)%7]; // align with planner's mapping
      if(!planner[dayName]) planner[dayName] = [];
      const chapterStart = i*tasksPerDay + 1;
      const chapterEnd = Math.min(chapters, chapterStart+tasksPerDay-1);
      const label = chapterStart === chapterEnd ? `Chapter ${chapterStart}` : `Chapters ${chapterStart}-${chapterEnd}`;
      const quality = Math.min(100, Math.round((hours/4)*100));
      planner[dayName].push(`[Retrieval] ${name}: ${label} • ${hours}h • Quality ${quality}%`);
      if(makePacer){
        planner[dayName].push(`[PACER] ${name}: Capture one core concept (C,P,A,E,R)`);
      }
    }
    localStorage.setItem("planner_v3_data", JSON.stringify(planner));
    // trigger planner re-render if present
    try{ if(typeof window.render === "function") window.render(); }catch(e){}
  }

  function initStudyPlanButton(){
    document.getElementById("btn-study-plan")?.addEventListener("click", openStudyPlanModal);
  }

  // Exam-mode extras
  const PRIORITY_KEY = "planner_concept_priority";
  const FUTURE_NOTE_KEY = "planner_future_notes";
  function loadPriority(){ try{ const raw = JSON.parse(localStorage.getItem(PRIORITY_KEY)); return Array.isArray(raw)?raw:[]; }catch(e){ return []; } }
  function savePriority(list){ try{ localStorage.setItem(PRIORITY_KEY, JSON.stringify(list||[])); }catch(e){} }

  function renderPriorityCard(target){
    const host = target || document.getElementById("assignments-modal-body");
    if(!host) return;
    let card = host.querySelector("#priority-card"); if(card) card.remove();
    card = document.createElement("div"); card.id="priority-card"; card.style.marginTop="12px"; card.style.padding="12px"; card.style.border="1px solid #e2e8f0"; card.style.borderRadius="14px"; card.style.background="#fff"; card.style.boxShadow="0 8px 16px rgba(0,0,0,.08)";
    const list = loadPriority();
    const crit = list.filter(i=>i.rank==="critical" && (Date.now() - (i.reviewed||0) > 5*86400000));
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div><div class="smart-chip">Exam Mode</div><strong>Concept priority</strong></div>
        <button class="btn" id="prio-add" type="button">Add concept</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:6px;">
        <input id="prio-concept" type="text" placeholder="Concept/topic">
        <select id="prio-rank"><option value="critical">⭐ Critical</option><option value="useful">🟡 Useful</option><option value="extra">⚪ Extra</option></select>
      </div>
      ${crit.length ? `<div class="note">Danger: ${crit.length} critical topics not reviewed in 5+ days.</div>`:""}
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
        ${list.map(p=>`<div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px;display:flex;justify-content:space-between;align-items:center;">
          <span>${p.rank==="critical"?"⭐":p.rank==="useful"?"🟡":"⚪"} ${p.title}</span>
          <button class="btn" data-review="${p.title}" type="button">Mark reviewed</button>
        </div>`).join("") || "<div class='note'>No concepts yet.</div>"}
      </div>
    `;
    host.append(card);
    card.querySelector("#prio-add")?.addEventListener("click",()=>{
      const title = card.querySelector("#prio-concept")?.value.trim()||""; const rank = card.querySelector("#prio-rank")?.value||"useful";
      if(!title) return toast("Need concept");
      const list = loadPriority(); list.unshift({ title, rank, reviewed:0 }); savePriority(list); renderPriorityCard(host);
    });
    card.querySelectorAll("[data-review]")?.forEach(btn=>{
      btn.addEventListener("click",()=>{
        const title = btn.dataset.review;
        const list = loadPriority().map(p=> p.title===title ? {...p, reviewed:Date.now()} : p);
        savePriority(list); renderPriorityCard(host);
      });
    });
  }

  function openAssignmentsModal(){
    if(document.getElementById("assignments-modal")) return;
    const overlay = document.createElement("div");
    overlay.id = "assignments-modal";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,.45)";
    overlay.style.zIndex = "250";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.padding = "16px";
    card.style.borderRadius = "14px";
    card.style.maxWidth = "720px";
    card.style.width = "94%";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div><div class="smart-chip">Assignments</div><strong>Concept priority</strong></div>
        <button class="btn" id="assignments-close" type="button">Close</button>
      </div>
      <div id="assignments-modal-body" style="margin-top:8px;"></div>
    `;
    overlay.append(card);
    document.body.append(overlay);
    card.querySelector("#assignments-close")?.addEventListener("click", ()=> overlay.remove());
    const body = card.querySelector("#assignments-modal-body");
    renderPriorityCard(body);
    renderPacerPanel(body);
    renderSubmissionPanel(body);
    renderConfidenceCard(body);
    renderSketchCard(body);
    renderStudyLogCard(body);
    renderFactCard(body);
    renderPretestCard(body);
    if(window.plannerIntel?.injectDailyIntel){ window.plannerIntel.injectDailyIntel(body); }
    if(window.plannerBoss?.renderBossBoard){ window.plannerBoss.renderBossBoard(); }
    if(window.plannerMini?.renderMiniSession){ window.plannerMini.renderMiniSession(body); }
  }

  function initAssignmentsButton(){
    document.getElementById("btn-assignments-modal")?.addEventListener("click", openAssignmentsModal);
  }

  function renderQOTD(){
    const anchor = document.querySelector("header"); if(!anchor) return;
    let bar = document.getElementById("qotd-bar"); if(bar) bar.remove();
    const pacer = loadPacer(); if(!pacer.length) return;
    const pick = pacer[Math.floor(Math.random()*pacer.length)];
    bar = document.createElement("div");
    bar.id="qotd-bar"; bar.style.margin="8px 0"; bar.style.padding="8px"; bar.style.border="1px solid #e2e8f0"; bar.style.borderRadius="12px"; bar.style.background="#f8fafc";
    bar.innerHTML = `
      <div><strong>Question of the day:</strong> Explain "${pick.topic}"</div>
      <textarea id="qotd-answer" placeholder="Type or think your answer" style="width:100%;min-height:50px;border-radius:8px;border:1px solid #e2e8f0;padding:6px;margin-top:6px;"></textarea>
      <button class="btn" id="qotd-reveal" type="button">Show my notes</button>
      <div id="qotd-notes" style="display:none;" class="note">C:${pick.c||"—"} | P:${pick.p||"—"} | A:${pick.a||"—"} | E:${pick.e||"—"} | R:${pick.r||"—"}</div>
    `;
    anchor.parentElement.insertBefore(bar, anchor.nextSibling);
    bar.querySelector("#qotd-reveal")?.addEventListener("click",()=> bar.querySelector("#qotd-notes").style.display="block");
  }

  function initPostPomoQuiz(){
    const modeEl = document.getElementById("pomo-mode"); if(!modeEl) return;
    let prev = (modeEl.textContent||"").toLowerCase();
    const obs = new MutationObserver(()=>{
      const current = (modeEl.textContent||"").toLowerCase();
      if(prev.includes("focus") && current.includes("break")) showPostPomoQuiz();
      prev = current;
    });
    obs.observe(modeEl,{childList:true,subtree:true,characterData:true});
  }
  function showPostPomoQuiz(){
    if(document.getElementById("pomo-quiz")) return;
    const anchor = document.querySelector(".pomo-card"); if(!anchor) return;
    const pacer = loadPacer(); if(!pacer.length) return;
    const pick = pacer[Math.floor(Math.random()*pacer.length)];
    const box = document.createElement("div");
    box.id="pomo-quiz"; box.style.marginTop="8px"; box.style.padding="8px"; box.style.border="1px solid #e2e8f0"; box.style.borderRadius="10px"; box.style.background="#fff7ed";
    box.innerHTML = `
      <div><strong>Quick quiz before break:</strong> ${pick.topic}</div>
      <button class="btn" id="pomo-quiz-reveal" type="button">Reveal</button>
      <div id="pomo-quiz-notes" style="display:none;" class="note">C:${pick.c||"—"} | P:${pick.p||"—"} | A:${pick.a||"—"} | E:${pick.e||"—"} | R:${pick.r||"—"}</div>
    `;
    anchor.parentElement.insertBefore(box, anchor.nextSibling);
    box.querySelector("#pomo-quiz-reveal")?.addEventListener("click",()=>{ box.querySelector("#pomo-quiz-notes").style.display="block"; setTimeout(()=>box.remove(), 4000); });
    setTimeout(()=>box.remove(), 10000);
  }
  function loadFutureNotes() {
  // Example shape – adjust to match your real data
  // Maybe you're storing parsed ICS events in localStorage:
  const raw = localStorage.getItem("planner-future-notes");
  if (!raw) return [];

  try {
    return JSON.parse(raw); // [{ when: 1732406400000, note: "Quiz 3 – Module 12" }, ...]
  } catch (e) {
    console.error("Failed to parse future notes:", e);
    return [];
  }
}


  // Future banner removed

    


  // Weekly debrief removed

  function renderEnergySuggestions(){
    // Remove the old suggestion card and any quick-launch button in the header.
    const oldCard = document.getElementById("energy-suggest");
    if(oldCard) oldCard.remove();
    const quickBtn = document.getElementById("pomo-quick-launch");
    if(quickBtn) quickBtn.remove();
  }

  // -------------------------------
  // NPC Classmate commentary
  // -------------------------------
  // NPC card removed

  // Cosmic weather removed

  // -------------------------------
  // Rituals tab/button
  // -------------------------------
  const rituals = [
    "Stack your books neatly.",
    "Close all tabs except this one & your LMS.",
    "Take 3 slow breaths and think of one reason you care about this class.",
    "Phone goes face-down in another room.",
    "Fill your water bottle before you start."
  ];
  function renderRitualCard(){
    const anchor = document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("ritual-card"); if(card) card.remove();
    card = document.createElement("div"); card.id="ritual-card"; card.className="ritual-card";
    const ritual = rituals[Math.floor(Math.random()*rituals.length)];
    card.innerHTML = `<div class="smart-chip">Ritual</div><strong>${ritual}</strong>`;
    anchor.parentElement.insertBefore(card, anchor.nextSibling);
  }
  function initRitualButton(){
    document.getElementById("btn-rituals")?.addEventListener("click", renderRitualCard);
  }

  // -------------------------------
  // Academic Crimes Log
  // -------------------------------
  const CRIMES_LOG_KEY = "planner_crimes_log";
  function loadCrimes(){ try{ const raw = JSON.parse(localStorage.getItem(CRIMES_LOG_KEY)); return Array.isArray(raw)?raw:[]; }catch(e){ return []; } }
  function saveCrimes(list){ try{ localStorage.setItem(CRIMES_LOG_KEY, JSON.stringify(list||[])); }catch(e){} }
  function renderCrimesCard(){
    const anchor = document.getElementById("danger-zone") || document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("crimes-card"); if(card) card.remove();
    card = document.createElement("div"); card.id="crimes-card"; card.className="crimes-card";
    const crimes = loadCrimes();
    card.innerHTML = `
      <div class="smart-chip">Academic Crimes</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
        <input id="crime-new" type="text" placeholder="e.g., Started 30 min before deadline" style="flex:1;min-width:220px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;">
        <button class="btn" id="crime-add" type="button">Log</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
        ${crimes.length ? crimes.slice(-5).map(c=>`<div class="note">${c}</div>`).join("") : "<div class='note'>No crimes yet.</div>"}
      </div>
    `;
    if(anchor.id === "danger-zone"){
      anchor.prepend(card);
    } else {
      anchor.parentElement.insertBefore(card, anchor.nextSibling);
    }
    card.querySelector("#crime-add")?.addEventListener("click",()=>{
      const val = card.querySelector("#crime-new")?.value.trim(); if(!val) return;
      const list = loadCrimes(); list.push(val); saveCrimes(list); renderCrimesCard();
    });
  }

  // -------------------------------
  // Weekly radar checklist
  // -------------------------------
  function renderWeeklyRadar(){
    const anchor = document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("weekly-radar"); if(card) card.remove();
    card = document.createElement("div");
    card.id = "weekly-radar";
    card.className = "radar-card";
    const subs = Object.values(submissionState||{});
    const discussions = subs.filter(s=>s.type==="discussion");
    const repliesDone = discussions.reduce((a,s)=> a + (s.steps?.replies||0),0);
    const repliesTarget = discussions.reduce((a,s)=> a + (s.steps?.repliesTarget||3),0) || 3;
    const labs = subs.filter(s=>s.type==="lab").length;
    const labsDone = subs.filter(s=>s.type==="lab" && isComplete("lab", s.steps)).length;
    const reading = Array.from(document.querySelectorAll(".row .read")).length || 0;
    const extra = subs.filter(s=>s.type==="extra").length;
    const extraDone = subs.filter(s=>s.type==="extra" && isComplete("lab", s.steps)).length;
    const review = loadPacer().filter(p=>p.status && p.status!=="new").length;
    const reviewTarget = 5;
    card.innerHTML = `
      <div><strong>Weekly Radar</strong></div>
      <div class="radar-item">📝 Discussions: ${discussions.length || 0}</div>
      <div class="radar-item">💬 Replies: ${repliesDone} / ${repliesTarget} ${repliesDone<repliesTarget? " — owe "+(repliesTarget-repliesDone):""}</div>
      <div class="radar-item">🧪 Labs: ${labsDone} / ${labs}</div>
      <div class="radar-item">📚 Reading entries: ${reading}</div>
      <div class="radar-item">🧩 Extra credit: ${extraDone} / ${extra}</div>
      <div class="radar-item">🔁 Review/SPR: ${review} / ${reviewTarget}</div>
    `;
    anchor.parentElement.insertBefore(card, anchor.nextSibling);
  }

  // -------------------------------
  // End-of-day debrief (popup)
  // -------------------------------
  function renderEODPopup(){
    if(document.getElementById("eod-popup")) return;
    const overlay = document.createElement("div");
    overlay.id = "eod-popup";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,.45)";
    overlay.style.zIndex = "240";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.padding = "16px";
    card.style.borderRadius = "14px";
    card.style.maxWidth = "520px";
    card.style.width = "90%";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>End of day debrief</strong>
        <button class="btn" id="eod-close" type="button">Close</button>
      </div>
      <textarea id="eod-learn" placeholder="One thing you actually learned today" style="width:100%;min-height:60px;margin-top:8px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;"></textarea>
      <textarea id="eod-danger" placeholder="Most dangerous thing to forget" style="width:100%;min-height:60px;margin-top:8px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;"></textarea>
      <textarea id="eod-move" placeholder="Tomorrow's first move (one concrete task)" style="width:100%;min-height:60px;margin-top:8px;border-radius:10px;border:1px solid #e2e8f0;padding:8px 10px;"></textarea>
      <button class="btn" id="eod-save" type="button" style="margin-top:10px;">Save to Learning Log</button>
    `;
    overlay.append(card);
    document.body.append(overlay);
    card.querySelector("#eod-close")?.addEventListener("click", ()=> overlay.remove());
    card.querySelector("#eod-save")?.addEventListener("click", ()=>{
      const entry = {
        ts: Date.now(),
        learn: card.querySelector("#eod-learn")?.value.trim() || "",
        danger: card.querySelector("#eod-danger")?.value.trim() || "",
        move: card.querySelector("#eod-move")?.value.trim() || ""
      };
      const list = loadEOD(); list.unshift(entry); saveEOD(list);
      toast("Logged to Learning Log");
      overlay.remove();
      renderEODBanner();
    });
  }

  // -------------------------------
  // Review Queue (spaced)
  // -------------------------------
  const REVIEW_QUEUE_KEY = "planner_review_queue";
  function loadReviewQueue(){ try{ const raw = JSON.parse(localStorage.getItem(REVIEW_QUEUE_KEY)); return Array.isArray(raw)?raw:[]; }catch(e){ return []; } }
  function saveReviewQueue(list){ try{ localStorage.setItem(REVIEW_QUEUE_KEY, JSON.stringify(list||[])); }catch(e){} }
  function addReviewItem(title){
    const now = Date.now();
    const seq = [1,3,7];
    const queue = loadReviewQueue();
    seq.forEach(d=> queue.push({ id:`rev-${now}-${d}`, title, due: now + d*86400000, stage:d }));
    saveReviewQueue(queue);
  }
  function renderReviewQueue(){
    const anchor = document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("review-queue"); if(card) card.remove();
    const queue = loadReviewQueue();
    const now = Date.now();
    const due = queue.filter(item=> item.due <= now + 24*60*60*1000);
    card = document.createElement("div"); card.id="review-queue"; card.className="radar-card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>Review Queue</strong>
        <div style="display:flex;gap:6px;align-items:center;">
          <input id="review-title" placeholder="Add to review" style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:10px;">
          <button class="btn" id="review-add" type="button">Add</button>
        </div>
      </div>
      <div id="review-list" style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
        ${due.length ? due.map(d=>`<div class="radar-item"><span>${d.title}</span><button class="btn" data-review-done="${d.id}" type="button">Done</button></div>`).join("") : "<div class='note'>No reviews due today.</div>"}
      </div>
    `;
    anchor.parentElement.insertBefore(card, anchor.nextSibling);
    card.querySelector("#review-add")?.addEventListener("click",()=>{
      const title = card.querySelector("#review-title")?.value.trim(); if(!title) return;
      addReviewItem(title); renderReviewQueue();
    });
    card.querySelectorAll("[data-review-done]")?.forEach(btn=>{
      btn.addEventListener("click",()=>{
        const id = btn.dataset.reviewDone;
        const list = loadReviewQueue().filter(q=>q.id!==id);
        saveReviewQueue(list);
        renderReviewQueue();
      });
    });
  }

  // -------------------------------
  // What Matters strip
  // -------------------------------
  function renderWhatMatters(){
    const anchor = document.querySelector(".view-controls"); if(!anchor) return;
    let strip = document.getElementById("what-matters"); if(strip) strip.remove();
    strip = document.createElement("div"); strip.id="what-matters"; strip.className="radar-card";
    const events = getAssignmentsWindow().slice(0,3);
    const pacer = loadPacer();
    const review = pacer.length ? pacer[0].topic : "Add a PACER note";
    strip.innerHTML = `
      <div><strong>What Matters</strong></div>
      <div class="radar-item">🚨 Urgent: ${events[0]?.title || "No urgent tasks"}</div>
      <div class="radar-item">🎯 Long-term: ${events[1]?.title || "Exam prep block"}</div>
      <div class="radar-item">🔁 Review: ${review}</div>
    `;
    anchor.parentElement.insertBefore(strip, anchor.nextSibling);
  }

  // -------------------------------
  // Concept map lite
  // -------------------------------
  const CONCEPT_KEY = "planner_concepts";
  function loadConcepts(){ try{ const raw = JSON.parse(localStorage.getItem(CONCEPT_KEY)); return Array.isArray(raw)?raw:[]; }catch(e){ return []; } }
  function saveConcepts(list){ try{ localStorage.setItem(CONCEPT_KEY, JSON.stringify(list||[])); }catch(e){} }
  function renderConceptCard(){
    const anchor = document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("concept-card"); if(card) card.remove();
    card = document.createElement("div"); card.id="concept-card"; card.className="radar-card";
    const list = loadConcepts();
    card.innerHTML = `
      <div><strong>Concept map</strong></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;">
        <input id="concept-name" placeholder="Concept">
        <input id="concept-classes" placeholder="Classes/modules">
        <input id="concept-links" placeholder="Links (notes/assignments)">
        <button class="btn" id="concept-add" type="button">Add</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
        ${list.slice(0,5).map(c=>`<div class="note"><strong>${c.name}</strong> — ${c.classes}<br>${c.links}</div>`).join("") || "<div class='note'>No concepts yet.</div>"}
      </div>
    `;
    anchor.parentElement.insertBefore(card, anchor.nextSibling);
    card.querySelector("#concept-add")?.addEventListener("click",()=>{
      const name = card.querySelector("#concept-name")?.value.trim(); if(!name) return;
      const classes = card.querySelector("#concept-classes")?.value.trim() || "";
      const links = card.querySelector("#concept-links")?.value.trim() || "";
      const list = loadConcepts(); list.unshift({ name, classes, links }); saveConcepts(list); renderConceptCard();
    });
  }

  // -------------------------------
  // Weekly overlook checklist
  // -------------------------------
  function renderOverlookChecklist(){
    const anchor = document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("overlook-card"); if(card) card.remove();
    card = document.createElement("div"); card.id="overlook-card"; card.className="radar-card";
    card.innerHTML = `
      <div><strong>Weekly Checklist</strong></div>
      <label><input type="checkbox"> Posted 1 discussion in each class</label>
      <label><input type="checkbox"> Replied ≥ 3 times where required</label>
      <label><input type="checkbox"> Checked LMS for hidden labs/extra credit</label>
      <label><input type="checkbox"> Reviewed at least 1 previous week's notes</label>
      <label><input type="checkbox"> Updated PACER for at least 1 chapter</label>
    `;
    anchor.parentElement.insertBefore(card, anchor.nextSibling);
  }

  // -------------------------------
  // Micro-review generator
  // -------------------------------
  function renderMicroReview(){
    const anchor = document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("micro-review"); if(card) card.remove();
    card = document.createElement("div"); card.id="micro-review"; card.className="radar-card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>60-second review</strong>
        <button class="btn" id="micro-refresh" type="button">Give me one</button>
      </div>
      <div id="micro-prompt" class="note"></div>
    `;
    anchor.parentElement.insertBefore(card, anchor.nextSibling);
    const generate = ()=>{
      const seeds = [
        "Write 3 properties of a good hash function from memory.",
        "Summarize chain of custody in 2 sentences.",
        "List 2 pros/cons of cloud forensics without peeking."
      ];
      const pacer = loadPacer();
      if(pacer.length){
        const pick = pacer[Math.floor(Math.random()*pacer.length)];
        seeds.push(`Explain ${pick.topic} in one sentence.`);
      }
      card.querySelector("#micro-prompt").textContent = seeds[Math.floor(Math.random()*seeds.length)];
    };
    card.querySelector("#micro-refresh")?.addEventListener("click", generate);
    generate();
  }

  // -------------------------------
  // Submission Proof Locker
  // -------------------------------
  const PROOF_KEY = "planner_submission_proofs";
  function loadProofs(){ try{ const raw = JSON.parse(localStorage.getItem(PROOF_KEY)); return Array.isArray(raw)?raw:[]; }catch(e){ return []; } }
  function saveProofs(list){ try{ localStorage.setItem(PROOF_KEY, JSON.stringify(list||[])); }catch(e){} }
  function renderProofLocker(){
    const anchor = document.getElementById("danger-zone") || document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("proof-card"); if(card) card.remove();
    card = document.createElement("div"); card.id="proof-card"; card.className="radar-card";
    const proofs = loadProofs();
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>Essay submission proof + version history</strong>
        <button class="btn" id="proof-add" type="button">Add proof</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px;margin-top:6px;">
        <input id="proof-title" placeholder="Essay title / assignment">
        <input id="proof-note" placeholder="Version history link or confirmation text/time">
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
        ${proofs.slice(-5).map(p=>`<div class="note"><strong>${p.title}</strong>: ${p.note}</div>`).join("") || "<div class='note'>No proofs logged yet.</div>"}
      </div>
    `;
    if(anchor.id === "danger-zone"){
      anchor.prepend(card);
    } else {
      anchor.parentElement.insertBefore(card, anchor.nextSibling);
    }
    card.querySelector("#proof-add")?.addEventListener("click",()=>{
      const title = card.querySelector("#proof-title")?.value.trim(); const note = card.querySelector("#proof-note")?.value.trim();
      if(!title || !note) return;
      const list = loadProofs(); list.push({ title, note }); saveProofs(list); renderProofLocker();
    });
  }

  // -------------------------------
  // Courtroom Mode (cross-exam)
  // -------------------------------
  const COURT_KEY = "planner_courtroom_logs";
  function loadCourt(){ try{ const raw = JSON.parse(localStorage.getItem(COURT_KEY)); return Array.isArray(raw)?raw:[]; }catch(e){ return []; } }
  function saveCourt(list){ try{ localStorage.setItem(COURT_KEY, JSON.stringify(list||[])); }catch(e){} }
  function renderCourtCard(){
    const anchor = document.getElementById("panel-notes") || document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("court-card"); if(card) card.remove();
    card = document.createElement("div"); card.id="court-card"; card.className="radar-card";
    const topics = ["Chain of custody","Shor's algorithm","Hash-based signatures","Cloud forensics challenges"];
    const logs = loadCourt().slice(0,4);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>Courtroom Mode</strong>
        <button class="btn" id="court-run" type="button">Cross-examine me</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;margin-top:6px;">
        <select id="court-topic">${topics.map(t=>`<option value="${t}">${t}</option>`).join("")}</select>
        <input id="court-custom" placeholder="Or type custom topic">
      </div>
      <div id="court-prompts" class="note" style="margin-top:6px;">Pick a topic and press run.</div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:8px;">
        ${logs.length ? logs.map(l=>`<div class="note"><strong>${l.topic}</strong> - ${new Date(l.ts).toLocaleString()}<br>${l.answer}</div>`).join("") : "<div class='note'>No transcripts yet.</div>"}
      </div>
    `;
    if(anchor.id === "panel-notes"){
      anchor.prepend(card);
    } else {
      anchor.parentElement.insertBefore(card, anchor.nextSibling);
    }
    const promptsArea = card.querySelector("#court-prompts");
    card.querySelector("#court-run")?.addEventListener("click",()=>{
      const selectVal = card.querySelector("#court-topic")?.value || "";
      const custom = card.querySelector("#court-custom")?.value.trim();
      const topic = custom || selectVal || "Your topic";
      const prompts = [
        `You are on the stand. Explain ${topic} in 3 sentences.`,
        "Counselor, define this term precisely.",
        "What would opposing counsel attack in your explanation?",
        "Give one example from a real standard or case."
      ];
      promptsArea.innerHTML = prompts.map(p=>`<div class="note">${p}</div>`).join("");
      const answer = prompt(`Courtroom Mode — ${topic}\n\nAnswer the prompts in one go:`,"");
      if(answer){
        const list = loadCourt(); list.unshift({ topic, answer, ts: Date.now() }); saveCourt(list); renderCourtCard();
      }
    });
  }

  // -------------------------------
  // Incident Report Mode
  // -------------------------------
  const INCIDENT_KEY = "planner_incident_reports";
  function loadIncidents(){ try{ const raw = JSON.parse(localStorage.getItem(INCIDENT_KEY)); return Array.isArray(raw)?raw:[]; }catch(e){ return []; } }
  function saveIncidents(list){ try{ localStorage.setItem(INCIDENT_KEY, JSON.stringify(list||[])); }catch(e){} }
  function renderIncidentCard(){
    const anchor = document.getElementById("panel-notes") || document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("incident-card"); if(card) card.remove();
    card = document.createElement("div"); card.id="incident-card"; card.className="radar-card";
    const items = loadIncidents().slice(0,3);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>Incident Report</strong>
        <button class="btn" id="incident-save" type="button">Log incident</button>
      </div>
      <textarea id="incident-what" placeholder="What happened?" style="width:100%;min-height:50px;margin-top:6px;"></textarea>
      <textarea id="incident-timeline" placeholder="Timeline of events" style="width:100%;min-height:40px;margin-top:6px;"></textarea>
      <textarea id="incident-root" placeholder="Root cause" style="width:100%;min-height:40px;margin-top:6px;"></textarea>
      <textarea id="incident-mitigation" placeholder="Mitigation next time" style="width:100%;min-height:40px;margin-top:6px;"></textarea>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
        ${items.length ? items.map(it=>`<div class="note"><strong>${new Date(it.ts).toLocaleDateString()}</strong><br>${it.what}<br>Cause: ${it.root}<br>Mitigation: ${it.mitigation}</div>`).join("") : "<div class='note'>No incidents logged.</div>"}
      </div>
    `;
    if(anchor.id==="panel-notes"){
      anchor.prepend(card);
    } else {
      anchor.parentElement.insertBefore(card, anchor.nextSibling);
    }
    card.querySelector("#incident-save")?.addEventListener("click",()=>{
      const what = card.querySelector("#incident-what")?.value.trim();
      const timeline = card.querySelector("#incident-timeline")?.value.trim();
      const root = card.querySelector("#incident-root")?.value.trim();
      const mitigation = card.querySelector("#incident-mitigation")?.value.trim();
      if(!what) return;
      const list = loadIncidents();
      list.unshift({ ts: Date.now(), what, timeline, root, mitigation });
      saveIncidents(list);
      renderIncidentCard();
    });
  }

  // -------------------------------
  // Academic Health Bar
  // -------------------------------
  function computeHealth(){
    const subs = Object.values(submissionState||{});
    const totalAssignments = subs.length || 1;
    const onTrack = subs.filter(s=> isComplete(s.type, s.steps)).length / totalAssignments;
    const repliesDone = subs.filter(s=>s.type==="discussion").reduce((a,s)=> a + (s.steps?.replies||0),0);
    const repliesNeed = subs.filter(s=>s.type==="discussion").reduce((a,s)=> a + (s.steps?.repliesTarget||3),0) || 3;
    const repliesPct = Math.min(1, repliesDone / repliesNeed);
    const reviewCount = loadReviewQueue().length;
    const reviewPct = reviewCount ? Math.min(1, 1 - Math.min(reviewCount,5)/5) : 0.8;
    const reading = Array.from(document.querySelectorAll(".row .read")).length || 0;
    const readingPct = reading ? Math.min(1, reading/4) : 0.3;
    const overall = (onTrack + repliesPct + reviewPct + readingPct) / 4;
    let status = "green", msg = "You're on pace this week.";
    if(overall < 0.4){ status="red"; msg = "CRITICAL: focus on discussions and one review today."; }
    else if(overall < 0.7){ status="yellow"; msg = "You're drifting; do 1 small thing now."; }
    return { overall, status, msg };
  }

  function renderHealthBar(){
    const anchor = document.getElementById("danger-zone"); if(!anchor) return;
    let card = document.getElementById("health-card"); if(card) card.remove();
    const { overall, status, msg } = computeHealth();
    const pct = Math.round(overall*100);
    card = document.createElement("div"); card.id="health-card"; card.className="radar-card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>Academic Health</strong>
        <span class="note">${msg}</span>
      </div>
      <div style="margin-top:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;height:14px;">
        <span style="display:block;height:100%;width:${pct}%;background:${status==="green"?"#10b981":status==="yellow"?"#f59e0b":"#ef4444"};"></span>
      </div>
      <div class="note" style="margin-top:4px;">${pct}% healthy</div>
    `;
    anchor.prepend(card);
  }

  // -------------------------------
  // Hold Me Accountable Pact
  // -------------------------------
  const PACT_KEY = "planner_future_pact";
  function loadPact(){ try{ const raw = JSON.parse(localStorage.getItem(PACT_KEY)); return raw || {}; }catch(e){ return {}; } }
  function savePact(val){ try{ localStorage.setItem(PACT_KEY, JSON.stringify(val||{})); }catch(e){} }
  function renderPactCard(){
    const anchor = document.getElementById("panel-notes") || document.querySelector(".view-controls"); if(!anchor) return;
    let card = document.getElementById("pact-card"); if(card) card.remove();
    const pact = loadPact();
    card = document.createElement("div"); card.id="pact-card"; card.className="radar-card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <strong>Hold Me Accountable</strong>
        <button class="btn" id="pact-save" type="button">Save pact</button>
      </div>
      <textarea id="pact-text" placeholder="Promise to Future You..." style="width:100%;min-height:50px;margin-top:6px;">${pact.text||""}</textarea>
      <input id="pact-exam" type="date" value="${pact.exam||""}" style="margin-top:6px;">
      <div class="note" style="margin-top:6px;">${pact.text ? `Future you reminder: ${pact.text}` : "No pact set. Write one."}</div>
    `;
    if(anchor.id === "panel-notes"){
      anchor.prepend(card);
    } else {
      anchor.parentElement.insertBefore(card, anchor.nextSibling);
    }
    card.querySelector("#pact-save")?.addEventListener("click",()=>{
      const text = card.querySelector("#pact-text")?.value.trim();
      const exam = card.querySelector("#pact-exam")?.value;
      savePact({ text, exam });
      renderPactCard();
    });
  }

  // -------------------------------
  // Notes Hub (quick access to meta tools)
  // -------------------------------
  function renderNotesHub(){
    const panel = document.getElementById("panel-notes"); if(!panel) return;
    let card = document.getElementById("notes-hub"); if(card) card.remove();
    card = document.createElement("div");
    card.id = "notes-hub";
    card.className = "notes-hub";
    card.innerHTML = `
      <div class="notes-hub-head">
        <div>
          <div class="smart-chip">Meta tools</div>
          <strong>Exam mode, PACER, Retrieval, Submission, Metacog</strong>
        </div>
        <div class="notes-hub-actions">
          <button class="btn" data-launch="btn-roulette" type="button">Retrieval Roulette</button>
          <button class="btn" data-launch="btn-mistakes" type="button">Mistake Museum</button>
          <button class="btn" data-launch="btn-pacer-mode" type="button">PACER Mode</button>
          <button class="btn" data-launch="btn-audit" type="button">Submission Check</button>
        </div>
      </div>
      <div class="notes-hub-grid">
        <button class="btn ghost" data-launch="btn-study-plan" type="button">Exam mode / Study plan</button>
        <button class="btn ghost" data-launch="btn-rituals" type="button">Rituals</button>
        <button class="btn ghost" data-launch="btn-shutdown" type="button">Shutdown / end-of-day</button>
      </div>
      <div class="note">Use the buttons above to open the Retrieval Roulette, PACER decks, submission audit, mini-session, intel, gremlin, and crimes features already on the planner.</div>
    `;
    panel.prepend(card);
    card.querySelectorAll("[data-launch]")?.forEach(btn=>{
      btn.addEventListener("click",()=>{
        const targetId = btn.getAttribute("data-launch");
        const target = document.getElementById(targetId);
        if(target) target.click();
      });
    });
  }

    // -------------------------------
  // Planner day color / emoji badges
  // -------------------------------
  const dayPalette = [
    { day:"Monday", color:"#e0f2fe", emoji:"Mon" },
    { day:"Tuesday", color:"#e8f5e9", emoji:"Tue" },
    { day:"Wednesday", color:"#fff7e6", emoji:"Wed" },
    { day:"Thursday", color:"#f3e8ff", emoji:"Thu" },
    { day:"Friday", color:"#ffe4e6", emoji:"Fri" },
    { day:"Saturday", color:"#e0f7fa", emoji:"Sat" },
    { day:"Sunday", color:"#fef3c7", emoji:"Sun" }
  ];
  let colorizing = false;
  let colorizePending = false;
  function colorizePlannerDays(){
    if(colorizing) return;
    colorizing = true;
    const panel = document.getElementById("panel-planner"); if(!panel){ colorizing=false; return; }
    panel.querySelectorAll(".card[data-day]").forEach(card=>{
      const day = card.getAttribute("data-day") || "";
      const match = dayPalette.find(p=> day.toLowerCase().includes(p.day.toLowerCase().slice(0,3)));
      if(match){
        card.style.background = match.color;
        card.style.borderColor = "rgba(0,0,0,0.04)";
        const chip = card.querySelector(".day-emoji-chip");
        const label = `${match.emoji} ${match.day || day}`;
        if(chip){
          chip.textContent = label;
        } else {
          const nextChip = document.createElement("div");
          nextChip.className = "day-emoji-chip";
          nextChip.textContent = label;
          card.prepend(nextChip);
        }
      }
    });
    colorizing = false;
  }
  function scheduleColorize(){
    if(colorizePending) return;
    colorizePending = true;
    requestAnimationFrame(()=>{ colorizePending = false; colorizePlannerDays(); });
  }
  function observePlanner(){
    const panel = document.getElementById("panel-planner"); if(!panel) return;
    scheduleColorize();
    const obs = new MutationObserver(()=> scheduleColorize());
    obs.observe(panel, { childList:true });
  }

    if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", ()=>{
      initPacerButton(); renderPacerRadar(); pacerReminderForAssignments();
      renderQOTD(); initPostPomoQuiz(); renderEnergySuggestions(); initStudyPlanButton();
      renderCrimesCard(); initRitualButton();
      renderCourtCard(); renderIncidentCard(); renderHealthBar(); renderPactCard(); renderProofLocker();
      renderNotesHub(); observePlanner(); initAssignmentsButton();
    });
  } else {
    initPacerButton(); renderPacerRadar(); pacerReminderForAssignments();
    renderQOTD(); initPostPomoQuiz(); renderEnergySuggestions(); initStudyPlanButton();
    renderCrimesCard(); initRitualButton();
    renderCourtCard(); renderIncidentCard(); renderHealthBar(); renderPactCard(); renderProofLocker();
    renderNotesHub(); observePlanner(); initAssignmentsButton();
  }
})();

