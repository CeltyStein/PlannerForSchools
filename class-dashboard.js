(function(){
  const CAL_KEY = "planner-calendar-events";
  const DANGER_BOSS_KEY = "planner_danger_boss_done";
  const termWrap = document.getElementById("class-term-filter");
  const grid = document.getElementById("class-all-grid");
  const searchInput = document.getElementById("class-search");
  const refreshBtn = document.getElementById("class-refresh");
  const showCompletedToggle = document.getElementById("class-show-completed");

  let termFilter = "all";
  let searchTerm = "";
  let showCompleted = false;

  const normalizeTitle = (value)=> String(value || "").replace(/\s+/g, " ").trim();
  const normalizeDueKey = (value)=>{
    if(value === null || value === undefined) return "";
    if(typeof value === "number") return value;
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? String(value) : parsed;
  };
  const makeDangerKey = (item)=> `${normalizeTitle(item.title || "").toLowerCase()}|${normalizeDueKey(item.due)}`;
  const loadDangerBossDone = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem(DANGER_BOSS_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    }catch(e){
      return new Set();
    }
  };
  const saveDangerBossDone = (set)=>{
    try{ localStorage.setItem(DANGER_BOSS_KEY, JSON.stringify(Array.from(set || []))); }catch(e){}
  };
  const loadEvents = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem(CAL_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    }catch(e){
      return [];
    }
  };
  const isCourseAssignmentEvent = (ev)=>{
    const title = String(ev?.title || "");
    if(/\[[^\]]+\]/.test(title)) return true;
    if(/\b[A-Z]{2,4}-\d{3}(?:-[A-Z0-9]+)?\b/.test(title)) return true;
    const url = String(ev?.url || "");
    return /include_contexts=course_/i.test(url);
  };
  const parseCourseMeta = (title)=>{
    const match = /\[(.+?)\]/.exec(title || "");
    let rawCode = match ? match[1].trim() : "";
    if(!rawCode){
      const codeMatch = /\b([A-Z]{2,4}-\d{3}(?:-[A-Z0-9]+)?)\b/.exec(title || "");
      rawCode = codeMatch ? codeMatch[1].trim() : "General";
    }
    const code = rawCode.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/");
    const courseTitle = (title || "").replace(match ? match[0] : "", "").replace(rawCode, "").trim() || title || "";
    const parts = code.split(/\s+/);
    const termKey = (parts[0] || "").toUpperCase();
    let term = "";
    if(termKey.includes("FA")) term = "fall";
    else if(termKey.includes("SP")) term = "spring";
    else if(termKey.includes("SU")) term = "summer";
    const courseId = parts.slice(1).join(" ").trim() || code;
    return { code, courseId, courseTitle, term, rawCode };
  };
  const buildClassCoursesFromEvents = (events)=>{
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
        due: ev.start || ev.date || "",
        description: ev.description || "",
        url: ev.url || ""
      });
    });
    map.forEach(course=>{
      course.entries.sort((a,b)=> new Date(a.due || 0).getTime() - new Date(b.due || 0).getTime());
      list.push(course);
    });
    list.sort((a,b)=> a.id.localeCompare(b.id));
    return list;
  };

  const formatDue = (due)=>{
    const date = new Date(due || Date.now());
    if(Number.isNaN(date.getTime())) return "No due date";
    return date.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
  };

  const render = ()=>{
    if(!grid) return;
    grid.innerHTML = "";
    const events = loadEvents().filter(isCourseAssignmentEvent);
    if(!events.length){
      grid.appendChild(Object.assign(document.createElement("div"),{
        className:"class-empty",
        textContent:"No class assignments found yet. Import your .ics in the Calendar tab first."
      }));
      return;
    }
    const bossDone = loadDangerBossDone();
    let courses = buildClassCoursesFromEvents(events);
    if(termFilter !== "all"){
      courses = courses.filter(course=>course.term === termFilter);
    }
    if(searchTerm){
      const query = searchTerm.toLowerCase();
      courses = courses.map(course=>{
        const filtered = course.entries.filter(entry=>{
          const hay = `${entry.title} ${entry.description} ${entry.rawTitle}`.toLowerCase();
          return hay.includes(query);
        });
        return { ...course, entries: filtered };
      }).filter(course=>course.entries.length);
    }
    if(!courses.length){
      grid.appendChild(Object.assign(document.createElement("div"),{
        className:"class-empty",
        textContent:"No matching assignments for that filter."
      }));
      return;
    }
    courses.forEach(course=>{
      const card = document.createElement("div");
      card.className = "class-card";
      const head = document.createElement("div");
      head.className = "class-card-head";
      const titleWrap = document.createElement("div");
      const h3 = document.createElement("h3");
      h3.textContent = course.id;
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = course.code || "";
      titleWrap.appendChild(h3);
      titleWrap.appendChild(note);
      const term = document.createElement("div");
      term.className = "class-term-pill";
      term.textContent = (course.term || "term").toUpperCase();
      head.appendChild(titleWrap);
      head.appendChild(term);
      card.appendChild(head);

      const list = document.createElement("div");
      list.className = "class-assignments";
      const entries = course.entries || [];
      entries.forEach(entry=>{
        const key = makeDangerKey(entry);
        const isDone = bossDone.has(key);
        if(isDone && !showCompleted) return;
        const row = document.createElement("div");
        row.className = `class-assignment${isDone ? " completed" : ""}`;
        const rowTop = document.createElement("div");
        rowTop.className = "class-assignment-row";
        const info = document.createElement("div");
        info.appendChild(Object.assign(document.createElement("div"),{
          className:"class-assignment-title",
          textContent: entry.title || entry.rawTitle || "Assignment"
        }));
        info.appendChild(Object.assign(document.createElement("div"),{
          className:"class-assignment-meta",
          textContent: `${formatDue(entry.due)}${entry.description ? " - " + entry.description : ""}`
        }));
        const actions = document.createElement("div");
        actions.className = "class-assignment-actions";
        if(entry.url){
          const link = document.createElement("a");
          link.className = "btn";
          link.href = entry.url;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = "Open";
          actions.appendChild(link);
        }
        const completeBtn = document.createElement("button");
        completeBtn.className = "btn";
        completeBtn.type = "button";
        completeBtn.textContent = isDone ? "Undo" : "Delete";
        completeBtn.addEventListener("click", ()=>{
          const nextSet = loadDangerBossDone();
          if(nextSet.has(key)){
            nextSet.delete(key);
          } else {
            nextSet.add(key);
          }
          saveDangerBossDone(nextSet);
          render();
        });
        actions.appendChild(completeBtn);
        rowTop.appendChild(info);
        rowTop.appendChild(actions);
        row.appendChild(rowTop);
        list.appendChild(row);
      });
      if(!list.children.length){
        list.appendChild(Object.assign(document.createElement("div"),{
          className:"note",
          textContent:"No assignments found for this class."
        }));
      }
      card.appendChild(list);
      grid.appendChild(card);
    });
  };

  const renderFilters = ()=>{
    if(!termWrap) return;
    termWrap.innerHTML = "";
    const filters = [
      { id:"all", label:"All terms" },
      { id:"fall", label:"Fall" },
      { id:"spring", label:"Spring" },
      { id:"summer", label:"Summer" }
    ];
    filters.forEach(f=>{
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn${termFilter===f.id?" tab":""}`;
      btn.textContent = f.label;
      btn.setAttribute("aria-pressed", String(termFilter===f.id));
      btn.addEventListener("click", ()=>{
        termFilter = f.id;
        renderFilters();
        render();
      });
      termWrap.appendChild(btn);
    });
  };

  searchInput?.addEventListener("input", (e)=>{
    searchTerm = String(e.target.value || "").trim();
    render();
  });
  showCompletedToggle?.addEventListener("change", (e)=>{
    showCompleted = !!e.target.checked;
    render();
  });
  refreshBtn?.addEventListener("click", render);
  window.addEventListener("storage", (event)=>{
    if(event.key === CAL_KEY || event.key === DANGER_BOSS_KEY){
      render();
    }
  });

  renderFilters();
  render();
})();
