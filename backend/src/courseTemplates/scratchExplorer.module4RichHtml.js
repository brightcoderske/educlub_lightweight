const style = `
<style>
  .se-m4 { --blue:#1d70f2; --blue-2:#edf5ff; --violet:#7657d6; --violet-2:#f1edff; --green:#13976f; --green-2:#e7f8f1; --orange:#c96719; --orange-2:#fff2df; --ink:#172033; --muted:#566274; --line:#e1e6ef; font-family:"Segoe UI",system-ui,sans-serif; color:var(--ink); line-height:1.7; }
  .se-m4 * { box-sizing:border-box; }
  .se-m4-hero { border-radius:16px; padding:28px; color:#fff; background:radial-gradient(circle at 85% 10%,rgba(255,255,255,.22),transparent 28%),linear-gradient(135deg,#17306f 0%,#7657d6 52%,#13976f 100%); overflow:hidden; }
  .se-m4-kicker { display:inline-block; margin-bottom:10px; padding:5px 12px; border:1px solid rgba(255,255,255,.38); border-radius:999px; background:rgba(255,255,255,.16); font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
  .se-m4 h2 { margin:0 0 8px; font-size:26px; line-height:1.2; color:inherit; }
  .se-m4 h3 { margin:0 0 8px; font-size:18px; color:var(--ink); }
  .se-m4 h4 { margin:0 0 6px; font-size:15px; color:var(--ink); }
  .se-m4 p { margin:0 0 12px; color:var(--muted); }
  .se-m4-hero p { color:rgba(255,255,255,.9); max-width:760px; }
  .se-m4-meta { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
  .se-m4-pill { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:6px 11px; background:rgba(255,255,255,.16); color:inherit; font-size:12px; font-weight:700; }
  .se-m4-card { border:1px solid var(--line); border-radius:12px; padding:18px; margin:14px 0; background:#fff; }
  .se-m4-card.blue { border-left:5px solid var(--blue); background:var(--blue-2); }
  .se-m4-card.violet { border-left:5px solid var(--violet); background:var(--violet-2); }
  .se-m4-card.green { border-left:5px solid var(--green); background:var(--green-2); }
  .se-m4-card.orange { border-left:5px solid var(--orange); background:var(--orange-2); }
  .se-m4-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin:14px 0; }
  .se-m4-mini { border:1px solid var(--line); border-radius:10px; padding:14px; background:#fff; }
  .se-m4-mini strong { display:block; color:#402b9a; margin-bottom:4px; }
  .se-m4-steps { list-style:none; padding:0; margin:12px 0 0; counter-reset:step; }
  .se-m4-steps li { counter-increment:step; display:flex; gap:12px; margin:0 0 13px; color:var(--muted); }
  .se-m4-steps li:before { content:counter(step); width:28px; height:28px; flex:0 0 28px; border-radius:50%; background:var(--violet); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; }
  .se-m4-blocks { border:1px solid var(--line); border-radius:12px; padding:14px; background:#f8fafc; margin:12px 0; }
  .se-m4-block { display:inline-block; margin:4px 4px 4px 0; padding:7px 12px; border-radius:7px; color:#fff; font-weight:800; font-size:13px; }
  .se-m4-event { background:#f4a61d; color:#2f2100; } .se-m4-motion { background:#3f8cff; } .se-m4-pen { background:#0f9d78; } .se-m4-control { background:#f4a61d; color:#2f2100; } .se-m4-looks { background:#8f5cff; } .se-m4-sensing { background:#49a6ff; }
  .se-m4-note { margin:12px 0; padding:12px 14px; border-radius:10px; background:#fff; border:1px dashed #c9cdd8; color:var(--muted); }
  .se-m4-project { border:1px solid var(--line); border-radius:12px; overflow:hidden; background:#fff; margin:14px 0; }
  .se-m4-project-head { padding:15px 18px; background:linear-gradient(90deg,var(--violet-2),#fff); }
  .se-m4-badge { display:inline-block; margin:0 6px 6px 0; padding:3px 9px; border-radius:999px; font-size:11px; font-weight:800; text-transform:uppercase; background:var(--green-2); color:#07513e; }
  .se-m4-checks { margin:8px 0 0; padding-left:18px; color:var(--muted); }
  .se-m4-board { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin:12px 0; }
  .se-m4-cell { min-height:48px; border-radius:8px; background:linear-gradient(135deg,#edf5ff,#f1edff); border:1px solid #dce4f4; display:flex; align-items:center; justify-content:center; font-weight:800; color:#402b9a; }
  .se-m4-rubric { width:100%; border-collapse:collapse; margin-top:10px; background:#fff; }
  .se-m4-rubric th,.se-m4-rubric td { border:1px solid var(--line); padding:9px; text-align:left; vertical-align:top; }
  .se-m4-rubric th { background:#f8fafc; color:var(--ink); }
</style>`;

const wrap = (body) => `${style}<div class="se-m4">${body}</div>`;

