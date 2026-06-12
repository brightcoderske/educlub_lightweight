const missions = [
  {
    title: "Mission 1 - Meet the Web", badge: "Web Explorer",
    reading: "What Is a Website?", discussion: "Which website helps you learn, create, or solve a problem?",
    summary: "A website is a collection of connected pages. Browsers request files from servers. HTML provides structure and CSS provides style.",
    imageAlt: "A browser requesting website files from a server.", video: "How a website reaches your screen",
    practice: "Create a valid HTML page skeleton and identify the editor and live preview.",
    build: "Choose a safe guided topic and add the page title.", milestone: "page-skeleton",
    levelUp: "Add a safe subtitle describing your chosen topic.", reflection: "What do you want visitors to learn from your website?",
    concepts: [["Browser", "Requests and displays web pages"], ["Server", "Stores and delivers website files"], ["HTML", "Gives a page structure"], ["CSS", "Gives a page style"]],
    choice: ["Chrome", "HTML", "A server room", "CSS"], choiceAnswer: "Chrome",
    fill: "website", order: ["Browser requests files", "Server sends files", "Browser displays the page"],
    starterHtml: "<!doctype html>\n<html>\n<head><title>My First Website</title></head>\n<body>\n<h1>My First Website</h1>\n</body>\n</html>", starterCss: "",
  },
  {
    title: "Mission 2 - HTML Building Blocks", badge: "HTML Builder",
    reading: "HTML Is the Structure", discussion: "How is a web page like a book or school poster?",
    summary: "HTML elements describe content. Headings, paragraphs, and lists organize ideas, while correct nesting keeps code understandable.",
    imageAlt: "An HTML element labelled opening tag, content, and closing tag.", video: "Building with headings, paragraphs, and lists",
    practice: "Practise h1, h2, p, ul, ol, and li elements.", build: "Add an introduction, two sections, facts, and a list.",
    milestone: "structured-content", levelUp: "Add a quotation or fun-fact section.", reflection: "Which HTML element was most useful today?",
    concepts: [["<h1>", "Main heading"], ["<p>", "Paragraph"], ["<ol>", "Numbered list"], ["<li>", "List item"]],
    choice: ["h1 then h2", "h3 then h1", "p then h1", "li then h1"], choiceAnswer: "h1 then h2",
    fill: "</p>", order: ["Open the list", "Open a list item", "Add item text", "Close the list item", "Close the list"],
    starterHtml: "<h1>My Topic</h1>\n<p>Welcome to my website.</p>\n<h2>Facts</h2>\n<ul><li>First fact</li></ul>", starterCss: "",
  },
  {
    title: "Mission 3 - Links and Images", badge: "Content Connector",
    reading: "Connecting the Web", discussion: "What makes a link helpful instead of confusing?",
    summary: "Links connect pages. Images need a source and meaningful alternative text. Creators use safe, permitted images and credit them when required.",
    imageAlt: "A link and image element with href, src, and alt attributes labelled.", video: "Adding a safe image and meaningful link",
    practice: "Add a link, image, alternative text, and an approved source link.", build: "Add at least two relevant images and two useful links.",
    milestone: "links-and-images", levelUp: "Turn one image into a link.", reflection: "How does alternative text help a visitor?",
    concepts: [["href", "Where a link goes"], ["src", "Where an image comes from"], ["alt", "A text description of an image"], ["credit", "Names the image creator or source"]],
    choice: ["A brown dog running through grass", "picture", "image123", "nice"], choiceAnswer: "A brown dog running through grass",
    fill: "alt", order: ["Find an image", "Check permission", "Save the source", "Write useful alternative text"],
    starterHtml: "<h1>My Topic</h1>\n<img src=\"image.jpg\" alt=\"Describe the image\">\n<p><a href=\"https://example.com\">Visit a useful source</a></p>", starterCss: "",
  },
  {
    title: "Mission 4 - CSS Style Lab", badge: "Style Scientist",
    reading: "CSS Gives a Website Its Look", discussion: "How can color change the feeling of a website?",
    summary: "CSS rules use selectors, properties, and values. Consistent colors and fonts make a website attractive and readable.",
    imageAlt: "A CSS rule labelled selector, property, and value.", video: "Styling text, links, colors, and backgrounds",
    practice: "Style the body, headings, paragraphs, links, and background.", build: "Create a consistent color palette and type style.",
    milestone: "visual-style", levelUp: "Add a hover style to links.", reflection: "Which design choice best matches your topic, and why?",
    concepts: [["selector", "Chooses what to style"], ["property", "Names what will change"], ["value", "Sets how it will look"], ["semicolon", "Ends a declaration"]],
    choice: ["Dark blue text on white", "Yellow text on white", "Red text on orange", "Gray text on gray"], choiceAnswer: "Dark blue text on white",
    fill: "color", order: ["Write the selector", "Open the rule", "Add property and value", "Close the rule"],
    starterHtml: "<h1>My Styled Website</h1>\n<p>This page has its own look.</p>", starterCss: "body { background: #f5f9ff; color: #16324f; }\nh1 { color: #2563eb; }",
  },
  {
    title: "Mission 5 - Boxes and Spacing", badge: "Layout Architect",
    reading: "Every Element Has a Box", discussion: "Why is empty space useful in a design?",
    summary: "Every element is a box. Padding creates space inside the border, while margin creates space outside it.",
    imageAlt: "The box model showing content, padding, border, and margin.", video: "Turning plain sections into clear cards",
    practice: "Use classes, margin, padding, borders, width, and alignment.", build: "Organize content into clear sections or cards.",
    milestone: "box-layout", levelUp: "Add rounded corners and a subtle shadow.", reflection: "What became easier to read after changing the spacing?",
    concepts: [["content", "The text or image"], ["padding", "Space inside the border"], ["border", "The edge around padding"], ["margin", "Space outside the border"]],
    choice: ["padding", "margin", "color", "font-size"], choiceAnswer: "padding",
    fill: "margin", order: ["Content", "Padding", "Border", "Margin"],
    starterHtml: "<section class=\"card\"><h2>My Section</h2><p>Grouped content.</p></section>", starterCss: ".card { padding: 20px; margin: 16px; border: 2px solid #2563eb; }",
  },
  {
    title: "Mission 6 - Pages and Navigation", badge: "Site Navigator",
    reading: "From One Page to a Website", discussion: "What should a visitor be able to find quickly?",
    summary: "Websites can have connected pages. Clear, consistent navigation and correct relative paths help visitors move around.",
    imageAlt: "A site map connecting a home page and an information page.", video: "Creating and linking a second page",
    practice: "Plan a second page and repeat a clear navigation menu.", build: "Connect two pages and confirm every navigation link works.",
    milestone: "second-page-navigation", levelUp: "Add a Back to top link or optional third page.", reflection: "Could a first-time visitor move around without help?",
    concepts: [["index.html", "Home page"], ["about.html", "Information page"], ["navigation", "Links for moving around"], ["relative path", "A path to a file in the website"]],
    choice: ["Home", "Click here maybe", "Mystery", "Page 1 thing"], choiceAnswer: "Home",
    fill: "about.html", order: ["Plan the pages", "Create the files", "Add navigation links", "Test every link"],
    starterHtml: "<nav><a href=\"index.html\">Home</a> <a href=\"about.html\">About</a></nav>\n<h1>Home</h1>", starterCss: "nav a { margin-right: 12px; }",
  },
  {
    title: "Mission 7 - Polish and Test", badge: "Bug Detective",
    reading: "Test, Fix, Improve", discussion: "Describe a mistake that helped you learn something.",
    summary: "Testing is part of building. Developers check one problem at a time and improve links, images, readability, and accessibility.",
    imageAlt: "A website testing checklist for code, links, images, contrast, and keyboard use.", video: "Finding common HTML and CSS mistakes",
    practice: "Repair syntax, broken links, missing images, overflow, and readability problems.", build: "Complete peer review and improve the website.",
    milestone: "tested-accessible-site", levelUp: "Add one simple responsive CSS rule.", reflection: "Which improvement made the biggest difference?",
    concepts: [["broken image", "Check the src path"], ["missing style", "Check the selector and punctuation"], ["hard to read", "Improve contrast and size"], ["broken link", "Check the href path"]],
    choice: ["Your headings are clear; consider making the link color darker.", "It is bad.", "I do not like it.", "Change everything."], choiceAnswer: "Your headings are clear; consider making the link color darker.",
    fill: "alt", order: ["Notice the problem", "Read the relevant code", "Change one thing", "Preview and test again"],
    starterHtml: "<h1>Website Test</h1>\n<img src=\"topic.jpg\" alt=\"Describe your topic\">\n<a href=\"about.html\">About</a>", starterCss: "body { max-width: 900px; margin: auto; padding: 16px; }\n@media (max-width: 600px) { body { font-size: 18px; } }",
  },
  {
    title: "Mission 8 - Launch Day", badge: "Web Creator",
    reading: "From Code to the World", discussion: "What are you most proud of, and what would you build next?",
    summary: "Publishing gives a website an address. Creators test, receive teacher approval, download their files, and explain their design choices.",
    imageAlt: "A flow from draft to test, teacher approval, publish, download, and showcase.", video: "Publishing and downloading an eduClub website",
    practice: "Complete the final safety, accessibility, link, and image checklist.", build: "Submit for approval, publish, download, and present the website.",
    milestone: "approved-launched-site", levelUp: "Preview the supplied tiny JavaScript interaction.", reflection: "What can you build now that you could not build before?",
    concepts: [["draft", "A website still being improved"], ["approval", "A teacher checks it is ready and safe"], ["publish", "Make it available through a link"], ["download", "Save a copy of the files"]],
    choice: ["Test and ask for teacher approval", "Publish private details", "Skip checking links", "Use any image online"], choiceAnswer: "Test and ask for teacher approval",
    fill: "publish", order: ["Finish the draft", "Test the website", "Receive teacher approval", "Publish and download", "Present the website"],
    starterHtml: "<button id=\"hello\">Celebrate my website</button>\n<p id=\"message\"></p>\n<script>document.querySelector('#hello').onclick = () => document.querySelector('#message').textContent = 'I am a Web Creator!';</script>", starterCss: "button { padding: 12px 18px; background: #2563eb; color: white; border: 0; border-radius: 8px; }",
  },
];

