/**
 * The Python the runner itself installs into Pyodide (never the learner's).
 *
 * IMPORT_GUARD_PY turns imports that cannot work in a browser into one plain
 * sentence instead of a traceback. PLOTS_PY makes matplotlib draw into
 * pictures: plt.show(), figures still open at the end, and animations come
 * back as PNG/GIF data URLs.
 */

// Imports the safe runner never allows, from anywhere: browser and package
// bridges. The custom jsglobals object and the runner CSP are the real
// boundaries; this is an extra, learner-friendly failure mode.
export const ALWAYS_BLOCKED_IMPORTS = ["js", "pyodide_js", "micropip", "pyodide.http"];

// Imports that only fail when the learner's own code makes them, with the
// reason in plain words. Libraries may still use these internally (pandas
// imports urllib.request, for example), so they are not blocked for them.
const WINDOW =
  "{name} opens a desktop window, and Python here runs inside a web page, which " +
  "cannot open windows. Use print() and input() to talk to the user, or matplotlib " +
  "to draw a picture (plt.show() puts it under your output).";
const NETWORK =
  "{name} connects to the internet, and Python here is kept offline to keep everyone " +
  "safe. Put the data your program needs straight into the code, for example as a " +
  "list or a dictionary.";
export const EXPLAINED_IMPORTS = {
  tkinter: WINDOW,
  _tkinter: WINDOW,
  turtle:
    "turtle draws in a desktop window, and Python here runs inside a web page, which " +
    "cannot open windows. Try matplotlib instead: draw with plt.plot(...) and " +
    "plt.show() puts the picture under your output.",
  pygame:
    "pygame opens a game window, and Python here runs inside a web page, which cannot " +
    "open windows. Games in this course use print() and input(), or matplotlib for " +
    "pictures and animations.",
  easygui: WINDOW,
  PySimpleGUI: WINDOW,
  pyautogui: "{name} controls the mouse and keyboard of a desktop computer, which Python inside a web page cannot do.",
  pynput: "{name} reads the keyboard and mouse of a desktop computer, which Python inside a web page cannot do. Use input() to ask the user instead.",
  keyboard: "{name} reads the keyboard of a desktop computer, which Python inside a web page cannot do. Use input() to ask the user instead.",
  wx: WINDOW,
  PyQt5: WINDOW,
  PyQt6: WINDOW,
  PySide6: WINDOW,
  kivy: WINDOW,
  requests: NETWORK,
  urllib3: NETWORK,
  httpx: NETWORK,
  aiohttp: NETWORK,
  socket: NETWORK,
  websockets: NETWORK,
  ftplib: NETWORK,
  smtplib: NETWORK,
  "urllib.request": NETWORK,
  "http.client": NETWORK,
  webbrowser: "webbrowser opens other web pages, which Python here is not allowed to do.",
  pip:
    "Nothing needs installing here: libraries load by themselves when you import " +
    "them (for example import numpy).",
  micropip:
    "Nothing needs installing here: libraries load by themselves when you import " +
    "them (for example import numpy).",
};

export function importGuardPython() {
  return `
import builtins

def _educlub_make_import_guard(original_import, blocked, explained):
    def explain(name, root):
        if name in explained:
            return explained[name].replace("{name}", name)
        if root in explained:
            return explained[root].replace("{name}", root)
        return None

    def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
        if level == 0:
            root = name.split(".", 1)[0]
            if root in blocked or name in blocked or any(name.startswith(b + ".") for b in blocked):
                message = explain(name, root) or f"{name} is unavailable in the safe eduClub runner"
                raise ModuleNotFoundError("[educlub] " + message, name=name)
            if globals is not None and globals.get("__name__") == "__main__":
                message = explain(name, root)
                if message is None:
                    for item in fromlist or ():
                        message = explained.get(f"{name}.{item}")
                        if message:
                            message = message.replace("{name}", f"{name}.{item}")
                            break
                if message is not None:
                    raise ModuleNotFoundError("[educlub] " + message, name=name)
        return original_import(name, globals, locals, fromlist, level)
    return guarded_import

builtins.__import__ = _educlub_make_import_guard(
    builtins.__import__,
    frozenset(${JSON.stringify(ALWAYS_BLOCKED_IMPORTS)}),
    ${JSON.stringify(EXPLAINED_IMPORTS)},
)
del _educlub_make_import_guard
`;
}

