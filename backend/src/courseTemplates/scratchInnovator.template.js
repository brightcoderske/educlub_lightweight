const { buildScratchCourse } = require("./scratchProgressive.builder");
const modules = require("./scratchInnovator.modules");

module.exports = buildScratchCourse({
  name: "Scratch Innovator: Advanced Computing and Responsible AI",
  code: "SCRATCH-INNOVATOR",
  description: "Use Scratch as an advanced laboratory for algorithms, modelling, control systems, data science, machine learning, generative AI, and responsible innovation.",
  targetLevel: "Advanced | Lists, clones, broadcasts and custom blocks | Admin placement",
  imageUrl: "/course-assets/scratch-innovator/course-cover.svg",
  imageAlt: "Young innovators testing advanced algorithms, data systems, simulations, robotics, and responsible AI ideas.",
  roadmapUrl: "/course-assets/scratch-innovator/course-roadmap.svg",
  roadmapAlt: "Ten-step Scratch Innovator roadmap from software design to a responsible future-technology capstone.",
  paths: ["Explorer", "Creator", "Innovator"],
  learningObjectives: [
    "Design maintainable programs with specifications, state machines, procedures, algorithms, and repeatable tests.",
    "Create and validate mathematical models, control systems, data stories, search, sorting, and recommendation tools.",
    "Evaluate machine learning and generative AI through data quality, error analysis, privacy, fairness, attribution, and human oversight.",
    "Research, prototype, evaluate, document, and present a responsible advanced computing solution.",
  ],
  modules,
});
