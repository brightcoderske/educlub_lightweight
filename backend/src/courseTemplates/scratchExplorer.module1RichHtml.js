const style = `
<style>
  .se-m1 { --purple:#6d5df6; --purple-2:#f0edff; --teal:#159973; --teal-2:#e7f8f1; --coral:#d95d39; --coral-2:#fff0ea; --amber:#b97818; --amber-2:#fff4dc; --ink:#172033; --muted:#5c6575; --line:#e4e7ee; font-family: "Segoe UI", system-ui, sans-serif; color:var(--ink); line-height:1.7; }
  .se-m1 * { box-sizing:border-box; }
  .se-m1-hero { border-radius:16px; padding:28px; color:#fff; background:linear-gradient(135deg,#2d236b 0%,#604ad9 58%,#159973 100%); overflow:hidden; }
  .se-m1-kicker { display:inline-block; margin-bottom:10px; padding:5px 12px; border:1px solid rgba(255,255,255,.35); border-radius:999px; background:rgba(255,255,255,.16); font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
  .se-m1 h2 { margin:0 0 8px; font-size:26px; line-height:1.2; color:inherit; }
  .se-m1 h3 { margin:0 0 8px; font-size:18px; color:var(--ink); }
  .se-m1 h4 { margin:0 0 6px; font-size:15px; color:var(--ink); }
  .se-m1 p { margin:0 0 12px; color:var(--muted); }
  .se-m1-hero p { color:rgba(255,255,255,.88); max-width:720px; }
  .se-m1-meta { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
  .se-m1-pill { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:6px 11px; background:rgba(255,255,255,.15); color:inherit; font-size:12px; font-weight:700; }
  .se-m1-card { border:1px solid var(--line); border-radius:12px; padding:18px; margin:14px 0; background:#fff; }
  .se-m1-card.purple { border-left:5px solid var(--purple); background:var(--purple-2); }
  .se-m1-card.teal { border-left:5px solid var(--teal); background:var(--teal-2); }
  .se-m1-card.coral { border-left:5px solid var(--coral); background:var(--coral-2); }
  .se-m1-card.amber { border-left:5px solid var(--amber); background:var(--amber-2); }
  .se-m1-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin:14px 0; }
  .se-m1-mini { border:1px solid var(--line); border-radius:10px; padding:14px; background:#fff; }
  .se-m1-mini strong { display:block; color:#3d328f; margin-bottom:4px; }
  .se-m1-steps { list-style:none; padding:0; margin:12px 0 0; counter-reset:step; }
  .se-m1-steps li { counter-increment:step; display:flex; gap:12px; margin:0 0 13px; color:var(--muted); }
  .se-m1-steps li:before { content:counter(step); width:28px; height:28px; flex:0 0 28px; border-radius:50%; background:var(--purple); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; }
  .se-m1-blocks { border:1px solid var(--line); border-radius:12px; padding:14px; background:#f8fafc; margin:12px 0; }
  .se-m1-block { display:inline-block; margin:4px 4px 4px 0; padding:7px 12px; border-radius:7px; color:#fff; font-weight:800; font-size:13px; }
  .se-m1-event { background:#f4a61d; color:#2f2100; } .se-m1-motion { background:#3f8cff; } .se-m1-looks { background:#8f5cff; } .se-m1-sound { background:#c357c3; } .se-m1-control { background:#f4a61d; color:#2f2100; }
  .se-m1-note { margin:12px 0; padding:12px 14px; border-radius:10px; background:#fff; border:1px dashed #c9cdd8; color:var(--muted); }
  .se-m1-project { border:1px solid var(--line); border-radius:12px; overflow:hidden; background:#fff; margin:14px 0; }
  .se-m1-project-head { padding:15px 18px; background:linear-gradient(90deg,var(--purple-2),#fff); }
  .se-m1-badge { display:inline-block; margin:0 6px 6px 0; padding:3px 9px; border-radius:999px; font-size:11px; font-weight:800; text-transform:uppercase; background:var(--teal-2); color:#07513e; }
  .se-m1-checks { margin:8px 0 0; padding-left:18px; color:var(--muted); }
  .se-m1-details { margin:12px 0; border:1px solid var(--line); border-radius:10px; background:#fff; overflow:hidden; }
  .se-m1-details summary { cursor:pointer; padding:12px 14px; font-weight:800; color:#3d328f; background:var(--purple-2); }
  .se-m1-details div { padding:14px; }
  .se-m1-rubric { width:100%; border-collapse:collapse; margin-top:10px; background:#fff; }
  .se-m1-rubric th,.se-m1-rubric td { border:1px solid var(--line); padding:9px; text-align:left; vertical-align:top; }
  .se-m1-rubric th { background:#f8fafc; color:var(--ink); }
</style>`;

