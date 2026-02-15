// Bunker Mode: Room Integrity + Narrative Briefing integration
(function(){
  // Utilities reused
  const normalizeTitle = (t="")=> String(t||"").trim();
  const startOfWeek = (date)=>{ const d=new Date(date); const day=d.getDay(); const diff=day===0?6:day-1; d.setDate(d.getDate()-diff); d.setHours(0,0,0,0); return d; };
  const el = (tag, attrs, ...children)=>{ const n=document.createElement(tag); if(attrs&&typeof attrs==="object"&&!Array.isArray(attrs)){ Object.entries(attrs).forEach(([k,v])=>{ if(k==="class") n.className=v; else if(k==="onclick") n.addEventListener("click",v); else n.setAttribute(k,v); }); children.forEach(c=>appendChild(n,c)); } else { [attrs,...children].forEach(c=>appendChild(n,c)); } return n; };
  const appendChild = (parent, child)=>{ if(child==null||child===false) return; if(Array.isArray(child)) return child.forEach(c=>appendChild(parent,c)); if(child instanceof Node) return parent.appendChild(child); parent.appendChild(document.createTextNode(String(child))); };

  // Derive Danger Zone items
  function getDangerItems(){
    return Array.from(document.querySelectorAll(".danger-item")).map(row=>{
      const titleEl = row.querySelector(".danger-title");
      const statusEl = row.querySelector(".danger-status");
      const btn = row.querySelector(".danger-done-btn");
      return {
        el: row,
        title: titleEl?.textContent?.trim() || "",
        status: statusEl?.textContent?.trim() || "",
        done: btn && /defeated/i.test(btn.textContent||""),
      };
    }).filter(r=>r.title);
  }

  // Room integrity calculations
  function computeRooms(){
    const items = getDangerItems();
    const roomHealth = new Map();
    const roomItems = new Map();
    const bump = (room, delta)=> roomHealth.set(room, Math.max(0, Math.min(100, (roomHealth.get(room)||100)+delta)));
    const extractRoom = (title="")=>{
      const m = /\[(.+?)\]/.exec(title);
      if(m && m[1]) return m[1].trim();
      return "Ops Center";
    };
    items.forEach(it=>{
      if(it.done) return;
      const room = extractRoom(it.title);
      if(!roomItems.has(room)) roomItems.set(room, []);
      roomItems.get(room).push(it);
      const status = it.status.toLowerCase();
      if(status.includes("final form") || status.includes("overdue")) bump(room, -30);
      else if(status.includes("1 day") || status.includes("today")) bump(room, -20);
      else if(status.includes("2 day")) bump(room, -15);
      else if(status.includes("3 day")) bump(room, -10);
      else bump(room, -5);
    });
    return Array.from(roomHealth.entries()).map(([name,integrity])=>({
      name,
      integrity,
      items: roomItems.get(name)||[]
    }));
  }

  function renderRoomsCard(){
    const cardHost = document.getElementById("rooms-card");
    const rooms = computeRooms().sort((a,b)=> a.integrity - b.integrity);
    if(!cardHost) return;
    cardHost.innerHTML = "";
    if(!rooms.length){
      cardHost.classList.add("hidden");
      return;
    }
    cardHost.classList.remove("hidden");
    const list = el("div",{class:"rooms-list"},
      ...rooms.slice(0,5).map(room=>{
        const cls = room.integrity<40 ? "low" : room.integrity<70 ? "mid" : "ok";
        return el("div",{class:`room-row ${cls}`},
          el("div",{class:"room-name"}, room.name),
          el("div",{class:"room-bar"}, el("span",{style:`width:${room.integrity}%`})),
          el("div",{class:"room-meta"}, `${room.integrity}%`),
          el("button",{class:"btn room-repair",type:"button",onclick:()=>repairRoom(room)},"Repair")
        );
      })
    );
    cardHost.append(
      el("div",{class:"rooms-head"},"Room Integrity"),
      list
    );
  }

  // Briefing generation (simple wrapper)
  function renderBriefingStrip(){
    const strip = document.getElementById("daily-briefing");
    if(!strip) return;
    strip.classList.remove("hidden");
  }

  function repairRoom(room){
    // Filter Danger Zone to that room's tasks (by [Room] tag)
    const dz = document.getElementById("danger-zone");
    if(dz){
      const rows = Array.from(dz.querySelectorAll(".danger-item"));
      rows.forEach(r=>{
        const title = r.querySelector(".danger-title")?.textContent || "";
        r.style.display = title.includes(`[${room.name}]`) ? "" : "none";
      });
    }
    // Start Pomodoro on next mission for that room if available (integrates with existing controls)
    const next = (room.items||[]).find(it=> !it.done);
    if(next){
      try{
        const startBtn = document.getElementById("pomo-start");
        const modeLabel = document.getElementById("pomo-mode");
        if(startBtn && modeLabel){
          modeLabel.textContent = "Focus";
          startBtn.click();
        }
      }catch(e){}
    }
  }

  function initDangerEnhancements(){
    // insert card shell if missing
    const dz = document.querySelector("#danger-zone");
    if(dz && !document.getElementById("rooms-card")){
      const card = document.createElement("div");
      card.id = "rooms-card";
      card.className = "rooms-card hidden";
      dz.parentElement?.insertBefore(card, dz);
    }
    renderRoomsCard();
    renderBriefingStrip();
    // re-render when strikes happen
    document.addEventListener("click", (e)=>{
      const btn = e.target.closest(".danger-done-btn");
      if(btn) setTimeout(renderRoomsCard, 50);
    });
  }

  document.addEventListener("DOMContentLoaded", initDangerEnhancements);
})();

