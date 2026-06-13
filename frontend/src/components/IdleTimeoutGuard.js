import { useEffect, useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import PropTypes from "prop-types";

import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";

const IDLE_LIMIT_MS = 60 * 60 * 1000;
const WARNING_MS = 30 * 1000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
  "input",
  "change",
  "focus",
];

function IdleTimeoutGuard({ active, onTimeout }) {
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const timedOutRef = useRef(false);

  const clearTimers = () => {
    window.clearTimeout(warningTimerRef.current);
    window.clearTimeout(logoutTimerRef.current);
    window.clearInterval(countdownRef.current);
  };

  const resetTimers = () => {
    clearTimers();
    setWarningOpen(false);
    setSecondsLeft(30);
    timedOutRef.current = false;

    if (!active) return;

    warningTimerRef.current = window.setTimeout(() => {
      setWarningOpen(true);
      setSecondsLeft(30);
      countdownRef.current = window.setInterval(() => {
        setSecondsLeft((current) => Math.max(current - 1, 0));
      }, 1000);
    }, IDLE_LIMIT_MS - WARNING_MS);

    logoutTimerRef.current = window.setTimeout(() => {
      if (timedOutRef.current) return;
      timedOutRef.current = true;
      clearTimers();
      setWarningOpen(false);
      onTimeout();
    }, IDLE_LIMIT_MS);
  };

  useEffect(() => {
    if (!active) {
      clearTimers();
      setWarningOpen(false);
      return undefined;
    }

    resetTimers();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetTimers, { passive: true });
    });
    document.addEventListener("visibilitychange", resetTimers);

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimers);
      });
      document.removeEventListener("visibilitychange", resetTimers);
      clearTimers();
    };
  }, [active]);

  return (
    <Dialog open={warningOpen} maxWidth="xs" fullWidth>
      <DialogTitle>Are you still there?</DialogTitle>
      <DialogContent>
        <MDTypography variant="body2" color="text">
          You will be signed out in {secondsLeft} seconds because there has been no activity.
        </MDTypography>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <MDButton variant="gradient" color="info" onClick={resetTimers}>
          Stay Signed In
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

IdleTimeoutGuard.propTypes = {
  active: PropTypes.bool.isRequired,
  onTimeout: PropTypes.func.isRequired,
};

export default IdleTimeoutGuard;