module.exports = {
  overview: wrap(`
    <div class="se-m4-hero">
      <span class="se-m4-kicker">Module 4 of 10</span>
      <h2>Shapes, Patterns and Digital Art</h2>
      <p>Turn Scratch into an art studio. You will use coordinates, direction, repeat loops, angles, and the pen extension to draw accurate shapes, then transform them into original patterns.</p>
      <div class="se-m4-meta"><span class="se-m4-pill">Digital art lab</span><span class="se-m4-pill">Geometry + coding</span><span class="se-m4-pill">3 build paths</span><span class="se-m4-pill">Portfolio project</span></div>
    </div>
    <div class="se-m4-grid">
      <div class="se-m4-mini"><strong>Coordinate</strong>x and y values place the sprite exactly on the Stage.</div>
      <div class="se-m4-mini"><strong>Angle</strong>a turn amount controls the corner of each shape.</div>
      <div class="se-m4-mini"><strong>Loop</strong>repeat blocks redraw the same move-turn rule.</div>
      <div class="se-m4-mini"><strong>Symmetry</strong>balanced matching parts make a design feel intentional.</div>
    </div>
    <div class="se-m4-card green"><h3>Your mission</h3><p>Create digital artwork that can be redrawn by an algorithm. Your final project should look creative, but it must also prove a clear coding rule.</p></div>
  `),
  visual_learning: wrap(`
    <div class="se-m4-card violet"><h3>See the art system</h3><p>Every drawing has four connected parts: a starting point, a pen state, a movement rule, and a repeat pattern. If one part is unclear, the picture becomes hard to debug.</p></div>
    <div class="se-m4-grid">
      <div class="se-m4-mini"><strong>Start</strong>Clear the Stage and move to a known coordinate.</div>
      <div class="se-m4-mini"><strong>Draw</strong>Put the pen down, move, and turn.</div>
      <div class="se-m4-mini"><strong>Repeat</strong>Use loops so the algorithm does the hard work.</div>
      <div class="se-m4-mini"><strong>Transform</strong>Change color, size, position, or rotation to create a pattern.</div>
    </div>
    <div class="se-m4-board"><div class="se-m4-cell">start</div><div class="se-m4-cell">move</div><div class="se-m4-cell">turn</div><div class="se-m4-cell">repeat</div></div>
    <div class="se-m4-note"><strong>Prediction:</strong> What regular shape appears if a sprite repeats move and turn 90 degrees four times?</div>
  `),
  algorithm: wrap(`
    <div class="se-m4-card orange"><h3>Plan the drawing algorithm</h3><p>Artists sketch. Coders plan. Before you draw in Scratch, decide the repeat count, movement size, and turn amount.</p></div>
    <ol class="se-m4-steps">
      <li>Clear earlier pen marks.</li>
      <li>Move to a planned starting coordinate.</li>
      <li>Put the pen down.</li>
      <li>Repeat move and turn to draw one shape.</li>
      <li>Change color, position, size, or turn.</li>
      <li>Repeat the shape to create a larger pattern.</li>
    </ol>
    <div class="se-m4-blocks"><h4>Shape starter stack</h4><span class="se-m4-block se-m4-event">when green flag clicked</span><span class="se-m4-block se-m4-pen">erase all</span><span class="se-m4-block se-m4-motion">go to x: -80 y: 0</span><span class="se-m4-block se-m4-pen">pen down</span><span class="se-m4-block se-m4-control">repeat 4</span><span class="se-m4-block se-m4-motion">move 80 steps</span><span class="se-m4-block se-m4-motion">turn 90 degrees</span></div>
  `),
  discussion: wrap(`
    <div class="se-m4-card blue"><h3>Patterns tell stories</h3><p>Patterns appear in clothing, buildings, baskets, nature, games, and interfaces. Discuss how repetition creates unity while small changes create surprise.</p></div>
    <div class="se-m4-grid">
      <div class="se-m4-mini"><strong>Symmetry hunt</strong>Where have you noticed balanced matching parts?</div>
      <div class="se-m4-mini"><strong>Loop artist</strong>How does a repeat block help an artist make more work with fewer instructions?</div>
      <div class="se-m4-mini"><strong>Design choice</strong>When does a repeated pattern become too crowded?</div>
    </div>
    <div class="se-m4-note">Sentence starter: "My pattern feels balanced because ___ repeats, while ___ changes."</div>
  `),
  guided_practice: wrap(`
    <div class="se-m4-project"><div class="se-m4-project-head"><span class="se-m4-badge">Project 1</span><span class="se-m4-badge">Guided build</span><span class="se-m4-badge">Pen extension</span><h3>Shape Drawing Machine</h3><p>Build a machine that draws a square, triangle, and hexagon from known side and turn values.</p></div>
      <div class="se-m4-card"><ol class="se-m4-steps"><li>Add the Pen extension and clear the Stage.</li><li>Draw a square with repeat 4 and 90-degree turns.</li><li>Change the loop count and turn amount for a triangle.</li><li>Change them again for a hexagon.</li><li>Move to a new coordinate before each shape.</li><li>Test that each shape closes cleanly.</li></ol></div></div>
    <div class="se-m4-note"><strong>Debug clue:</strong> if a shape does not close, check the number of repeats and whether the total turn reaches 360 degrees.</div>
  `),
  main_project: wrap(`
    <div class="se-m4-card violet"><h3>Choose your art studio project</h3><p>Pick one complete project. Both should be beautiful enough to show and logical enough to redraw from your code.</p></div>
    <div class="se-m4-project"><div class="se-m4-project-head"><span class="se-m4-badge">Project 2</span><span class="se-m4-badge">Radial art</span><span class="se-m4-badge">20 marks</span><h3>Pattern and Mandala Studio</h3><p>Create an original radial or tiled pattern by repeating a base shape while changing turn, color, size, or position.</p></div>
      <div class="se-m4-card"><ol class="se-m4-steps"><li>Choose one accurate base shape.</li><li>Make a custom block or repeat pattern that redraws it.</li><li>Rotate, move, recolor, or resize the shape after each copy.</li><li>Test with small repeat counts before filling the Stage.</li><li>Add a title or artist note explaining the rule.</li><li>Ask a peer what feels balanced or too crowded, then improve.</li></ol></div></div>
    <div class="se-m4-project"><div class="se-m4-project-head"><span class="se-m4-badge">Project 3</span><span class="se-m4-badge">Design lab</span><span class="se-m4-badge">20 marks</span><h3>Digital Textile or Tile</h3><p>Design a repeating motif inspired by nature, geometry, school life, or an original symbol. Explain the transformation: translation, rotation, reflection, or scale.</p></div>
      <div class="se-m4-card"><ol class="se-m4-steps"><li>Sketch a small motif on paper or in your notebook.</li><li>Build the motif with pen movement, sprites, or costumes.</li><li>Repeat it across the Stage with balanced spacing.</li><li>Use at least one transformation deliberately.</li><li>Label the transformation in the project.</li><li>Save and test that the artwork can redraw from a fresh green flag.</li></ol></div></div>
    <table class="se-m4-rubric"><tr><th>Ready</th><th>Excellent</th></tr><tr><td>The art redraws reliably and shows a repeated pattern.</td><td>The art is original, balanced, explained mathematically, and improved after testing.</td></tr></table>
  `),
  challenge: wrap(`
    <div class="se-m4-card green"><h3>User-Controlled Art</h3><p>Finished your required art? Let the viewer choose one safe value, such as number of sides, size, color, or repeat count.</p></div>
    <ol class="se-m4-steps">
      <li>Duplicate your working art project.</li>
      <li>Ask for one numeric value.</li>
      <li>Check that the value is inside a safe range.</li>
      <li>Use the answer in the drawing algorithm.</li>
      <li>Show guidance if the input is too small, too large, or not useful.</li>
      <li>Clear and redraw so the viewer sees the new result.</li>
    </ol>
    <div class="se-m4-blocks"><h4>Input idea</h4><span class="se-m4-block se-m4-sensing">ask How many sides? and wait</span><span class="se-m4-block se-m4-control">if answer &lt; 3 then</span><span class="se-m4-block se-m4-looks">say Choose 3 or more</span></div>
  `),
  quiz: wrap(`
    <div class="se-m4-card violet"><h3>Knowledge Check</h3><p>The quiz asks about the same ideas you used while drawing: coordinates, turns, loops, clearing, and symmetry.</p></div>
    <div class="se-m4-grid">
      <div class="se-m4-mini"><strong>x and y</strong>Place a sprite exactly before drawing.</div>
      <div class="se-m4-mini"><strong>90 degrees</strong>Four outside turns close a square.</div>
      <div class="se-m4-mini"><strong>Loop</strong>Repeat the same drawing rule without copying blocks.</div>
      <div class="se-m4-mini"><strong>Clear</strong>Remove old pen marks before a fresh test.</div>
    </div>
    <div class="se-m4-note">Goal: reach 80 percent mastery. If one answer is wrong, return to your project and point to the block that proves the idea.</div>
  `),
  reflection: wrap(`
    <div class="se-m4-card green"><h3>Portfolio Reflection</h3><p>A strong digital artist can explain both the artwork and the algorithm. Show what repeats, what changes, and what evidence proves the project redraws correctly.</p></div>
    <div class="se-m4-grid">
      <div class="se-m4-mini"><strong>Choose</strong>Which pattern or motif is your best work?</div>
      <div class="se-m4-mini"><strong>Explain</strong>Where did you use coordinates, angle, loop, or symmetry?</div>
      <div class="se-m4-mini"><strong>Test</strong>What happened after clearing and running the green flag twice?</div>
      <div class="se-m4-mini"><strong>Improve</strong>What did you change after peer feedback?</div>
    </div>
    <div class="se-m4-card orange"><h3>Submission checklist</h3><ul class="se-m4-checks"><li>Download the Scratch file as .sb3.</li><li>Reopen it and confirm the artwork redraws.</li><li>Include no private information.</li><li>Upload it with one sentence explaining the pattern rule.</li></ul></div>
    <div class="se-m4-hero"><span class="se-m4-kicker">Module 4 complete</span><h2>You are now an Algorithmic Artist</h2><p>Next you will use movement rules in a different way: navigating a maze and testing collisions.</p></div>
  `),
};