const activity = (title, type, purpose, content, options = {}) => ({
  title, activity_type: type, content: { purpose, ...content },
  points: options.points || 0, is_required: options.is_required !== false,
  completion_rule: options.completion_rule || "viewed",
  pass_score: options.pass_score || null,
});

function questionsFor(mission, week) {
  const choicePrompts = [
    "Which item is a web browser?",
    "Which heading order gives a page the clearest structure?",
    "Which alternative text best describes an image?",
    "Which color combination is easiest to read?",
    "Which CSS property adds space inside a border?",
    "Which navigation label is clearest for visitors?",
    "Which peer-feedback comment is kind and useful?",
    "What should happen before a website is published?",
  ];
  const fillPrompts = [
    "A collection of connected web pages is a ____.",
    "Complete this paragraph element: <p>Hello ____",
    "The ____ attribute describes an image for people who cannot see it.",
    "Complete the CSS declaration: ____: blue;",
    "The space outside an element's border is called ____.",
    "Complete this link to the second page: href=\"____\".",
    "Every meaningful image should have an ____ description.",
    "Making a website available through a web address is called ____.",
  ];
  return [
    { id: `w${week}-choice`, question_type: "multiple_choice", prompt: choicePrompts[week - 1], options: mission.choice, correct_answer: mission.choiceAnswer, points: 1, hint: "Think back to the example in the reading.", explanation: `${mission.choiceAnswer} is the best answer.` },
    { id: `w${week}-match`, question_type: "matching", prompt: "Match each term to its job.", options: mission.concepts.map(([left, right]) => ({ left, right })), correct_answer: Object.fromEntries(mission.concepts), points: 4, hint: "Say each term and its job aloud.", explanation: "Each web term has a specific job." },
    { id: `w${week}-fill`, question_type: "short_answer", prompt: fillPrompts[week - 1], options: [], correct_answer: mission.fill, points: 1, hint: `The answer begins with ${mission.fill[0].toUpperCase()}.`, explanation: `The missing answer is ${mission.fill}.` },
    { id: `w${week}-order`, question_type: "ordering", prompt: "Arrange these steps in the correct order.", options: [...mission.order].reverse(), correct_answer: mission.order, points: mission.order.length, hint: "Find what must happen first, then work forward.", explanation: `The correct order is: ${mission.order.join(" -> ")}.` },
  ];
}

