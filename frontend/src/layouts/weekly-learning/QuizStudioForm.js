import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Radio from "@mui/material/Radio";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import {
  addAcceptableAnswer,
  normalizeAcceptableAnswers,
  removeAcceptableAnswer,
  updateAcceptableAnswer,
} from "./quizAnswerUtils";
import { formatWeekDate, gradeOptions, optionLabel } from "./weeklyLearningUtils";

const steps = ["Quiz Details", "Questions", "Settings", "Review"];
const typeLabels = {
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  true_false: "True / False",
  short_answer: "Short Answer",
  matching: "Matching Pairs",
  ordering: "Arrange in Order",
};
const surfaceSx = {
  border: "1px solid #e3e9f1",
  borderRadius: "14px",
  boxShadow: "none",
  overflow: "hidden",
};

function StepBar({ activeStep, setActiveStep }) {
  return (
    <MDBox
      display="flex"
      gap={{ xs: 0.25, md: 1 }}
      px={{ xs: 1, md: 1.5 }}
      sx={{ overflowX: "auto", borderBottom: "1px solid #e6ebf2" }}
    >
      {steps.map((label, index) => (
        <MDButton
          key={label}
          variant="text"
          color={activeStep === index ? "info" : "secondary"}
          onClick={() => setActiveStep(index)}
          sx={{
            position: "relative",
            minWidth: "max-content",
            px: 1.25,
            py: 1,
            borderRadius: 0,
            textTransform: "none",
            "&::after": {
              content: '""',
              position: "absolute",
              inset: "auto 0 0",
              height: 2,
              bgcolor: activeStep === index ? "#1A73E8" : "transparent",
            },
          }}
        >
          <MDBox
            component="span"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            mr={0.75}
            sx={{
              width: 23,
              height: 23,
              borderRadius: "7px",
              color: activeStep === index ? "#fff" : "#7b809a",
              bgcolor: activeStep === index ? "#1A73E8" : "#f0f3f7",
              fontSize: "0.72rem",
              fontWeight: 700,
            }}
          >
            {index + 1}
          </MDBox>
          {label}
        </MDButton>
      ))}
    </MDBox>
  );
}

function SettingLine({ icon, label, value }) {
  return (
    <MDBox display="flex" alignItems="center" justifyContent="space-between" gap={1} py={0.7}>
      <MDBox display="flex" alignItems="center" gap={0.8}>
        <Icon fontSize="small" sx={{ color: "#7b809a" }}>
          {icon}
        </Icon>
        <MDTypography variant="caption" color="text">
          {label}
        </MDTypography>
      </MDBox>
      <MDTypography variant="caption" color="dark" fontWeight="bold" textAlign="right">
        {value}
      </MDTypography>
    </MDBox>
  );
}

function LivePreview({ question, index, total }) {
  if (!question) return null;
  const options = Array.isArray(question.options) ? question.options : [];
  return (
    <Card sx={{ ...surfaceSx, bgcolor: "#fbfcfe" }}>
      <MDBox p={2}>
        <MDBox display="flex" justifyContent="space-between" mb={2}>
          <MDTypography
            variant="caption"
            fontWeight="bold"
            sx={{ color: "#1A73E8", bgcolor: "#eaf3ff", px: 1, py: 0.4, borderRadius: "8px" }}
          >
            Q{index + 1} of {total}
          </MDTypography>
          <MDTypography variant="caption" color="text">
            {Number(question.points || 0)} points
          </MDTypography>
        </MDBox>
        <MDTypography variant="button" color="dark" fontWeight="bold" display="block" mb={1.5}>
          {question.prompt || "Your question will appear here."}
        </MDTypography>
        {question.image_url && (
          <MDBox
            component="img"
            src={question.image_url}
            alt="Question preview"
            mb={1.5}
            sx={{ width: "100%", maxHeight: 145, objectFit: "contain", borderRadius: "10px" }}
          />
        )}
        {question.question_type === "short_answer" ? (
          <MDBox sx={{ height: 42, border: "1px solid #dfe5ed", borderRadius: "9px", bgcolor: "#fff" }} />
        ) : question.question_type === "matching" ? (
          <MDBox display="flex" flexDirection="column" gap={0.7}>
            {options.map((pair, pairIndex) => (
              <MDTypography key={pairIndex} variant="caption" color="text">
                {pair.left || "Item"} → {pair.right || "Match"}
              </MDTypography>
            ))}
          </MDBox>
        ) : (
          <MDBox display="flex" flexDirection="column" gap={0.85}>
            {options.map((option, optionIndex) => {
              const correct = Array.isArray(question.correct_answer)
                ? question.correct_answer.includes(option)
                : question.correct_answer === option;
              return (
                <MDBox key={optionIndex} display="flex" alignItems="center" gap={1}>
                  <MDBox
                    sx={{
                      width: 15,
                      height: 15,
                      flex: "0 0 auto",
                      borderRadius: question.question_type === "multiple_choice" ? "4px" : "50%",
                      border: correct ? "4px solid #1A73E8" : "1px solid #aeb8c7",
                      bgcolor: "#fff",
                    }}
                  />
                  <MDTypography variant="caption" color={correct ? "dark" : "text"}>
                    {question.question_type === "ordering" ? `${optionIndex + 1}. ` : ""}
                    {typeof option === "string" && option ? option : `Option ${optionLabel(optionIndex)}`}
                  </MDTypography>
                </MDBox>
              );
            })}
          </MDBox>
        )}
      </MDBox>
    </Card>
  );
}

