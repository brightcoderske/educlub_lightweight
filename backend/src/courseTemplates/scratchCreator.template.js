const { buildScratchCourse } = require("./scratchProgressive.builder");
const modules = require("./scratchCreator.modules");

module.exports = buildScratchCourse({
  name: "Scratch Creator: Games, STEAM and Smart Systems",
  code: "SCRATCH-CREATOR",
  description: "Create substantial games, simulations, data projects, smart systems, and a responsible introduction to machine learning.",
  targetLevel: "Developing | Events, loops, conditions and variables | Admin placement",
  imageUrl: "/course-assets/scratch-creator/course-cover.svg",
  imageAlt: "Learners creating games, simulations, data displays, and smart systems with block coding.",
  roadmapUrl: "/course-assets/scratch-creator/course-roadmap.svg",
  roadmapAlt: "Ten-step Scratch Creator roadmap from branching stories to a responsible STEAM design challenge.",
  paths: ["Explorer", "Creator", "Innovator"],
  learningObjectives: [
    "Build reliable multi-scene, multi-level, clone-based, and state-driven Scratch projects.",
    "Use custom blocks, lists, data, variables, probability, and scientific models.",
    "Plan fair investigations and explain evidence, uncertainty, and model limitations.",
    "Explain classification, training data, testing, bias, privacy, and human oversight.",
  ],
  modules,
});
