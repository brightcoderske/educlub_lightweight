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
import { buildTypingPracticePath, fingerForKey, progressKey } from "./practicePath";
import { buildProgressMap, calculateStats, mergePracticeAttempt } from "./typingTutorUtils";
import {
  isMuted,
  playAttemptSaved,
  playError,
  playKeyTick,
  playSuccess,
  playWordComplete,
  setMuted,
} from "./typingSounds";

const keyboardRows = ["QWERTYUIOP", "ASDFGHJKL;", "ZXCVBNM"].map((row) => row.split(""));
// The eight keys a learner's fingers rest on. Marking them keeps the idea of a
// home position visible on every level, not only while it is being taught.
const homeKeys = new Set(["A", "S", "D", "F", "J", "K", "L", ";"]);
const tracks = buildTypingPracticePath();

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
  const { user, isLearner } = useAuth();
  const inputRef = useRef(null);
  const submitting = useRef(false);
  const pendingAttempt = useRef(null);
  const [finishedSeconds, setFinishedSeconds] = useState(null);
  const [attemptSaved, setAttemptSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
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
  const [keyboardVisible, setKeyboardVisible] = useState(true);
  const [soundOn, setSoundOn] = useState(() => !isMuted());

  const progressMap = useMemo(() => buildProgressMap(progressRows), [progressRows]);
  const selectedTrack = tracks.find((track) => track.key === selectedTrackKey) || tracks[0];
  const selectedLevel =
    selectedTrack.levels.find((level) => level.number === selectedLevelNumber) ||
    selectedTrack.levels[0];
  const selectedActivity =
    selectedLevel.activities.find((activity) => activity.key === selectedActivityKey) ||
    selectedLevel.activities[0];
  const elapsedSeconds =
    finishedSeconds ??
    (startedAt
      ? Math.min(selectedActivity.seconds, Math.round((Date.now() - startedAt) / 1000))
      : 0);
  const stats = calculateStats(selectedActivity.text, typedText, elapsedSeconds || 1);
  const currentChar = selectedActivity.text[typedText.length] || "";
  const currentKey = currentChar.toUpperCase();
  const preview = targetPreview(selectedActivity.text, typedText);
  // The keyboard map used to be hidden outside the beginner track, which is
  // exactly when the unfamiliar keys start arriving. It is now available on
  // every track and the learner decides when they no longer need it.
  const showKeyboard = keyboardVisible;
  const isComplete = typedText.length >= selectedActivity.text.length || remaining <= 0;
  const passed =
    typedText.length >= selectedActivity.text.length &&
    stats.accuracy >= selectedActivity.accuracyGoal &&
    stats.netWpm >= selectedActivity.goalWpm;

  useEffect(() => {
    if (user?.role !== "learner") return;
    apiClient
      .get("/typing-practice/progress")
      .then((response) => setProgressRows(response.activities || []))
      .catch((err) => setError(err.message || "Could not load typing tutor progress."));
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!startedAt || isComplete) return undefined;
    const timer = setInterval(() => {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      setRemaining(Math.max(0, selectedActivity.seconds - elapsed));
    }, 250);
    return () => clearInterval(timer);
  }, [startedAt, selectedActivity.seconds, isComplete]);

  const resetActivity = ({ ready = false } = {}) => {
    pendingAttempt.current = null;
    setFinishedSeconds(null);
    setAttemptSaved(false);
    setSaveFailed(false);
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

    // Sound only on forward progress. Backspacing through a mistake should be
    // quiet, or correcting an error turns into a burst of noise.
    if (value.length > typedText.length) {
      const target = selectedActivity.text;
      const lastIndex = value.length - 1;
      if (value[lastIndex] !== target[lastIndex]) {
        playError();
      } else if (value[lastIndex] === " " || value.length === target.length) {
        playWordComplete();
      } else {
        playKeyTick();
      }
    }

    setTypedText(value);
  };

  // The caret must sit at the end of what has been typed. Without this a learner
  // who clicks into the middle of the box, or whose tablet keyboard moves the
  // caret, silently starts inserting characters in the wrong place and every
  // later letter is marked wrong for no visible reason.
  const keepCaretAtEnd = (event) => {
    const field = event.target;
    const end = field.value.length;
    if (field.selectionStart !== end || field.selectionEnd !== end) {
      field.setSelectionRange(end, end);
    }
  };

  const saveAttempt = async () => {
    if (submitting.current || !pendingAttempt.current) return;
    submitting.current = true;
    setSaving(true);
    setSaveFailed(false);
    setError("");
    try {
      const response = await apiClient.post("/typing-practice/attempts", pendingAttempt.current);
      setProgressRows((current) => mergePracticeAttempt(current, response));
      pendingAttempt.current = null;
      setAttemptSaved(true);
      if (response.passed) playSuccess();
      else playAttemptSaved();
      setMessage(
        response.passed
          ? "Activity passed and saved for your teacher."
          : "Attempt saved for your teacher. Try again to pass."
      );
    } catch (err) {
      setSaveFailed(true);
      setError("Your attempt has not saved yet. Check your connection and use Save again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!isComplete || !startedAt) return;
    const duration = Math.max(
      1,
      Math.min(selectedActivity.seconds, Math.round((Date.now() - startedAt) / 1000))
    );
    setFinishedSeconds(duration);
    pendingAttempt.current = {
      track_key: selectedTrack.key,
      level_number: selectedLevel.number,
      activity_key: selectedActivity.key,
      activity_title: selectedActivity.title,
      target_text: selectedActivity.text,
      typed_text: typedText,
      goal_wpm: selectedActivity.goalWpm,
      accuracy_goal: selectedActivity.accuracyGoal,
      duration_seconds: duration,
    };
    saveAttempt();
  }, [isComplete]);

  const selectTrack = (track) => {
    if (saving || saveFailed) return;
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
    !saving &&
    !saveFailed &&
    progressMap[progressKey(selectedTrack.key, selectedLevel.number, selectedActivity.key)]?.passed;
  const goToNextActivity = () => {
    if (saving || !nextPractice || !canGoNext) return;
    setSelectedLevelNumber(nextPractice.level.number);
    setSelectedActivityKey(nextPractice.activity.key);
  };

  if (!isLearner()) {
    return <MDBox>Access denied. Learner only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        autoHideOnScroll
        title="My Typing Tutor"
        subtitle="Self-paced keyboard practice. It is separate from report-card typing assessments."
      />
      <MDBox py={{ xs: 1.25, sm: 1.5 }} sx={{ bgcolor: "#f7fbf7", minHeight: "100vh" }}>
        {error && (
          <MDTypography variant="caption" color="error" display="block" mb={1}>
            {error}
          </MDTypography>
        )}
        {saveFailed && (
          <MDButton size="small" color="info" onClick={saveAttempt} disabled={saving}>
            Save again
          </MDButton>
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
                            if (saving || saveFailed) return;
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
                            if (saving || saveFailed) return;
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
                          {selectedLevel.number}.{selectedActivity.order} {selectedActivity.title}
                        </MDTypography>
                        <MDTypography variant="body2" color="text">
                          {selectedActivityUnlocked
                            ? selectedActivity.teaches
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

                    {/* What this level is for, in the learner's own words. */}
                    <MDBox
                      mt={1.25}
                      p={1.25}
                      borderRadius="md"
                      sx={{ bgcolor: "#eff6ff", border: "1px solid #bfdbfe" }}
                    >
                      <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <MDTypography variant="button" fontWeight="bold">
                          Level {selectedLevel.number}: {selectedLevel.focus}
                        </MDTypography>
                        {selectedLevel.newKeys && (
                          <Chip
                            size="small"
                            color="info"
                            label={`New keys: ${selectedLevel.newKeys}`}
                          />
                        )}
                      </MDBox>
                      <MDTypography variant="body2" color="text" mt={0.5}>
                        {selectedLevel.teaches}
                      </MDTypography>
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
                        color={soundOn ? "info" : "secondary"}
                        onClick={() => setSoundOn(!setMuted(soundOn))}
                        startIcon={<Icon>{soundOn ? "volume_up" : "volume_off"}</Icon>}
                      >
                        {soundOn ? "Sound On" : "Sound Off"}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color={keyboardVisible ? "info" : "secondary"}
                        onClick={() => setKeyboardVisible((current) => !current)}
                        startIcon={<Icon>keyboard_alt</Icon>}
                      >
                        {keyboardVisible ? "Hide Keys" : "Show Keys"}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color="dark"
                        disabled={saving || saveFailed}
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
                      onSelect={keepCaretAtEnd}
                      onClick={keepCaretAtEnd}
                      onKeyUp={keepCaretAtEnd}
                      // Losing focus mid-passage stops the keystrokes reaching the
                      // box while the timer keeps running, which reads as the tutor
                      // freezing. Take the caret straight back.
                      onBlur={() => {
                        if (practiceReady && !isComplete) {
                          window.setTimeout(() => inputRef.current?.focus(), 0);
                        }
                      }}
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
                            {currentChar
                              ? `Use your ${fingerForKey(currentChar)}.`
                              : "Finished. Every key in this activity is typed."}
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
                            {row.map((key) => {
                              const isNext = currentKey === key.toUpperCase();
                              const isHome = homeKeys.has(key.toUpperCase());
                              return (
                                <MDBox
                                  key={key}
                                  width={{ xs: 28, sm: 42 }}
                                  height={{ xs: 28, sm: 34 }}
                                  display="grid"
                                  sx={{
                                    placeItems: "center",
                                    borderRadius: "7px",
                                    // Home keys stay marked on every level, so the
                                    // idea of a resting position never disappears.
                                    border: isHome ? "2px solid #1e88e5" : "1px solid #cbd5e1",
                                    bgcolor: isNext ? "#ffb020" : isHome ? "#e3f2fd" : "#ffffff",
                                    fontWeight: 800,
                                  }}
                                >
                                  {key}
                                </MDBox>
                              );
                            })}
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
                            {saving
                              ? "Saving attempt…"
                              : !attemptSaved
                              ? "Attempt not saved yet."
                              : passed
                              ? "Passed and saved."
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
