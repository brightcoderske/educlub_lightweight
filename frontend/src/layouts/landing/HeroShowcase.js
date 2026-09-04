import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

/**
 * The floating panels over the hero photograph.
 *
 * These are an illustration of the product, in the way a marketing page shows a
 * mock screen - the figures are fixed sample values, not a reading of anyone's
 * account. They are marked aria-hidden so a screen reader is never told that
 * "2,450 XP" describes the visitor.
 */

// Respect the OS setting rather than animating regardless. Checked once and
// re-checked on change, because a visitor can flip it while the tab is open.
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return reduced;
}

/** Counts up to `value` once, then stops. Reduced motion shows the total. */
function useCountUp(value, { duration = 1600, active = true } = {}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced || !active ? value : 0);
  const frame = useRef(0);

  useEffect(() => {
    if (reduced || !active) {
      setShown(value);
      return undefined;
    }

    const started = performance.now();
    const step = (now) => {
      const progress = Math.min((now - started) / duration, 1);
      // Ease-out: fast at first, settling at the end, so the number reads as
      // arriving rather than ticking.
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration, active, reduced]);

  return shown;
}

const CODE_LINES = ["when green flag clicked", "  move 10 steps", "  say “Hello, world!”"];

/** Types the sample program out, line by line, then holds. */
function useTypedCode() {
  const reduced = useReducedMotion();
  const full = CODE_LINES.join("\n");
  const [typed, setTyped] = useState(reduced ? full : "");

  useEffect(() => {
    if (reduced) {
      setTyped(full);
      return undefined;
    }

    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTyped(full.slice(0, index));
      if (index >= full.length) clearInterval(timer);
    }, 45);

    return () => clearInterval(timer);
  }, [full, reduced]);

  return typed;
}

const float = {
  "@keyframes educlubFloat": {
    "0%,100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(-9px)" },
  },
};

function panel(extra = {}) {
  return {
    position: "absolute",
    p: 1.25,
    borderRadius: "14px",
    bgcolor: "rgba(17,22,61,0.92)",
    border: "1px solid rgba(126,110,255,0.42)",
    boxShadow: "0 14px 34px rgba(4,6,25,0.5)",
    backdropFilter: "blur(6px)",
    animation: "educlubFloat 6s ease-in-out infinite",
    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
    ...extra,
  };
}

function HeroShowcase({ image, alt }) {
  const xp = useCountUp(2450);
  const wpm = useCountUp(42, { duration: 1200 });
  const quiz = useCountUp(90, { duration: 1400 });
  const code = useTypedCode();

  return (
    <MDBox
      sx={{
        position: "relative",
        width: "100%",
        minHeight: { xs: 300, sm: 400, lg: 520 },
        ...float,
      }}
    >
      <MDBox
        component="img"
        src={image}
        // A phone has no business downloading the 1200px file. The browser picks
        // a rendition from these; sizes says the art is about half the viewport
        // on a wide screen and the full width once the hero stacks.
        srcSet={`${image.replace("-1200", "-480")} 480w, ${image.replace(
          "-1200",
          "-800"
        )} 800w, ${image} 1200w`}
        sizes="(min-width: 1200px) 46vw, (min-width: 900px) 50vw, 92vw"
        alt={alt}
        // Fixed intrinsic size so the row does not jump once the photo lands.
        width="1200"
        height="813"
        loading="eager"
        fetchpriority="high"
        decoding="async"
        sx={{
          width: "100%",
          height: "auto",
          display: "block",
          filter: "drop-shadow(0 24px 48px rgba(3,6,28,0.55))",
        }}
      />

      {/* Typing speed */}
      <MDBox aria-hidden sx={panel({ top: "4%", left: { xs: "-2%", md: "-6%" }, width: 150 })}>
        <MDTypography variant="caption" sx={{ color: "#b9b6e8", display: "block" }}>
          Typing Speed
        </MDTypography>
        <MDBox display="flex" alignItems="baseline" gap={0.5}>
          <MDTypography variant="h4" sx={{ color: "#fff", fontWeight: 800, lineHeight: 1 }}>
            {wpm}
          </MDTypography>
          <MDTypography variant="caption" sx={{ color: "#fff" }}>
            WPM
          </MDTypography>
        </MDBox>
        <MDTypography variant="caption" sx={{ color: "#5ff2a6", fontWeight: 700 }}>
          ▲ +8 WPM
        </MDTypography>
      </MDBox>

      {/* The program writing itself */}
      <MDBox
        aria-hidden
        sx={panel({
          top: "-4%",
          right: { xs: "-2%", md: "4%" },
          width: 214,
          animationDelay: "1.2s",
          display: { xs: "none", sm: "block" },
        })}
      >
        <MDTypography variant="caption" sx={{ color: "#b9b6e8", display: "block", mb: 0.5 }}>
          Scratch Project
        </MDTypography>
        <MDBox
          component="pre"
          sx={{
            m: 0,
            minHeight: 54,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: ".62rem",
            lineHeight: 1.5,
            color: "#8ff0c6",
            whiteSpace: "pre-wrap",
          }}
        >
          {code}
          <MDBox
            component="span"
            sx={{
              display: "inline-block",
              width: "6px",
              height: "0.75em",
              ml: "1px",
              bgcolor: "#8ff0c6",
              animation: "educlubBlink 1s steps(2) infinite",
              "@keyframes educlubBlink": { "50%": { opacity: 0 } },
              "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0 },
            }}
          />
        </MDBox>
      </MDBox>

      {/* Quiz score */}
      <MDBox
        aria-hidden
        sx={panel({
          top: "38%",
          right: { xs: "-3%", md: "-7%" },
          width: 138,
          animationDelay: ".6s",
        })}
      >
        <MDTypography variant="caption" sx={{ color: "#b9b6e8", display: "block" }}>
          Quiz Score
        </MDTypography>
        <MDTypography variant="h4" sx={{ color: "#fff", fontWeight: 800, lineHeight: 1 }}>
          {quiz}%
        </MDTypography>
        <MDTypography variant="caption" sx={{ color: "#ffd66b", fontWeight: 700 }}>
          Great job! 🎉
        </MDTypography>
      </MDBox>

      {/* XP rising */}
      <MDBox
        aria-hidden
        sx={panel({
          bottom: "10%",
          right: { xs: "2%", md: "-4%" },
          width: 168,
          animationDelay: "1.8s",
        })}
      >
        <MDBox
          sx={{
            display: "inline-block",
            px: 1,
            py: 0.25,
            mb: 0.5,
            borderRadius: "8px",
            background: "linear-gradient(90deg,#ff9d2f,#ff6a3d)",
          }}
        >
          <MDTypography variant="caption" sx={{ color: "#fff", fontWeight: 800 }}>
            +250 XP
          </MDTypography>
        </MDBox>
        <MDTypography variant="caption" sx={{ color: "#b9b6e8", display: "block" }}>
          Total Points
        </MDTypography>
        <MDTypography variant="h4" sx={{ color: "#fff", fontWeight: 800, lineHeight: 1 }}>
          {xp.toLocaleString("en-KE")}
        </MDTypography>
      </MDBox>
    </MDBox>
  );
}

HeroShowcase.propTypes = {
  image: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
};

export default HeroShowcase;
