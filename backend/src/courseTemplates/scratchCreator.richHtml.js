const css = `
<style>
  .sc-rich { --blue:#3f8cff; --yellow:#ffbf2f; --orange:#ff9f1c; --purple:#b455c6; --pink:#ff6fae; --red:#e45757; --green:#22a06b; --ink:#172033; --muted:#5b6474; --paper:#fffdf7; --line:#e5e7eb; --soft:#f6f7fb; font-family:"Segoe UI",system-ui,sans-serif; color:var(--ink); line-height:1.65; }
  .sc-rich * { box-sizing:border-box; }
  .sc-hero { border-radius:18px; padding:26px; color:#fff; background:linear-gradient(135deg,#233876,#6d5df6 56%,#22a06b); overflow:hidden; }
  .sc-hero h2 { margin:6px 0 8px; font-size:clamp(24px,4vw,38px); color:#fff; line-height:1.12; }
  .sc-hero p { max-width:780px; color:rgba(255,255,255,.9); margin:0; }
  .sc-badge { display:inline-block; padding:5px 12px; border-radius:999px; background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.35); color:inherit; font-size:12px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
  .sc-progress { margin:14px 0; padding:12px; border-radius:14px; background:#fff; border:1px solid var(--line); }
  .sc-progress-row { display:flex; justify-content:space-between; gap:12px; font-size:13px; font-weight:800; color:var(--muted); }
  .sc-progress-track { height:10px; border-radius:999px; background:#e9edf5; margin-top:8px; overflow:hidden; }
  .sc-progress-fill { height:100%; width:0; border-radius:999px; background:linear-gradient(90deg,#6d5df6,#22a06b); transition:width .35s ease; }
  .sc-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; margin:16px 0; }
  .sc-card { border:1px solid var(--line); border-radius:14px; padding:16px; background:#fff; box-shadow:0 8px 22px rgba(15,23,42,.06); }
  .sc-card h3 { margin:0 0 8px; color:var(--ink); font-size:20px; }
  .sc-card h4 { margin:0 0 6px; color:var(--ink); font-size:16px; }
  .sc-card p { color:var(--muted); margin:0 0 10px; }
  .sc-card.teach { background:#f0edff; border-left:6px solid #6d5df6; }
  .sc-card.plan { background:#eaf8f2; border-left:6px solid var(--green); }
  .sc-card.challenge { background:#fff3dd; border-left:6px solid var(--orange); }
  .sc-steps { list-style:none; padding:0; margin:12px 0; counter-reset:step; }
  .sc-steps li { counter-increment:step; display:flex; gap:12px; align-items:flex-start; margin:0 0 12px; color:var(--muted); }
  .sc-steps li:before { content:counter(step); width:30px; height:30px; border-radius:50%; background:#6d5df6; color:#fff; display:flex; align-items:center; justify-content:center; flex:0 0 30px; font-weight:900; }
  .sc-check { width:21px; height:21px; margin-top:4px; accent-color:#22a06b; flex:0 0 auto; }
  .sc-flashcards { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin:14px 0; }
  .sc-flashcard { min-height:132px; perspective:900px; cursor:pointer; border:0; background:transparent; padding:0; text-align:left; }
  .sc-flashcard-inner { position:relative; width:100%; min-height:132px; transition:transform .45s; transform-style:preserve-3d; }
  .sc-flashcard.is-flipped .sc-flashcard-inner { transform:rotateY(180deg); }
  .sc-flash-front,.sc-flash-back { position:absolute; inset:0; border-radius:14px; padding:16px; backface-visibility:hidden; border:1px solid var(--line); box-shadow:0 8px 18px rgba(15,23,42,.08); }
  .sc-flash-front { background:#fff; display:flex; align-items:center; justify-content:center; text-align:center; font-size:20px; font-weight:900; color:#4537a8; }
  .sc-flash-back { background:#eaf8f2; transform:rotateY(180deg); color:#174436; font-size:14px; }
  .sc-blocks { padding:14px; border-radius:14px; background:#202536; margin:14px 0; box-shadow:inset 0 0 0 1px rgba(255,255,255,.08); }
  .sc-blocks h4 { color:#fff; margin:0 0 10px; }
  .scratch-block { display:table; margin:6px 0; padding:8px 14px; border-radius:8px 8px 8px 8px; color:#fff; font-weight:900; font-size:14px; box-shadow:0 3px 0 rgba(0,0,0,.22); }
  .scratch-block.indent { margin-left:24px; }
  .scratch-block.slot { border-radius:18px; }
  .b-motion { background:var(--blue); } .b-events { background:var(--yellow); color:#332600; } .b-control { background:var(--orange); color:#321f00; } .b-sound { background:var(--purple); } .b-looks { background:var(--pink); } .b-variables { background:var(--red); } .b-sensing { background:#38a9d6; }
  .sc-scripts { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:12px; }
  .sc-script-card { border-radius:12px; background:#151a28; padding:12px; border:1px solid rgba(255,255,255,.12); }
  .sc-script-card h5 { color:#fff; margin:0 0 8px; font-size:14px; }
  .sc-hint { margin:10px 0; }
  .sc-hint button,.sc-action { border:0; border-radius:999px; padding:9px 14px; background:#111827; color:#fff; cursor:pointer; font-weight:900; }
  .sc-hint-panel { display:none; margin-top:8px; padding:12px 14px; border-radius:12px; background:#fff8db; border:1px dashed #e8b84a; color:#5f3c00; }
  .sc-hint-panel.show { display:block; }
  .sc-sorter { padding:14px; border-radius:14px; background:#eef5ff; border:1px solid #cadbff; margin:14px 0; }
  .sc-sorter-list { list-style:none; padding:0; margin:10px 0; display:grid; gap:8px; }
  .sc-sorter-item { border:2px solid #cadbff; border-radius:12px; padding:10px 12px; background:#fff; cursor:grab; color:#25304a; font-weight:800; }
  .sc-sorter-item:focus { outline:3px solid #6d5df6; outline-offset:2px; }
  .sc-sorter-item.dragging { opacity:.45; }
  .sc-sorter-status { min-height:24px; font-weight:900; color:#38509a; }
  .sc-mission { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin:14px 0; }
  .sc-mission div { border-radius:12px; padding:12px; background:#fff; border:1px solid var(--line); }
  .sc-mission strong { display:block; color:#4537a8; margin-bottom:4px; }
  .sc-quiz { margin:14px 0; padding:14px; border-radius:14px; border:1px solid var(--line); background:#fff; }
  .sc-options { display:grid; gap:8px; margin-top:10px; }
  .sc-option { border:2px solid #e5e7eb; background:#fff; border-radius:12px; padding:10px 12px; text-align:left; cursor:pointer; color:var(--ink); }
  .sc-option.correct { border-color:#22a06b; background:#eaf8f2; color:#14543e; }
  .sc-option.wrong { border-color:#e45757; background:#fff1f1; color:#7b1d1d; }
  .sc-feedback { min-height:24px; margin-top:8px; font-weight:900; color:var(--muted); }
  .sc-preview { display:grid; grid-template-columns:minmax(190px,1fr) minmax(190px,1fr); gap:12px; align-items:stretch; }
  .sc-stage { min-height:190px; border:10px solid #384152; border-radius:16px; background:linear-gradient(#bfe7ff,#f8fbff 70%); position:relative; overflow:hidden; }
  .sc-sprite { position:absolute; left:14%; bottom:22px; width:48px; height:48px; border-radius:50% 50% 45% 45%; background:#ffab19; animation:sc-hop 1.8s infinite ease-in-out; box-shadow:0 8px 0 rgba(0,0,0,.12); }
  .sc-target { position:absolute; right:15%; top:45px; width:50px; height:50px; border-radius:12px; background:#22a06b; animation:sc-float 2.2s infinite ease-in-out; }
  .sc-hud { position:absolute; left:10px; top:10px; display:flex; gap:8px; flex-wrap:wrap; }
  .sc-chip { border-radius:999px; background:rgba(255,255,255,.88); padding:4px 9px; font-size:12px; font-weight:900; color:#1f2b46; }
  .sc-choice { position:absolute; left:10%; right:10%; bottom:12px; border-radius:12px; background:rgba(255,255,255,.92); padding:8px; font-weight:900; color:#25304a; text-align:center; }
  .sc-trail { position:absolute; left:12%; bottom:54px; width:68%; height:70px; border-bottom:5px dotted #6d5df6; border-radius:50%; animation:sc-pulse 1.6s infinite ease-in-out; }
  .sc-chart { position:absolute; left:12%; right:12%; bottom:24px; height:120px; display:flex; align-items:end; gap:10px; }
  .sc-chart span { flex:1; border-radius:8px 8px 0 0; background:#6d5df6; animation:sc-grow 1.8s infinite alternate; }
  .sc-chart span:nth-child(2){height:72%;background:#22a06b;animation-delay:.2s}.sc-chart span:nth-child(3){height:48%;background:#ff9f1c;animation-delay:.4s}.sc-chart span:nth-child(4){height:88%;background:#ff6fae;animation-delay:.6s}
  @keyframes sc-hop { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-24px)} }
  @keyframes sc-float { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(18px) rotate(8deg)} }
  @keyframes sc-pulse { 0%,100%{opacity:.55; transform:scale(.97)} 50%{opacity:1; transform:scale(1.02)} }
  @keyframes sc-grow { from{transform:scaleY(.7)} to{transform:scaleY(1)} }
  .sc-journal textarea { width:100%; min-height:110px; border:1px solid var(--line); border-radius:12px; padding:12px; font:inherit; resize:vertical; }
  .sc-celebrate { margin-top:12px; background:linear-gradient(90deg,#6d5df6,#22a06b); }
  .sc-confetti { position:fixed; inset:0; pointer-events:none; z-index:9999; overflow:hidden; }
  .sc-star { position:absolute; top:-20px; font-size:22px; animation:sc-fall 1.4s linear forwards; color:#ffbf2f; }
  @keyframes sc-fall { to { transform:translateY(105vh) rotate(540deg); opacity:.1; } }
  @media (max-width:700px){ .sc-preview { grid-template-columns:1fr; } .sc-hero { padding:20px; } }
</style>`;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function block(text, type = "looks", indent = false) {
  return `<div class="scratch-block b-${type}${indent ? " indent" : ""}">${escapeHtml(text)}</div>`;
}