const wrap = (label, title, body) => `${style}<div class="se-m1">${body}</div>`;

module.exports = {
  overview: wrap("Activity 1", "Welcome", `
    <div class="se-m1-hero">
      <span class="se-m1-kicker">Module 1 of 10</span>
      <h2>Welcome to Creative Coding</h2>
      <p>Start your Scratch adventure by learning how sprites, events, sequences, and the Stage work together. By the end, you will build three small projects and know how to test, save, and explain your work safely.</p>
      <div class="se-m1-meta">
        <span class="se-m1-pill">60-90 min</span><span class="se-m1-pill">9 activities</span><span class="se-m1-pill">Self paced</span><span class="se-m1-pill">Scratch beginner</span>
      </div>
    </div>
    <div class="se-m1-grid">
      <div class="se-m1-mini"><strong>Event</strong>Something that starts code, like clicking the green flag.</div>
      <div class="se-m1-mini"><strong>Sequence</strong>Blocks placed in the exact order Scratch should run them.</div>
      <div class="se-m1-mini"><strong>Sprite</strong>A character or object you can code.</div>
      <div class="se-m1-mini"><strong>Stage</strong>The area where your project performs.</div>
    </div>
    <div class="se-m1-card teal"><h3>Your mission</h3><p>Create friendly Scratch animations that introduce an idea without sharing private information. You will learn, build, test, improve, and submit a working .sb3 file.</p></div>
  `),
  visual_learning: wrap("Activity 2", "See the System", `
    <div class="se-m1-card purple"><h3>How Scratch thinks</h3><p>Scratch does not guess what you mean. It waits for an event, then follows connected blocks from top to bottom. That ordered list is your algorithm.</p></div>
    <div class="se-m1-grid">
      <div class="se-m1-mini"><strong>1. Input or event</strong>The green flag, a click, or a key press starts the action.</div>
      <div class="se-m1-mini"><strong>2. Rule</strong>Your blocks tell Scratch exactly what to do next.</div>
      <div class="se-m1-mini"><strong>3. Output</strong>The viewer sees movement, words, sounds, or costume changes.</div>
      <div class="se-m1-mini"><strong>4. Test</strong>You run it again to check if the same plan still works.</div>
    </div>
    <div class="se-m1-blocks">
      <h4>Starter stack to recognise</h4>
      <span class="se-m1-block se-m1-event">when green flag clicked</span>
      <span class="se-m1-block se-m1-motion">go to x: -80 y: 0</span>
      <span class="se-m1-block se-m1-looks">say Hello! for 2 seconds</span>
      <span class="se-m1-block se-m1-motion">move 40 steps</span>
    </div>
    <div class="se-m1-note"><strong>Prediction:</strong> If you swap the movement and the greeting, what changes for the viewer?</div>
  `),
  algorithm: wrap("Activity 3", "Plan Before You Build", `
    <div class="se-m1-card amber"><h3>Your first algorithm</h3><p>Before opening many blocks, write the order of actions. A clear plan makes Scratch easier because you know what each block is supposed to prove.</p></div>
    <ol class="se-m1-steps">
      <li>Choose one sprite and one backdrop.</li>
      <li>Start with <strong>when green flag clicked</strong>.</li>
      <li>Put the sprite in a known starting position.</li>
      <li>Show a greeting, movement, sound, or costume change.</li>
      <li>Finish in a planned pose so the viewer knows it is done.</li>
      <li>Save, reopen, and test the .sb3 project.</li>
    </ol>
    <details class="se-m1-details"><summary>Planning help</summary><div>Use this sentence: "When the viewer clicks the green flag, my sprite will ___, then ___, then ___, so the viewer understands ___."</div></details>
  `),
  discussion: wrap("Activity 4", "Talk Like a Coder", `
    <div class="se-m1-card teal"><h3>Precise instructions matter</h3><p>A person can sometimes guess missing steps. A computer cannot. In this discussion, compare everyday instructions with Scratch instructions and notice where confusion can happen.</p></div>
    <div class="se-m1-grid">
      <div class="se-m1-mini"><strong>Example</strong>"Make tea" sounds simple, but it hides many steps.</div>
      <div class="se-m1-mini"><strong>Scratch version</strong>Every action needs a block, a value, or an event.</div>
      <div class="se-m1-mini"><strong>Safety rule</strong>Use nicknames and fictional details, not private information.</div>
    </div>
    <div class="se-m1-note">Sentence starter: "One instruction that could be misunderstood is ___ because ___."</div>
  `),
  guided_practice: wrap("Activity 5", "Project 1", `
    <div class="se-m1-project">
      <div class="se-m1-project-head">
        <span class="se-m1-badge">Project 1</span><span class="se-m1-badge">Guided build</span><span class="se-m1-badge">5 marks</span>
        <h3>Make a Character Come Alive</h3>
        <p>Build one reliable animation. You are practising the exact routine real coders use: start, test, add one idea, test again.</p>
      </div>
      <div class="se-m1-card">
        <ol class="se-m1-steps">
          <li>Create a new Scratch project and choose one sprite.</li>
          <li>Add <strong>when green flag clicked</strong>.</li>
          <li>Set a starting x and y position so every test begins the same way.</li>
          <li>Add a short greeting that stays long enough to read.</li>
          <li>Add movement, a costume change, size change, or sound.</li>
          <li>Use waits if actions are happening too quickly.</li>
          <li>Run the green flag twice. Fix one thing before submitting.</li>
        </ol>
      </div>
    </div>
    <div class="se-m1-blocks">
      <h4>Helpful block pattern</h4>
      <span class="se-m1-block se-m1-event">when green flag clicked</span>
      <span class="se-m1-block se-m1-motion">go to x: -100 y: -20</span>
      <span class="se-m1-block se-m1-looks">say Welcome! for 2 seconds</span>
      <span class="se-m1-block se-m1-motion">glide 1 seconds to x: 100 y: -20</span>
      <span class="se-m1-block se-m1-looks">next costume</span>
    </div>
    <ul class="se-m1-checks"><li>The green flag always starts the animation.</li><li>The sprite starts in the same place.</li><li>The actions happen in a clear order.</li></ul>
  `),
  main_project: wrap("Activity 6", "Projects 2 and 3", `
    <div class="se-m1-card purple"><h3>Choose your main build</h3><p>Pick one project to complete carefully. Both are designed so a self-paced learner can plan, build, test, and explain the work.</p></div>
    <div class="se-m1-project">
      <div class="se-m1-project-head"><span class="se-m1-badge">Project 2</span><span class="se-m1-badge">Creative title</span><span class="se-m1-badge">20 marks</span><h3>My Name in Motion</h3><p>Create an animated title using letters, shapes, or invented symbols. Use a safe nickname or fictional title instead of a full private name.</p></div>
      <div class="se-m1-card"><ol class="se-m1-steps"><li>Choose at least three letters, shapes, or symbols as sprites.</li><li>Give each sprite a starting position.</li><li>Make each one animate in a different way: move, turn, grow, change colour, or switch costume.</li><li>Use waits so the title appears in a planned order.</li><li>End with a clear finished title on the Stage.</li><li>Test twice and improve timing, spacing, or readability.</li></ol></div>
    </div>
    <div class="se-m1-project">
      <div class="se-m1-project-head"><span class="se-m1-badge">Project 3</span><span class="se-m1-badge">Welcome card</span><span class="se-m1-badge">20 marks</span><h3>Educlub Welcome Card</h3><p>Design a friendly card for a new learner. Teach one helpful habit, such as testing often, saving work, reading instructions, or asking kind questions.</p></div>
      <div class="se-m1-card"><ol class="se-m1-steps"><li>Choose a welcoming backdrop and one or two sprites.</li><li>Write one short learning habit message.</li><li>Animate a sprite so the message feels alive.</li><li>Add one learner action, such as clicking a sprite or pressing space.</li><li>Include a save or testing tip at the end.</li><li>Ask another learner if the message is easy to understand.</li></ol></div>
    </div>
    <table class="se-m1-rubric"><tr><th>Ready</th><th>Excellent</th></tr><tr><td>The project works, has a clear start and ending, and uses safe text.</td><td>The project is polished, tested by someone else, and improved from evidence.</td></tr></table>
  `),
  challenge: wrap("Activity 7", "Try More", `
    <div class="se-m1-card coral"><h3>Clickable Surprise</h3><p>Finished the required project? Add a small surprise that only happens when the viewer clicks a sprite. This teaches that different events can start different scripts.</p></div>
    <ol class="se-m1-steps">
      <li>Duplicate or save a new version of your working project.</li>
      <li>Choose a sprite that looks clickable.</li>
      <li>Add <strong>when this sprite clicked</strong>.</li>
      <li>Reveal a kind message, sound, costume, or movement.</li>
      <li>Reset the sprite so the surprise can happen again.</li>
      <li>Test the green flag and the click event separately.</li>
    </ol>
    <div class="se-m1-blocks"><h4>Clickable surprise starter</h4><span class="se-m1-block se-m1-event">when this sprite clicked</span><span class="se-m1-block se-m1-looks">switch costume to surprise</span><span class="se-m1-block se-m1-sound">play sound Pop until done</span><span class="se-m1-block se-m1-looks">say You found it! for 2 seconds</span><span class="se-m1-block se-m1-looks">switch costume to normal</span></div>
  `),
  quiz: wrap("Activity 8", "Knowledge Check", `
    <div class="se-m1-card purple"><h3>Before you answer</h3><p>The quiz checks the words and ideas you used while building. Read each question slowly and imagine where that idea appears in your Scratch project.</p></div>
    <div class="se-m1-grid">
      <div class="se-m1-mini"><strong>Sprite</strong>Which part of your project was programmable?</div>
      <div class="se-m1-mini"><strong>Event</strong>What started your blocks?</div>
      <div class="se-m1-mini"><strong>Sequence</strong>What order did Scratch follow?</div>
      <div class="se-m1-mini"><strong>Debugging</strong>What did you test and fix?</div>
    </div>
    <div class="se-m1-note">Goal: reach 80 percent mastery. If you miss one, use the explanation as a clue and try again.</div>
  `),
  reflection: wrap("Activity 9", "Portfolio Reflection", `
    <div class="se-m1-card teal"><h3>Celebrate and submit</h3><p>Your portfolio shows what you built and how your thinking changed. A good reflection explains the project, the bug you fixed, and the evidence that it now works better.</p></div>
    <div class="se-m1-grid">
      <div class="se-m1-mini"><strong>Choose</strong>Which project are you most proud of?</div>
      <div class="se-m1-mini"><strong>Explain</strong>Where did you use an event and sequence?</div>
      <div class="se-m1-mini"><strong>Test</strong>What happened when you ran it more than once?</div>
      <div class="se-m1-mini"><strong>Improve</strong>What did you change after testing?</div>
    </div>
    <div class="se-m1-card amber"><h3>Submission checklist</h3><ul class="se-m1-checks"><li>Download the Scratch file as .sb3.</li><li>Reopen it to make sure it works.</li><li>Remove private information.</li><li>Upload it with a short explanation of one improvement.</li></ul></div>
    <div class="se-m1-hero"><span class="se-m1-kicker">Module 1 complete</span><h2>You are now a Creative Coding Explorer</h2><p>Next you will use these same foundations to build richer stories, animations, games, art, and investigations.</p></div>
  `),
};
