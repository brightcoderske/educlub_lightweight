import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import { formatWeekDate, gradeOptions } from "./weeklyLearningUtils";

const steps = ["Test Details", "Lessons", "Settings", "Review"];
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

function LessonPreview({ lesson, index, total }) {
  const passage = lesson?.passage || "Your typing passage will appear here.";
  return (
    <Card sx={{ ...surfaceSx, bgcolor: "#fbfcfe" }}>
      <MDBox p={2}>
        <MDBox display="flex" justifyContent="space-between" mb={1.75}>
          <MDTypography
            variant="caption"
            fontWeight="bold"
            sx={{ color: "#1A73E8", bgcolor: "#eaf3ff", px: 1, py: 0.4, borderRadius: "8px" }}
          >
            Lesson {index + 1} of {total}
          </MDTypography>
          <MDTypography variant="caption" color="text">
            {passage.trim().split(/\s+/).filter(Boolean).length} words
          </MDTypography>
        </MDBox>
        <MDTypography variant="button" color="dark" fontWeight="bold" display="block" mb={0.75}>
          {lesson?.title || `Lesson ${index + 1}`}
        </MDTypography>
        {lesson?.instructions && (
          <MDTypography variant="caption" color="text" display="block" mb={1.25}>
            {lesson.instructions}
          </MDTypography>
        )}
        <MDBox
          p={1.5}
          sx={{
            minHeight: 120,
            border: "1px solid #e0e6ee",
            borderRadius: "10px",
            bgcolor: "#fff",
          }}
        >
          <MDTypography
            variant="body2"
            color="dark"
            sx={{ fontFamily: "monospace", lineHeight: 1.8, whiteSpace: "pre-wrap" }}
          >
            {passage}
          </MDTypography>
        </MDBox>
        <MDBox mt={1.25} sx={{ height: 7, borderRadius: "999px", bgcolor: "#e9eef5" }}>
          <MDBox
            sx={{ width: "18%", height: "100%", borderRadius: "inherit", bgcolor: "#1A73E8" }}
          />
        </MDBox>
      </MDBox>
    </Card>
  );
}