function moduleKind(moduleIndex) {
  return [
    "story",
    "maze",
    "arcade",
    "drawing",
    "pet",
    "motion",
    "ecosystem",
    "data",
    "ai",
    "capstone",
  ][moduleIndex] || "project";
}

function variableName(module, offset = 0) {
  return module.concepts[offset % module.concepts.length][0].replace(/\s+/g, " ");
}

function blockSetFor(module, moduleIndex) {
  const v1 = variableName(module, 0);
  const v2 = variableName(module, 1);
  const v3 = variableName(module, 2);
  const sets = {
    story: [
      ["Start and ask", [["when green flag clicked", "events"], [`set ${v1} to opening scene`, "variables", true], ["ask Which choice: A or B? and wait", "sensing", true], [`set ${v2} to answer`, "variables", true], [`broadcast ${v2} scene`, "events", true]]],
      ["Receive a scene", [[`when I receive ${v2} scene`, "events"], ["switch backdrop to matching scene", "looks", true], ["say the consequence clearly", "looks", true], ["broadcast next choice", "events", true]]],
    ],
    maze: [
      ["Player movement", [["when green flag clicked", "events"], [`set ${v1} to 1`, "variables", true], ["forever", "control", true], ["if right arrow pressed then change x by speed", "motion", true], ["if touching wall then change x by -speed", "motion", true]]],
      ["Goal and hazards", [["when green flag clicked", "events"], ["forever", "control", true], ["if touching hazard then change lives by -1", "variables", true], ["go to checkpoint x y", "motion", true], [`if touching goal then change ${v1} by 1`, "variables", true]]],
    ],
    arcade: [
      ["Clone spawner", [["when green flag clicked", "events"], ["set game state to playing", "variables", true], ["forever", "control", true], ["wait spawn rate seconds", "control", true], ["create clone of myself", "control", true]]],
      ["Clone behavior", [["when I start as a clone", "events"], ["go to random start", "motion", true], ["repeat until touching edge or player", "control", true], ["move speed steps", "motion", true], ["if touching player then change lives by -1", "variables", true], ["delete this clone", "control", true]]],
    ],
    drawing: [
      ["Custom block", [["define draw polygon sides size", "events"], ["repeat sides", "control", true], ["move size steps", "motion", true], ["turn 360 / sides degrees", "motion", true]]],
      ["Pattern caller", [["when green flag clicked", "events"], ["clear", "motion", true], ["repeat 24", "control", true], ["draw polygon sides size", "events", true], ["turn 15 degrees", "motion", true], ["change color effect by 8", "looks", true]]],
    ],
    pet: [
      ["Need loop", [["when green flag clicked", "events"], [`set ${v1} to 60`, "variables", true], [`set ${v2} to 60`, "variables", true], ["forever", "control", true], [`change ${v1} by -1`, "variables", true], ["wait 2 seconds", "control", true]]],
      ["Reaction", [["when green flag clicked", "events"], ["forever", "control", true], [`if ${v1} < 25 then`, "control", true], ["switch costume to worried", "looks", true], ["say I need care", "looks", true]]],
    ],
    motion: [
      ["Flight model", [["when green flag clicked", "events"], ["set y velocity to launch power", "variables", true], ["repeat until touching ground", "control", true], ["change y by y velocity", "motion", true], ["change y velocity by gravity", "variables", true], ["change x by x speed", "motion", true]]],
      ["Measure", [["when green flag clicked", "events"], ["reset timer", "sensing", true], ["if touching ground then", "control", true], ["set flight time to timer", "variables", true], ["say the measured result", "looks", true]]],
    ],
    ecosystem: [
      ["Creature rule", [["when green flag clicked", "events"], [`set ${v1} to starting amount`, "variables", true], ["forever", "control", true], ["move toward resource or wander", "motion", true], ["if touching food then change energy by 10", "variables", true], ["if energy = 0 then remove creature", "control", true]]],
      ["Trial loop", [["when green flag clicked", "events"], [`set ${v3} to condition A`, "variables", true], ["repeat trial length", "control", true], ["apply survival and reproduction rules", "control", true], ["record population", "variables", true]]],
    ],
    data: [
      ["Collect safely", [["when green flag clicked", "events"], ["delete all of data list", "variables", true], ["repeat 5", "control", true], ["ask for safe number and wait", "sensing", true], ["if answer is valid then add to list", "control", true]]],
      ["Calculate", [["when green flag clicked", "events"], ["set total to 0", "variables", true], ["repeat length of list", "control", true], ["change total by item number", "variables", true], ["set average to total / length", "variables", true], ["show labeled result", "looks", true]]],
    ],
    ai: [
      ["Classifier rule", [["when green flag clicked", "events"], ["ask for safe features and wait", "sensing", true], [`set ${v1} score to 0`, "variables", true], [`set ${v2} score to 0`, "variables", true], ["if feature matches label then change score", "control", true], ["say category with highest score", "looks", true]]],
      ["Test table", [["when green flag clicked", "events"], ["repeat for each test example", "control", true], ["predict label", "looks", true], ["compare with real label", "sensing", true], ["record correct or error", "variables", true]]],
    ],
    capstone: [
      ["Prototype", [["when green flag clicked", "events"], ["show user instructions", "looks", true], ["set prototype state to testing", "variables", true], ["broadcast first feature", "events", true]]],
      ["Evidence", [["when I receive test feedback", "events"], ["ask what confused the user and wait", "sensing", true], ["add answer to feedback list", "variables", true], ["choose one improvement", "looks", true]]],
    ],
  };
  return sets[moduleKind(moduleIndex)] || sets.arcade;
}

