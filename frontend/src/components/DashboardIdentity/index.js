import { useId } from "react";
import PropTypes from "prop-types";

import MDAvatar from "components/MDAvatar";
import { useAppPalette } from "lib/appTheme";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { getRoleLabel, getUserDisplayName, getUserInitials } from "lib/userDisplay";

// Small, local vector characters keep every course illustrated without image requests.
export function learningTheme(name = "") {
  const title = String(name).toLowerCase();
  if (/scratch/.test(title))
    return { art: "cat", color: "#d97706", tint: "#fff3d6", label: "Create with code" };
  if (/python/.test(title))
    return { art: "python", color: "#2563eb", tint: "#eaf2ff", label: "Think like a coder" };
  if (/web|html|css|javascript/.test(title))
    return { art: "code", color: "#7040e8", tint: "#f0eaff", label: "Build for the web" };
  if (/\bai\b|robot|intelligence/.test(title))
    return { art: "robot", color: "#008b95", tint: "#def9f6", label: "Explore new ideas" };
  if (/typing|keyboard/.test(title))
    return { art: "keyboard", color: "#138653", tint: "#e3f8eb", label: "Grow your skills" };
  if (/game|app/.test(title))
    return { art: "game", color: "#d33e87", tint: "#fff0f7", label: "Make something fun" };
  if (/quiz|challenge|competition|badge/.test(title))
    return { art: "trophy", color: "#a75c04", tint: "#fff4d6", label: "Show what you know" };
  return { art: "rocket", color: "#5c4ad1", tint: "#efedff", label: "Discover something new" };
}

