import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

import MDBox from "components/MDBox";

const STORAGE_KEY = "educlub-learn-sidebar-width";
export const SIDEBAR_DEFAULT = 320;
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 560;
const KEY_STEP = 24;

const clamp = (width) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width)));

// The learning path width this learner last chose on this device. Storage can
// be blocked on shared school machines; the default is used then.
export function useSidebarWidth() {
  const [width, setWidth] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY));
      return stored ? clamp(stored) : SIDEBAR_DEFAULT;
    } catch {
      return SIDEBAR_DEFAULT;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      // Not remembered; it still works for this visit.
    }
  }, [width]);
  return [width, (next) => setWidth(clamp(next))];
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