export default function TypingStudioForm({
  typingForm,
  setTypingForm,
  editingTypingId,
  saveTypingTest,
  cancelTypingEdit,
  toggleTypingGrade,
  typingTerms,
  typingCompetitions,
  termOptions,
  selectedTerm,
  weekOptions,
  isSystemAdmin,
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const lessons = Array.isArray(typingForm.lessons) ? typingForm.lessons : [];
  const lesson = lessons[selectedIndex] || lessons[0];

  useEffect(() => {
    if (selectedIndex >= lessons.length) {
      setSelectedIndex(Math.max(0, lessons.length - 1));
    }
  }, [lessons.length, selectedIndex]);

  const updateLesson = (updates) => {
    setTypingForm({
      ...typingForm,
      lessons: lessons.map((item, index) =>
        index === selectedIndex ? { ...item, ...updates } : item
      ),
    });
  };

  const addLesson = () => {
    const nextIndex = lessons.length;
    setTypingForm({
      ...typingForm,
      lessons: [...lessons, { title: `Lesson ${nextIndex + 1}`, passage: "", instructions: "" }],
    });
    setSelectedIndex(nextIndex);
  };

  const removeLesson = () => {
    if (lessons.length <= 1) return;
    setTypingForm({
      ...typingForm,
      lessons: lessons.filter((_, index) => index !== selectedIndex),
    });
    setSelectedIndex((current) => Math.max(0, current - 1));
  };

  const saveDisabled =
    !typingForm.name ||
    lessons.length === 0 ||
    lessons.some((item) => !item.title || !item.passage) ||
    (typingForm.test_type === "competition" && !typingForm.competition_id);

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
            {editingTypingId ? "Edit Typing Test" : "Create New Typing Test"}
          </MDTypography>
          <MDTypography variant="caption" color="text">
            Build focused typing lessons for your eduClub learners.
          </MDTypography>
        </MDBox>
        <MDBox display="flex" gap={1} flexWrap="wrap">
          {editingTypingId && (
            <MDButton variant="text" color="dark" onClick={cancelTypingEdit}>
              Cancel
            </MDButton>
          )}
          <MDButton
            variant="outlined"
            color="dark"
            size="small"
            onClick={() => saveTypingTest({ is_published: false, is_open: false })}
            disabled={saveDisabled}
          >
            Save as Draft
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            size="small"
            onClick={() => saveTypingTest({ is_published: true, is_open: true })}
            disabled={saveDisabled}
          >
            Publish Typing Test
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
                  label="Typing Test Name"
                  fullWidth
                  value={typingForm.name}
                  onChange={(event) => setTypingForm({ ...typingForm, name: event.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Type"
                  fullWidth
                  value={typingForm.test_type}
                  onChange={(event) =>
                    setTypingForm({ ...typingForm, test_type: event.target.value })
                  }
                  SelectProps={{ native: true }}
                  disabled={!isSystemAdmin()}
                >
                  <option value="weekly">Weekly</option>
                  {isSystemAdmin() && <option value="competition">Competition</option>}
                </MDInput>
              </Grid>
              {typingForm.test_type === "competition" ? (
                <Grid item xs={12} md={3}>
                  <MDInput
                    select
                    label="Typing Competition"
                    fullWidth
                    value={typingForm.competition_id}
                    onChange={(event) =>
                      setTypingForm({ ...typingForm, competition_id: event.target.value })
                    }
                    SelectProps={{ native: true }}
                  >
                    <option value="">Select competition</option>
                    {typingCompetitions.map((competition) => (
                      <option key={competition.id} value={competition.id}>
                        {competition.name}
                      </option>
                    ))}
                  </MDInput>
                </Grid>
              ) : (
                <>
                  <Grid item xs={12} md={3}>
                    <MDInput
                      select
                      label="Academic Year"
                      fullWidth
                      value={typingForm.academic_year}
                      onChange={(event) => {
                        const nextYear = event.target.value;
                        const firstTerm = termOptions.find(
                          (term) => String(term.academic_year || "") === String(nextYear || "")
                        );
                        setTypingForm({
                          ...typingForm,
                          academic_year: nextYear,
                          term: firstTerm?.name || "",
                          week_number: 1,
                        });
                      }}
                      SelectProps={{ native: true }}
                    >
                      <option value="">Select year</option>
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
                      value={typingForm.term}
                      onChange={(event) =>
                        setTypingForm({ ...typingForm, term: event.target.value, week_number: 1 })
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="">Select term</option>
                      {typingTerms.map((term) => (
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
                      value={typingForm.week_number}
                      disabled={!selectedTerm || weekOptions.length === 0}
                      onChange={(event) =>
                        setTypingForm({ ...typingForm, week_number: event.target.value })
                      }
                      SelectProps={{ native: true }}
                    >
                      {weekOptions.length === 0 && <option value="">No seeded weeks</option>}
                      {weekOptions.map((week) => {
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
                  value={typingForm.description}
                  onChange={(event) =>
                    setTypingForm({ ...typingForm, description: event.target.value })
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
                      variant={typingForm.eligible_grades.includes(grade) ? "gradient" : "outlined"}
                      color="info"
                      size="small"
                      onClick={() => toggleTypingGrade(grade)}
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
                  Lesson List
                </MDTypography>
                <MDTypography variant="caption" color="text">
                  {lessons.length} Lessons
                </MDTypography>
              </MDBox>
              <MDBox sx={{ borderTop: "1px solid #edf1f5" }}>
                {lessons.map((item, index) => (
                  <MDButton
                    key={`${item.title}-${index}`}
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
                        {item.title || `Untitled lesson ${index + 1}`}
                      </MDTypography>
                      <MDTypography variant="caption" color="text">
                        {(item.passage || "").trim().split(/\s+/).filter(Boolean).length} words
                      </MDTypography>
                    </MDBox>
                  </MDButton>
                ))}
              </MDBox>
              <MDBox p={2}>
                <MDButton variant="outlined" color="dark" fullWidth onClick={addLesson}>
                  <Icon>add</Icon>&nbsp; Add Lesson
                </MDButton>
              </MDBox>
            </Grid>

            <Grid item xs={12} md={6} sx={{ borderRight: { md: "1px solid #e6ebf2" } }}>
              <MDBox p={{ xs: 2, md: 2.5 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <MDInput
                      label="Lesson Title"
                      fullWidth
                      value={lesson?.title || ""}
                      onChange={(event) => updateLesson({ title: event.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      label="Instructions (Optional)"
                      fullWidth
                      value={lesson?.instructions || ""}
                      onChange={(event) => updateLesson({ instructions: event.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      label="Typing Passage"
                      fullWidth
                      multiline
                      rows={11}
                      value={lesson?.passage || ""}
                      onChange={(event) => updateLesson({ passage: event.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} display="flex" justifyContent="space-between" gap={1}>
                    <MDButton
                      variant="text"
                      color="error"
                      size="small"
                      disabled={lessons.length <= 1}
                      onClick={removeLesson}
                    >
                      <Icon>delete</Icon>&nbsp; Remove Lesson
                    </MDButton>
                    <MDTypography variant="caption" color="text" textAlign="right">
                      Changes appear in Live Preview. Use Save as Draft to save the test.
                    </MDTypography>
                  </Grid>
                </Grid>
              </MDBox>
            </Grid>

            <Grid item xs={12} md={3}>
              <MDBox p={2} display="flex" flexDirection="column" gap={2}>
                <MDBox>
                  <MDTypography
                    variant="button"
                    color="dark"
                    fontWeight="bold"
                    display="block"
                    mb={1}
                  >
                    Live Preview
                  </MDTypography>
                  <LessonPreview lesson={lesson} index={selectedIndex} total={lessons.length} />
                </MDBox>
                <Card sx={surfaceSx}>
                  <MDBox p={2}>
                    <MDTypography
                      variant="button"
                      color="dark"
                      fontWeight="bold"
                      display="block"
                      mb={0.6}
                    >
                      Typing Settings
                    </MDTypography>
                    <SettingLine icon="keyboard" label="Total Lessons" value={lessons.length} />
                    <SettingLine
                      icon="schedule"
                      label="Time Limit"
                      value={`${Math.round(Number(typingForm.duration_seconds || 0) / 60)} minutes`}
                    />
                    <SettingLine icon="speed" label="Pass WPM" value={typingForm.pass_threshold} />
                    <SettingLine icon="replay" label="Attempts" value={typingForm.max_attempts} />
                    <SettingLine
                      icon="visibility"
                      label="Visibility"
                      value={
                        typingForm.eligible_grades.length
                          ? `${typingForm.eligible_grades.length} grades`
                          : "All learners"
                      }
                    />
                  </MDBox>
                </Card>
                <MDBox p={1.6} sx={{ bgcolor: "#eef5ff", borderRadius: "12px" }}>
                  <MDTypography variant="caption" color="info" fontWeight="bold" display="block">
                    Practice builds speed!
                  </MDTypography>
                  <MDTypography variant="caption" color="text">
                    Short, focused passages help learners improve accuracy and confidence.
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
                <MDInput
                  label="Pass WPM"
                  type="number"
                  fullWidth
                  value={typingForm.pass_threshold}
                  onChange={(event) =>
                    setTypingForm({ ...typingForm, pass_threshold: event.target.value })
                  }
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  label="Max Attempts"
                  type="number"
                  fullWidth
                  value={typingForm.max_attempts}
                  onChange={(event) =>
                    setTypingForm({ ...typingForm, max_attempts: event.target.value })
                  }
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  label="Duration Seconds"
                  type="number"
                  fullWidth
                  value={typingForm.duration_seconds}
                  onChange={(event) =>
                    setTypingForm({ ...typingForm, duration_seconds: event.target.value })
                  }
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Reattempts"
                  fullWidth
                  value={typingForm.allow_reattempts ? "yes" : "no"}
                  onChange={(event) =>
                    setTypingForm({ ...typingForm, allow_reattempts: event.target.value === "yes" })
                  }
                  SelectProps={{ native: true }}
                >
                  <option value="yes">Allowed</option>
                  <option value="no">Disabled</option>
                </MDInput>
              </Grid>
              <Grid item xs={12} md={4}>
                <MDInput
                  select
                  label="Status"
                  fullWidth
                  value={`${typingForm.is_published ? "published" : "draft"}-${
                    typingForm.is_open ? "open" : "closed"
                  }`}
                  onChange={(event) => {
                    const [published, open] = event.target.value.split("-");
                    setTypingForm({
                      ...typingForm,
                      is_published: published === "published",
                      is_open: open === "open",
                    });
                  }}
                  SelectProps={{ native: true }}
                >
                  <option value="draft-closed">Draft</option>
                  <option value="published-closed">Published, closed</option>
                  <option value="published-open">Published, open</option>
                </MDInput>
              </Grid>
            </Grid>
          </MDBox>
        )}

        {activeStep === 3 && (
          <MDBox p={{ xs: 2, md: 2.5 }}>
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={8}>
                <MDTypography variant="h6" color="dark" fontWeight="bold" mb={1}>
                  Review {typingForm.name}
                </MDTypography>
                <MDBox display="flex" flexDirection="column" gap={1}>
                  {lessons.map((item, index) => (
                    <Card key={`${item.title}-${index}`} sx={surfaceSx}>
                      <MDBox p={1.5} display="flex" justifyContent="space-between" gap={2}>
                        <MDBox>
                          <MDTypography variant="button" color="dark" fontWeight="bold">
                            {index + 1}. {item.title || "Untitled lesson"}
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            {(item.passage || "").trim().split(/\s+/).filter(Boolean).length} words
                          </MDTypography>
                        </MDBox>
                        <IconButton
                          color="info"
                          onClick={() => {
                            setSelectedIndex(index);
                            setActiveStep(1);
                          }}
                        >
                          <Icon>edit</Icon>
                        </IconButton>
                      </MDBox>
                    </Card>
                  ))}
                </MDBox>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={surfaceSx}>
                  <MDBox p={2}>
                    <SettingLine
                      icon="calendar_month"
                      label="Term"
                      value={`${typingForm.term} · ${typingForm.academic_year}`}
                    />
                    <SettingLine
                      icon="date_range"
                      label="Week"
                      value={`Week ${typingForm.week_number}`}
                    />
                    <SettingLine icon="keyboard" label="Lessons" value={lessons.length} />
                    <SettingLine icon="speed" label="Pass WPM" value={typingForm.pass_threshold} />
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
          <MDBox
            display="flex"
            alignItems="center"
            justifyContent="center"
            sx={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              bgcolor: "#e1eeff",
              color: "#1A73E8",
            }}
          >
            <Icon>check</Icon>
          </MDBox>
          <MDBox>
            <MDTypography variant="button" color="dark" fontWeight="bold" display="block">
              Creating typing tests on eduClub is quick and intuitive
            </MDTypography>
            <MDTypography variant="caption" color="text">
              Add lessons, preview passages, set speed targets, and publish in a few clicks.
            </MDTypography>
          </MDBox>
        </MDBox>
        <MDTypography variant="caption" color="info" fontWeight="bold">
          {lessons.length} lessons · {typingForm.pass_threshold} WPM target
        </MDTypography>
      </MDBox>
    </MDBox>
  );
}