function blocksFor(module, moduleIndex, title = "Scratch block map") {
  const scripts = blockSetFor(module, moduleIndex);
  return `
    <div class="sc-blocks">
      <h4>${escapeHtml(title)}</h4>
      <div class="sc-scripts">
        ${scripts.map(([scriptTitle, scriptBlocks]) => `
          <div class="sc-script-card">
            <h5>${escapeHtml(scriptTitle)}</h5>
            ${scriptBlocks.map(([text, type, indent]) => block(text, type, indent)).join("")}
          </div>
        `).join("")}
      </div>
    </div>`;
}

function sorter(key, steps) {
  return `
    <div class="sc-sorter" data-sorter="${key}">
      <h3>Drag the algorithm into order</h3>
      <p>Before coding, arrange the steps. Drag with a mouse or use Tab, then the buttons below.</p>
      <ol class="sc-sorter-list">
        ${steps.map((step, index) => `<li class="sc-sorter-item" draggable="true" tabindex="0" data-sort-index="${index + 1}">${escapeHtml(step)}</li>`).reverse().join("")}
      </ol>
      <button class="sc-action" type="button" data-sort-check>Check order</button>
      <button class="sc-action" type="button" data-sort-reset>Reset</button>
      <div class="sc-sorter-status" data-sort-status></div>
    </div>`;
}

