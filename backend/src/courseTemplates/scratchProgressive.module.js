function conceptQuiz(concepts, application) {
  const meanings = concepts.map(([, meaning]) => meaning);
  const questions = concepts.map(([term, meaning], index) => {
    const alternatives = meanings.filter((item) => item !== meaning).slice(0, 3);
    const options = [meaning, ...alternatives];
    const shift = index % options.length;
    return {
      prompt: `What does ${term} mean in this module?`,
      options: [...options.slice(shift), ...options.slice(0, shift)],
      answer: meaning,
      hint: `Find ${term} in the guided vocabulary and connect it to the project behavior.`,
      explanation: `${meaning} is correct because that is the job ${term} performs in the module's algorithm and projects.`,
    };
  });
  questions.push({
    prompt: application.prompt,
    options: application.options,
    answer: application.answer,
    hint: application.hint,
    explanation: application.explanation,
  });
  return questions;
}

function createModule(input) {
  return {
    ...input,
    quiz: conceptQuiz(input.concepts, input.application),
  };
}

module.exports = { createModule };
