// Keeps a learner's work in progress safe: an instant copy in this browser on
// every change, an autosave to the server shortly after they stop typing, and
// the work put back in the editor when the activity is opened again, on any
// device, after signing out or after the session expires.
import { useEffect, useRef, useState } from "react";
import API_BASE_URL from "lib/apiBase";
import { apiClient } from "lib/api";
import { registerPendingWork } from "lib/pendingWork";

export const DRAFT_ACTIVITY_TYPES = ["coding", "assignment", "project", "reflection"];
const FIELDS = ["code", "html", "css", "js", "input", "text"];
const IDLE_SAVE_MS = 3000;
const MAX_UNSAVED_MS = 15000;
const RETRY_MS = 15000;
// Browsers refuse keepalive requests over 64KB; larger work still has its
// copy in this browser and uploads next time.
const KEEPALIVE_LIMIT = 60 * 1024;

export function draftStorageKey(learnerId, activityId) {
  return `educlub-draft:${learnerId}:${activityId}`;
}

// Storage can be blocked or full (private windows, shared school machines);
// the server copy still works without it.
export function readLocalDraft(learnerId, activityId, storage = window.localStorage) {
  try {
    const stored = JSON.parse(storage.getItem(draftStorageKey(learnerId, activityId)) || "null");
    return stored && typeof stored.content === "object" ? stored : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(learnerId, activityId, record, storage = window.localStorage) {
  try {
    storage.setItem(draftStorageKey(learnerId, activityId), JSON.stringify(record));
  } catch {
    // Server autosave still runs.
  }
}

function removeLocalDraft(learnerId, activityId, storage = window.localStorage) {
  try {
    storage.removeItem(draftStorageKey(learnerId, activityId));
  } catch {
    // Nothing to clean up.
  }
}

export function pickFields(content = {}) {
  return Object.fromEntries(
    FIELDS.filter((field) => typeof content[field] === "string").map((field) => [
      field,
      content[field],
    ])
  );
}

export function sameWork(left = {}, right = {}) {
  return FIELDS.every((field) => (left[field] ?? "") === (right[field] ?? ""));
}

/** A submission made before drafts existed, in the shape the editors use. */
export function submissionToWork(content = {}, activityType) {
  if (activityType !== "coding") return pickFields({ text: content.text });
  return pickFields({ code: content.text, html: content.html, css: content.css, js: content.js });
}

/**
 * Which saved work to open with. A copy in this browser wins only when it was
 * built on the newest server draft and never reached the server - for example
 * when the session expired or the connection dropped mid-lesson. Otherwise the
 * server draft wins, then the last submission.
 */
export function chooseRestoredWork({ local, draft, submission, activityType }) {
  const serverRevision = Number(draft?.revision || 0);
  if (local && Number(local.baseRevision || 0) >= serverRevision) {
    return {
      work: pickFields(local.content),
      revision: serverRevision,
      source: "device",
      unsent: true,
    };
  }
  if (draft) return { work: pickFields(draft.content), revision: serverRevision, source: "draft" };
  if (submission) {
    return {
      work: submissionToWork(submission.content, activityType),
      revision: 0,
      source: "submission",
    };
  }
  return null;
}

function sendOnPageExit(activityId, content, revision) {
  const body = JSON.stringify({ content, base_revision: revision });
  if (body.length > KEEPALIVE_LIMIT) return;
  try {
    fetch(`${API_BASE_URL}/courses/activities/${activityId}/draft`, {
      method: "PUT",
      keepalive: true,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body,
    }).catch(() => {});
  } catch {
    // The copy in this browser is restored on the next visit.
  }
}

/**
 * `work` is what the editors hold now and `starter` what a fresh activity
 * starts with; `applyWork` puts restored work into the editors.
 */
export function useActivityDraft({
  activityId,
  activityType,
  learnerId,
  enabled,
  work,
  starter,
  applyWork,
}) {
  const [status, setStatus] = useState({ state: "idle" });
  const session = useRef(null);
  const workRef = useRef(work);
  const applyRef = useRef(applyWork);
  workRef.current = work;
  applyRef.current = applyWork;

  const active = Boolean(
    enabled && activityId && learnerId && DRAFT_ACTIVITY_TYPES.includes(activityType)
  );

  const save = async (current) => {
    if (!current || current.conflict || !current.loaded) return;
    window.clearTimeout(current.timer);
    if (current.inFlight) {
      current.again = true;
      return current.inFlight;
    }
    const content = current.closed ? current.closingWork : pickFields(workRef.current);
    if (sameWork(content, current.lastSaved)) return;

    if (!current.closed) setStatus({ state: "saving" });
    current.inFlight = apiClient
      .put(`/courses/activities/${current.activityId}/draft`, {
        content,
        base_revision: current.revision,
      })
      .then((saved) => {
        current.revision = saved.revision;
        current.lastSaved = content;
        current.dirtySince = 0;
        const latest = current.closed ? current.closingWork : pickFields(workRef.current);
        if (sameWork(latest, content)) removeLocalDraft(current.learnerId, current.activityId);
        else
          writeLocalDraft(current.learnerId, current.activityId, {
            content: latest,
            baseRevision: saved.revision,
          });
        if (!current.closed) setStatus({ state: "saved", at: saved.updated_at });
      })
      .catch((error) => {
        if (current.closed) return;
        if (error.status === 409) {
          current.conflict = error.payload?.draft || null;
          setStatus({ state: "conflict" });
          return;
        }
        if (error.status === 413) {
          setStatus({ state: "error", message: error.message });
          return;
        }
        setStatus({ state: "offline", message: error.message });
        current.timer = window.setTimeout(() => save(current), RETRY_MS);
      })
      .finally(() => {
        current.inFlight = null;
        if (current.again && !current.conflict) {
          current.again = false;
          save(current);
        }
      });
    return current.inFlight;
  };

  // Load saved work whenever a different activity opens.
  useEffect(() => {
    if (!active) {
      setStatus({ state: "idle" });
      return undefined;
    }
    const current = {
      activityId,
      learnerId,
      loaded: false,
      revision: 0,
      lastSaved: pickFields(starter),
      dirtySince: 0,
      timer: null,
      inFlight: null,
      conflict: null,
      closed: false,
    };
    session.current = current;
    setStatus({ state: "loading" });

    const local = readLocalDraft(learnerId, activityId);
    const restore = (chosen) => {
      // Never replace anything the learner typed while this was loading.
      if (chosen && sameWork(pickFields(workRef.current), pickFields(starter))) {
        applyRef.current(chosen.work);
      }
    };

    apiClient
      .get(`/courses/activities/${activityId}/work`)
      .then(({ draft, submission }) => {
        if (session.current !== current) return;
        const chosen = chooseRestoredWork({ local, draft, submission, activityType });
        current.revision = Number(draft?.revision || 0);
        current.lastSaved = draft ? pickFields(draft.content) : pickFields(starter);
        current.loaded = true;
        restore(chosen);
        setStatus(chosen ? { state: "restored", source: chosen.source } : { state: "saved" });
        if (chosen?.unsent) save(current);
      })
      .catch((error) => {
        if (session.current !== current) return;
        current.revision = Number(local?.baseRevision || 0);
        current.loaded = true;
        if (local) restore({ work: pickFields(local.content) });
        setStatus({ state: "offline", message: error.message });
        current.timer = window.setTimeout(() => save(current), RETRY_MS);
      });

    const flush = () => save(current);
    const unregister = registerPendingWork(flush);
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onPageHide = () => {
      if (
        current.loaded &&
        !current.conflict &&
        !sameWork(pickFields(workRef.current), current.lastSaved)
      ) {
        sendOnPageExit(activityId, pickFields(workRef.current), current.revision);
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      unregister();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      // Moving to another activity: send what this one holds now. The editors
      // are about to be reset, so the work is captured before that happens.
      current.closingWork = pickFields(workRef.current);
      current.closed = true;
      save(current);
    };
  }, [active, activityId, learnerId]);

  // Every change: copy to this browser at once, autosave once typing pauses,
  // and never leave work unsent for more than MAX_UNSAVED_MS.
  const workKey = JSON.stringify(pickFields(work));
  useEffect(() => {
    const current = session.current;
    if (!active || !current?.loaded || current.closed || current.activityId !== activityId) return;
    const content = pickFields(work);
    if (sameWork(content, current.lastSaved)) return;

    writeLocalDraft(learnerId, activityId, {
      content,
      baseRevision: current.revision,
      savedAt: Date.now(),
    });
    if (current.conflict) return;
    if (!current.dirtySince) current.dirtySince = Date.now();
    setStatus((previous) => (previous.state === "offline" ? previous : { state: "unsaved" }));
    window.clearTimeout(current.timer);
    const overdue = Date.now() - current.dirtySince >= MAX_UNSAVED_MS;
    current.timer = window.setTimeout(() => save(current), overdue ? 0 : IDLE_SAVE_MS);
  }, [workKey]);

  // Another tab or device saved newer work: take it, replacing this tab's copy.
  const loadNewest = () => {
    const current = session.current;
    if (!current?.conflict) return;
    const newest = current.conflict;
    current.revision = Number(newest.revision || 0);
    current.lastSaved = pickFields(newest.content);
    current.conflict = null;
    removeLocalDraft(learnerId, activityId);
    applyRef.current(pickFields(newest.content));
    setStatus({ state: "restored", source: "draft" });
  };

  // Keep this tab's work instead, saving it over the newer copy.
  const keepMine = () => {
    const current = session.current;
    if (!current?.conflict) return;
    current.revision = Number(current.conflict.revision || 0);
    current.conflict = null;
    save(current);
  };

  return { status, loadNewest, keepMine };
}