function progress(key, label = "Activity progress") {
  return `
    <div class="sc-progress" data-rich-progress="${key}">
      <div class="sc-progress-row"><span>${escapeHtml(label)}</span><span data-rich-progress-text>0% complete</span></div>
      <div class="sc-progress-track"><div class="sc-progress-fill" data-rich-progress-fill></div></div>
    </div>`;
}

function flashcards(module) {
  return `
    <div class="sc-card teach">
      <h3>Key vocabulary flashcards</h3>
      <p>Tap a card to flip it. If the word sounds fancy, the back explains it like a friend would.</p>
      <div class="sc-flashcards">
        ${module.concepts.map(([term, meaning]) => `
          <button class="sc-flashcard" type="button" data-flashcard aria-label="Flip ${escapeHtml(term)} flashcard">
            <span class="sc-flashcard-inner">
              <span class="sc-flash-front">${escapeHtml(term)}</span>
              <span class="sc-flash-back"><strong>${escapeHtml(term)}</strong><br>${escapeHtml(meaning)}<br><br>Example: you will use this when ${escapeHtml(module.outcome)}.</span>
            </span>
          </button>`).join("")}
      </div>
    </div>`;
}

function checklist(key, items, title = "Build steps") {
  return `
    <div class="sc-card">
      <h3>${escapeHtml(title)}</h3>
      <ol class="sc-steps">
        ${items.map((item, index) => `
          <li><input class="sc-check" type="checkbox" data-rich-check data-rich-key="${key}-step-${index + 1}" aria-label="Complete step ${index + 1}"><span>${escapeHtml(item)}</span></li>
        `).join("")}
      </ol>
    </div>`;
}