function activitiesFor(mission, week) {
  const vocabularyText = mission.concepts.map(([term, meaning]) => `${term} means ${meaning.toLowerCase()}.`).join(" ");
  const readingBody = `${mission.summary}\n\n${vocabularyText}\n\nYour mission is to connect this idea to your own website. ${mission.practice} Then ${mission.build.toLowerCase()} Work one small step at a time, preview every change, and keep private information out of your page.`;
  const transcript = `${mission.video}. First, review this idea: ${mission.summary} Next, open the eduClub editor. ${mission.practice} Preview the result and check each change. Then complete the mission build: ${mission.build} Finally, use the quiz and reflection to explain what you learned.`;
  const media = { image_url: "", image_alt: mission.imageAlt, video_url: "", video_title: mission.video, transcript };
  const badge = { name: mission.badge, image_url: "" };
  return [
    activity(`${mission.title}: Welcome`, "lesson", "welcome", { description: mission.summary, module_badge: badge, guided_topics: ["About Me", "A hobby", "A favorite animal", "A school club", "A local hero"] }),
    activity(`Discover: ${mission.reading}`, "lesson", "reading", { body: readingBody, media, vocabulary: mission.concepts.map(([term, meaning]) => ({ term, meaning })) }),
    activity(`Watch: ${mission.video}`, "lesson", "video", { description: mission.video, media }),
    activity("Talk: Class Discussion", "discussion", "discussion", { discussion_prompt: mission.discussion, moderation_notes: "Use kind, safe, topic-focused replies." }, { completion_rule: "submitted" }),
    activity("Try It: Guided Practice", "coding", "guided_practice", { description: mission.practice, starter_html: mission.starterHtml, starter_css: mission.starterCss, language: week === 8 ? "html_css_js" : "html_css", friendly_hints: ["Read one instruction at a time.", "Preview after each small change."] }, { completion_rule: "submitted" }),
    activity("Build It: Website Milestone", "coding", "build", { project_brief: mission.build, starter_html: mission.starterHtml, starter_css: mission.starterCss, language: week === 8 ? "html_css_js" : "html_css", milestone_key: mission.milestone, expected_checks: [mission.milestone], friendly_hints: ["Use the guided example as a starting point.", "Ask what the visitor should see first."] }, { points: 10, completion_rule: "submitted" }),
    activity("Knowledge Check", "quiz", "quiz", { description: "Show what you understand. You may retry and use friendly hints.", questions: questionsFor(mission, week), unlimited_retries: true }, { points: 10, completion_rule: "score_at_least", pass_score: 80 }),
    activity("Level Up: Optional Challenge", "assignment", "level_up", { project_brief: mission.levelUp, submission_instructions: "Try this only when your required milestone works." }, { is_required: false, completion_rule: "submitted" }),
    activity("Reflect on Your Learning", "reflection", "reflection", { reflection_prompt: mission.reflection, confidence_prompt: "How confident do you feel: growing, ready, or ready to help?" }, { completion_rule: "submitted" }),
    activity(`Celebrate: ${mission.badge}`, "lesson", "celebration", { body: `Mission complete. You earned the ${mission.badge} badge.`, module_badge: badge }),
  ];
}

module.exports = {
  name: "Welcome to Web Development 1",
  code: "WEB-DEV-1",
  validation_profile: "web_development_1",
  description: "Discover how websites work and build, test, publish, and download your first website.",
  target_level: "Ages 9-14",
  image_url: "",
  estimated_weeks: 8,
  learning_objectives: [
    "Explain what websites, browsers, servers, HTML, and CSS do.",
    "Create structured and connected HTML pages.",
    "Style readable pages with foundational CSS.",
    "Test a website for correctness, safety, and accessibility.",
  ],
  certificate_enabled: true,
  course_category: "general",
  settings: { mastery_score: 80, unlimited_quiz_retries: true, public_showcase_enabled: true, teacher_publish_approval_required: true },
  modules: missions.map((mission, index) => ({
    title: mission.title, description: mission.summary,
    learning_outcomes: mission.concepts.map(([term, meaning]) => `${term}: ${meaning}`),
    badge: { name: mission.badge, image_url: "" },
    teacher_notes: `Demonstrate the guided practice, discuss common misconceptions, support younger learners with starter code, and check milestone ${mission.milestone}.`,
    activities: activitiesFor(mission, index + 1),
  })),
};
