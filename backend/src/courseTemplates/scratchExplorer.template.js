const { buildScratchCourse } = require("./scratchProgressive.builder");
const modules = require("./scratchExplorer.modules");

module.exports = buildScratchCourse({
  name: "Scratch Explorer: Creative Coding Foundations",
  code: "SCRATCH-EXPLORER",
  description: "Build confidence through stories, animation, art, games, quizzes, nature models, and engineering investigations.",
  targetLevel: "Foundation | New Scratch learners | School-admin placement",
  imageUrl: "/course-assets/scratch-explorer/course-cover.svg",
  imageAlt: "Young creators exploring stories, music, games, nature, and digital art with block coding.",
  roadmapUrl: "/course-assets/scratch-explorer/course-roadmap.svg",
  roadmapAlt: "Ten-step Scratch Explorer roadmap from first animation to an original showcase project.",
  paths: ["Explorer", "Creator", "Innovator"],
  learningObjectives: [
    "Use events, sequences, loops, conditions, variables, input, sensing, broadcasts, and pen tools.",
    "Plan projects with storyboards, algorithms, predictions, and success checks.",
    "Connect creative coding to language, art, music, mathematics, science, and engineering.",
    "Test, debug, explain, save, and submit original Scratch projects safely.",
  ],
  modules,
});