function hint(key, text) {
  return `
    <div class="sc-hint">
      <button type="button" data-hint-toggle="${key}" aria-expanded="false">Show hint</button>
      <div class="sc-hint-panel" data-hint-panel="${key}">${escapeHtml(text)}</div>
    </div>`;
}

function quiz(key, questions) {
  return `
    <div class="sc-card">
      <h3>Quick Check</h3>
      <p>This is practice. Your official marks still come from the platform quiz or submitted project.</p>
      ${questions.slice(0, 3).map((question, questionIndex) => `
        <div class="sc-quiz" data-rich-quiz="${key}-q-${questionIndex + 1}">
          <h4>${escapeHtml(question.prompt)}</h4>
          <div class="sc-options">
            ${question.options.map((option) => `
              <button type="button" class="sc-option" data-quiz-option data-correct="${option === question.answer ? "true" : "false"}">${escapeHtml(option)}</button>
            `).join("")}
          </div>
          <div class="sc-feedback" data-quiz-feedback></div>
        </div>
      `).join("")}
    </div>`;
}

function reflection(key, module, prompt = "What did you build? What was hard? What would you change?") {
  return `
    <div class="sc-card sc-journal">
      <h3>Reflection journal</h3>
      <p>${escapeHtml(prompt)}</p>
      <textarea data-rich-reflection data-rich-key="${key}-reflection" placeholder="Write your thoughts here. They save on this device."></textarea>
      <p><strong>Creator value:</strong> Explain your evidence kindly and honestly. That is how strong designers improve.</p>
    </div>
    <button class="sc-action sc-celebrate" type="button" data-celebrate> I finished this activity </button>`;
}