// Smart Notes: tagging, summaries, mood-linked prompts, AI highlights, and coach suggestions for the Notes tab.
(function(){
  const STOPWORDS = new Set("the a an and or but of for with in on at to from by about into after over under again further then once here there when where why how all any both each few more most other some such no nor not only own same so than too very s t can will just don don should now i you he she it we they me my your his her its our their this that these those".split(/\s+/));
  const STORAGE_KEY = "planner_notes_mood_pref";
  const HIGHLIGHT_KEY = "planner_notes_ai_highlight";
  const LINK_KEY = "planner_note_links";
  const hasStorage = (()=>{ try{ localStorage.setItem("__notes_ai","1"); localStorage.removeItem("__notes_ai"); return true; }catch(e){ return false; } })();
  let highlightOn = false;

  function create(tag, attrs={}, ...children){
    const el = document.createElement(tag);
    Object.entries(attrs||{}).forEach(([k,v])=>{
      if(k==="class") el.className = v;
      else if(k==="text") el.textContent = v;
      else el.setAttribute(k,v);
    });
    children.forEach(child=>{
      if(child==null) return;
      if(Array.isArray(child)) child.forEach(c=>el.append(c));
      else el.append(child);
    });
    return el;
  }

  function injectStyles(){
    if(document.getElementById("smart-notes-style")) return;
    const style = document.createElement("style");
    style.id = "smart-notes-style";
    style.textContent = `
      .smart-note-tags{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;font-size:12px;}
      .smart-note-tag{padding:4px 8px;border-radius:999px;background:var(--chip-bg,#1f2937);color:var(--chip-fg,#e5e7eb);border:1px solid rgba(255,255,255,0.08);}
      .smart-note-summary{font-size:12px;opacity:0.85;margin:4px 0 0;}
      .smart-note-actions{font-size:12px;opacity:0.9;margin:4px 0 0;padding-left:16px;}
      #smart-tag-filter{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;}
      #smart-tag-filter .filter-chip{padding:6px 10px;border-radius:10px;border:1px solid #374151;background:#0b1220;color:#e5e7eb;cursor:pointer;font-size:12px;transition:all .15s;}
      #smart-tag-filter .filter-chip.active{background:#22c55e;color:#0b1727;border-color:#16a34a;}
      #smart-mood-box{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0 10px;padding:8px;border:1px solid #1f2937;border-radius:10px;background:#0d1626;}
      #smart-mood-prompt{font-size:12px;opacity:0.9;}
      .smart-note-meta{font-size:12px;color:#9ca3af;}
      .ai-highlight-toggle{margin:8px 0;display:inline-flex;align-items:center;gap:8px;}
      .ai-highlight-toggle button{padding:6px 10px;border-radius:10px;border:1px solid #374151;background:#0b1220;color:#e5e7eb;cursor:pointer;}
      mark.ai-highlight{padding:2px 4px;border-radius:4px;}
      mark.ai-key{background:#facc15;color:#1f2937;}
      mark.ai-action{background:#fca5a5;color:#1f2937;}
      mark.ai-sentiment{background:#bfdbfe;color:#0f172a;}
      .ai-insights{margin:6px 0;padding-left:16px;font-size:12px;color:#e5e7eb;}
      .ai-insights li{margin:2px 0;}
      .ai-coach{margin:6px 0;padding:8px;border:1px dashed #374151;border-radius:10px;font-size:12px;}
      .ai-coach .coach-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;}
      .ai-coach button{padding:6px 10px;border-radius:8px;border:1px solid #374151;background:#111827;color:#e5e7eb;cursor:pointer;font-size:12px;}
      .ai-coach .coach-suggestions li{margin:2px 0;}
      .smart-links{margin:6px 0;padding:8px;border:1px solid #1f2937;border-radius:10px;background:#0d1626;font-size:12px;}
      .smart-links .link-actions{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;}
      .smart-links .link-chip{padding:6px 10px;border-radius:10px;border:1px solid #374151;background:#0b1220;color:#e5e7eb;cursor:pointer;}
      .smart-links .link-chip.suggestion{border-style:dashed;}
      .smart-links .link-list{margin:4px 0;padding-left:16px;}
      .voice-note-box{margin:8px 0;padding:10px;border:1px solid #1f2937;border-radius:12px;background:#0d1626;font-size:12px;}
      .voice-note-box .controls{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0;}
      .voice-note-box button{padding:6px 10px;border-radius:8px;border:1px solid #374151;background:#111827;color:#e5e7eb;cursor:pointer;}
      .voice-note-box textarea{width:100%;min-height:80px;background:#0b1220;color:#e5e7eb;border:1px solid #1f2937;border-radius:8px;padding:8px;}
      .voice-note-box .note{opacity:0.8;}
    `;
    document.head.append(style);
  }

  function loadMoodPref(){
    if(!hasStorage) return "neutral";
    try{ return localStorage.getItem(STORAGE_KEY) || "neutral"; }catch(e){ return "neutral"; }
  }
  function saveMoodPref(val){
    if(!hasStorage) return;
    try{ localStorage.setItem(STORAGE_KEY, val); }catch(e){}
  }
  function loadHighlightPref(){
    if(!hasStorage) return false;
    try{ return localStorage.getItem(HIGHLIGHT_KEY) === "1"; }catch(e){ return false; }
  }
  function saveHighlightPref(val){
    if(!hasStorage) return;
    try{ localStorage.setItem(HIGHLIGHT_KEY, val ? "1" : "0"); }catch(e){}
  }

  function smartPrompt(mood){
    const prompts = {
      happy: "Double down on what worked: What made you feel happy today? How can you get more of it tomorrow?",
      stressed: "Name the stressor in one sentence. What is one controllable step to shrink it?",
      anxious: "List the top 3 worries. Which one can you nudge forward in 10 minutes?",
      tired: "What's the smallest win you can bank before resting?",
      focused: "What's the single output you want from this session?",
      neutral: "What's one insight or decision you want by the end of this note?",
      grateful: "Who or what helped you today? Capture it in two lines."
    };
    return prompts[mood] || prompts.neutral;
  }

  function extractKeywords(text=""){
    const words = text.toLowerCase().match(/[a-z]{3,}/g) || [];
    const counts = new Map();
    words.forEach(w=>{
      if(STOPWORDS.has(w)) return;
      counts.set(w, (counts.get(w)||0)+1);
    });
    return Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([w])=>w);
  }
  function detectCategories(text=""){
    const lc = text.toLowerCase();
    const tags = [];
    if(/project|assignment|deadline|due|submit|draft/.test(lc)) tags.push("project");
    if(/workout|exercise|gym|pushup|run|cardio|abs|stretch/.test(lc)) tags.push("fitness");
    if(/study|quiz|exam|lecture|class|course/.test(lc)) tags.push("study");
    if(/mood|stress|anxious|tired|happy|grateful/.test(lc)) tags.push("mood");
    if(/todo|task|next step|action/.test(lc)) tags.push("action");
    if(/meeting|call|sync/.test(lc)) tags.push("meeting");
    return tags;
  }
  function summarize(text=""){
    const clean = text.replace(/\s+/g," ").trim();
    if(!clean) return "";
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
    const first = sentences[0] || clean.slice(0,140);
    return first.length > 160 ? first.slice(0,157)+"..." : first;
  }
  function extractActions(text=""){
    const lines = text.split(/\n/).map(l=>l.trim()).filter(Boolean);
    return lines.filter(l=>/(^-\s*|^•\s*|^todo|^action|next|prepare|review|send|draft|write|study|practice)/i.test(l)).slice(0,3);
  }
  function sentimentMood(text=""){
    const lc = text.toLowerCase();
    if(/stress|anxious|overwhelm|worry|nervous/.test(lc)) return "anxious";
    if(/tired|exhaust|sleepy/.test(lc)) return "tired";
    if(/happy|great|good|grateful|excited/.test(lc)) return "happy";
    if(/focus|productive|flow/.test(lc)) return "focused";
    return null;
  }
  function escapeHtml(str=""){
    return str.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]));
  }
  function scoreSentences(text){
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s=>s.trim().length>4);
    const results = [];
    sentences.forEach(s=>{
      const lc = s.toLowerCase();
      let score = 0;
      let type = "key";
      let reason = "Key point";
      if(/action|todo|next|deadline|due|send|submit|call|email|prepare|review/.test(lc)){
        score += 3; type = "action"; reason = "Detected as action item";
      }
      if(/important|critical|key|remember|note/.test(lc)) score += 2;
      if(/definition|means|is called|stands for/.test(lc)){
        score += 2; reason = "Definition/clarification";
      }
      if(/worried|excited|happy|frustrated|tired/.test(lc)){
        score += 1; if(type==="key"){ type="sentiment"; reason="Sentiment detected"; }
      }
      results.push({ sentence:s.trim(), score, type, reason });
    });
    return results.sort((a,b)=>b.score - a.score).slice(0,3);
  }
  function renderHighlights(card, text){
    const body = card.querySelector("p");
    if(!body) return;
    const original = body.dataset.originalText || body.textContent || "";
    body.dataset.originalText = original;
    let insights = card.querySelector(".ai-insights");
    if(insights) insights.remove();
    if(!highlightOn){
      body.textContent = original;
      return;
    }
    const picks = scoreSentences(original);
    if(!picks.length){ body.textContent = original; return; }
    const sentences = original.split(/(?<=[.!?])\s+/).filter(Boolean);
    const highlighted = sentences.map(s=>{
      const hit = picks.find(p=>p.sentence === s.trim());
      if(!hit) return escapeHtml(s);
      const cls = hit.type==="action" ? "ai-action" : hit.type==="sentiment" ? "ai-sentiment" : "ai-key";
      return `<mark class="ai-highlight ${cls}" title="${hit.reason}">${escapeHtml(s)}</mark>`;
    }).join(" ");
    body.innerHTML = highlighted;
    insights = create("ul",{class:"ai-insights"});
    picks.forEach(p=>{
      const li = document.createElement("li");
      li.textContent = `${p.reason}: ${p.sentence}`;
      insights.append(li);
    });
    card.append(insights);
  }
  function coachSuggestions(text){
    const suggestions = [];
    const words = text.split(/\s+/).length;
    if(words < 50) suggestions.push("Expand: add 2-3 supporting details or examples so this note is more complete.");
    if(/very|really|just|maybe/i.test(text)) suggestions.push("Clarity: replace vague qualifiers (very/really/just) with specific facts or numbers.");
    if(!/[.!?]\s/.test(text)) suggestions.push("Structure: break long lines into shorter sentences for readability.");
    suggestions.push("Grammar pass: read once aloud or use a spell-check to catch typos.");
    return suggestions.slice(0,3);
  }
  function renderCoach(card, text){
    let coach = card.querySelector(".ai-coach");
    if(coach) coach.remove();
    coach = create("div",{class:"ai-coach"});
    const actions = create("div",{class:"coach-actions"});
    const suggList = create("ul",{class:"coach-suggestions"});
    const render = (mode)=>{
      suggList.innerHTML = "";
      coachSuggestions(text).forEach(s=>{
        const li = document.createElement("li");
        li.textContent = mode ? `${s} (${mode})` : s;
        suggList.append(li);
      });
    };
    const clarifyBtn = create("button",{type:"button"}, document.createTextNode("Clarify"));
    const expandBtn = create("button",{type:"button"}, document.createTextNode("Expand"));
    const grammarBtn = create("button",{type:"button"}, document.createTextNode("Polish grammar"));
    clarifyBtn.addEventListener("click",()=> render("clarify focus"));
    expandBtn.addEventListener("click",()=> render("expand details"));
    grammarBtn.addEventListener("click",()=> render("grammar polish"));
    actions.append(clarifyBtn, expandBtn, grammarBtn);
    coach.append(actions, suggList);
    card.append(coach);
    render("");
  }

  const hashString = (str="")=>{
    let h = 0;
    for(let i=0;i<str.length;i++){ h = (h<<5) - h + str.charCodeAt(i); h |= 0; }
    return `note-${Math.abs(h)}`;
  };
  const loadLinks = ()=>{
    if(!hasStorage) return {};
    try{ const raw = JSON.parse(localStorage.getItem(LINK_KEY)); return raw && typeof raw === "object" ? raw : {}; }catch(e){ return {}; }
  };
  const saveLinks = (links)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(LINK_KEY, JSON.stringify(links||{})); }catch(e){}
  };
  const linkStore = loadLinks();

  function findActionables(text=""){
    const ideas = [];
    if(/deadline|due|submit|by \b(next|this)\b|\bmon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?\b/i.test(text)){
      ideas.push({ label:"Add as assignment with due date", kind:"assignment" });
    }
    if(/habit|daily|every day|morning|night|routine|stretch|pushup|abs/i.test(text)){
      ideas.push({ label:"Link to habit tracker", kind:"habit" });
    }
    if(/task|todo|next step|action|plan/i.test(text)){
      ideas.push({ label:"Link to planner task", kind:"planner" });
    }
    return ideas.slice(0,4);
  }

  function renderLinks(card, text, key){
    let box = card.querySelector(".smart-links");
    if(box) box.remove();
    box = create("div",{class:"smart-links"});
    const store = linkStore[key] || [];
    const suggestions = findActionables(text);
    const suggestionWrap = create("div",{class:"link-actions"});
    suggestions.forEach(s=>{
      const chip = create("button",{type:"button",class:"link-chip suggestion"}, document.createTextNode(s.label));
      chip.addEventListener("click",()=>{
        linkStore[key] = [...(linkStore[key]||[]), { type:s.kind, label:s.label, at:new Date().toISOString() }];
        saveLinks(linkStore);
        renderLinks(card, text, key);
      });
      suggestionWrap.append(chip);
    });
    const manualInput = create("input",{type:"text",placeholder:"Link to (planner item / habit / project)...", style:"width:100%;margin:6px 0;padding:6px;border-radius:8px;border:1px solid #374151;background:#0b1220;color:#e5e7eb;"});
    const addBtn = create("button",{type:"button",class:"link-chip"}, document.createTextNode("Link to..."));
    addBtn.addEventListener("click",()=>{
      const val = (manualInput.value||"").trim();
      if(!val) return;
      linkStore[key] = [...(linkStore[key]||[]), { type:"manual", label:val, at:new Date().toISOString() }];
      saveLinks(linkStore);
      manualInput.value = "";
      renderLinks(card, text, key);
    });
    const list = create("ul",{class:"link-list"});
    if(store.length){
      store.forEach((item, idx)=>{
        const li = document.createElement("li");
        li.textContent = `${item.label}`;
        const rm = create("button",{type:"button",class:"link-chip", style:"margin-left:6px;"}, document.createTextNode("Unlink"));
        rm.addEventListener("click",()=>{
          linkStore[key] = (linkStore[key]||[]).filter((_,i)=>i!==idx);
          saveLinks(linkStore);
          renderLinks(card, text, key);
        });
        li.append(rm);
        list.append(li);
      });
    } else {
      const empty = document.createElement("li");
      empty.textContent = "No links yet.";
      list.append(empty);
    }
    box.append(create("div",{class:"smart-note-meta"}, "Planner & Habit Links"), suggestionWrap, manualInput, addBtn, list);
    card.append(box);
  }

  function applyFilters(activeTags){
    const cards = document.querySelectorAll("#notes-feed .note-entry");
    cards.forEach(card=>{
      const tags = (card.dataset.tags || "").split(",").filter(Boolean);
      const show = !activeTags.length || activeTags.some(t=>tags.includes(t));
      card.style.display = show ? "" : "none";
    });
  }

  function renderFilterBar(allTags){
    const filterBar = document.getElementById("smart-tag-filter") || create("div",{id:"smart-tag-filter"});
    if(!filterBar.parentElement){
      const panel = document.getElementById("panel-notes");
      panel?.insertBefore(filterBar, panel.firstChild);
    }
    filterBar.innerHTML = "";
    const unique = Array.from(new Set(allTags)).slice(0,15);
    const active = new Set();
    unique.forEach(tag=>{
      const chip = create("button",{class:"filter-chip",type:"button"}, document.createTextNode("#"+tag));
      chip.addEventListener("click",()=>{
        if(active.has(tag)) active.delete(tag); else active.add(tag);
        chip.classList.toggle("active");
        applyFilters(Array.from(active));
      });
      filterBar.append(chip);
    });
  }

  function renderHighlightToggle(){
    const panel = document.getElementById("panel-notes");
    if(!panel) return;
    let wrap = document.getElementById("ai-highlight-toggle");
    if(!wrap){
      wrap = create("div",{class:"ai-highlight-toggle", id:"ai-highlight-toggle"});
      const btn = create("button",{type:"button", id:"ai-highlight-btn"});
      wrap.append(btn);
      panel.insertBefore(wrap, panel.firstChild);
    }
    const btn = document.getElementById("ai-highlight-btn");
    if(btn){
      btn.textContent = highlightOn ? "AI Highlight: On" : "AI Highlight: Off";
      btn.onclick = ()=>{
        highlightOn = !highlightOn;
        btn.textContent = highlightOn ? "AI Highlight: On" : "AI Highlight: Off";
        saveHighlightPref(highlightOn);
        decorateNotes();
      };
    }
  }

  function decorateNotes(){
    const feed = document.getElementById("notes-feed");
    if(!feed) return;
    const cards = feed.querySelectorAll(".note-entry");
    const allTags = [];
    cards.forEach(card=>{
      const title = card.querySelector("h4")?.textContent || "";
      const body = card.querySelector("p")?.textContent || "";
      const text = `${title} ${body}`.trim();
      const keywords = extractKeywords(text);
      const categories = detectCategories(text);
      const tags = Array.from(new Set([...categories, ...keywords])).slice(0,6);
      card.dataset.tags = tags.join(",");
      allTags.push(...tags);

      let tagRow = card.querySelector(".smart-note-tags");
      if(!tagRow){
        tagRow = create("div",{class:"smart-note-tags"});
        const meta = card.querySelector(".note-meta");
        (meta || card).append(tagRow);
      } else tagRow.innerHTML = "";
      if(tags.length){
        tags.forEach(t=> tagRow.append(create("span",{class:"smart-note-tag"}, document.createTextNode("#"+t))));
      } else {
        tagRow.textContent = "No tags yet.";
      }

      let summaryRow = card.querySelector(".smart-note-summary");
      const summaryText = summarize(body || title);
      if(summaryText){
        if(!summaryRow){
          summaryRow = create("div",{class:"smart-note-summary"});
          card.append(summaryRow);
        }
        summaryRow.textContent = `Summary: ${summaryText}`;
      }

      const actions = extractActions(body);
      let actionsList = card.querySelector(".smart-note-actions");
      if(actions.length){
        if(!actionsList){
          actionsList = create("ul",{class:"smart-note-actions"});
          card.append(actionsList);
        }
        actionsList.innerHTML = "";
        actions.forEach(a=> actionsList.append(create("li",{}, document.createTextNode(a))));
      } else if(actionsList){
        actionsList.remove();
      }

      renderHighlights(card, body || title);
      renderCoach(card, body || title);
      const key = hashString((title||"") + "::" + (body||""));
      card.dataset.noteKey = key;
      renderLinks(card, body || title, key);
    });
    renderFilterBar(allTags);
    renderHighlightToggle();
  }

  function buildMoodBox(){
    const panel = document.getElementById("panel-notes");
    if(!panel) return;
    let box = document.getElementById("smart-mood-box");
    if(box) return box;
    box = create("div",{id:"smart-mood-box"});
    const label = create("label",null,"Mood:");
    const sel = create("select",{id:"smart-mood-select"});
    ["neutral","happy","focused","stressed","anxious","tired","grateful"].forEach(val=>{
      const opt = create("option",{value:val,text:val.charAt(0).toUpperCase()+val.slice(1)});
      sel.append(opt);
    });
    const prompt = create("div",{id:"smart-mood-prompt"});
    const refresh = create("button",{type:"button",class:"btn"}, document.createTextNode("Refresh prompt"));
    refresh.addEventListener("click",()=> prompt.textContent = smartPrompt(sel.value));
    sel.addEventListener("change",()=>{
      saveMoodPref(sel.value);
      prompt.textContent = smartPrompt(sel.value);
    });
    box.append(label, sel, refresh, prompt);
    panel.insertBefore(box, panel.querySelector(".notes-card") || panel.firstChild);
    sel.value = loadMoodPref();
    prompt.textContent = smartPrompt(sel.value);
    return box;
  }

  function observeNotes(){
    const feed = document.getElementById("notes-feed");
    if(!feed) return;
    const observer = new MutationObserver(()=> decorateNotes());
    observer.observe(feed, {childList:true, subtree:true});
    decorateNotes();
  }

  function buildVoiceNoteBox(){
    const panel = document.getElementById("panel-notes");
    if(!panel) return;
    let box = document.getElementById("voice-note-box");
    if(box) return box;
    box = create("div",{class:"voice-note-box", id:"voice-note-box"});
    const title = create("div",{class:"smart-note-meta"},"Voice note (speech-to-text + summary)");
    const controls = create("div",{class:"controls"});
    const recordBtn = create("button",{type:"button"}, document.createTextNode("Start recording"));
    const stopBtn = create("button",{type:"button"}, document.createTextNode("Stop"));
    stopBtn.disabled = true;
    const status = create("div",{class:"note"},"Idle");
    const transcript = create("textarea",{placeholder:"Transcript will appear here..."});
    const summaryEl = create("div",{class:"smart-note-summary"},"");
    const copyBtn = create("button",{type:"button"}, document.createTextNode("Copy transcript"));
    controls.append(recordBtn, stopBtn, copyBtn);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognizer = null;
    if(SpeechRecognition){
      recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = "en-US";
    }

    const stopRecording = ()=>{
      if(recognizer){ recognizer.stop(); }
      recordBtn.disabled = false;
      stopBtn.disabled = true;
      status.textContent = "Stopped";
    };
    const startRecording = ()=>{
      if(!recognizer){ status.textContent = "Speech recognition not supported in this browser."; return; }
      transcript.value = "";
      summaryEl.textContent = "";
      recordBtn.disabled = true;
      stopBtn.disabled = false;
      status.textContent = "Listening...";
      recognizer.start();
    };

    if(recognizer){
      recognizer.onresult = (event)=>{
        let finalText = "";
        for(let i=0;i<event.results.length;i++){
          finalText += event.results[i][0].transcript + " ";
        }
        transcript.value = finalText.trim();
      };
      recognizer.onerror = ()=>{ status.textContent = "Recognition error"; stopRecording(); };
      recognizer.onend = ()=>{
        recordBtn.disabled = false;
        stopBtn.disabled = true;
        status.textContent = "Stopped";
        const text = transcript.value.trim();
        if(text){
          const sum = summarize(text);
          summaryEl.textContent = `Summary: ${sum}`;
        }
      };
    } else {
      status.textContent = "Speech recognition not supported here.";
      recordBtn.disabled = true;
      stopBtn.disabled = true;
    }

    recordBtn.addEventListener("click", startRecording);
    stopBtn.addEventListener("click", stopRecording);
    copyBtn.addEventListener("click",()=>{
      if(!transcript.value) return;
      navigator.clipboard?.writeText(transcript.value);
      status.textContent = "Transcript copied. Paste into a note to save it.";
    });

    box.append(title, controls, status, transcript, summaryEl);
    panel.insertBefore(box, panel.querySelector(".notes-card") || panel.firstChild);
    return box;
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    injectStyles();
    highlightOn = loadHighlightPref();
    buildMoodBox();
    buildVoiceNoteBox();
    observeNotes();
  });
})();
// Pomodoro Activity Logger: forces a note after each focus cycle and visualizes weekly usage.
(function(){
  const STORAGE_KEY = "planner_pomo_activity_log";
  const STREAK_KEY = "planner_pomo_streak";
  const SUBJECT_KEY = "planner_pomo_subject_goals";
  const LAST_SUBJECT_KEY = "planner_pomo_last_subject";
  const BREAK_KEY = "planner_pomo_breaks";
  const STUDY_STREAK_KEY = "planner_pomo_study_streak";
  const BADGE_KEY = "planner_pomo_badges";
  const dayLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const hasStorage = (()=>{ try{ localStorage.setItem("__pomo_log_test","1"); localStorage.removeItem("__pomo_log_test"); return true; }catch(e){ return false; }})();
  const startOfWeek = (date)=>{ const d=new Date(date); const day=d.getDay(); const diff=day===0?6:day-1; d.setDate(d.getDate()-diff); d.setHours(0,0,0,0); return d; };
  const MAX_PLAN_ITEMS = 8;
  const PLAN_KEY = "planner_pomo_plan";
  const currentWeekKey = ()=> startOfWeek(new Date()).toISOString();
  const DAILY_GOAL = 2; // pomodoros per day to count toward streak
  const normalizeSubject = (s="")=>{
    const clean = String(s||"").trim();
    return clean || "General";
  };
  const subjectKey = (s="")=> normalizeSubject(s).toLowerCase();

  const formatDayKey = (d)=>{
    const n = new Date(d);
    n.setHours(0,0,0,0);
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
  };
  const sameDay = (a,b)=> formatDayKey(a) === formatDayKey(b);
  const loadEntries = ()=>{
    if(!hasStorage) return [];
    try{
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(Array.isArray(raw)) return raw.filter(e=>e && e.ts && e.note).sort((a,b)=> new Date(b.ts) - new Date(a.ts));
    }catch(e){}
    return [];
  };
  const saveEntries = (list)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(list || [])); }catch(e){}
  };

  const defaultStreak = { best:0, current:0, freezeUsed:false, freezeDay:null };
  const loadStreak = ()=>{
    if(!hasStorage) return { ...defaultStreak };
    try{
      const raw = JSON.parse(localStorage.getItem(STREAK_KEY));
      if(raw && typeof raw==="object") return { ...defaultStreak, ...raw };
    }catch(e){}
    return { ...defaultStreak };
  };
  const saveStreak = (s)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(STREAK_KEY, JSON.stringify(s||defaultStreak)); }catch(e){}
  };

  const loadPlan = ()=>{
    if(!hasStorage) return null;
    try{ const raw = JSON.parse(localStorage.getItem(PLAN_KEY)); return raw && typeof raw==="object" ? raw : null; }catch(e){ return null; }
  };
  const savePlan = (plan)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(PLAN_KEY, JSON.stringify(plan||{})); }catch(e){}
  };

  const loadSubjectGoals = ()=>{
    if(!hasStorage) return {};
    try{
      const raw = JSON.parse(localStorage.getItem(SUBJECT_KEY));
      if(raw && typeof raw==="object"){
        const out = {};
        Object.entries(raw).forEach(([label,val])=>{
          const key = subjectKey(label);
          const baseLabel = normalizeSubject((val && typeof val==="object" && val.label) ? val.label : label);
          const goalNum = (val && typeof val==="object" && typeof val.goal !== "undefined") ? Number(val.goal) : Number(val);
          out[key] = { label: baseLabel, goal: Math.max(0, goalNum||0) };
        });
        return out;
      }
    }catch(e){}
    return {};
  };
  const saveSubjectGoals = (goals)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(SUBJECT_KEY, JSON.stringify(goals||{})); }catch(e){}
  };
  const loadLastSubject = ()=>{
    if(!hasStorage) return "";
    try{
      const raw = localStorage.getItem(LAST_SUBJECT_KEY) || "";
      return normalizeSubject(raw);
    }catch(e){ return ""; }
  };
  const saveLastSubject = (val)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(LAST_SUBJECT_KEY, normalizeSubject(val)); }catch(e){}
  };

  const defaultBreakStats = ()=>({ week: currentWeekKey(), count:0, lastSuggestion:"" });
  const loadBreakStats = ()=>{
    if(!hasStorage) return defaultBreakStats();
    try{
      const raw = JSON.parse(localStorage.getItem(BREAK_KEY));
      if(raw && typeof raw==="object"){
        const wk = raw.week === currentWeekKey() ? raw.week : currentWeekKey();
        return { ...defaultBreakStats(), ...raw, week:wk };
      }
    }catch(e){}
    return defaultBreakStats();
  };
  const saveBreakStats = (stats)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(BREAK_KEY, JSON.stringify(stats||defaultBreakStats())); }catch(e){}
  };

  const defaultStudyStreak = ()=>({ best:0, current:0, days:{} });
  const loadStudyStreak = ()=>{
    if(!hasStorage) return defaultStudyStreak();
    try{
      const raw = JSON.parse(localStorage.getItem(STUDY_STREAK_KEY));
      if(raw && typeof raw==="object") return { ...defaultStudyStreak(), ...raw };
    }catch(e){}
    return defaultStudyStreak();
  };
  const saveStudyStreak = (s)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(STUDY_STREAK_KEY, JSON.stringify(s||defaultStudyStreak())); }catch(e){}
  };

  const loadBadges = ()=>{
    if(!hasStorage) return [];
    try{
      const raw = JSON.parse(localStorage.getItem(BADGE_KEY));
      return Array.isArray(raw) ? raw : [];
    }catch(e){ return []; }
  };
  const saveBadges = (list)=>{
    if(!hasStorage) return;
    try{ localStorage.setItem(BADGE_KEY, JSON.stringify(list||[])); }catch(e){}
  };

  function breakdownTask(text=""){
    const clean = text.trim();
    if(!clean) return null;
    // Simple heuristic: number of pomodoros based on length/keywords
    const base = Math.min(MAX_PLAN_ITEMS, Math.max(3, Math.ceil(clean.split(/\s+/).length / 25)));
    const keywords = {
      read:["read","chapter","pages","textbook"],
      write:["essay","write","draft","paper"],
      study:["study","exam","quiz","review","practice"]
    };
    let type = "general";
    const lower = clean.toLowerCase();
    if(keywords.read.some(k=>lower.includes(k))) type="read";
    else if(keywords.write.some(k=>lower.includes(k))) type="write";
    else if(keywords.study.some(k=>lower.includes(k))) type="study";
    const steps = [];
    for(let i=1;i<=base;i++){
      if(type==="read") steps.push(`Pomodoro ${i}: Read 5-7 pages and jot 3 bullet takeaways.`);
      else if(type==="write") steps.push(`Pomodoro ${i}: ${i===1 ? "Outline thesis + 3 claims" : i===base ? "Polish and proofread" : "Draft a section (~150-200 words)"} .`);
      else if(type==="study") steps.push(`Pomodoro ${i}: ${i%2 ? "Active recall 10 Qs" : "Review notes + make flashcards"} in focus.`);
      else steps.push(`Pomodoro ${i}: Complete a focused chunk (~40-50 min) of "${clean.slice(0,60)}"...`);
    }
    return { title: clean, steps: steps.slice(0,MAX_PLAN_ITEMS) };
  }

  function injectStyles(){
    if(document.getElementById("pomo-log-styles")) return;
    const css = `
      #pomo-log-card{border:1px solid var(--border,#2d2d2d);border-radius:12px;padding:12px;margin-top:12px;}
      #pomo-log-card.locked{box-shadow:0 0 0 2px #f97316 inset;}
      .pomo-log-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}
      .pomo-log-status{font-size:12px;opacity:0.8;}
      .pomo-log-lock{color:#f97316;font-size:13px;margin:6px 0;}
      #pomo-log-text{width:100%;min-height:80px;border-radius:8px;padding:8px;border:1px solid var(--border,#3a3a3a);background:transparent;color:inherit;}
      .pomo-log-actions{display:flex;gap:8px;align-items:center;margin:8px 0;}
      .pomo-log-error{color:#f87171;font-size:12px;min-height:14px;}
      .pomo-log-list{max-height:180px;overflow:auto;border-top:1px solid var(--border,#2d2d2d);margin-top:8px;padding-top:8px;}
      .pomo-log-total{font-size:12px;opacity:0.8;margin-bottom:6px;}
      .pomo-log-item{margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed var(--border,#2d2d2d);}
      .pomo-log-item:last-child{border-bottom:none;}
      .pomo-log-chart{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(100px,1fr));
        gap:10px;
        align-items:stretch;
        margin-top:10px;
        padding:10px;
        border-radius:12px;
        background:rgba(31,34,38,.6);
        border:1px solid var(--border,#2d343c);
        box-shadow:0 10px 20px rgba(0,0,0,.25);
      }
      .pomo-log-bar{
        display:flex;
        flex-direction:column;
        gap:8px;
        padding:10px;
        border-radius:12px;
        background:linear-gradient(180deg,rgba(124,184,255,.12),rgba(209,110,224,.08));
        border:1px solid var(--border,#2d343c);
        box-shadow:0 10px 16px rgba(0,0,0,.22);
      }
      .pomo-log-bar .bar{
        position:relative;
        width:100%;
        height:70px;
        border-radius:10px;
        background:linear-gradient(180deg,#0f1113,#0f1113);
        box-shadow:inset 0 -6px 0 rgba(0,0,0,.16),0 8px 14px rgba(0,0,0,.25);
        overflow:hidden;
        display:flex;
        align-items:flex-end;
        justify-content:center;
        color:#f8fafc;
        font-weight:800;
        font-size:18px;
      }
      .pomo-log-bar .bar-fill{
        position:absolute;
        left:0;right:0;bottom:0;
        background:linear-gradient(180deg,#4ade80,#16a34a);
        border-radius:10px 10px 6px 6px;
      }
      .pomo-log-count{padding-bottom:8px;}
      .pomo-log-bar label{
        font-size:12px;
        font-weight:700;
        color:#e8e6e3;
        text-align:center;
        letter-spacing:.02em;
      }
      .pomo-streak-card{margin-top:12px;padding:12px;border:1px solid var(--border,#2d2d2d);border-radius:12px;background:rgba(255,255,255,0.04);}
      .pomo-streak-head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .pomo-streak-main{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:600;}
      .pomo-streak-meta{font-size:12px;opacity:0.8;}
      .pomo-streak-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:10px;}
      .pomo-streak-day{height:36px;border-radius:10px;border:1px solid var(--border,#2d2d2d);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;gap:2px;opacity:0.9;}
      .pomo-streak-day.on{background:#16a34a22;border-color:#16a34a99;}
      .pomo-streak-day.freeze{background:#f59e0b22;border-color:#f59e0b99;}
      .pomo-streak-day.missed{opacity:0.5;}
      .pomo-streak-day .dot{width:6px;height:6px;border-radius:50%;background:#16a34a99;}
      .pomo-streak-freeze{display:flex;gap:8px;align-items:center;margin-top:8px;font-size:12px;}
      .pomo-streak-freeze button{padding:6px 10px;border-radius:8px;border:1px solid var(--border,#2d2d2d);background:#0f172a;color:inherit;cursor:pointer;}
      .pomo-streak-freeze button:disabled{opacity:0.5;cursor:not-allowed;}
      .pomo-plan-card{border:1px solid var(--border,#2d2d2d);border-radius:12px;padding:12px;margin-top:12px;background:rgba(255,255,255,0.03);}
      .pomo-plan-card h4{margin:0 0 6px 0;font-size:15px;}
      .pomo-plan-form{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
      .pomo-plan-form input{flex:1;min-width:200px;padding:8px 10px;border-radius:10px;border:1px solid var(--border,#2d2d2d);background:#0f172a;color:inherit;}
      .pomo-plan-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
      .pomo-plan-result{margin-top:8px;font-size:13px;line-height:1.5;}
      .pomo-plan-checklist{margin-top:6px;padding-left:16px;font-size:13px;}
      .pomo-plan-checklist li{margin:2px 0;}
      .pomo-subject-card{border:1px solid var(--border,#2d2d2d);border-radius:12px;padding:12px;margin-top:12px;background:rgba(255,255,255,0.02);}
      .pomo-subject-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;}
      .pomo-subject-form{display:flex;gap:8px;flex-wrap:wrap;}
      .pomo-subject-form input{padding:8px 10px;border-radius:10px;border:1px solid var(--border,#2d2d2d);background:#0f172a;color:inherit;}
      .pomo-subject-goals{margin-top:8px;font-size:13px;display:grid;gap:6px;}
      .pomo-subject-goal{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border,#2d2d2d);border-radius:8px;}
      .pomo-subject-progress{flex:1;height:6px;background:#1f2937;border-radius:999px;overflow:hidden;}
      .pomo-subject-progress span{display:block;height:100%;background:#10b981;}
      .pomo-break-card{border:1px solid var(--border,#2d2d2d);border-radius:12px;padding:12px;margin-top:12px;background:rgba(255,255,255,0.02);}
      .pomo-break-head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .pomo-break-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px;}
      .pomo-break-note{font-size:12px;opacity:0.85;margin-top:4px;}
      .pomo-study-streak{border:1px solid var(--border,#2d2d2d);border-radius:12px;padding:12px;margin-top:12px;background:rgba(255,255,255,0.02);}
      .pomo-study-streak-head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .pomo-study-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:8px;}
      .pomo-study-day{height:40px;border-radius:10px;border:1px solid var(--border,#2d2d2d);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;gap:2px;}
      .pomo-study-day.hit{background:#22c55e22;border-color:#22c55e;}
      .pomo-study-day.miss{opacity:0.5;}
      .pomo-study-day.goal{background:#0ea5e922;border-color:#0ea5e9;}
      .pomo-badges{border:1px solid var(--border,#2d2d2d);border-radius:12px;padding:12px;margin-top:12px;background:rgba(255,255,255,0.02);}
      .pomo-badges h4{margin:0 0 6px 0;font-size:15px;}
      .pomo-badge-list{display:grid;gap:6px;}
      .pomo-badge{display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:10px;border:1px solid var(--border,#2d2d2d);}
      .pomo-badge.locked{opacity:0.55;}
      .pomo-badge .info{display:flex;flex-direction:column;gap:2px;}
      .pomo-badge .name{font-weight:600;}
      .pomo-badge .meta{font-size:12px;opacity:0.8;}
    `;
    const style = document.createElement("style");
    style.id = "pomo-log-styles";
    style.textContent = css;
    document.head.append(style);
  }

  function initPomodoroLogger(){
    const panel = document.getElementById("panel-pomodoro");
    const startBtn = document.getElementById("pomo-start");
    const skipBtn = document.getElementById("pomo-skip");
    const resetBtn = document.getElementById("pomo-reset");
    const completeEl = document.getElementById("pomo-complete");
    const modeLabel = document.getElementById("pomo-mode");
    const aside = document.querySelector("#panel-pomodoro .pomo-side");
    if(!panel || !startBtn || !completeEl || !modeLabel || !aside) return;

    injectStyles();

    const card = document.createElement("div");
    card.className = "pomo-side-card";
    card.id = "pomo-log-card";
    const head = document.createElement("div");
    head.className = "pomo-log-head";
    const title = document.createElement("h3");
    title.textContent = "Logging Activity";
    const status = document.createElement("div");
    status.className = "pomo-log-status";
    head.append(title, status);

    const lockMsg = document.createElement("div");
    lockMsg.className = "pomo-log-lock";
    lockMsg.textContent = "You must log each focus cycle before starting another.";

    const textarea = document.createElement("textarea");
    textarea.id = "pomo-log-text";
    textarea.placeholder = "What did you work on this cycle?";

    const actions = document.createElement("div");
    actions.className = "pomo-log-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "pomo-btn primary";
    saveBtn.textContent = "Log cycle & unlock";
    saveBtn.id = "pomo-log-save";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "pomo-btn ghost";
    cancelBtn.textContent = "Clear";
    cancelBtn.id = "pomo-log-clear";
    actions.append(saveBtn, cancelBtn);

    const error = document.createElement("div");
    error.className = "pomo-log-error";
    const list = document.createElement("div");
    list.id = "pomo-log-list";
    list.className = "pomo-log-list";
    const chart = document.createElement("div");
    chart.id = "pomo-log-chart";
    chart.className = "pomo-log-chart";

    const planner = document.createElement("div");
    planner.className = "pomo-plan-card";
    planner.innerHTML = `
      <h4>Smart Task Breakdown</h4>
      <div class="pomo-plan-form">
        <input type="text" id="pomo-plan-input" placeholder="e.g., Study for biology exam or Write history essay">
      </div>
      <div class="pomo-plan-actions">
        <button type="button" class="pomo-btn primary" id="pomo-plan-btn">Plan with AI</button>
        <div class="note" id="pomo-plan-note">Generates Pomodoro-sized steps you can tackle now.</div>
      </div>
      <div class="pomo-plan-result" id="pomo-plan-result"></div>
      <ul class="pomo-plan-checklist" id="pomo-plan-checklist"></ul>
    `;

    const streakCard = document.createElement("div");
    streakCard.className = "pomo-streak-card";
    streakCard.id = "pomo-streak-card";
    streakCard.innerHTML = `
      <div class="pomo-streak-head">
        <div class="pomo-streak-main"><span>🔥</span><span id="pomo-streak-count">0-day focus streak</span></div>
        <div class="pomo-streak-meta" id="pomo-streak-best">Best: 0</div>
      </div>
      <div class="pomo-streak-grid" id="pomo-streak-grid"></div>
      <div class="pomo-streak-freeze">
        <button type="button" id="pomo-streak-freeze-btn">Use streak freeze</button>
        <div id="pomo-streak-freeze-note">One-time pass to cover a missed day.</div>
      </div>
    `;

    const subjectCard = document.createElement("div");
    subjectCard.className = "pomo-subject-card";
    subjectCard.id = "pomo-subject-card";
    subjectCard.innerHTML = `
      <div class="pomo-subject-head">
        <strong>Subject / Project</strong>
        <span class="note" id="pomo-subject-msg" style="font-size:12px;">Tag cycles and set weekly goals.</span>
      </div>
      <div class="pomo-subject-form">
        <input type="text" id="pomo-subject-input" list="pomo-subject-list" placeholder="e.g., Math, Biology exam, Essay draft" style="flex:2;min-width:180px;">
        <datalist id="pomo-subject-list"></datalist>
        <input type="number" id="pomo-subject-goal" min="1" max="40" placeholder="Weekly goal (cycles)" style="width:140px;">
        <button type="button" class="pomo-btn ghost" id="pomo-subject-save">Set goal</button>
      </div>
      <div class="pomo-subject-goals" id="pomo-subject-goals"></div>
    `;

    const breakCard = document.createElement("div");
    breakCard.className = "pomo-break-card";
    breakCard.id = "pomo-break-card";
    breakCard.innerHTML = `
      <div class="pomo-break-head">
        <strong>Active Breaks</strong>
        <span id="pomo-break-count" class="note" style="font-size:12px;">0 logged this week</span>
      </div>
      <div id="pomo-break-suggestion">Waiting for break...</div>
      <div class="pomo-break-actions">
        <button type="button" class="pomo-btn ghost" id="pomo-break-refresh">New idea</button>
        <button type="button" class="pomo-btn primary" id="pomo-break-log">Log break move</button>
      </div>
      <div class="pomo-break-note" id="pomo-break-note">When a break starts, we'll suggest a quick move.</div>
    `;

    const studyStreakCard = document.createElement("div");
    studyStreakCard.className = "pomo-study-streak";
    studyStreakCard.id = "pomo-study-streak";
    studyStreakCard.innerHTML = `
      <div class="pomo-study-streak-head">
        <strong>Study Streak</strong>
        <span class="note" id="pomo-study-streak-meta" style="font-size:12px;">0-day streak</span>
      </div>
      <div class="pomo-study-grid" id="pomo-study-grid"></div>
      <div class="note" style="font-size:12px;margin-top:6px;">Hit your daily Pomodoro goal to keep the chain alive.</div>
    `;

    const badgeCard = document.createElement("div");
    badgeCard.className = "pomo-badges";
    badgeCard.id = "pomo-badges";
    badgeCard.innerHTML = `
      <h4>Achievements</h4>
      <div class="pomo-badge-list" id="pomo-badge-list"></div>
    `;

    card.append(
      head,
      lockMsg,
      textarea,
      actions,
      error,
      list,
      chart,
      subjectCard,
      planner,
      breakCard,
      studyStreakCard,
      badgeCard,
      streakCard
    );
    aside.append(card);

    const state = {
      entries: loadEntries(),
      pending: false,
      pendingAt: null,
      pendingCycle: null,
      notePending: false,
      notePendingAt: null,
      checkpointPending: false,
      checkpointPendingAt: null,
      lastLogAt: null,
      lastNoteAt: null,
      lastCheckpointAt: null,
      lastComplete: parseInt(completeEl.textContent || "0", 10) || 0,
      streak: loadStreak(),
      plan: loadPlan(),
      subjectGoals: loadSubjectGoals(),
      lastSubject: loadLastSubject(),
      breakStats: loadBreakStats(),
      studyStreak: loadStudyStreak(),
      badges: loadBadges()
    };

    const deleteSubjectGoal = (key)=>{ // removes stored goal only; caller decides reassigning entries
      if(!key) return;
      if(state.subjectGoals && state.subjectGoals[key]){
        const next = { ...state.subjectGoals };
        delete next[key];
        state.subjectGoals = next;
        saveSubjectGoals(state.subjectGoals);
      }
    };

    function reassignEntries(fromKey, toSubject="General"){
      if(!fromKey || !state.entries?.length) return;
      let changed = false;
      const newList = state.entries.map(e=>{
        if(subjectKey(e.subject) === fromKey){
          changed = true;
          return { ...e, subject: normalizeSubject(toSubject) };
        }
        return e;
      });
      if(changed){
        state.entries = newList;
        saveEntries(state.entries);
        if(subjectKey(state.lastSubject||"") === fromKey){
          state.lastSubject = normalizeSubject(toSubject);
          saveLastSubject(state.lastSubject);
        }
      }
      if(changed){
        renderList();
        renderChart();
        renderStreak();
        renderStudyStreak();
        renderBadges();
      }
    }

    function deleteAndReplaceSubject(fromKey, displayLabel, goalObj){
      const replacement = prompt(`Replace all "${displayLabel}" entries with (leave blank for General):`, "General");
      if(replacement === null) return;
      const target = normalizeSubject(replacement || "General");
      const targetKey = subjectKey(target);
      const ok = confirm(`Delete "${displayLabel}" and move entries to "${target}"?`);
      if(!ok) return;
      deleteSubjectGoal(fromKey);
      reassignEntries(fromKey, target);
      // preserve goal if moving to a new target that lacks a goal
      if(goalObj && goalObj.goal && !state.subjectGoals[targetKey]){
        state.subjectGoals[targetKey] = { label: target, goal: goalObj.goal };
        saveSubjectGoals(state.subjectGoals);
      }
      renderSubjectGoals();
      updateSubjectDatalist();
    }

    function deleteEntry(entryId){
      const before = state.entries.length;
      state.entries = state.entries.filter(e=> (e.id || e.ts) !== entryId);
      if(state.entries.length === before) return;
      saveEntries(state.entries);
      renderList();
      renderChart();
      renderStreak();
      renderStudyStreak();
      renderSubjectGoals();
      renderBadges();
      updateSubjectDatalist();
    }

    function renderList(){
      list.innerHTML = "";
      if(!state.entries.length){
        list.textContent = "No cycles logged yet.";
        return;
      }
      const totalLabel = document.createElement("div");
      totalLabel.className = "pomo-log-total";
      totalLabel.textContent = `${state.entries.length} logged ${state.entries.length===1 ? "cycle" : "cycles"}`;
      list.append(totalLabel);
      state.entries.slice(0,6).forEach(entry=>{
        const row = document.createElement("div");
        row.className = "pomo-log-item";
        const when = new Date(entry.ts);
        const meta = document.createElement("div");
        meta.style.fontSize = "12px";
        meta.style.opacity = "0.8";
        const subjectLabel = normalizeSubject(entry.subject || "General");
        meta.textContent = `${when.toLocaleString()} ${entry.cycle ? `(Cycle ${entry.cycle})` : ""} • ${subjectLabel}`;
        const body = document.createElement("div");
        body.textContent = entry.note || "";
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.justifyContent = "flex-end";
        const delBtn = document.createElement("button");
        delBtn.className = "pomo-btn ghost";
        delBtn.type = "button";
        delBtn.style.padding = "6px 10px";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", ()=>{
          const id = entry.id || entry.ts;
          const ok = confirm("Delete this log entry?");
          if(!ok) return;
          deleteEntry(id);
        });
        actions.append(delBtn);
        row.append(meta, body, actions);
        list.append(row);
      });
    }

    function renderChart(){
      chart.innerHTML = "";
      const start = startOfWeek(new Date());
      const buckets = dayLabels.map((label, idx)=>{
        const day = new Date(start);
        day.setDate(start.getDate()+idx);
        const count = state.entries.filter(e=> sameDay(new Date(e.ts), day)).length;
        return { label, count };
      });
      const max = Math.max(1, ...buckets.map(b=>b.count));
      buckets.forEach(bucket=>{
        const wrap = document.createElement("div");
        wrap.className = "pomo-log-bar";
        const bar = document.createElement("div");
        bar.className = "bar";
        const fill = document.createElement("div");
        fill.className = "bar-fill";
        const pct = max ? Math.max(6, Math.round((bucket.count / max)*100)) : 6;
        fill.style.height = `${pct}%`;
        const countBadge = document.createElement("div");
        countBadge.className = "pomo-log-count";
        countBadge.textContent = bucket.count;
        bar.append(fill, countBadge);
        const lbl = document.createElement("label");
        lbl.textContent = `${bucket.label} (${bucket.count})`;
        wrap.append(bar, lbl);
        chart.append(wrap);
      });
    }

    function renderStreak(){
      const streakCountEl = document.getElementById("pomo-streak-count");
      const streakBestEl = document.getElementById("pomo-streak-best");
      const grid = document.getElementById("pomo-streak-grid");
      const freezeBtn = document.getElementById("pomo-streak-freeze-btn");
      const freezeNote = document.getElementById("pomo-streak-freeze-note");
      if(!streakCountEl || !grid || !freezeBtn || !freezeNote || !streakBestEl) return;

      const completions = new Set(state.entries.map(e=> formatDayKey(e.ts)));
      if(state.streak.freezeDay) completions.add(state.streak.freezeDay);

      // Compute streak from today backwards
      const today = new Date();
      today.setHours(0,0,0,0);
      let streak = 0;
      for(let i=0;i<90;i++){ // cap search to 90 days
        const d = new Date(today);
        d.setDate(today.getDate()-i);
        const key = formatDayKey(d);
        if(completions.has(key)){
          streak += 1;
        } else if(!state.streak.freezeUsed){
          // allow one skipped day placeholder, but don't consume automatically
          break;
        } else {
          break;
        }
      }
      state.streak.current = streak;
      if(streak > state.streak.best) state.streak.best = streak;
      streakCountEl.textContent = `🔥 ${streak}-day focus streak`;
      streakBestEl.textContent = `Best: ${state.streak.best}`;

      // Build last 14 days grid
      grid.innerHTML = "";
      const last14 = [];
      for(let i=13;i>=0;i--){
        const d = new Date(today);
        d.setDate(today.getDate()-i);
        last14.push(d);
      }
      last14.forEach(d=>{
        const key = formatDayKey(d);
        const cell = document.createElement("div");
        cell.className = "pomo-streak-day";
        if(completions.has(key)){
          cell.classList.add("on");
        } else if(state.streak.freezeDay === key){
          cell.classList.add("freeze");
        } else {
          cell.classList.add("missed");
        }
        const lbl = document.createElement("div");
        lbl.textContent = d.toLocaleDateString(undefined,{month:"short",day:"numeric"}).replace(",", "");
        const dot = document.createElement("div");
        dot.className = "dot";
        cell.append(lbl, dot);
        grid.append(cell);
      });

      freezeBtn.disabled = state.streak.freezeUsed;
      freezeBtn.textContent = state.streak.freezeUsed ? "Freeze used" : "Use streak freeze";
      freezeNote.textContent = state.streak.freezeUsed
        ? state.streak.freezeDay ? `Freeze applied to ${state.streak.freezeDay}.` : "Freeze already used."
        : "One-time pass to cover a missed day.";
      saveStreak(state.streak);
    }

    function renderStudyStreak(){
      const meta = document.getElementById("pomo-study-streak-meta");
      const grid = document.getElementById("pomo-study-grid");
      if(!meta || !grid) return;
      const weekStart = startOfWeek(new Date());
      const weekKey = weekStart.toISOString();
      const days = {};
      state.entries.forEach(e=>{
        const key = formatDayKey(e.ts);
        days[key] = (days[key]||0) + 1;
      });
      const weekDays = [];
      for(let i=0;i<7;i++){
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate()+i);
        weekDays.push(d);
      }
      grid.innerHTML = "";
      weekDays.forEach(d=>{
        const key = formatDayKey(d);
        const hit = days[key] >= DAILY_GOAL;
        const cell = document.createElement("div");
        cell.className = "pomo-study-day " + (hit ? "hit" : "miss");
        const lbl = document.createElement("div");
        lbl.textContent = d.toLocaleDateString(undefined,{weekday:"short"});
        const dot = document.createElement("div");
        dot.textContent = hit ? "●" : "○";
        cell.append(lbl, dot);
        grid.append(cell);
      });
      // update streak counts across all days
      const sortedKeys = Object.keys(days).sort();
      let current = 0;
      let best = state.studyStreak.best || 0;
      sortedKeys.forEach(k=>{
        if(days[k] >= DAILY_GOAL){
          current += 1;
          if(current > best) best = current;
        } else {
          current = 0;
        }
      });
      state.studyStreak.current = current;
      state.studyStreak.best = best;
      state.studyStreak.days = days;
      saveStudyStreak(state.studyStreak);
      meta.textContent = `Current streak: ${current} | Best: ${best}`;
    }

    function renderBadges(){
      const list = document.getElementById("pomo-badge-list");
      if(!list) return;
      const focusInput = document.getElementById("pomo-focus-input");
      const focusMinutes = Math.max(1, parseInt(focusInput?.value || "50", 10));
      const totalHours = state.entries.reduce((acc,e)=> acc + ((e.focusMins||focusMinutes)/60), 0);
      const dailyCounts = {};
      state.entries.forEach(e=>{
        const key = formatDayKey(e.ts);
        dailyCounts[key] = (dailyCounts[key]||0)+1;
      });
      const maxDay = Math.max(0, ...Object.values(dailyCounts));
      const definitions = [
        { id:"first-cycle", name:"First Focus", desc:"Log your first Pomodoro.", test:()=> state.entries.length>=1 },
        { id:"ten-in-day", name:"10 in a Day", desc:"Complete 10 Pomodoro cycles in one day.", test:()=> maxDay>=10 },
        { id:"fifty-cycles", name:"50 Cycles", desc:"Complete 50 Pomodoro cycles.", test:()=> state.entries.length>=50 },
        { id:"hundred-hours", name:"100 Hours", desc:"Accumulate 100 focus hours.", test:()=> totalHours>=100 },
        { id:"week-streak", name:"7-Day Streak", desc:"Maintain a 7-day study streak.", test:()=> (state.studyStreak.current||0) >=7 }
      ];
      const unlocked = new Map((state.badges||[]).map(b=>[b.id,b]));
      definitions.forEach(def=>{
        const already = unlocked.get(def.id);
        if(!already && def.test()){
          unlocked.set(def.id, { id:def.id, name:def.name, desc:def.desc, unlockedAt:new Date().toISOString() });
        }
      });
      state.badges = Array.from(unlocked.values());
      saveBadges(state.badges);
      list.innerHTML = "";
      definitions.forEach(def=>{
        const badge = unlocked.get(def.id);
        const row = document.createElement("div");
        row.className = "pomo-badge" + (badge ? "" : " locked");
        const info = document.createElement("div");
        info.className = "info";
        const name = document.createElement("div");
        name.className = "name";
        name.textContent = def.name;
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = badge ? `Unlocked ${new Date(badge.unlockedAt).toLocaleDateString()}` : def.desc;
        info.append(name, meta);
        const icon = document.createElement("div");
        icon.textContent = badge ? "🏆" : "🔒";
        row.append(info, icon);
        list.append(row);
      });
    }

    function updateStatus(){
      const total = state.entries.length;
      status.textContent = `${total} logged ${total===1 ? "cycle" : "cycles"} saved`;
      const locked = state.pending || state.notePending || state.checkpointPending;
      card.classList.toggle("locked", locked);
      if(state.pending){
        const cycleMsg = state.pendingCycle ? `Cycle ${state.pendingCycle} finished.` : "Cycle finished.";
        lockMsg.textContent = `${cycleMsg} Log what you worked on to start the next focus block.`;
      } else if(state.notePending){
        lockMsg.textContent = "Add a Quick Note to unlock the next Pomodoro.";
      } else if(state.checkpointPending){
        lockMsg.textContent = "Complete the self-checkpoint to unlock the next Pomodoro.";
      } else {
        lockMsg.textContent = "You must log each focus cycle before starting another.";
      }
      lockMsg.style.display = locked ? "" : "none";
    }

    function focusInput(){
      setTimeout(()=> textarea.focus(), 10);
    }
    function focusQuickNote(){
      const note = document.getElementById("pomo-note-scratch");
      if(note){
        note.focus();
        try{ note.scrollIntoView({ behavior:"smooth", block:"center" }); }catch(e){}
      }
    }

    function enforceLock(){
      const locked = state.pending || state.notePending || state.checkpointPending;
      if(!locked){
        startBtn.removeAttribute("disabled");
        skipBtn?.removeAttribute("disabled");
        return;
      }
      const focusMode = (modeLabel.textContent || "").toLowerCase().includes("focus");
      if(focusMode && startBtn.textContent.trim().toLowerCase() === "pause"){
        startBtn.click(); // pause active focus if it auto-started
      }
      if(focusMode){
        startBtn.setAttribute("disabled","true");
        skipBtn?.setAttribute("disabled","true");
      } else {
        startBtn.removeAttribute("disabled");
        skipBtn?.removeAttribute("disabled");
      }
    }

    function requireLog(cycleCount){
      state.pending = true;
      state.pendingAt = new Date();
      state.pendingCycle = cycleCount;
      state.notePending = false;
      state.notePendingAt = null;
      error.textContent = "";
      updateStatus();
      enforceLock();
      focusInput();
    }

    function clearPending(){
      state.pending = false;
      state.pendingAt = null;
      state.pendingCycle = null;
      error.textContent = "";
      updateStatus();
      enforceLock();
    }
    function requireNote(){
      state.notePending = true;
      state.notePendingAt = new Date();
      error.textContent = "Add a Quick Note to unlock the timer.";
      updateStatus();
      enforceLock();
      focusQuickNote();
    }
    function clearNotePending(){
      state.notePending = false;
      state.notePendingAt = null;
      state.lastNoteAt = new Date();
      if(!state.pending) error.textContent = "";
      updateStatus();
      enforceLock();
    }
    function requireCheckpoint(){
      state.checkpointPending = true;
      state.checkpointPendingAt = new Date();
      error.textContent = "Write your self-checkpoint to unlock the timer.";
      updateStatus();
      enforceLock();
      try{
        window.dispatchEvent(new CustomEvent("pomoCheckpointRequired", {
          detail:{ ts: state.checkpointPendingAt.getTime() }
        }));
      }catch(e){}
    }
    function clearCheckpointPending(){
      state.checkpointPending = false;
      state.checkpointPendingAt = null;
      state.lastCheckpointAt = new Date();
      if(!state.pending && !state.notePending) error.textContent = "";
      updateStatus();
      enforceLock();
    }

    function submitLog(){
      const note = (textarea.value || "").trim();
      if(!note){
        error.textContent = "Add a short note about what you worked on.";
        focusInput();
        return;
      }
      const subjectInput = document.getElementById("pomo-subject-input");
      const rawSubject = (subjectInput?.value || "").trim() || state.lastSubject || "General";
      const subject = normalizeSubject(rawSubject);
      state.lastSubject = subject;
      saveLastSubject(subject);
      if(subjectInput) subjectInput.value = subject;
      updateSubjectDatalist();
      const focusInputEl = document.getElementById("pomo-focus-input");
      const focusMins = Math.max(1, parseInt(focusInputEl?.value || "50", 10));
      const entry = {
        id: Date.now(),
        ts: state.pendingAt ? state.pendingAt.toISOString() : new Date().toISOString(),
        note,
        cycle: state.pendingCycle || undefined,
        subject,
        focusMins
      };
      state.entries.unshift(entry);
      saveEntries(state.entries);
      // mark the day as completed for streaks
      state.streak = { ...state.streak, freezeDay: state.streak.freezeDay, freezeUsed: state.streak.freezeUsed };
      saveStreak(state.streak);
      textarea.value = "";
      state.lastLogAt = new Date(entry.ts);
      clearPending();
      requireNote();
      renderList();
      renderChart();
      renderStreak();
      renderStudyStreak();
      renderSubjectGoals();
      renderBadges();
    }

    window.__pomoLogSave = (text)=>{
      if(typeof text === "string"){
        textarea.value = text;
      }
      submitLog();
    };

    saveBtn.addEventListener("click", submitLog);
    cancelBtn.addEventListener("click", ()=>{
      textarea.value = "";
      error.textContent = "";
      focusInput();
    });

    startBtn.addEventListener("click", (e)=>{
      const focusMode = (modeLabel.textContent || "").toLowerCase().includes("focus");
      if(state.pending && focusMode){
        e.stopImmediatePropagation();
        e.preventDefault();
        error.textContent = "Log your last cycle to unlock the timer.";
        focusInput();
        return;
      }
      if(state.notePending && focusMode){
        e.stopImmediatePropagation();
        e.preventDefault();
        error.textContent = "Add a Quick Note to start the next Pomodoro.";
        focusQuickNote();
        return;
      }
      if(state.checkpointPending && focusMode){
        e.stopImmediatePropagation();
        e.preventDefault();
        error.textContent = "Finish the self-checkpoint to start the next Pomodoro.";
        requireCheckpoint();
        return;
      }
    }, true);

    skipBtn?.addEventListener("click", (e)=>{
      if(state.pending){
        e.stopImmediatePropagation();
        e.preventDefault();
        error.textContent = "Log your last cycle before skipping.";
        focusInput();
        return;
      }
      if(state.notePending){
        e.stopImmediatePropagation();
        e.preventDefault();
        error.textContent = "Add a Quick Note before skipping.";
        focusQuickNote();
        return;
      }
      if(state.checkpointPending){
        e.stopImmediatePropagation();
        e.preventDefault();
        error.textContent = "Finish the self-checkpoint before skipping.";
        requireCheckpoint();
        return;
      }
    }, true);

    document.addEventListener("keydown", e=>{
      if(!state.pending && !state.notePending && !state.checkpointPending) return;
      const tag = (e.target && e.target.tagName || "").toLowerCase();
      if(tag === "textarea" || tag === "input" || e.target?.isContentEditable) return;
      const key = e.key ? e.key.toLowerCase() : "";
      if((e.code === "Space" || key === " " || key === "n") && (modeLabel.textContent || "").toLowerCase().includes("focus")){
        e.preventDefault();
        if(state.pending){
          error.textContent = "Logging required before starting another focus block.";
          focusInput();
        } else if(state.notePending){
          error.textContent = "Add a Quick Note to start the next Pomodoro.";
          focusQuickNote();
        } else if(state.checkpointPending){
          error.textContent = "Finish the self-checkpoint to start the next Pomodoro.";
          requireCheckpoint();
        }
      }
    });

    resetBtn?.addEventListener("click", ()=>{
      state.lastComplete = parseInt(completeEl.textContent || "0", 10) || 0;
      clearPending();
      clearNotePending();
      clearCheckpointPending();
    });

    window.addEventListener("pomoQuickNoteAdded", e=>{
      if(!state.notePending) return;
      const ts = e?.detail?.ts ? Number(e.detail.ts) : Date.now();
      const threshold = state.notePendingAt ? state.notePendingAt.getTime() : (state.lastLogAt ? state.lastLogAt.getTime() : 0);
      if(ts >= threshold){
        clearNotePending();
        requireCheckpoint();
      }
    });
    window.addEventListener("pomoCheckpointSaved", e=>{
      if(!state.checkpointPending) return;
      const ts = e?.detail?.ts ? Number(e.detail.ts) : Date.now();
      const threshold = state.checkpointPendingAt ? state.checkpointPendingAt.getTime() : (state.lastNoteAt ? state.lastNoteAt.getTime() : 0);
      if(ts >= threshold){
        clearCheckpointPending();
      }
    });

    const completionObserver = new MutationObserver(()=>{
      const val = parseInt(completeEl.textContent || "0", 10);
      if(isNaN(val)) return;
      if(val > state.lastComplete){
        state.lastComplete = val;
        // award XP on each completed Pomodoro cycle
        try{
          if(typeof window.addXP === "function") window.addXP(20);
        }catch(e){}
        requireLog(val);
      } else {
        state.lastComplete = val;
      }
    });
    completionObserver.observe(completeEl, { characterData:true, childList:true, subtree:true });

    const modeObserver = new MutationObserver(enforceLock);
    modeObserver.observe(modeLabel, { characterData:true, childList:true, subtree:true });

    renderList();
    renderChart();
    updateStatus();
    renderStreak();

    document.getElementById("pomo-streak-freeze-btn")?.addEventListener("click", ()=>{
      if(state.streak.freezeUsed) return;
      const todayKey = formatDayKey(new Date());
      state.streak.freezeUsed = true;
      state.streak.freezeDay = todayKey;
      saveStreak(state.streak);
      renderStreak();
    });

    // Smart Task Breakdown
    const planInput = document.getElementById("pomo-plan-input");
    const planBtn = document.getElementById("pomo-plan-btn");
    const planResult = document.getElementById("pomo-plan-result");
    const planList = document.getElementById("pomo-plan-checklist");
    const planNote = document.getElementById("pomo-plan-note");

    function renderPlan(){
      if(!planResult || !planList) return;
      planList.innerHTML = "";
      if(!state.plan || !state.plan.steps?.length){
        planResult.textContent = "Enter a big task and generate a Pomodoro plan.";
        return;
      }
      planResult.textContent = `Plan for: ${state.plan.title}`;
      state.plan.steps.forEach((step, idx)=>{
        const li = document.createElement("li");
        li.textContent = step;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pomo-btn ghost";
        btn.style.marginLeft = "8px";
        btn.textContent = "Set next focus";
        btn.addEventListener("click", ()=>{
          const modeLabel = document.getElementById("pomo-mode");
          const startBtn = document.getElementById("pomo-start");
          if(modeLabel) modeLabel.textContent = `Focus: ${step}`;
          startBtn?.click();
        });
        li.append(btn);
        planList.append(li);
      });
    }

    if(planBtn){
      planBtn.addEventListener("click", ()=>{
        const text = (planInput?.value || "").trim();
        const plan = breakdownTask(text);
        if(!plan){
          if(planNote) planNote.textContent = "Add a task first (e.g., 'Study for biology exam').";
          return;
        }
        state.plan = plan;
        savePlan(plan);
        renderPlan();
        if(planNote) planNote.textContent = "Plan created. Use 'Set next focus' to start.";
      });
    }

    if(state.plan){
      renderPlan();
    } else if(planResult){
      planResult.textContent = "Enter a big task and generate a Pomodoro plan.";
    }

    // Subject tagging + goals
    const subjectInput = document.getElementById("pomo-subject-input");
    const subjectList = document.getElementById("pomo-subject-list");
    const subjectGoalInput = document.getElementById("pomo-subject-goal");
    const subjectSaveBtn = document.getElementById("pomo-subject-save");
    const subjectGoalsWrap = document.getElementById("pomo-subject-goals");
    const subjectMsg = document.getElementById("pomo-subject-msg");
    if(subjectInput && state.lastSubject){
      subjectInput.value = state.lastSubject;
    }

    function knownSubjects(){
      const map = new Map();
      state.entries.forEach(e=>{
        const subj = normalizeSubject(e.subject || "General");
        const key = subjectKey(subj);
        if(!map.has(key)) map.set(key, subj);
      });
      if(state.lastSubject){
        const subj = normalizeSubject(state.lastSubject);
        const key = subjectKey(subj);
        if(!map.has(key)) map.set(key, subj);
      }
      Object.values(state.subjectGoals||{}).forEach(obj=>{
        const subj = normalizeSubject(obj?.label || "General");
        const key = subjectKey(subj);
        if(!map.has(key)) map.set(key, subj);
      });
      if(!map.size) map.set("general","General");
      return Array.from(map.values()).slice(0,25);
    }

    function updateSubjectDatalist(){
      if(!subjectList) return;
      subjectList.innerHTML = "";
      knownSubjects().forEach(s=>{
        const opt = document.createElement("option");
        opt.value = s;
        subjectList.append(opt);
      });
    }

    function renderSubjectGoals(){
      if(!subjectGoalsWrap) return;
      subjectGoalsWrap.innerHTML = "";
      const weekKey = currentWeekKey();
      const weeklyCounts = {};
      state.entries.forEach(e=>{
        const key = formatDayKey(e.ts);
        if(startOfWeek(new Date(key)).toISOString() !== weekKey) return;
        const subj = normalizeSubject(e.subject || "General");
        const sKey = subjectKey(subj);
        weeklyCounts[sKey] = { label: subj, count: (weeklyCounts[sKey]?.count||0)+1 };
      });
      const subjects = knownSubjects();
      subjects.forEach(subj=>{
        const lbl = normalizeSubject(subj);
        const sKey = subjectKey(lbl);
        const goalObj = state.subjectGoals?.[sKey];
        const goal = Number(goalObj?.goal||0);
        const done = weeklyCounts[sKey]?.count || 0;
      const displayLabel = goalObj?.label || weeklyCounts[sKey]?.label || lbl;
      const row = document.createElement("div");
        row.className = "pomo-subject-goal";
        const label = document.createElement("div");
        label.textContent = goal ? `${displayLabel} — ${done}/${goal}` : `${displayLabel} — ${done} this week`;
        label.style.flex = "1";
        const barWrap = document.createElement("div");
      barWrap.className = "pomo-subject-progress";
      const bar = document.createElement("span");
      const pct = goal ? Math.min(100, Math.round((done/goal)*100)) : Math.min(100, done*20);
      bar.style.width = `${pct}%`;
      barWrap.append(bar);
        row.append(label, barWrap);

        if(sKey !== "general"){ // allow deleting/replacing any non-General subject
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "pomo-btn ghost";
          delBtn.style.padding = "6px 10px";
          delBtn.textContent = "Delete";
          delBtn.addEventListener("click", ()=> deleteAndReplaceSubject(sKey, displayLabel, goalObj));
          row.append(delBtn);
        }

      subjectGoalsWrap.append(row);
    });
  }

    subjectSaveBtn?.addEventListener("click", ()=>{
      const subjRaw = (subjectInput?.value || state.lastSubject || "").trim();
      const subj = normalizeSubject(subjRaw);
      if(!subj) return;
      const goal = Math.max(1, Math.min(40, Number(subjectGoalInput?.value || 0)));
      const key = subjectKey(subj);
      state.subjectGoals = { ...(state.subjectGoals||{}), [key]: { label: subj, goal } };
      state.lastSubject = subj;
      saveLastSubject(subj);
      if(subjectInput) subjectInput.value = subj;
      saveSubjectGoals(state.subjectGoals);
      updateSubjectDatalist();
      renderSubjectGoals();
    });

    function ensureSubjectSelected(){
      if(subjectInput && !subjectInput.value.trim() && state.lastSubject){
        subjectInput.value = state.lastSubject;
      }
      const subjRaw = (subjectInput?.value || "").trim();
      if(!subjRaw){
        if(subjectMsg) subjectMsg.textContent = "Pick the class/project before starting your first Pomodoro.";
        subjectInput?.focus();
        return false;
      }
      const subj = normalizeSubject(subjRaw);
      state.lastSubject = subj;
      saveLastSubject(subj);
      if(subjectMsg) subjectMsg.textContent = "Tag cycles and set weekly goals.";
      updateSubjectDatalist();
      renderSubjectGoals();
      return true;
    }

    subjectInput?.addEventListener("input", ()=>{ if(subjectMsg) subjectMsg.textContent = "Tag cycles and set weekly goals."; });

    startBtn?.addEventListener("click",(e)=>{
      if(!ensureSubjectSelected()){
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);

    // Active break suggestions
    const breakSuggestionEl = document.getElementById("pomo-break-suggestion");
    const breakNoteEl = document.getElementById("pomo-break-note");
    const breakCountEl = document.getElementById("pomo-break-count");
    const breakRefreshBtn = document.getElementById("pomo-break-refresh");
    const breakLogBtn = document.getElementById("pomo-break-log");
    const breakIdeas = [
      "10 jumping jacks",
      "5-minute stretch: neck, shoulders, wrists",
      "Wall sit for 45 seconds",
      "Calf raises x20 + ankle rolls",
      "Hip flexor stretch both sides",
      "10 slow air squats",
      "Plank 30-45 seconds",
      "Box breathing 10 cycles"
    ];
    function resetBreakWeekIfNeeded(){
      const wk = currentWeekKey();
      if(state.breakStats.week !== wk){
        state.breakStats = { ...state.breakStats, week:wk, count:0 };
        saveBreakStats(state.breakStats);
      }
    }
    function setBreakSuggestion(forceText){
      if(!breakSuggestionEl || !breakNoteEl || !breakCountEl) return;
      resetBreakWeekIfNeeded();
      if(forceText){
        breakSuggestionEl.textContent = forceText;
      } else {
        const idea = breakIdeas[Math.floor(Math.random()*breakIdeas.length)];
        breakSuggestionEl.textContent = idea;
        state.breakStats.lastSuggestion = idea;
      }
      const count = state.breakStats.count || 0;
      breakCountEl.textContent = `${count} logged this week`;
      breakNoteEl.textContent = "Do it during this break, then log it.";
      saveBreakStats(state.breakStats);
    }
    function logBreakMove(){
      resetBreakWeekIfNeeded();
      state.breakStats.count = (state.breakStats.count||0)+1;
      saveBreakStats(state.breakStats);
      setBreakSuggestion(state.breakStats.lastSuggestion || breakSuggestionEl?.textContent);
    }
    window.__pomoLogBreakMove = (label, note)=>{
      if(label) setBreakSuggestion(label);
      logBreakMove();
      if(note){
        try{
          const key = "planner_pomo_quick_notes";
          const raw = JSON.parse(localStorage.getItem(key)) || { scratch:"", entries:[] };
          raw.entries = [note, ...(Array.isArray(raw.entries)? raw.entries : [])].slice(0,50);
          localStorage.setItem(key, JSON.stringify(raw));
          window.dispatchEvent(new CustomEvent("pomoQuickNoteAdded",{ detail:{ text: note, ts: Date.now() } }));
        }catch(e){}
      }
    };
    breakRefreshBtn?.addEventListener("click", ()=> setBreakSuggestion());
    breakLogBtn?.addEventListener("click", logBreakMove);
    setBreakSuggestion(state.breakStats.lastSuggestion || "Waiting for break...");

    // Detect break transitions from Pomodoro mode label
    const breakObserver = new MutationObserver(()=>{
      const text = (modeLabel.textContent || "").toLowerCase();
      if(text.includes("break")){
        setBreakSuggestion();
      }
    });
    breakObserver.observe(modeLabel, { characterData:true, childList:true, subtree:true });

    updateSubjectDatalist();
    renderSubjectGoals();
    renderStudyStreak();
    renderBadges();
  }

  if(document.readyState === "complete" || document.readyState === "interactive"){
    setTimeout(initPomodoroLogger, 0);
  } else {
    document.addEventListener("DOMContentLoaded", initPomodoroLogger);
  }
})();
