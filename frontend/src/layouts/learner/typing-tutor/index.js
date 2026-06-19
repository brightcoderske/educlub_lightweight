import { useEffect, useMemo, useRef, useState } from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { buildTypingPracticePath, progressKey } from "./practicePath";
import { buildProgressMap, calculateStats } from "./typingTutorUtils";

const keyboardRows = ["QWERTYUIOP", "ASDFGHJKL;", "ZXCVBNM"].map((row) => row.split(""));
const tracks = buildTypingPracticePath();
const fingerHints = {
  A: "left little finger",
  S: "left ring finger",
  D: "left middle finger",
  F: "left index finger",
  J: "right index finger",
  K: "right middle finger",
  L: "right ring finger",
  ";": "right little finger",
};

function targetPreview(targetText, typedText) {
  const typed = String(typedText || "").slice(0, targetText.length);
  const next = targetText[typed.length] || "";
  return {
    typed: targetText
      .slice(0, typed.length)
      .split("")
      .map((char, index) => ({
        char,
        correct: typed[index] === char,
      })),
    next,
    rest: targetText.slice(typed.length + 1),
  };
}

function firstAvailableActivity(track, progressMap) {
  for (const level of track.levels) {
    for (const activity of level.activities) {
      const key = progressKey(track.key, level.number, activity.key);
      if (!progressMap[key]?.passed) return { level, activity };
    }
  }
  return { level: track.levels[0], activity: track.levels[0].activities[0] };
}