function preview(module, moduleIndex) {
  const kind = moduleKind(moduleIndex);
  const stageExtras = {
    story: '<div class="sc-hud"><span class="sc-chip">scene: forest</span><span class="sc-chip">choice: A</span></div><div class="sc-choice">Choose: Help / Explore</div>',
    maze: '<div class="sc-hud"><span class="sc-chip">lives: 3</span><span class="sc-chip">level: 2</span></div><div class="sc-target" style="right:8%;top:54%"></div><div class="sc-sprite" style="left:16%;bottom:120px"></div>',
    arcade: '<div class="sc-hud"><span class="sc-chip">score: 8</span><span class="sc-chip">state: play</span></div><div class="sc-target" style="right:18%;top:25px"></div><div class="sc-target" style="right:45%;top:70px;background:#e45757"></div>',
    drawing: '<div class="sc-trail"></div><div class="sc-hud"><span class="sc-chip">sides: 6</span><span class="sc-chip">repeat: 24</span></div>',
    pet: '<div class="sc-hud"><span class="sc-chip">hunger: 40</span><span class="sc-chip">mood: ok</span></div><div class="sc-choice">Choose food, play, rest, or clean.</div>',
    motion: '<div class="sc-trail"></div><div class="sc-hud"><span class="sc-chip">time: 2.8</span><span class="sc-chip">range: 154</span></div>',
    ecosystem: '<div class="sc-hud"><span class="sc-chip">pop: 18</span><span class="sc-chip">rain: medium</span></div><div class="sc-target" style="right:30%;top:38px"></div><div class="sc-target" style="right:60%;top:82px;background:#ff9f1c"></div>',
    data: '<div class="sc-chart"><span style="height:35%"></span><span></span><span></span><span></span></div><div class="sc-hud"><span class="sc-chip">average: 7</span></div>',
    ai: '<div class="sc-hud"><span class="sc-chip">label: A</span><span class="sc-chip">test: unknown</span></div><div class="sc-choice">Classifier explains: I chose A because two features matched.</div>',
    capstone: '<div class="sc-hud"><span class="sc-chip">prototype</span><span class="sc-chip">feedback: 3</span></div><div class="sc-choice">Test, improve, explain evidence.</div>',
  };
  return `
    <div class="sc-preview">
      <div class="sc-stage" aria-label="Animated preview panel"><div class="sc-sprite"></div><div class="sc-target"></div>${stageExtras[kind] || ""}</div>
      <div class="sc-card">
        <h3>Finished project preview</h3>
        <p>Your finished work should feel like this: clear instructions, moving sprites, visible feedback, and a result the user can understand without you standing beside them.</p>
        <p><strong>Build goal:</strong> ${escapeHtml(module.outcome)}.</p>
      </div>
    </div>`;
}

function hero(moduleIndex, module, activityLabel, title, subtitle) {
  return `
    <div class="sc-hero">
      <span class="sc-badge">Scratch Creator Module ${moduleIndex + 1} | ${escapeHtml(activityLabel)}</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(subtitle)}</p>
    </div>`;
}

function wrap(key, moduleIndex, module, activityLabel, title, subtitle, body) {
  return `${css}<div class="sc-rich" data-rich-root="${key}">
    ${hero(moduleIndex, module, activityLabel, title, subtitle)}
    ${progress(key)}
    ${body}
  </div>`;
}

function planSection(module) {
  return `
    <div class="sc-card plan">
      <h3>Plan before blocks</h3>
      <p>Why first? A plan is like drawing a treasure map before walking. It helps you know where each Scratch block belongs.</p>
      <ol class="sc-steps">${module.algorithm.map((step) => `<li><span>${escapeHtml(step)}</span></li>`).join("")}</ol>
    </div>`;
}

function missionBoard(module, project) {
  return `
    <div class="sc-mission">
      <div><strong>What we build</strong>${escapeHtml(project.title)}</div>
      <div><strong>User goal</strong>${escapeHtml(project.brief)}</div>
      <div><strong>Why it matters</strong>${escapeHtml(module.steam)}</div>
    </div>`;
}

