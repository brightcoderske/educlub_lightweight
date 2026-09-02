import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../assets/theme";
import { MaterialUIControllerProvider } from "../context";
import QuizStudioForm from "../layouts/weekly-learning/QuizStudioForm";
import { emptyQuizForm, defaultQuestions } from "../layouts/weekly-learning/weeklyLearningUtils";
import { emptyTypingForm } from "../layouts/weekly-learning/weeklyLearningUtils";

function QuizHarness() {
  const [form, setForm] = useState(() => ({
    ...emptyQuizForm(),
    name: "History quiz",
    term: "Term 2",
    academic_year: 2025,
  }));
  return (
    <QuizStudioForm
      quizForm={form}
      setQuizForm={setForm}
      isSystemAdmin={() => false}
      termOptions={[{ id: 1, name: "Term 2", academic_year: 2025 }]}
      quizTerms={[{ id: 1, name: "Term 2" }]}
      quizWeekOptions={[{ week_number: 1 }]}
      selectedQuizTerm={{ id: 1 }}
      quizCompetitions={[]}
      addQuizQuestion={() =>
        setForm((current) => ({
          ...current,
          questions: [
            ...current.questions,
            { ...defaultQuestions()[0], position: current.questions.length + 1 },
          ],
        }))
      }
      updateQuizQuestion={(index, changes) =>
        setForm((current) => ({
          ...current,
          questions: current.questions.map((item, i) =>
            i === index ? { ...item, ...changes } : item
          ),
        }))
      }
      removeQuizQuestion={() => {}}
      saveQuizTest={() => {}}
      toggleQuizGrade={() => {}}
    />
  );
}

test("quiz steps change only by creator choice and adding a question preserves earlier questions", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const tab = (label) =>
    [...container.querySelectorAll('[role="tab"]')].find((item) =>
      item.textContent.includes(label)
    );
  const input = (label) => {
    const element = [...container.querySelectorAll("label")].find(
      (item) => item.textContent === label
    );
    return document.getElementById(element.htmlFor);
  };
  try {
    await act(async () =>
      root.render(
        <ThemeProvider theme={theme}>
          <MaterialUIControllerProvider>
            <QuizHarness />
          </MaterialUIControllerProvider>
        </ThemeProvider>
      )
    );
    expect(tab("Quiz Details").getAttribute("aria-selected")).toBe("true");
    await act(async () =>
      Simulate.change(input("Quiz Name"), { target: { value: "Updated quiz" } })
    );
    expect(tab("Quiz Details").getAttribute("aria-selected")).toBe("true");
    await act(async () => tab("Questions").click());
    const prompt = input("Question");
    await act(async () => Simulate.change(prompt, { target: { value: "Original question one" } }));
    const firstOption = input("Option A");
    expect(firstOption).not.toBeNull();
    await act(async () => Simulate.change(firstOption, { target: { value: "Original answer" } }));
    const add = [...container.querySelectorAll("button")].find((item) =>
      item.textContent.includes("Add Question")
    );
    await act(async () => add.click());
    expect(tab("Questions").getAttribute("aria-selected")).toBe("true");
    await act(async () =>
      Simulate.change(input("Question"), { target: { value: "Second question" } })
    );
    const first = [...container.querySelectorAll("button")].find((item) =>
      item.textContent.includes("Original question one")
    );
    expect(first).toBeDefined();
    await act(async () => first.click());
    expect(input("Question").value).toBe("Original question one");
    expect(input("Option A").value).toBe("Original answer");
    expect(container.textContent).toContain("Second question");
    const preview = container.querySelector('[aria-label="All quiz questions preview"]');
    expect(preview.textContent).toContain("Original question one");
    expect(preview.textContent).toContain("Second question");
    await act(async () => tab("Settings").click());
    await act(async () => Simulate.change(input("Pass Score"), { target: { value: "70" } }));
    expect(tab("Settings").getAttribute("aria-selected")).toBe("true");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

test("a new typing assessment starts with one independent lesson", () => {
  const first = emptyTypingForm();
  expect(first.lessons).toEqual([{ title: "Lesson 1", passage: "", instructions: "" }]);
  first.lessons[0].passage = "Changed";
  expect(emptyTypingForm().lessons[0].passage).toBe("");
});