/** Names the runner never downloads, whatever the learner imports. */
export const NEVER_LOADED_IMPORTS = new Set([
  ...ALWAYS_BLOCKED_IMPORTS.map((name) => name.split(".")[0]),
  ...Object.keys(EXPLAINED_IMPORTS).map((name) => name.split(".")[0]),
]);

export const PLOT_LIMITS = Object.freeze({
  maxImages: 8,
  maxStaticPixels: 1_600_000,
  maxImageLength: 2_500_000,
  maxAnimations: 2,
  maxGifFrames: 48,
  maxFrameUpdates: 720,
  maxAnimationSide: 360,
  maxGifLength: 5_900_000,
  animationSeconds: 8,
});

// The module is called _educlub_runtime. Learner code could import it, but
// all it can do is draw pictures: it holds no bridge to JavaScript.
export function runtimePython() {
  return `
import sys, types

_source = r'''
import base64, io, itertools, json, math, sys, time

LIMITS = ${JSON.stringify(PLOT_LIMITS)}

_images = []
_notes = []
_animations = []
_pending = []
_installed = False
_warmed = False


def preimport(names):
    """Import libraries before the learner's program starts its 3-second clock."""
    import importlib
    for name in names:
        try:
            importlib.import_module(name)
        except Exception:
            pass  # the learner's own run reports any real problem
    if "matplotlib" in sys.modules:
        _install()


def _note(text):
    if text not in _notes:
        _notes.append(text)


def _install():
    global _installed, _warmed
    if _installed:
        return
    import matplotlib
    matplotlib.use("Agg", force=True)
    import matplotlib.pyplot as plt
    import matplotlib.animation as animation

    plt.show = show
    original_init = animation.Animation.__init__

    def init(self, fig, *args, **kwargs):
        original_init(self, fig, *args, **kwargs)
        _animations.append(self)

    animation.Animation.__init__ = init

    def save(self, filename=None, *args, **kwargs):
        # A browser cannot keep the file, so the animation is shown instead.
        _note("Animations are shown below your output instead of being saved as a file.")
        _queue_animation(self._fig, self)

    animation.Animation.save = save
    _installed = True
    if not _warmed:
        # The first drawing loads fonts; do it now, not on the learner's clock.
        fig = plt.figure(figsize=(1, 1))
        fig.text(0.5, 0.5, "0")
        fig.canvas.draw()
        plt.close(fig)
        _warmed = True


def begin():
    """A fresh start for each run: no figures left over from the last one."""
    _images.clear()
    _notes.clear()
    _animations.clear()
    _pending.clear()
    if _installed:
        import matplotlib.pyplot as plt
        plt.close("all")


def _data_url(raw, mime):
    return f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")


def _add(item, limit):
    if len(_images) >= LIMITS["maxImages"]:
        _note(f"Only the first {LIMITS['maxImages']} charts are shown.")
        return
    if len(item["src"]) > limit:
        _note("A chart was too big to show. Try a smaller figure size.")
        return
    _images.append(item)


def _png(fig):
    width, height = fig.get_size_inches()
    dpi = fig.dpi
    area = max(width * height, 0.01)
    if area * dpi * dpi > LIMITS["maxStaticPixels"]:
        dpi = math.sqrt(LIMITS["maxStaticPixels"] / area)
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=dpi)
    return buffer.getvalue()


def _animation_for(fig):
    for anim in _animations:
        if getattr(anim, "_fig", None) is fig:
            return anim
    return None


def _queue_animation(fig, anim):
    if any(queued is anim for _, queued in _pending):
        return
    if len(_pending) >= LIMITS["maxAnimations"]:
        _note(f"Only the first {LIMITS['maxAnimations']} animations are shown.")
        return
    _pending.append((fig, anim))


def show(*args, **kwargs):
    """plt.show(): every open figure becomes a picture under the output."""
    import matplotlib.pyplot as plt
    from matplotlib._pylab_helpers import Gcf
    for manager in list(Gcf.get_all_fig_managers()):
        fig = manager.canvas.figure
        anim = _animation_for(fig)
        if anim is not None:
            _queue_animation(fig, anim)
        else:
            try:
                _add({"kind": "image", "src": _data_url(_png(fig), "image/png")}, LIMITS["maxImageLength"])
            except Exception as error:
                _note(f"A chart could not be drawn: {error}")
        plt.close(fig)


def needs_drawing():
    if not _installed:
        return False
    from matplotlib._pylab_helpers import Gcf
    return bool(_pending) or bool(Gcf.get_all_fig_managers())


def _render_animation(fig, anim):
    import numpy as np
    from PIL import Image
    from matplotlib import cbook

    try:
        fig.canvas.mpl_disconnect(anim._first_draw_id)
    except Exception:
        pass
    anim._draw_was_started = True  # no "deleted without rendering" warning

    frames_data = list(itertools.islice(anim.new_saved_frame_seq(), LIMITS["maxFrameUpdates"] + 1))
    too_many = len(frames_data) > LIMITS["maxFrameUpdates"]
    frames_data = frames_data[: LIMITS["maxFrameUpdates"]]
    total = len(frames_data)
    if not total:
        return
    # Every frame is computed (so animations that build on the last frame stay
    # right), but only every step-th one becomes a picture.
    step = max(1, math.ceil(total / LIMITS["maxGifFrames"]))
    width, height = fig.get_size_inches()
    fig.set_dpi(min(fig.dpi, LIMITS["maxAnimationSide"] / max(width, height, 0.01)))

    pictures = []
    computed = 0
    deadline = time.monotonic() + LIMITS["animationSeconds"]
    with cbook._setattr_cm(fig.canvas, _is_saving=True, manager=None):
        anim._init_draw()
        for index, data in enumerate(frames_data):
            if time.monotonic() > deadline:
                break
            anim._draw_frame(data)
            computed = index + 1
            if index % step:
                continue
            fig.canvas.draw()
            rgba = np.asarray(fig.canvas.buffer_rgba())
            pictures.append(Image.fromarray(rgba[:, :, :3].copy()))
    if not pictures:
        return
    interval = getattr(anim, "_interval", 100) or 100
    buffer = io.BytesIO()
    pictures[0].save(
        buffer,
        format="GIF",
        save_all=True,
        append_images=pictures[1:],
        duration=max(20, int(interval * step)),
        loop=0,
    )
    note = ""
    if computed < total:
        note = f"This animation was cut short: drawing it took too long, so {computed} of {total} frames are shown."
    elif too_many:
        note = f"This animation was cut short: only the first {total} frames are shown."
    _add({"kind": "animation", "src": _data_url(buffer.getvalue(), "image/gif"), "note": note}, LIMITS["maxGifLength"])


def finish():
    """Figures still open become pictures; queued animations are drawn."""
    if _installed:
        show()
        for fig, anim in list(_pending):
            try:
                _render_animation(fig, anim)
            except Exception as error:
                _note(f"The animation stopped while drawing a frame: {type(error).__name__}: {error}")
        _pending.clear()
        _animations.clear()
    result = json.dumps({"images": _images, "notes": _notes})
    _images.clear()
    _notes.clear()
    return result
'''

_module = types.ModuleType("_educlub_runtime")
exec(compile(_source, "_educlub_runtime.py", "exec"), _module.__dict__)
sys.modules["_educlub_runtime"] = _module
del _module, _source
`;
}