function projectCard(key, module, moduleIndex, project, projectNumber) {
  const steps = [
    `Write the purpose of ${project.title} in one sentence.`,
    "Create the smallest working version first: one sprite, one event, one result.",
    ...module.algorithm.slice(0, 4),
    ...project.features.map((feature) => `Add and test this feature: ${feature}.`),
    "Run the project three times, fix one problem, then ask another learner to try it.",
  ];
  return `
    <div class="sc-card">
      <h3>Project ${projectNumber}: ${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.brief)}</p>
      ${missionBoard(module, project)}
      ${preview(module, moduleIndex)}
      ${planSection({ ...module, algorithm: steps.slice(0, 6) })}
      ${checklist(`${key}-project-${projectNumber}`, steps, "Step-by-step Scratch build")}
      ${blocksFor(module, moduleIndex, `Visual blocks for ${project.title}`)}
      ${hint(`${key}-project-${projectNumber}`, "If you feel stuck, make only the first tiny version. One event, one sprite, one visible result. Then add the next feature after it works.")}
      <h4>Success checks</h4>
      <ul>${project.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
    </div>`;
}

function creatorRichHtml(module, moduleIndex) {
  const keyBase = `scratch-creator-m${moduleIndex + 1}-${slug(module.title)}`;
  const practiceSteps = [
    `Open Scratch and create a safe project name for ${module.practice.title}.`,
    ...module.practice.steps,
    `Test that ${module.practice.checks[0]}.`,
    "Save a copy before adding extras.",
  ];
  const challengeSteps = [
    `Start from a working version of ${module.challenge.title}.`,
    ...module.challenge.steps,
    "Test the required project again so the bonus did not break it.",
  ];

  return {
    overview: wrap(
      `${keyBase}-overview`,
      moduleIndex,
      module,
      "Lesson",
      module.title.replace(/^Module \d+ - /, ""),
      module.introduction,
      `
        <div class="sc-card teach"><h3>Objectives</h3><p>By the end, you can explain the key ideas, plan before coding, build a real Scratch project, test it, and reflect like a young STEAM creator.</p></div>
        ${flashcards(module)}
        ${planSection(module)}
        ${quiz(`${keyBase}-overview`, module.quiz)}
        ${reflection(`${keyBase}-overview`, module, "Which new word feels most useful today? How could it help your project?")}
      `,
    ),
    visual_learning: wrap(
      `${keyBase}-visual`,
      moduleIndex,
      module,
      "Explore",
      "See the System",
      `Look at how ${module.focus} work together before you build.`,
      `
        ${preview(module, moduleIndex)}
        <div class="sc-card challenge"><h3>Think like a designer</h3><p>${escapeHtml(module.predict)}</p><p><strong>Common trap:</strong> ${escapeHtml(module.misconception)}</p></div>
        ${blocksFor(module, moduleIndex, "System map")}
        ${hint(`${keyBase}-visual`, module.debugging)}
        ${quiz(`${keyBase}-visual`, module.quiz.slice(1))}
      `,
    ),
    algorithm: wrap(
      `${keyBase}-algorithm`,
      moduleIndex,
      module,
      "Plan",
      "Algorithm Studio",
      "Write the plain-English steps before touching Scratch blocks.",
      `
        ${planSection(module)}
        ${sorter(`${keyBase}-algorithm-sort`, module.algorithm)}
        ${checklist(`${keyBase}-algorithm`, module.algorithm, "Tick off your plan")}
        ${blocksFor(module, moduleIndex, "Plan translated into Scratch-style blocks")}
        ${hint(`${keyBase}-algorithm`, "Read your plan out loud. If a friend cannot follow it, split one big step into two smaller steps.")}
        ${reflection(`${keyBase}-algorithm`, module, "Which plan step is most important? Which step might cause bugs?")}
      `,
    ),
    discussion: wrap(
      `${keyBase}-discussion`,
      moduleIndex,
      module,
      "Reason",
      "Creator Conversation",
      module.discussion.prompt,
      `
        <div class="sc-card teach"><h3>CBC values in action</h3><p>Be respectful, responsible, creative, and honest with evidence. Great creators listen before improving a design.</p></div>
        ${checklist(`${keyBase}-discussion`, module.discussion.questions, "Discuss or write your ideas")}
        ${hint(`${keyBase}-discussion`, "Use this sentence starter: I predict ___ because the rule says ___.")}
        ${reflection(`${keyBase}-discussion`, module, "Which idea from the discussion should affect your project design?")}
      `,
    ),
    guided_practice: wrap(
      `${keyBase}-practice`,
      moduleIndex,
      module,
      "Project 1",
      module.practice.title,
      module.practice.brief,
      `
        ${preview(module, moduleIndex)}
        ${planSection({ ...module, algorithm: practiceSteps })}
        ${checklist(`${keyBase}-practice`, practiceSteps, "Project 1 guided build")}
        ${blocksFor(module, moduleIndex, `Blocks for ${module.practice.title}`)}
        ${hint(`${keyBase}-practice`, module.support)}
        ${quiz(`${keyBase}-practice`, module.quiz.slice(0, 2))}
        ${reflection(`${keyBase}-practice`, module)}
      `,
    ),
    main_project: wrap(
      `${keyBase}-main-project`,
      moduleIndex,
      module,
      "Projects 2 and 3",
      "Choose a Real Scratch Project",
      `Both projects practise ${module.focus} and connect coding to ${module.steam}.`,
      `
        ${projectCard(`${keyBase}-main-project`, module, moduleIndex, module.projects[0], 2)}
        ${projectCard(`${keyBase}-main-project`, module, moduleIndex, module.projects[1], 3)}
        ${quiz(`${keyBase}-main-project`, module.quiz.slice(2))}
        ${reflection(`${keyBase}-main-project`, module, "Which project did you choose? What user or problem are you designing for?")}
      `,
    ),
    challenge: wrap(
      `${keyBase}-challenge`,
      moduleIndex,
      module,
      "Try More",
      module.challenge.title,
      module.challenge.brief,
      `
        <div class="sc-card challenge"><h3>Bonus projects unlock after Project 3</h3><p>Choose one extension only after your required project works. A strong creator improves a working idea instead of piling features onto a broken one.</p></div>
        ${checklist(`${keyBase}-challenge`, challengeSteps, "Try More build")}
        ${blocksFor(module, moduleIndex, `Extension blocks for ${module.challenge.title}`)}
        ${hint(`${keyBase}-challenge`, "Duplicate your project before experimenting. If the bonus breaks, your main project stays safe.")}
        <div class="sc-grid">
          <div class="sc-card"><h4>Polish card</h4><p>Add clearer instructions, kinder feedback, or a better ending screen.</p></div>
          <div class="sc-card"><h4>Accessibility card</h4><p>Add slower speed, bigger controls, high contrast, or an alternative input.</p></div>
          <div class="sc-card"><h4>STEAM card</h4><p>Add a scientific, artistic, data, or design explanation connected to real life.</p></div>
        </div>
        ${reflection(`${keyBase}-challenge`, module, "What did the extension add? Did it improve the user experience?")}
      `,
    ),
    quiz: wrap(
      `${keyBase}-quiz`,
      moduleIndex,
      module,
      "Quiz",
      "Practice Before the Graded Quiz",
      "Use these quick checks to warm up. The official marks come from the platform quiz below this rich lesson.",
      `
        ${flashcards(module)}
        ${quiz(`${keyBase}-quiz`, module.quiz)}
        ${hint(`${keyBase}-quiz`, "If you miss a question, go back to the flashcards and say the definition in your own words.")}
      `,
    ),
    reflection: wrap(
      `${keyBase}-reflection`,
      moduleIndex,
      module,
      "Portfolio",
      "Reflect, Explain and Submit",
      "A portfolio is proof of your learning: what you built, how you tested, and how you improved.",
      `
        <div class="sc-card plan"><h3>Submission checklist</h3><ul><li>Save your Scratch file as .sb3.</li><li>Reopen it to check it still works.</li><li>Remove names, passwords, faces, addresses, and private data.</li><li>Explain one test and one improvement.</li></ul></div>
        ${reflection(`${keyBase}-reflection`, module, "What did you build? What was hard? What would you change next time?")}
      `,
    ),
  };
}

module.exports = { creatorRichHtml };