function QuestionEditor({
  question,
  questionIndex,
  questionCount,
  updateQuizQuestion,
  toggleQuizCorrectOption,
  addQuizOption,
  removeQuizOption,
  uploadQuizQuestionImage,
  removeQuestion,
  onReview,
}) {
  if (!question) return null;

  const changeType = (questionType) => {
    updateQuizQuestion(questionIndex, {
      question_type: questionType,
      options:
        questionType === "true_false"
          ? ["True", "False"]
          : questionType === "matching"
          ? [{ left: "", right: "" }]
          : question.options?.some((option) => typeof option === "object")
          ? ["", "", "", ""]
          : question.options,
      correct_answer:
        questionType === "true_false"
          ? "True"
          : questionType === "multiple_choice"
          ? []
          : questionType === "short_answer"
          ? [""]
          : "",
    });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={8}>
        <MDInput
          select
          label="Question Type"
          fullWidth
          value={question.question_type}
          onChange={(event) => changeType(event.target.value)}
          SelectProps={{ native: true }}
        >
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </MDInput>
      </Grid>
      <Grid item xs={12} md={4}>
        <MDInput
          label="Points"
          type="number"
          fullWidth
          value={question.points}
          onChange={(event) => updateQuizQuestion(questionIndex, { points: event.target.value })}
        />
      </Grid>
      <Grid item xs={12}>
        <MDInput
          label="Question"
          fullWidth
          value={question.prompt}
          onChange={(event) => updateQuizQuestion(questionIndex, { prompt: event.target.value })}
        />
      </Grid>
      <Grid item xs={12}>
        <MDBox display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <MDButton component="label" variant="outlined" color="info" size="small">
            <Icon>image</Icon>&nbsp; {question.image_url ? "Replace Image" : "Add Image"}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(event) => uploadQuizQuestionImage(questionIndex, event.target.files?.[0])}
            />
          </MDButton>
          {question.image_url && (
            <MDButton
              variant="text"
              color="error"
              size="small"
              onClick={() => updateQuizQuestion(questionIndex, { image_url: "" })}
            >
              Remove image
            </MDButton>
          )}
        </MDBox>
      </Grid>

      {question.question_type === "matching" ? (
        <Grid item xs={12}>
          <MDTypography variant="caption" color="dark" fontWeight="bold" display="block" mb={1}>
            Matching pairs
          </MDTypography>
          <MDBox display="flex" flexDirection="column" gap={1}>
            {(question.options || []).map((pair, pairIndex) => (
              <MDBox key={pairIndex} display="flex" gap={1} alignItems="center">
                <MDInput
                  label="Item"
                  fullWidth
                  value={pair.left || ""}
                  onChange={(event) => {
                    const options = [...question.options];
                    options[pairIndex] = { ...pair, left: event.target.value };
                    updateQuizQuestion(questionIndex, { options });
                  }}
                />
                <Icon sx={{ color: "#7b809a" }}>arrow_forward</Icon>
                <MDInput
                  label="Match"
                  fullWidth
                  value={pair.right || ""}
                  onChange={(event) => {
                    const options = [...question.options];
                    options[pairIndex] = { ...pair, right: event.target.value };
                    updateQuizQuestion(questionIndex, { options });
                  }}
                />
                <IconButton color="error" onClick={() => removeQuizOption(questionIndex, pairIndex)}>
                  <Icon>delete_outline</Icon>
                </IconButton>
              </MDBox>
            ))}
            <MDButton
              variant="outlined"
              color="info"
              size="small"
              onClick={() =>
                updateQuizQuestion(questionIndex, {
                  options: [...(question.options || []), { left: "", right: "" }],
                })
              }
            >
              Add Pair
            </MDButton>
          </MDBox>
        </Grid>
      ) : question.question_type === "short_answer" ? (
        <Grid item xs={12}>
          <MDBox display="flex" flexDirection="column" gap={1}>
            {normalizeAcceptableAnswers(question.correct_answer).map((answer, answerIndex) => (
              <MDBox key={answerIndex} display="flex" gap={1}>
                <MDInput
                  label={answerIndex === 0 ? "Correct answer" : "Also accept"}
                  fullWidth
                  value={answer}
                  onChange={(event) =>
                    updateQuizQuestion(questionIndex, {
                      correct_answer: updateAcceptableAnswer(
                        question.correct_answer,
                        answerIndex,
                        event.target.value
                      ),
                    })
                  }
                />
                <IconButton
                  color="error"
                  onClick={() =>
                    updateQuizQuestion(questionIndex, {
                      correct_answer: removeAcceptableAnswer(question.correct_answer, answerIndex),
                    })
                  }
                >
                  <Icon>delete_outline</Icon>
                </IconButton>
              </MDBox>
            ))}
            <MDButton
              variant="outlined"
              color="info"
              size="small"
              onClick={() =>
                updateQuizQuestion(questionIndex, {
                  correct_answer: addAcceptableAnswer(question.correct_answer),
                })
              }
            >
              Add Accepted Answer
            </MDButton>
          </MDBox>
        </Grid>
      ) : (
        <Grid item xs={12}>
          <MDTypography variant="caption" color="dark" fontWeight="bold" display="block" mb={1}>
            Options
          </MDTypography>
          <MDBox display="flex" flexDirection="column" gap={1}>
            {(question.options || []).map((option, optionIndex) => {
              const checked =
                question.question_type === "multiple_choice"
                  ? (question.correct_answer || []).includes(option)
                  : question.question_type === "ordering"
                  ? true
                  : Boolean(option) && question.correct_answer === option;
              return (
                <MDBox
                  key={optionIndex}
                  display="flex"
                  alignItems="center"
                  gap={0.6}
                  p={0.65}
                  sx={{
                    border: checked ? "1px solid #67bb6a" : "1px solid #dfe5ed",
                    borderRadius: "9px",
                    bgcolor: checked ? "#f6fff7" : "#fff",
                  }}
                >
                  {question.question_type === "multiple_choice" ? (
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleQuizCorrectOption(questionIndex, option)}
                    />
                  ) : question.question_type === "ordering" ? (
                    <Icon sx={{ color: "#7b809a" }}>drag_indicator</Icon>
                  ) : (
                    <Radio
                      checked={checked}
                      onChange={() => toggleQuizCorrectOption(questionIndex, option)}
                    />
                  )}
                  <MDInput
                    label={
                      question.question_type === "ordering"
                        ? `Item ${optionIndex + 1}`
                        : `Option ${optionLabel(optionIndex)}`
                    }
                    fullWidth
                    value={option}
                    onChange={(event) => {
                      const options = [...question.options];
                      const oldOption = options[optionIndex];
                      options[optionIndex] = event.target.value;
                      let correctAnswer = question.correct_answer;
                      if (question.question_type === "ordering") correctAnswer = options;
                      else if (Array.isArray(correctAnswer)) {
                        correctAnswer = correctAnswer.map((answer) =>
                          answer === oldOption ? event.target.value : answer
                        );
                      } else if (correctAnswer === oldOption) correctAnswer = event.target.value;
                      updateQuizQuestion(questionIndex, {
                        options,
                        correct_answer: correctAnswer,
                      });
                    }}
                  />
                  <IconButton color="error" onClick={() => removeQuizOption(questionIndex, optionIndex)}>
                    <Icon>delete_outline</Icon>
                  </IconButton>
                </MDBox>
              );
            })}
            <MDButton
              variant="outlined"
              color="info"
              size="small"
              onClick={() => addQuizOption(questionIndex)}
            >
              <Icon>add</Icon>&nbsp;
              {question.question_type === "ordering" ? "Add Item" : "Add Option"}
            </MDButton>
          </MDBox>
        </Grid>
      )}
      <Grid item xs={12} display="flex" justifyContent="space-between" gap={1}>
        <MDButton
          variant="text"
          color="error"
          size="small"
          disabled={questionCount <= 1}
          onClick={removeQuestion}
        >
          <Icon>delete</Icon>&nbsp; Remove Question
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={onReview}>
          Save Question
        </MDButton>
      </Grid>
    </Grid>
  );
}

