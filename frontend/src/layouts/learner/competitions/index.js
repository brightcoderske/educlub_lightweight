import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import API_BASE_URL from "lib/apiBase";

const apiOrigin = new URL(API_BASE_URL).origin;

function resolveAssetUrl(url) {
  if (!url) {
    return "";
  }

  if (url.startsWith("/")) {
    return `${apiOrigin}${url}`;
  }

  return url;
}

function formatCompetitionDate(value, options = {}) {
  if (!value) {
    return "";
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    weekday: options.weekday || "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function competitionWindow(competition) {
  return `Open from ${formatCompetitionDate(competition.start_date)} to ${formatCompetitionDate(
    competition.end_date
  )}`;
}

function competitionAccessNote(competition) {
  if (competition.practice_available) {
    return `Practice is open every day. The final quiz opens on ${formatCompetitionDate(
      competition.end_date,
      { weekday: "long" }
    )}.`;
  }

  return `The competition quiz opens on ${formatCompetitionDate(competition.end_date, {
    weekday: "long",
  })}.`;
}

function LearnerCompetitions() {
  const { user, isLearner } = useAuth();
  const [searchParams] = useSearchParams();
  const [competitions, setCompetitions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [activeTest, setActiveTest] = useState(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [lessonElapsedSeconds, setLessonElapsedSeconds] = useState(0);
  const [lessonComplete, setLessonComplete] = useState(false);
  const [lessonLocked, setLessonLocked] = useState(false);
  const [advancingLesson, setAdvancingLesson] = useState(false);
  const [completionSummary, setCompletionSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadCompetitions = async () => {
    setLoading(true);
    setError("");
    try {
      setCompetitions(await apiClient.get("/competitions"));
    } catch (err) {
      setError(err.message || "Failed to load competitions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLearner()) {
      loadCompetitions();
    }
  }, []);

  useEffect(() => {
    const txRef = searchParams.get("tx_ref");
    const transactionId = searchParams.get("transaction_id");

    if (!txRef || !transactionId) {
      return;
    }

    apiClient
      .post("/competitions/payments/verify", {
        tx_ref: txRef,
        transaction_id: transactionId,
      })
      .then(() => {
        setMessage("Payment verified. You are enrolled in the competition.");
        loadCompetitions();
      })
      .catch((err) => setError(err.message || "Could not verify payment."));
  }, [searchParams]);

  const formatMoney = (competition) =>
    `${competition.currency || "KES"} ${Number(competition.price_amount || 0).toLocaleString()}`;

  const isFreeCompetition = (competition) => Number(competition?.price_amount || 0) <= 0;

  const isEnrolled = (competition) => competition.enrollment_status === "enrolled";

  const openCompetitions = useMemo(
    () => competitions.filter((competition) => !isEnrolled(competition)),
    [competitions]
  );

  const enrolledCompetitions = useMemo(
    () =>
      competitions
        .filter((competition) => isEnrolled(competition))
        .sort(
          (a, b) =>
            new Date(b.enrolled_at || b.start_date).getTime() -
            new Date(a.enrolled_at || a.start_date).getTime()
        ),
    [competitions]
  );

  const handleEnroll = async () => {
    if (!selected) {
      return;
    }

    const paymentWindow = !isFreeCompetition(selected)
      ? window.open("", "_blank", "noopener,noreferrer")
      : null;
    if (paymentWindow) {
      paymentWindow.document.write("Opening secure eduClub payment...");
    }

    setLoading(true);
    setError("");
    try {
      const result = await apiClient.post(`/competitions/${selected.id}/enroll`, {});
      if (result.status === "payment_required") {
        if (paymentWindow) {
          paymentWindow.location.href = result.paymentLink;
          setMessage("Payment opened in a new tab. Return here after payment to verify enrolment.");
        } else {
          window.location.href = result.paymentLink;
        }
      } else {
        paymentWindow?.close();
        setMessage("You are enrolled. The competition is ready to open.");
      }
      setSelected(null);
      await loadCompetitions();
    } catch (err) {
      paymentWindow?.close();
      setError(err.message || "Could not start enrolment.");
    } finally {
      setLoading(false);
    }
  };

  const launchCompetition = async (competition) => {
    setError("");
    try {
      const response = await apiClient.post(`/competitions/${competition.id}/launch`, {});
      if (response.nativeTyping && response.typingTestId) {
        await openTypingCompetition(response.typingTestId);
        return;
      }
      const competitionWindow = window.open(response.launchUrl, "_blank", "noopener,noreferrer");
      if (!competitionWindow) {
        setError("Please allow pop-ups for eduClub so the competition can open in a new tab.");
      }
    } catch (err) {
      setError(err.message || "Could not open competition.");
    }
  };

  const openPerformance = async (competition) => {
    setError("");
    try {
      setPerformance(await apiClient.get(`/competitions/${competition.id}/performance`));
    } catch (err) {
      setError(err.message || "Could not load competition performance.");
    }
  };

  const currentLesson = () => activeTest?.lessons?.[activeLessonIndex] || null;
  const currentLessonDuration = () =>
    currentLesson()?.duration_seconds || activeTest?.duration_seconds || 300;

  useEffect(() => {
    if (!activeTest || !hasStartedTyping || !startedAt || remaining <= 0 || lessonLocked) {
      return undefined;
    }
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const duration = currentLessonDuration();
      const nextRemaining = Math.max(0, duration - elapsed);
      setRemaining(nextRemaining);
      if (nextRemaining === 0) {
        clearInterval(timer);
        setLessonElapsedSeconds(duration);
        setLessonComplete(true);
        setLessonLocked(true);
        setHasStartedTyping(false);
        setStartedAt(null);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [activeTest, hasStartedTyping, startedAt, remaining, lessonLocked]);

  const openTypingCompetition = async (testId) => {
    setError("");
    try {
      const response = await apiClient.get(`/typing/tests/${testId}`);
      const nextLessonIndex = response.resume?.next_lesson_index || 0;
      setActiveTest(response);
      setActiveLessonIndex(nextLessonIndex);
      setTypedText("");
      setStartedAt(null);
      setHasStartedTyping(false);
      setRemaining(
        response.lessons?.[nextLessonIndex]?.duration_seconds || response.duration_seconds || 300
      );
      setLessonElapsedSeconds(0);
      setLessonComplete(false);
      setLessonLocked(false);
      setAdvancingLesson(false);
      setCompletionSummary(null);
    } catch (err) {
      setError(err.message || "Could not open typing competition.");
    }
  };

  const effectiveElapsedSeconds = () => {
    if (lessonElapsedSeconds > 0) return lessonElapsedSeconds;
    if (!hasStartedTyping || !startedAt) return 1;
    return Math.max(1, currentLessonDuration() - remaining);
  };

  const typingStats = () => {
    const passage = currentLesson()?.passage || "";
    const effectiveTypedText = typedText.slice(0, passage.length || undefined);
    const tokenizeWords = (value) =>
      String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const elapsed = effectiveElapsedSeconds();
    const minutes = elapsed / 60;
    const grossWpm = effectiveTypedText.length / 5 / minutes;
    const expectedWords = tokenizeWords(passage);
    const typedWords = tokenizeWords(effectiveTypedText);
    const totalWords = Math.max(typedWords.length, 1);
    let mistakes = 0;
    for (let index = 0; index < typedWords.length; index += 1) {
      if ((typedWords[index] || "") !== (expectedWords[index] || "")) {
        mistakes += 1;
      }
    }
    const accuracy = Math.max(0, ((totalWords - mistakes) / totalWords) * 100);
    const errorsPerMinute = mistakes / minutes;
    return {
      rawWpm: grossWpm.toFixed(1),
      netWpm: Math.max(0, grossWpm - errorsPerMinute).toFixed(1),
      accuracy: accuracy.toFixed(1),
      mistakes,
    };
  };

  const onTypingKeyDown = (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      ["v", "x", "c", "a"].includes(event.key.toLowerCase())
    ) {
      event.preventDefault();
    }
  };

  const onTypingChange = (event) => {
    const passage = currentLesson()?.passage || "";
    const nextText = String(event.target.value || "").slice(0, passage.length || undefined);
    if (!hasStartedTyping && nextText.length > 0) {
      setStartedAt(Date.now());
      setHasStartedTyping(true);
    }
    setTypedText(nextText);

    if (passage && nextText.length >= passage.length) {
      const elapsed = Math.max(1, currentLessonDuration() - remaining);
      setLessonElapsedSeconds(Math.min(elapsed, currentLessonDuration()));
      setLessonComplete(true);
      setLessonLocked(true);
      setHasStartedTyping(false);
      setStartedAt(null);
      return;
    }

    setLessonComplete(false);
  };

  const submitTypingAttempt = async () => {
    const lesson = currentLesson();
    if (!lesson) return;
    try {
      setAdvancingLesson(true);
      const elapsed = effectiveElapsedSeconds();
      await apiClient.post(`/typing/lessons/${lesson.id}/attempts`, {
        typed_text: typedText,
        duration_seconds: Math.min(elapsed, currentLessonDuration()),
      });
      const nextIndex = activeLessonIndex + 1;
      if (nextIndex < activeTest.lessons.length) {
        setActiveLessonIndex(nextIndex);
        setTypedText("");
        setStartedAt(null);
        setHasStartedTyping(false);
        setRemaining(activeTest.lessons[nextIndex].duration_seconds || activeTest.duration_seconds);
        setLessonElapsedSeconds(0);
        setLessonComplete(false);
        setLessonLocked(false);
        setAdvancingLesson(false);
      } else {
        setMessage("Competition typing test completed successfully.");
        setCompletionSummary({ netWpm: typingStats().netWpm });
        setAdvancingLesson(false);
        await loadCompetitions();
        setTimeout(() => {
          setActiveTest(null);
          setHasStartedTyping(false);
          setLessonElapsedSeconds(0);
          setLessonComplete(false);
          setLessonLocked(false);
          setCompletionSummary(null);
        }, 1600);
      }
    } catch (err) {
      setAdvancingLesson(false);
      setError(err.message || "Could not submit typing lesson.");
    }
  };

  if (!isLearner()) {
    return <MDBox p={2}>Access denied. Learner only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Competitions"
        subtitle="Monthly and seasonal quiz and typing challenges."
        actions={
          <>
            {" "}
            <MDButton variant="gradient" color="info" onClick={loadCompetitions}>
              Refresh
            </MDButton>{" "}
          </>
        }
      />
      <MDBox py={2}>
        {message && (
          <MDTypography variant="caption" color="success" display="block" mb={2}>
            {message}
          </MDTypography>
        )}
        {error && (
          <MDTypography variant="caption" color="error" display="block" mb={2}>
            {error}
          </MDTypography>
        )}

        <MDTypography variant="h5" fontWeight="bold" mb={2}>
          Open Competitions
        </MDTypography>
        {loading && competitions.length === 0 ? (
          <MDTypography variant="body2" color="text">
            Loading competitions...
          </MDTypography>
        ) : (
          <Grid container spacing={3} mb={4}>
            {openCompetitions.map((competition) => (
              <Grid item xs={12} md={6} lg={4} key={competition.id}>
                <Card sx={{ minHeight: 300, overflow: "hidden" }}>
                  {competition.image_url && (
                    <MDBox
                      component="img"
                      src={resolveAssetUrl(competition.image_url)}
                      alt={`${competition.name} banner`}
                      height={130}
                      width="100%"
                      loading="eager"
                      sx={{ objectFit: "cover", display: "block" }}
                    />
                  )}
                  <MDBox p={2}>
                    <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Chip
                        color="info"
                        label={competition.competition_type || "quiz"}
                        size="small"
                      />
                      {competition.is_featured && (
                        <Chip color="warning" label="Featured" size="small" />
                      )}
                    </MDBox>
                    <MDTypography variant="h3" fontWeight="bold" color="info" mb={1}>
                      {competition.name}
                    </MDTypography>
                    <MDTypography variant="caption" color="text" display="block">
                      {competitionWindow(competition)}
                    </MDTypography>
                    <MDTypography variant="caption" color="text" display="block">
                      {competitionAccessNote(competition)}
                    </MDTypography>
                    <MDTypography variant="caption" color="text" display="block">
                      Level:{" "}
                      {competition.eligible_grades?.length
                        ? competition.eligible_grades.join(", ")
                        : "All grades"}
                    </MDTypography>
                    <MDTypography variant="h5" fontWeight="bold" mt={2} mb={2}>
                      {formatMoney(competition)}
                    </MDTypography>
                    <MDButton
                      variant="gradient"
                      color="info"
                      fullWidth
                      startIcon={
                        <Icon>{isFreeCompetition(competition) ? "how_to_reg" : "payments"}</Icon>
                      }
                      onClick={() => setSelected(competition)}
                    >
                      {isFreeCompetition(competition) ? "Enroll Free" : "Enroll"}
                    </MDButton>
                  </MDBox>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Card>
          <MDBox p={2}>
            <MDTypography variant="h5" fontWeight="bold" mb={2}>
              Enrolled Competitions
            </MDTypography>
            <TableContainer>
              <Table>
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Competition</TableCell>
                    <TableCell>Dates</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Position</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {enrolledCompetitions.map((competition) => (
                    <TableRow key={competition.id} hover>
                      <TableCell>{competition.name}</TableCell>
                      <TableCell>
                        {competitionWindow(competition).replace("Open from ", "")}
                      </TableCell>
                      <TableCell>{competition.total_score ?? "-"}</TableCell>
                      <TableCell>
                        {competition.rank ? `#${competition.rank}` : "-"}
                        {competition.participant_count ? ` / ${competition.participant_count}` : ""}
                      </TableCell>
                      <TableCell align="center">
                        <MDButton
                          variant="text"
                          color="info"
                          size="small"
                          onClick={() => openPerformance(competition)}
                        >
                          Performance
                        </MDButton>
                        <MDButton
                          variant="text"
                          color="success"
                          size="small"
                          onClick={() => launchCompetition(competition)}
                        >
                          Open
                        </MDButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </MDBox>
        </Card>
      </MDBox>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Enroll in Competition</DialogTitle>
        <DialogContent>
          <MDTypography variant="h5" fontWeight="bold" mb={1}>
            {selected?.name}
          </MDTypography>
          <MDTypography variant="body2" color="text" mb={2}>
            {isFreeCompetition(selected)
              ? "This competition is free. You will be enrolled immediately."
              : "You will be enrolled after payment is verified."}
          </MDTypography>
          {selected && (
            <MDTypography variant="h4" color="info" fontWeight="bold">
              {formatMoney(selected)}
            </MDTypography>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="dark" onClick={() => setSelected(null)}>
            Cancel
          </MDButton>
          <MDButton variant="gradient" color="info" onClick={handleEnroll} disabled={loading}>
            {loading
              ? "Starting..."
              : isFreeCompetition(selected)
              ? "Enroll Now"
              : "Pay and Enroll"}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(performance)}
        onClose={() => setPerformance(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Competition Performance</DialogTitle>
        <DialogContent>
          <MDTypography variant="h5" fontWeight="bold" mb={1}>
            {performance?.name}
          </MDTypography>
          <MDTypography variant="body2" color="text" display="block">
            Grade: {performance?.grade || "-"} | Stage: {performance?.result_stage || "final"}
          </MDTypography>
          <MDTypography variant="body2" color="text" display="block">
            Quiz score: {performance?.quiz_score ?? "-"}
          </MDTypography>
          <MDTypography variant="body2" color="text" display="block">
            Typing: {performance?.typing_wpm ?? "-"} WPM / {performance?.typing_accuracy ?? "-"}%
          </MDTypography>
          <MDTypography variant="body2" color="text" display="block">
            Total score: {performance?.total_score ?? "-"}
          </MDTypography>
          <MDTypography variant="h4" color="info" fontWeight="bold" mt={2}>
            Position:{" "}
            {performance?.position
              ? `#${performance.position}${
                  performance?.participant_count ? ` / ${performance.participant_count}` : ""
                }`
              : "Pending"}
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton variant="gradient" color="info" onClick={() => setPerformance(null)}>
            Done
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(activeTest)} onClose={() => null} maxWidth="lg" fullWidth>
        <DialogContent>
          {activeTest && currentLesson() && (
            <MDBox>
              {completionSummary ? (
                <MDBox py={6} textAlign="center">
                  <MDTypography variant="h4" fontWeight="bold" mb={1}>
                    Congratulations
                  </MDTypography>
                  <MDTypography variant="h6" color="text">
                    You achieved {completionSummary.netWpm} speed.
                  </MDTypography>
                </MDBox>
              ) : (
                <>
                  <MDTypography variant="h4" fontWeight="bold">
                    {activeTest.name} - {currentLesson().title}
                  </MDTypography>
                  <MDBox display="flex" gap={2} flexWrap="wrap" my={2}>
                    <Chip label={`${remaining}s`} color="warning" />
                    <Chip label={`${typingStats().netWpm} Net WPM`} color="info" />
                    <Chip label={`${typingStats().rawWpm} Gross WPM`} color="default" />
                    <Chip label={`${typingStats().accuracy}% Accuracy`} color="success" />
                    <Chip label={`${typingStats().mistakes} Errors`} color="error" />
                  </MDBox>
                  <MDBox
                    p={2}
                    borderRadius="md"
                    sx={{ backgroundColor: "#f8fafc", lineHeight: 1.9, fontSize: 18 }}
                  >
                    {(currentLesson().passage || "").split("").map((char, index) => {
                      const typed = typedText[index];
                      const color =
                        typed === undefined ? "#344767" : typed === char ? "#16a34a" : "#dc2626";
                      return (
                        <span key={`${char}-${index}`} style={{ color }}>
                          {char}
                        </span>
                      );
                    })}
                  </MDBox>
                  <MDTypography variant="caption" color="text" display="block" mt={1}>
                    {currentLesson().instructions || "Type the passage exactly as shown."}
                  </MDTypography>
                  <MDBox
                    component="textarea"
                    value={typedText}
                    onChange={onTypingChange}
                    onKeyDown={onTypingKeyDown}
                    onPaste={(event) => event.preventDefault()}
                    onDrop={(event) => event.preventDefault()}
                    onContextMenu={(event) => event.preventDefault()}
                    disabled={lessonLocked || advancingLesson}
                    sx={{
                      mt: 2,
                      width: "100%",
                      minHeight: 180,
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "14px",
                      fontSize: 16,
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                  <MDBox display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                    <MDBox>
                      <MDTypography variant="caption" color="text">
                        Lesson {activeLessonIndex + 1} of {activeTest.lessons.length}
                      </MDTypography>
                      <MDTypography variant="caption" color="text" display="block">
                        {lessonComplete
                          ? "Lesson complete. Continue when you are ready."
                          : "Finish the passage to unlock the next lesson."}
                      </MDTypography>
                    </MDBox>
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={submitTypingAttempt}
                      disabled={!lessonComplete || advancingLesson}
                    >
                      {advancingLesson
                        ? "Opening..."
                        : activeLessonIndex + 1 < activeTest.lessons.length
                        ? "Next Lesson"
                        : "Finish Test"}
                    </MDButton>
                  </MDBox>
                </>
              )}
            </MDBox>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </DashboardLayout>
  );
}

export default LearnerCompetitions;