export function LearningArt({ kind = "robot", size = 180, ...props }) {
  const id = useId().replace(/:/g, "");
  const purple = `url(#${id}-purple)`;
  const gold = `url(#${id}-gold)`;
  const silver = `url(#${id}-silver)`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 220"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-purple`}
          x1="60"
          y1="60"
          x2="180"
          y2="205"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#a987ff" />
          <stop offset="1" stopColor="#5025c7" />
        </linearGradient>
        <linearGradient
          id={`${id}-gold`}
          x1="70"
          y1="50"
          x2="160"
          y2="170"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff18a" />
          <stop offset=".45" stopColor="#ffc52b" />
          <stop offset="1" stopColor="#ec8708" />
        </linearGradient>
        <linearGradient
          id={`${id}-silver`}
          x1="60"
          y1="60"
          x2="165"
          y2="180"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#b4c8f3" />
        </linearGradient>
      </defs>
      <circle cx="121" cy="109" r="83" fill="#a99aff" opacity=".13" />
      <ellipse cx="122" cy="202" rx="74" ry="9" fill="#121844" opacity=".14" />
      <path
        d="m29 62 3-9 3 9 9 3-9 3-3 9-3-9-9-3 9-3ZM199 128l3-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"
        fill="#ffd64d"
      />
      <circle cx="196" cy="45" r="5" fill="#72e7df" />
      <circle cx="42" cy="151" r="4" fill="#bb92ff" />
      {kind === "kid" ? (
        <>
          <path d="M57 195v-24c0-30 24-46 61-46s65 16 65 46v24" fill={purple} />
          <path
            d="m91 139 27 28 29-29M118 167v25"
            stroke="#42219f"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <rect x="105" y="120" width="27" height="28" rx="12" fill="#9d5635" />
          <ellipse cx="75" cy="91" rx="11" ry="16" fill="#ae6640" />
          <ellipse cx="164" cy="91" rx="11" ry="16" fill="#ae6640" />
          <rect x="78" y="40" width="83" height="96" rx="39" fill="#b9744b" />
          <path
            d="M80 77c-15-40 10-54 40-54 32 0 54 16 40 56l-9-23c-20 9-42 7-60-1Z"
            fill="#262134"
          />
          {[85, 101, 119, 138, 152].map((x, i) => (
            <circle key={x} cx={x} cy={36 + (i % 2) * 6} r="14" fill="#302839" />
          ))}
          <path
            d="M91 81q9-7 18-1m21 0q9-6 18 1"
            stroke="#40262a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <ellipse cx="101" cy="94" rx="9" ry="11" fill="white" />
          <ellipse cx="139" cy="94" rx="9" ry="11" fill="white" />
          <ellipse cx="104" cy="95" rx="5" ry="7" fill="#292036" />
          <ellipse cx="137" cy="95" rx="5" ry="7" fill="#292036" />
          <circle cx="105" cy="92" r="2" fill="white" />
          <circle cx="138" cy="92" r="2" fill="white" />
          <path d="M106 114q14 19 28 0Z" fill="#64302e" />
          <path d="M109 114h22q-10 9-22 0" fill="white" />
          <path d="m59 167 16-1 13 28H66Z" fill="#b9744b" />
          <path d="M65 153h96a7 7 0 0 1 7 8l-7 39H80Z" fill="#26324e" />
          <path d="M78 200h98" stroke="#8292b4" strokeWidth="6" strokeLinecap="round" />
          <path
            d="m117 174-7 7 7 7m13-14 7 7-7 7"
            stroke="#bcabff"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : kind === "robot" ? (
        <>
          <path d="M120 43V27" stroke="#93a9df" strokeWidth="7" />
          <circle cx="120" cy="23" r="9" fill="#67e7e3" />
          <rect x="76" y="137" width="88" height="57" rx="23" fill={purple} />
          <rect x="103" y="153" width="34" height="23" rx="9" fill="#d5cdff" />
          <path
            d="m70 151-17 20m117-20 17 20"
            stroke="#b5c9f0"
            strokeWidth="17"
            strokeLinecap="round"
          />
          <rect x="74" y="185" width="35" height="15" rx="7" fill="#889fd7" />
          <rect x="132" y="185" width="35" height="15" rx="7" fill="#889fd7" />
          <rect x="45" y="76" width="20" height="37" rx="9" fill="#9380e8" />
          <rect x="175" y="76" width="20" height="37" rx="9" fill="#9380e8" />
          <rect x="56" y="45" width="129" height="103" rx="37" fill={silver} />
          <rect x="68" y="61" width="105" height="69" rx="27" fill="#162644" />
          <ellipse cx="95" cy="89" rx="10" ry="13" fill="#78f1ef" />
          <ellipse cx="146" cy="89" rx="10" ry="13" fill="#78f1ef" />
          <circle cx="98" cy="85" r="3" fill="white" />
          <circle cx="149" cy="85" r="3" fill="white" />
          <path d="M109 111q11 11 23 0" stroke="#78f1ef" strokeWidth="5" strokeLinecap="round" />
        </>
      ) : kind === "cat" ? (
        <>
          <path d="M167 159q53-4 36-43" stroke="#ffb52c" strokeWidth="20" strokeLinecap="round" />
          <ellipse cx="120" cy="162" rx="46" ry="36" fill={gold} />
          <ellipse cx="120" cy="166" rx="26" ry="28" fill="#fff5df" />
          <path
            d="m70 85-7-49 40 28m34 0 39-28-7 52"
            fill="#ffb52c"
            stroke="#e78b19"
            strokeWidth="3"
          />
          <path d="m74 66-3-18 18 15m64 0 16-14-4 20" fill="#ffc3b0" />
          <ellipse cx="120" cy="99" rx="56" ry="44" fill={gold} />
          <ellipse cx="119" cy="119" rx="33" ry="21" fill="#fff9ec" />
          <ellipse cx="98" cy="94" rx="12" ry="17" fill="white" />
          <ellipse cx="140" cy="94" rx="12" ry="17" fill="white" />
          <ellipse cx="102" cy="95" rx="5" ry="10" fill="#24304c" />
          <ellipse cx="137" cy="95" rx="5" ry="10" fill="#24304c" />
          <path d="m113 110 7 8 7-8Z" fill="#b95752" />
          <path d="M105 122q15 14 30 0" stroke="#6f462a" strokeWidth="3" strokeLinecap="round" />
          <path
            d="m82 112-25-5m25 15-25 5m100-15 25-5m-25 15 25 5"
            stroke="#6f462a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="m85 158-18 13m89-13 17-12"
            stroke="#ffb52c"
            strokeWidth="17"
            strokeLinecap="round"
          />
          <ellipse cx="94" cy="192" rx="22" ry="10" fill="#ffb52c" />
          <ellipse cx="146" cy="192" rx="22" ry="10" fill="#ffb52c" />
        </>
      ) : kind === "trophy" ? (
        <>
          <rect x="67" y="179" width="109" height="21" rx="6" fill={purple} />
          <rect x="78" y="167" width="85" height="15" rx="5" fill="#ae92ff" />
          <path
            d="M84 60H54v23q0 39 43 37m59-60h30v23q0 39-43 37"
            stroke="#f7b521"
            strokeWidth="13"
          />
          <path d="M120 127v32m-24 8h48" stroke="#f7b521" strokeWidth="14" strokeLinecap="round" />
          <path d="M78 48h84v48c0 50-84 50-84 0Z" fill={gold} />
          <path d="M88 56v37q0 15 7 21" stroke="#fff3a7" strokeWidth="5" strokeLinecap="round" />
          <path
            d="m121 70 8 16 18 3-13 13 3 18-16-9-16 9 3-18-13-13 18-3Z"
            fill="#fff4ae"
            stroke="#d88810"
            strokeWidth="2"
          />
          <path
            d="m43 39 7 9m137-18-5 11m24 53 9-3M41 137l-8 6"
            stroke="#bd8eff"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </>
      ) : kind === "python" ? (
        <>
          <path
            d="M118 113H80V79q0-22 25-22h35v40h-30"
            stroke="#57a8f5"
            strokeWidth="30"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M123 109h38v34q0 22-25 22h-35v-40h30"
            stroke="#ffd151"
            strokeWidth="30"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="119" cy="57" r="4" fill="#162644" />
          <circle cx="122" cy="165" r="4" fill="#8e5b12" />
        </>
      ) : kind === "keyboard" ? (
        <>
          <rect x="35" y="67" width="170" height="106" rx="17" fill="#43318b" />
          <rect x="35" y="59" width="170" height="106" rx="17" fill={purple} />
          {[0, 1, 2].map((row) =>
            [0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={49 + col * 18}
                y={74 + row * 22}
                width="13"
                height="15"
                rx="3"
                fill={row === 1 && col > 2 && col < 6 ? "#92efce" : "#d9ccff"}
              />
            ))
          )}
          <rect x="84" y="142" width="72" height="12" rx="4" fill="#d9ccff" />
        </>
      ) : kind === "game" ? (
        <>
          <path
            d="M80 77h81q26 0 34 38l10 46q3 28-20 24l-29-28H84l-29 28q-24 5-21-24l11-46q9-38 35-38Z"
            fill={silver}
          />
          <path d="M75 102v37m-18-18h36" stroke="#554099" strokeWidth="11" strokeLinecap="round" />
          <circle cx="170" cy="112" r="8" fill="#a071ef" />
          <circle cx="152" cy="130" r="8" fill="#ee69a5" />
          <path d="M110 148h19" stroke="#b0a0d2" strokeWidth="5" strokeLinecap="round" />
        </>
      ) : kind === "code" ? (
        <>
          <rect x="42" y="47" width="156" height="131" rx="19" fill="#4b2c9a" />
          <rect x="42" y="39" width="156" height="131" rx="19" fill={purple} />
          <path d="M42 69h156" stroke="#ccb1ff" strokeOpacity=".4" strokeWidth="2" />
          <circle cx="58" cy="55" r="4" fill="#ffb9d6" />
          <circle cx="72" cy="55" r="4" fill="#ffe380" />
          <circle cx="86" cy="55" r="4" fill="#8df0cd" />
          <path
            d="m94 91-23 22 23 22m53-44 23 22-23 22m-17-52-17 61"
            stroke="white"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path d="m94 153-20 42 31-17 12 23 16-45" fill={gold} />
          <path d="M82 100q-36 18-32 59l40-13m59-46q36 18 32 59l-40-13" fill={purple} />
          <path d="M119 25q-49 38-40 117l15 19h48l16-19q10-79-39-117Z" fill={silver} />
          <path d="M119 25q-22 18-32 43h65q-10-25-33-43Z" fill={purple} />
          <circle cx="119" cy="105" r="25" fill="#b7a8f6" />
          <circle cx="119" cy="105" r="18" fill="#485ec7" />
          <path d="M108 98q7-11 17-6" stroke="#9be5ff" strokeWidth="6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
LearningArt.propTypes = {
  kind: PropTypes.string,
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export function LearnerHero({ eyebrow, title, description, art = "robot", children }) {
  const palette = useAppPalette();

  return (
    <MDBox
      className="learner-hero"
      sx={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        p: { xs: 1.5, sm: 1.75 },
        mb: 1.5,
        borderRadius: "16px",
        background: palette.heroBackground,
        border: `1px solid ${palette.heroBorder}`,
      }}
    >
      <MDBox sx={{ position: "relative", zIndex: 1, minWidth: 0, flex: 1 }}>
        {eyebrow && (
          <MDTypography
            variant="caption"
            sx={{
              color: palette.heroEyebrow,
              fontWeight: 800,
              fontSize: "0.6875rem",
              letterSpacing: ".09em",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </MDTypography>
        )}
        <MDTypography
          component="h2"
          variant="h3"
          sx={{
            color: palette.heroTitle,
            fontWeight: 800,
            mt: 0.25,
            fontSize: { xs: "1.15rem", sm: "1.35rem" },
            lineHeight: 1.25,
            letterSpacing: "-.03em",
          }}
        >
          {title}
        </MDTypography>
        {description && (
          <MDTypography
            variant="body2"
            sx={{
              color: palette.heroText,
              mt: 0.5,
              maxWidth: 560,
              fontSize: { xs: "0.78rem", sm: "0.83rem" },
              lineHeight: 1.45,
            }}
          >
            {description}
          </MDTypography>
        )}
        {children && (
          <MDBox mt={1} display="flex" alignItems="center" flexWrap="wrap" gap={0.75}>
            {children}
          </MDBox>
        )}
      </MDBox>
      <MDBox
        sx={{
          flexShrink: 0,
          width: { xs: 44, sm: 64, md: 78 },
          alignSelf: "center",
          "& svg": { width: "100%", height: "auto", display: "block" },
        }}
      >
        <LearningArt kind={art} />
      </MDBox>
    </MDBox>
  );
}
LearnerHero.propTypes = {
  eyebrow: PropTypes.string,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  art: PropTypes.string,
  children: PropTypes.node,
};

function DashboardIdentity({ user, title, subtitle }) {
  return (
    // The navbar above already carries the avatar, name and school - role line,
    // so this block stays a compact page heading rather than a second identity
    // card. Every dashboard renders it, so the height saved here is per page.
    <MDBox
      display="flex"
      alignItems="center"
      gap={{ xs: 1, sm: 1.25 }}
      minWidth={0}
      width={{ xs: "100%", sm: "auto" }}
    >
      <MDAvatar
        bgColor="info"
        size="sm"
        shadow="sm"
        sx={{ width: { xs: 24, sm: 26 }, height: { xs: 24, sm: 26 }, flexShrink: 0 }}
      >
        {getUserInitials(user)}
      </MDAvatar>
      <MDBox minWidth={0}>
        <MDTypography
          variant="h5"
          fontWeight="bold"
          sx={{ fontSize: { xs: "0.9375rem", sm: "1rem" }, lineHeight: 1.15 }}
        >
          {title}
        </MDTypography>
        <MDTypography
          variant="body2"
          color="text"
          sx={{ fontSize: { xs: "0.6875rem", sm: "0.75rem" }, lineHeight: 1.25 }}
        >
          {subtitle || `Welcome back, ${getUserDisplayName(user)} (${getRoleLabel(user?.role)})`}
        </MDTypography>
      </MDBox>
    </MDBox>
  );
}

DashboardIdentity.defaultProps = {
  subtitle: "",
};

DashboardIdentity.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string,
    fullName: PropTypes.string,
    full_name: PropTypes.string,
    role: PropTypes.string,
    username: PropTypes.string,
  }).isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
};

export default DashboardIdentity;