export default function QuizStudioForm({
  quizForm,
  setQuizForm,
  editingQuizId,
  saveQuizTest,
  toggleQuizGrade,
  toggleQuizCorrectOption,
  addQuizQuestion,
  removeQuizQuestion,
  updateQuizQuestion,
  addQuizOption,
  removeQuizOption,
  uploadQuizQuestionImage,
  quizTerms,
  quizCompetitions,
  termOptions,
  selectedQuizTerm,
  quizWeekOptions,
  isSystemAdmin,
  termTools,
}) {
  const [activeStep, setActiveStep] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const question = quizForm.questions[selectedIndex] || quizForm.questions[0];
  const allocatedMarks = useMemo(
    () => quizForm.questions.reduce((sum, item) => sum + Number(item.points || 0), 0),
    [quizForm.questions]
  );

  useEffect(() => {
    if (selectedIndex >= quizForm.questions.length) {
      setSelectedIndex(Math.max(0, quizForm.questions.length - 1));
    }
  }, [quizForm.questions.length, selectedIndex]);

  const addQuestion = () => {
    setSelectedIndex(quizForm.questions.length);
    addQuizQuestion();
  };
  const removeQuestion = () => {
    removeQuizQuestion(selectedIndex);
    setSelectedIndex((current) => Math.max(0, current - 1));
  };

  return (
    <MDBox>
      <MDBox
        display="flex"
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        flexDirection={{ xs: "column", md: "row" }}
        gap={2}
        pb={1.25}
      >
        <MDBox>
          <MDTypography variant="h5" color="dark" fontWeight="bold">
            {editingQuizId ? "Edit Quiz" : "Create New Quiz"}
          </MDTypography>
          <MDTypography variant="caption" color="text">
            Build and customize quizzes for your eduClub learners.
          </MDTypography>
        </MDBox>
        <MDBox display="flex" gap={1} flexWrap="wrap">
          <MDButton
            variant="outlined"
            color="dark"
            size="small"
            onClick={() => saveQuizTest({ is_published: false, is_open: false })}
            disabled={!quizForm.name || quizForm.questions.some((item) => !item.prompt)}
          >
            Save as Draft
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            size="small"
            onClick={() => saveQuizTest({ is_published: true, is_open: true })}
            disabled={
              !quizForm.name ||
              quizForm.questions.some((item) => !item.prompt) ||
              (quizForm.quiz_type === "competition" && !quizForm.competition_id)
            }
          >
            Publish Quiz
          </MDButton>
        </MDBox>
      </MDBox>

      <Card sx={{ ...surfaceSx, borderRadius: "16px" }}>
        <StepBar activeStep={activeStep} setActiveStep={setActiveStep} />

        {activeStep === 0 && (
          <MDBox p={{ xs: 2, md: 2.5 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <MDInput
                  label="Quiz Name"
                  fullWidth
                  value={quizForm.name}
                  onChange={(event) => setQuizForm({ ...quizForm, name: event.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Type"
                  fullWidth
                  value={quizForm.quiz_type}
                  onChange={(event) => setQuizForm({ ...quizForm, quiz_type: event.target.value })}
                  SelectProps={{ native: true }}
                  disabled={!isSystemAdmin()}
                >
                  <option value="weekly">Weekly</option>
                  {isSystemAdmin() && <option value="competition">Competition</option>}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Category"
                  fullWidth
                  value={quizForm.quiz_category}
                  onChange={(event) =>
                    setQuizForm({ ...quizForm, quiz_category: event.target.value })
                  }
                  SelectProps={{ native: true }}
                >
                  <option value="quiz">General Quiz</option>
                  <option value="maths">Maths</option>
                  <option value="science">Science</option>
                  <option value="stem">STEM</option>
                </MDInput>
              </Grid>
              {quizForm.quiz_type === "competition" ? (
                <Grid item xs={12} md={6}>
                  <MDInput
                    select
                    label="Competition"
                    fullWidth
                    value={quizForm.competition_id}
                    onChange={(event) =>
                      setQuizForm({ ...quizForm, competition_id: event.target.value })
                    }
                    SelectProps={{ native: true }}
                  >
                    <option value="">Select competition</option>
                    {quizCompetitions.map((competition) => (
                      <option key={competition.id} value={competition.id}>
                        {competition.name}
                      </option>
                    ))}
                  </MDInput>
                </Grid>
              ) : (
                <>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      select
                      label="Academic Year"
                      fullWidth
                      value={quizForm.academic_year}
                      onChange={(event) => {
                        const nextYear = event.target.value;
                        const firstTerm = termOptions.find(
                          (term) => String(term.academic_year || "") === String(nextYear || "")
                        );
                        setQuizForm({
                          ...quizForm,
                          academic_year: nextYear,
                          term: firstTerm?.name || "",
                          week_number: 1,
                        });
                      }}
                      SelectProps={{ native: true }}
                    >
                      {[...new Set(termOptions.map((term) => term.academic_year))]
                        .filter(Boolean)
                        .map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      select
                      label="Term"
                      fullWidth
                      value={quizForm.term}
                      onChange={(event) =>
                        setQuizForm({ ...quizForm, term: event.target.value, week_number: 1 })
                      }
                      SelectProps={{ native: true }}
                    >
                      {quizTerms.map((term) => (
                        <option key={term.id} value={term.name}>
                          {term.name}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      select
                      label="Week"
                      fullWidth
                      value={quizForm.week_number}
                      disabled={!selectedQuizTerm || quizWeekOptions.length === 0}
                      onChange={(event) =>
                        setQuizForm({ ...quizForm, week_number: event.target.value })
                      }
                      SelectProps={{ native: true }}
                    >
                      {quizWeekOptions.length === 0 && <option value="">No seeded weeks</option>}
                      {quizWeekOptions.map((week) => {
                        const number = typeof week === "object" ? week.week_number : week;
                        return (
                          <option key={number} value={number}>
                            Week {number}
                            {typeof week === "object"
                              ? ` (${formatWeekDate(week.start_date)} - ${formatWeekDate(
                                  week.end_date
                                )})`
                              : ""}
                          </option>
                        );
                      })}
                    </MDInput>
                  </Grid>
                </>
              )}
              <Grid item xs={12}>
                <MDInput
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={quizForm.description}
                  onChange={(event) =>
                    setQuizForm({ ...quizForm, description: event.target.value })
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <MDTypography variant="caption" color="text" display="block" mb={0.75}>
                  Eligible grades
                </MDTypography>
                <MDBox display="flex" flexWrap="wrap" gap={0.6}>
                  {gradeOptions.map((grade) => (
                    <MDButton
                      key={grade}
                      variant={quizForm.eligible_grades.includes(grade) ? "gradient" : "outlined"}
                      color="info"
                      size="small"
                      onClick={() => toggleQuizGrade(grade)}
                    >
                      {grade.replace("Grade ", "G")}
                    </MDButton>
                  ))}
                </MDBox>
              </Grid>
            </Grid>
          </MDBox>
        )}

        {activeStep === 1 && (
          <Grid container>
            <Grid item xs={12} md={3} sx={{ borderRight: { md: "1px solid #e6ebf2" } }}>
              <MDBox px={2} py={1.65} display="flex" justifyContent="space-between">
                <MDTypography variant="button" color="dark" fontWeight="bold">
                  Question List
                </MDTypography>
                <MDTypography variant="caption" color="text">
                  {quizForm.questions.length} Questions
                </MDTypography>
              </MDBox>
              <MDBox sx={{ borderTop: "1px solid #edf1f5" }}>
                {quizForm.questions.map((item, index) => (
                  <MDButton
                    key={index}
                    variant="text"
                    color={selectedIndex === index ? "info" : "dark"}
                    fullWidth
                    onClick={() => setSelectedIndex(index)}
                    sx={{
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      textAlign: "left",
                      textTransform: "none",
                      borderRadius: 0,
                      px: 2,
                      py: 1.35,
                      bgcolor: selectedIndex === index ? "#eef5ff" : "transparent",
                      borderBottom: "1px solid #edf1f5",
                    }}
                  >
                    <MDTypography variant="caption" color="inherit" mr={1}>
                      {index + 1}.
                    </MDTypography>
                    <MDBox minWidth={0}>
                      <MDTypography
                        variant="button"
                        color="inherit"
                        fontWeight={selectedIndex === index ? "bold" : "regular"}
                        display="block"
                        sx={{ whiteSpace: "normal", lineHeight: 1.35 }}
                      >
                        {item.prompt || `Untitled question ${index + 1}`}
                      </MDTypography>
                      <MDTypography variant="caption" color="text">
                        {typeLabels[item.question_type]}
                      </MDTypography>
                    </MDBox>
                  </MDButton>
                ))}
              </MDBox>
              <MDBox p={2}>
                <MDButton variant="outlined" color="dark" fullWidth onClick={addQuestion}>
                  <Icon>add</Icon>&nbsp; Add Question
                </MDButton>
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6} sx={{ borderRight: { md: "1px solid #e6ebf2" } }}>
              <MDBox p={{ xs: 2, md: 2.5 }}>
                <QuestionEditor
                  question={question}
                  questionIndex={selectedIndex}
                  questionCount={quizForm.questions.length}
                  updateQuizQuestion={updateQuizQuestion}
                  toggleQuizCorrectOption={toggleQuizCorrectOption}
                  addQuizOption={addQuizOption}
                  removeQuizOption={removeQuizOption}
                  uploadQuizQuestionImage={uploadQuizQuestionImage}
                  removeQuestion={removeQuestion}
                  onReview={() => setActiveStep(3)}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={3}>
              <MDBox p={2} display="flex" flexDirection="column" gap={2}>
                <MDBox>
                  <MDTypography variant="button" color="dark" fontWeight="bold" display="block" mb={1}>
                    Live Preview
                  </MDTypography>
                  <LivePreview question={question} index={selectedIndex} total={quizForm.questions.length} />
                </MDBox>
                <Card sx={surfaceSx}>
                  <MDBox p={2}>
                    <MDTypography variant="button" color="dark" fontWeight="bold" display="block" mb={0.6}>
                      Quiz Settings
                    </MDTypography>
                    <SettingLine icon="quiz" label="Total Questions" value={quizForm.questions.length} />
                    <SettingLine icon="settings" label="Total Points" value={quizForm.total_points} />
                    <SettingLine icon="schedule" label="Time Limit" value={`${Math.round(Number(quizForm.duration_seconds || 0) / 60)} minutes`} />
                    <SettingLine icon="task_alt" label="Passing Score" value={`${quizForm.pass_score}%`} />
                    <SettingLine icon="visibility" label="Visibility" value={quizForm.eligible_grades.length ? `${quizForm.eligible_grades.length} grades` : "All learners"} />
                  </MDBox>
                </Card>
                <MDBox p={1.6} sx={{ bgcolor: "#eef5ff", borderRadius: "12px" }}>
                  <MDTypography variant="caption" color="info" fontWeight="bold" display="block">
                    Quizzes drive engagement!
                  </MDTypography>
                  <MDTypography variant="caption" color="text">
                    Well-designed questions help learners improve and earn points.
                  </MDTypography>
                </MDBox>
              </MDBox>
            </Grid>
          </Grid>
        )}

        {activeStep === 2 && (
          <MDBox p={{ xs: 2, md: 2.5 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <MDInput label="Pass Score" type="number" fullWidth value={quizForm.pass_score} onChange={(event) => setQuizForm({ ...quizForm, pass_score: event.target.value })} />
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput label="Max Attempts" type="number" fullWidth value={quizForm.max_attempts} onChange={(event) => setQuizForm({ ...quizForm, max_attempts: event.target.value })} />
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput label="Duration Seconds" type="number" fullWidth value={quizForm.duration_seconds} onChange={(event) => setQuizForm({ ...quizForm, duration_seconds: event.target.value })} />
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput label="Total Marks" type="number" fullWidth value={quizForm.total_points} onChange={(event) => setQuizForm({ ...quizForm, total_points: event.target.value })} />
              </Grid>
              <Grid item xs={12} md={4}>
                <MDInput
                  select
                  label="Status"
                  fullWidth
                  value={`${quizForm.is_published ? "published" : "draft"}-${quizForm.is_open ? "open" : "closed"}`}
                  onChange={(event) => {
                    const [published, open] = event.target.value.split("-");
                    setQuizForm({ ...quizForm, is_published: published === "published", is_open: open === "open" });
                  }}
                  SelectProps={{ native: true }}
                >
                  <option value="draft-closed">Draft</option>
                  <option value="published-closed">Published, closed</option>
                  <option value="published-open">Published, open</option>
                </MDInput>
              </Grid>
            </Grid>
            {termTools}
          </MDBox>
        )}

        {activeStep === 3 && (
          <MDBox p={{ xs: 2, md: 2.5 }}>
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={8}>
                <MDTypography variant="h6" color="dark" fontWeight="bold" mb={1}>
                  Review {quizForm.name}
                </MDTypography>
                <MDBox display="flex" flexDirection="column" gap={1}>
                  {quizForm.questions.map((item, index) => (
                    <Card key={index} sx={surfaceSx}>
                      <MDBox p={1.5} display="flex" justifyContent="space-between" gap={2}>
                        <MDBox>
                          <MDTypography variant="button" color="dark" fontWeight="bold">
                            {index + 1}. {item.prompt || "Untitled question"}
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            {typeLabels[item.question_type]}
                          </MDTypography>
                        </MDBox>
                        <MDTypography variant="caption" color="info" fontWeight="bold">
                          {item.points} pts
                        </MDTypography>
                      </MDBox>
                    </Card>
                  ))}
                </MDBox>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={surfaceSx}>
                  <MDBox p={2}>
                    <SettingLine icon="calendar_month" label="Term" value={`${quizForm.term} · ${quizForm.academic_year}`} />
                    <SettingLine icon="date_range" label="Week" value={`Week ${quizForm.week_number}`} />
                    <SettingLine icon="quiz" label="Questions" value={quizForm.questions.length} />
                    <SettingLine icon="score" label="Allocated" value={`${allocatedMarks} / ${quizForm.total_points}`} />
                  </MDBox>
                </Card>
              </Grid>
            </Grid>
          </MDBox>
        )}
      </Card>

      <MDBox
        mt={2}
        p={{ xs: 2, md: 2.25 }}
        display="flex"
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        flexDirection={{ xs: "column", md: "row" }}
        gap={2}
        sx={{ bgcolor: "#f3f7fd", border: "1px solid #e2eaf5", borderRadius: "14px" }}
      >
        <MDBox display="flex" alignItems="center" gap={1.2}>
          <MDBox display="flex" alignItems="center" justifyContent="center" sx={{ width: 42, height: 42, borderRadius: "50%", bgcolor: "#e1eeff", color: "#1A73E8" }}>
            <Icon>check</Icon>
          </MDBox>
          <MDBox>
            <MDTypography variant="button" color="dark" fontWeight="bold" display="block">
              Creating quizzes on eduClub is quick and intuitive
            </MDTypography>
            <MDTypography variant="caption" color="text">
              Add questions, set points, preview the learner view, and publish in a few clicks.
            </MDTypography>
          </MDBox>
        </MDBox>
        <MDTypography variant="caption" color="info" fontWeight="bold">
          {quizForm.questions.length} questions · {allocatedMarks} allocated marks
        </MDTypography>
      </MDBox>
    </MDBox>
  );
}