function MyTypingTutor() {
  const { isLearner } = useAuth();
  const inputRef = useRef(null);
  const [selectedTrackKey, setSelectedTrackKey] = useState("beginner");
  const [selectedLevelNumber, setSelectedLevelNumber] = useState(1);
  const [selectedActivityKey, setSelectedActivityKey] = useState("finger-map");
  const [progressRows, setProgressRows] = useState([]);
  const [typedText, setTypedText] = useState("");
  const [practiceReady, setPracticeReady] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [remaining, setRemaining] = useState(45);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const progressMap = useMemo(() => buildProgressMap(progressRows), [progressRows]);
  const selectedTrack = tracks.find((track) => track.key === selectedTrackKey) || tracks[0];
  const selectedLevel =
    selectedTrack.levels.find((level) => level.number === selectedLevelNumber) ||
    selectedTrack.levels[0];
  const selectedActivity =
    selectedLevel.activities.find((activity) => activity.key === selectedActivityKey) ||
    selectedLevel.activities[0];
  const elapsedSeconds = startedAt
    ? Math.min(selectedActivity.seconds, Math.round((Date.now() - startedAt) / 1000))
    : 0;
  const stats = calculateStats(selectedActivity.text, typedText, elapsedSeconds || 1);
  const currentChar = selectedActivity.text[typedText.length] || "";
  const currentKey = currentChar.toUpperCase();
  const preview = targetPreview(selectedActivity.text, typedText);
  const showKeyboard = selectedTrack.key === "beginner";
  const isComplete = typedText.length >= selectedActivity.text.length || remaining <= 0;
  const passed =
    typedText.length >= selectedActivity.text.length &&
    stats.accuracy >= selectedActivity.accuracyGoal &&
    stats.netWpm >= selectedActivity.goalWpm;

  useEffect(() => {
    if (!isLearner()) return;
    apiClient
      .get("/typing-practice/progress")
      .then((response) => setProgressRows(response.activities || []))
      .catch((err) => setError(err.message || "Could not load typing tutor progress."));
  }, [isLearner]);

  useEffect(() => {
    if (!startedAt || isComplete) return undefined;
    const timer = setInterval(() => {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      setRemaining(Math.max(0, selectedActivity.seconds - elapsed));
    }, 250);
    return () => clearInterval(timer);
  }, [startedAt, selectedActivity.seconds, isComplete]);

  const resetActivity = ({ ready = false } = {}) => {
    setTypedText("");
    setPracticeReady(ready);
    setStartedAt(null);
    setRemaining(selectedActivity.seconds);
    setMessage("");
    setError("");
    if (ready) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  useEffect(() => {
    resetActivity();
  }, [selectedActivity.id]);

  const startPractice = () => {
    setPracticeReady(true);
    setStartedAt(null);
    setRemaining(selectedActivity.seconds);
    setMessage("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const updateTypedText = (value) => {
    if (!practiceReady || isComplete) return;
    if (!startedAt && value.length > 0) {
      setStartedAt(Date.now());
    }
    setTypedText(value);
  };

  const saveAttempt = async () => {
    if (saving) return;
    const localResult = {
      track_key: selectedTrack.key,
      level_number: selectedLevel.number,
      activity_key: selectedActivity.key,
      activity_title: selectedActivity.title,
      attempts: 1,
      passed,
      best_net_wpm: stats.netWpm,
      best_raw_wpm: stats.rawWpm,
      best_accuracy: stats.accuracy,
      fewest_mistakes: stats.mistakes,
      local_only: true,
    };
    if (passed) {
      setProgressRows((current) => [
        ...current.filter(
          (row) =>
            progressKey(row.track_key, row.level_number, row.activity_key) !==
            progressKey(localResult.track_key, localResult.level_number, localResult.activity_key)
        ),
        localResult,
      ]);
    }
    setSaving(true);
    setError("");
    try {
      const response = await apiClient.post("/typing-practice/attempts", {
        track_key: selectedTrack.key,
        level_number: selectedLevel.number,
        activity_key: selectedActivity.key,
        activity_title: selectedActivity.title,
        raw_wpm: stats.rawWpm,
        net_wpm: stats.netWpm,
        accuracy: stats.accuracy,
        mistakes: stats.mistakes,
        duration_seconds: Math.max(1, elapsedSeconds),
        passed,
      });
      setProgressRows((current) => [
        ...current.filter(
          (row) =>
            progressKey(row.track_key, row.level_number, row.activity_key) !==
            progressKey(response.track_key, response.level_number, response.activity_key)
        ),
        {
          ...response,
          attempts: 1,
          best_net_wpm: response.net_wpm,
          best_raw_wpm: response.raw_wpm,
          best_accuracy: response.accuracy,
          fewest_mistakes: response.mistakes,
        },
      ]);
      setMessage(
        passed ? "Great work. Activity passed and saved." : "Attempt saved. Try again to pass."
      );
    } catch (err) {
      setError(
        passed
          ? "Passed locally. Run the typing practice migration so progress can save permanently."
          : err.message || "Could not save typing practice."
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (isComplete && startedAt) {
      saveAttempt();
      setStartedAt(null);
    }
  }, [isComplete]);

  const selectTrack = (track) => {
    const next = firstAvailableActivity(track, progressMap);
    setSelectedTrackKey(track.key);
    setSelectedLevelNumber(next.level.number);
    setSelectedActivityKey(next.activity.key);
  };

  const completedInTrack = (track) =>
    track.levels.reduce(
      (count, level) =>
        count +
        level.activities.filter(
          (activity) => progressMap[progressKey(track.key, level.number, activity.key)]?.passed
        ).length,
      0
    );
  const trackIsCompleted = (track) =>
    completedInTrack(track) >= track.levels.length * track.levels[0].activities.length;
  const trackUnlocked = (trackIndex) => {
    if (trackIndex === 0) return true;
    return trackIsCompleted(tracks[trackIndex - 1]);
  };

  const activityUnlocked = (levelIndex, activityIndex) => {
    if (levelIndex === 0 && activityIndex === 0) return true;
    const flat = selectedTrack.levels.flatMap((level) =>
      level.activities.map((activity) => ({ level, activity }))
    );
    const targetIndex = selectedTrack.levels
      .flatMap((level) => level.activities.map((activity) => ({ level, activity })))
      .findIndex(
        (item) =>
          item.level.number === selectedTrack.levels[levelIndex].number &&
          item.activity.key === selectedTrack.levels[levelIndex].activities[activityIndex].key
      );
    if (targetIndex <= 0) return true;
    const previous = flat[targetIndex - 1];
    return Boolean(
      progressMap[progressKey(selectedTrack.key, previous.level.number, previous.activity.key)]
        ?.passed
    );
  };
  const selectedActivityIndex = selectedLevel.activities.findIndex(
    (activity) => activity.key === selectedActivity.key
  );
  const selectedActivityUnlocked = activityUnlocked(
    selectedLevel.number - 1,
    Math.max(0, selectedActivityIndex)
  );
  const flatActivities = selectedTrack.levels.flatMap((level) =>
    level.activities.map((activity) => ({ level, activity }))
  );
  const flatSelectedIndex = flatActivities.findIndex(
    (item) =>
      item.level.number === selectedLevel.number && item.activity.key === selectedActivity.key
  );
  const nextPractice = flatActivities[flatSelectedIndex + 1] || null;
  const canGoNext =
    passed ||
    progressMap[progressKey(selectedTrack.key, selectedLevel.number, selectedActivity.key)]?.passed;
  const goToNextActivity = () => {
    if (!nextPractice || !canGoNext) return;
    setSelectedLevelNumber(nextPractice.level.number);
    setSelectedActivityKey(nextPractice.activity.key);
  };

  if (!isLearner()) {
    return <MDBox>Access denied. Learner only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar autoHideOnScroll />
      <MDBox py={{ xs: 1.25, sm: 1.5 }} sx={{ bgcolor: "#f7fbf7", minHeight: "100vh" }}>
        <MDBox mb={1.25}>
          <MDTypography variant="h3">My Typing Tutor</MDTypography>
          <MDTypography variant="body2" color="text">
            Self-paced keyboard practice. It is separate from report-card typing assessments.
          </MDTypography>
        </MDBox>

        {error && (
          <MDTypography variant="caption" color="error" display="block" mb={1}>
            {error}
          </MDTypography>
        )}
        {message && (
          <MDTypography variant="caption" color="success" display="block" mb={1}>
            {message}
          </MDTypography>
        )}

        <Grid container spacing={1.5} alignItems="flex-start">
          <Grid item xs={12} lg={3}>
            <Card
              sx={{
                position: { lg: "sticky" },
                top: { lg: 10 },
                maxHeight: { lg: "calc(100vh - 24px)" },
                overflow: "auto",
              }}
            >
              <MDBox p={1.5}>
                <MDTypography variant="h6" fontWeight="bold">
                  Adventure Path
                </MDTypography>
                <MDBox mt={1} display="flex" flexDirection="column" gap={0.75}>
                  {tracks.map((track, trackIndex) => {
                    const completed = completedInTrack(track);
                    const total = track.levels.length * track.levels[0].activities.length;
                    const unlocked = trackUnlocked(trackIndex);
                    return (
                      <MDBox
                        key={track.key}
                        p={1.1}
                        border="1px solid #e5e7eb"
                        borderRadius="md"
                        onClick={() => {
                          if (unlocked) selectTrack(track);
                        }}
                        sx={{
                          cursor: unlocked ? "pointer" : "not-allowed",
                          opacity: unlocked ? 1 : 0.64,
                          bgcolor: track.key === selectedTrack.key ? "#eff6ff" : "#ffffff",
                        }}
                      >
                        <MDTypography variant="button" fontWeight="bold">
                          {track.title}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block">
                          {unlocked
                            ? `${completed}/${total} activities`
                            : "Locked until previous path is complete"}
                        </MDTypography>
                        <MDBox mt={0.75} height={7} borderRadius={8} sx={{ bgcolor: "#e5e7eb" }}>
                          <MDBox
                            height="100%"
                            borderRadius={8}
                            sx={{
                              bgcolor: "#1e88e5",
                              width: `${Math.round((completed / total) * 100)}%`,
                            }}
                          />
                        </MDBox>
                      </MDBox>
                    );
                  })}
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={9}>
            <Grid container spacing={1.25}>
              <Grid item xs={12}>
                <Card>
                  <MDBox p={1.35}>
                    <MDTypography variant="h5" fontWeight="bold">
                      {selectedTrack.title}: Level {selectedLevel.number}
                    </MDTypography>
                    <MDTypography variant="body2" color="text">
                      {selectedTrack.description}
                    </MDTypography>
                    <MDBox mt={1} display="flex" gap={0.75} flexWrap="wrap">
                      {selectedTrack.levels.map((level) => (
                        <MDButton
                          key={level.number}
                          size="small"
                          variant={level.number === selectedLevel.number ? "gradient" : "outlined"}
                          color="info"
                          onClick={() => {
                            const firstUnlocked = level.activities.find((activity, index) =>
                              activityUnlocked(level.number - 1, index)
                            );
                            if (!firstUnlocked) return;
                            setSelectedLevelNumber(level.number);
                            setSelectedActivityKey(firstUnlocked.key);
                          }}
                        >
                          {level.number}
                        </MDButton>
                      ))}
                    </MDBox>
                  </MDBox>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Grid container spacing={0.75}>
                  {selectedLevel.activities.map((activity, index) => {
                    const row =
                      progressMap[
                        progressKey(selectedTrack.key, selectedLevel.number, activity.key)
                      ];
                    const unlocked = activityUnlocked(selectedLevel.number - 1, index);
                    return (
                      <Grid item xs={12} md={2.4} key={activity.key}>
                        <MDBox
                          p={1.25}
                          borderRadius="md"
                          onClick={() => {
                            if (!unlocked) return;
                            setSelectedActivityKey(activity.key);
                          }}
                          sx={{
                            minHeight: { xs: 70, md: 82 },
                            cursor: unlocked ? "pointer" : "not-allowed",
                            color: "#ffffff",
                            bgcolor:
                              activity.key === selectedActivity.key
                                ? "#111827"
                                : row?.passed
                                ? "#22a06b"
                                : unlocked
                                ? "#1e88e5"
                                : "#94a3b8",
                          }}
                        >
                          <MDTypography variant="button" color="white" fontWeight="bold">
                            {index + 1}. {activity.title}
                          </MDTypography>
                          <MDTypography variant="caption" color="white" display="block">
                            {unlocked
                              ? `${activity.goalWpm} WPM / ${activity.accuracyGoal}%`
                              : "Locked"}
                          </MDTypography>
                        </MDBox>
                      </Grid>
                    );
                  })}
                </Grid>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <MDBox p={{ xs: 1.25, sm: 1.5 }}>
                    <MDBox display="flex" justifyContent="space-between" gap={1} flexWrap="wrap">
                      <MDBox>
                        <MDTypography variant="h5" fontWeight="bold">
                          {selectedActivity.title}
                        </MDTypography>
                        <MDTypography variant="body2" color="text">
                          {selectedActivityUnlocked
                            ? selectedActivity.instruction ||
                              "Type the text exactly. Stay calm and keep your fingers returning home."
                            : "Complete the previous activity to unlock this practice."}
                        </MDTypography>
                      </MDBox>
                      <MDBox display="flex" gap={1} flexWrap="wrap">
                        <Chip label={`${remaining}s`} color="warning" />
                        <Chip label={`${stats.netWpm.toFixed(1)} Net WPM`} color="info" />
                        <Chip label={`${stats.accuracy.toFixed(1)}% Accuracy`} color="success" />
                        <Chip label={`${stats.mistakes} Errors`} color="error" />
                      </MDBox>
                    </MDBox>

                    <MDBox
                      mt={1.25}
                      display="flex"
                      justifyContent="flex-end"
                      gap={1}
                      flexWrap="wrap"
                    >
                      <MDButton
                        variant="outlined"
                        color="dark"
                        onClick={() => resetActivity({ ready: true })}
                      >
                        Retry
                      </MDButton>
                      <MDButton
                        variant="gradient"
                        color="success"
                        disabled={!nextPractice || !canGoNext}
                        onClick={goToNextActivity}
                        endIcon={<Icon>arrow_forward</Icon>}
                      >
                        Next Activity
                      </MDButton>
                      <MDButton
                        variant="gradient"
                        color="info"
                        disabled={!selectedActivityUnlocked || practiceReady || saving}
                        onClick={startPractice}
                        startIcon={<Icon>keyboard</Icon>}
                      >
                        Start Practice
                      </MDButton>
                    </MDBox>

                    <MDBox
                      mt={2}
                      p={{ xs: 1.25, sm: 1.5 }}
                      borderRadius="md"
                      sx={{
                        bgcolor: "#111827",
                        color: "#ffffff",
                        fontSize: { xs: 20, sm: 28 },
                        lineHeight: 1.45,
                        minHeight: { xs: 92, sm: 104 },
                        maxHeight: { md: 150 },
                        overflow: "auto",
                      }}
                    >
                      {preview.typed.map((item, index) => (
                        <span
                          // eslint-disable-next-line react/no-array-index-key
                          key={`${item.char}-${index}`}
                          style={{
                            color: item.correct ? "#86efac" : "#fca5a5",
                            background: item.correct ? "transparent" : "rgba(239,68,68,0.22)",
                            borderRadius: item.correct ? 0 : 4,
                          }}
                        >
                          {item.char}
                        </span>
                      ))}
                      <span style={{ color: "#fde68a", borderBottom: "3px solid #fde68a" }}>
                        {preview.next}
                      </span>
                      <span>{preview.rest}</span>
                    </MDBox>

                    <MDBox
                      component="textarea"
                      ref={inputRef}
                      value={typedText}
                      disabled={!practiceReady || isComplete}
                      onChange={(event) => updateTypedText(event.target.value)}
                      placeholder="Press Start Practice, then type here..."
                      sx={{
                        mt: 1.5,
                        width: "100%",
                        minHeight: { xs: 76, sm: 84 },
                        resize: "vertical",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        p: 1.5,
                        fontSize: 18,
                        fontFamily: "Courier New, monospace",
                      }}
                    />

                    {showKeyboard && (
                      <MDBox mt={1.25} p={1.1} borderRadius="md" sx={{ bgcolor: "#eef2f7" }}>
                        <MDBox
                          mb={0.75}
                          p={0.85}
                          borderRadius="md"
                          sx={{ bgcolor: "#fff7ed", border: "1px solid #fed7aa" }}
                        >
                          <MDTypography variant="button" fontWeight="bold">
                            Next key: {currentChar === " " ? "Space" : currentChar || "Done"}
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            {fingerHints[currentKey] || "Use the nearest comfortable finger."}
                          </MDTypography>
                        </MDBox>
                        {keyboardRows.map((row) => (
                          <MDBox
                            key={row.join("")}
                            display="flex"
                            justifyContent="center"
                            gap={{ xs: 0.4, sm: 0.75 }}
                            mb={0.55}
                          >
                            {row.map((key) => (
                              <MDBox
                                key={key}
                                width={{ xs: 28, sm: 42 }}
                                height={{ xs: 28, sm: 34 }}
                                display="grid"
                                sx={{
                                  placeItems: "center",
                                  borderRadius: "7px",
                                  border: "1px solid #cbd5e1",
                                  bgcolor: currentKey === key.toUpperCase() ? "#ffb020" : "#ffffff",
                                  fontWeight: 800,
                                }}
                              >
                                {key}
                              </MDBox>
                            ))}
                          </MDBox>
                        ))}
                      </MDBox>
                    )}

                    <MDBox
                      mt={1.25}
                      display="flex"
                      justifyContent="space-between"
                      gap={1}
                      flexWrap="wrap"
                    >
                      <MDBox>
                        <MDTypography variant="caption" color="text">
                          Goal: {selectedActivity.goalWpm} WPM and {selectedActivity.accuracyGoal}%
                          accuracy
                        </MDTypography>
                        {isComplete && (
                          <MDTypography
                            variant="body2"
                            color={passed ? "success" : "warning"}
                            fontWeight="medium"
                          >
                            {passed
                              ? "Passed. Nice progress."
                              : "Saved. Retry to pass this activity."}
                          </MDTypography>
                        )}
                      </MDBox>
                    </MDBox>
                  </MDBox>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default MyTypingTutor;
