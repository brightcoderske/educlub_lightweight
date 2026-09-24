import { Component } from "react";
import PropTypes from "prop-types";

import { isMissingFileError, reloadForNewVersion } from "lib/staleBuild";

// Plain elements and inline styles, on purpose: this is what shows when something
// in the app has failed, and it must not depend on the theme or on any component
// that might be the thing that failed.
const styles = {
  wrap: {
    maxWidth: "28rem",
    margin: "20vh auto 0",
    padding: "0 1.25rem",
    textAlign: "center",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#17324d",
  },
  title: { fontSize: "1.4rem", margin: "0 0 0.75rem" },
  text: { fontSize: "1rem", lineHeight: 1.6, margin: "0 0 1.25rem" },
  button: {
    padding: "0.7rem 1.6rem",
    border: 0,
    borderRadius: "0.5rem",
    background: "#1a73e8",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
  },
  details: { marginTop: "1.5rem", fontSize: "0.85rem", color: "#4b5563", textAlign: "left" },
  message: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
};

function Failure({ error, onReload }) {
  const updated = isMissingFileError(error);

  return (
    <div role="alert" style={styles.wrap}>
      <h1 style={styles.title}>
        {updated ? "eduClub has just been updated" : "This page did not load properly"}
      </h1>
      <p style={styles.text}>
        {updated
          ? "Reload to open the new version."
          : "Reloading usually fixes it. If it keeps happening, tell your school admin or eduClub support."}
      </p>
      <button type="button" style={styles.button} onClick={onReload}>
        Reload page
      </button>
      {!updated && (
        <details style={styles.details}>
          <summary>Technical details</summary>
          <pre style={styles.message}>{String(error?.message ?? error)}</pre>
        </details>
      )}
    </div>
  );
}

Failure.propTypes = {
  error: PropTypes.any,
  onReload: PropTypes.func.isRequired,
};

/**
 * Keeps a screen that fails from taking the whole page with it. Without one, an
 * error while drawing anything unmounts everything and the person is left with a
 * blank page and no way forward but to reload.
 *
 * A screen whose files were replaced by a new release is loaded again once, without
 * asking. Anything else is shown, with the way out, and the failure is cleared when
 * `resetKey` changes, so moving to another screen tries it afresh.
 */
class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (isMissingFileError(error) && reloadForNewVersion()) return;
    console.error("A page could not be shown:", error, info?.componentStack);
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <Failure error={error} onReload={this.props.onReload} />;
  }
}

AppErrorBoundary.propTypes = {
  children: PropTypes.node,
  resetKey: PropTypes.any,
  onReload: PropTypes.func,
};

AppErrorBoundary.defaultProps = {
  onReload: () => window.location.reload(),
};

export default AppErrorBoundary;
