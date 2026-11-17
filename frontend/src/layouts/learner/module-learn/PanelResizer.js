import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

import MDBox from "components/MDBox";

const WIDTH_KEY = "educlub-learn-sidebar-width";
const HIDDEN_KEY = "educlub-learn-sidebar-hidden";
export const SIDEBAR_DEFAULT = 320;
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 560;
const KEY_STEP = 24;

const clamp = (width) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width)));

// A layout choice this learner last made on this device. Storage can be
// blocked on shared school machines; the fallback is used then, and the
// choice still holds for this visit.
function useRememberedLayout(key, read, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : read(stored);
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Not remembered.
    }
  }, [key, value]);
  return [value, setValue];
}

export function useSidebarWidth() {
  const [width, setWidth] = useRememberedLayout(
    WIDTH_KEY,
    (stored) => (Number(stored) ? clamp(Number(stored)) : SIDEBAR_DEFAULT),
    SIDEBAR_DEFAULT
  );
  return [width, (next) => setWidth(clamp(next))];
}

// Whether the learning path is tucked away to give the lesson the full width.
export function useSidebarHidden() {
  return useRememberedLayout(HIDDEN_KEY, (stored) => stored === "true", false);
}

// The bar between the learning path and the activity. Drag it, or focus it
// and use the arrow keys; double-click puts it back to the default width.
function PanelResizer({ width, onResize }) {
  const drag = useRef(null);

  const onPointerDown = (event) => {
    event.preventDefault();
    drag.current = { startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!drag.current) return;
    onResize(drag.current.startWidth + event.clientX - drag.current.startX);
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onKeyDown = (event) => {
    if (event.key === "ArrowLeft") onResize(width - KEY_STEP);
    else if (event.key === "ArrowRight") onResize(width + KEY_STEP);
    else if (event.key === "Home") onResize(SIDEBAR_MIN);
    else if (event.key === "End") onResize(SIDEBAR_MAX);
    else return;
    event.preventDefault();
  };

  return (
    <MDBox
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the learning path"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onResize(SIDEBAR_DEFAULT)}
      onKeyDown={onKeyDown}
      sx={{
        display: { xs: "none", md: "flex" },
        flex: "0 0 20px",
        justifyContent: "center",
        cursor: "col-resize",
        touchAction: "none",
        outline: "none",
        "&::after": {
          content: '""',
          width: "4px",
          borderRadius: "4px",
          bgcolor: "rgba(120, 120, 160, 0.25)",
          transition: "background-color 120ms",
        },
        "&:hover::after, &:focus-visible::after, &:active::after": {
          bgcolor: "#7c6cf2",
        },
      }}
    />
  );
}

PanelResizer.propTypes = {
  width: PropTypes.number.isRequired,
  onResize: PropTypes.func.isRequired,
};

export default PanelResizer;
