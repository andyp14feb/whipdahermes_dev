from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import threading
import time
from pathlib import Path

from capture.tmux_command import build_tmux_command

logger = logging.getLogger(__name__)

ATCH_SESSION_ID_PREFIX = "atch:"
TMUX_SESSION_ID_PREFIX = "tmux:"


def tmux_target_from_session_id(session_id: str) -> str:
    if session_id.startswith(TMUX_SESSION_ID_PREFIX):
        return session_id[len(TMUX_SESSION_ID_PREFIX) :]
    return session_id


def is_atch_session(session_id: str) -> bool:
    return session_id.startswith(ATCH_SESSION_ID_PREFIX)


class TmuxLiveSession:
    """Stream one tmux pane (pipe-pane file + capture poll); inject keys via send-keys -l."""

    def __init__(
        self,
        session_id: str,
        tmux_socket: str | None,
        on_output,
        on_error,
        on_ready,
        on_snapshot,
    ) -> None:
        self.session_id = session_id
        self.tmux_socket = tmux_socket
        self.on_output = on_output
        self.on_error = on_error
        self.on_ready = on_ready
        self.on_snapshot = on_snapshot
        self.target = tmux_target_from_session_id(session_id)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._stream_path: str | None = None
        self._tmpdir: str | None = None

    def start(self) -> None:
        if is_atch_session(self.session_id):
            # Atch Live is handled by AtchLiveSession; this class is tmux-only.
            self.on_error(
                self.session_id,
                "TmuxLiveSession cannot attach atch sessions; use AtchLiveSession.",
            )
            return
        self._thread = threading.Thread(
            target=self._run, name=f"tmux-live-{self.target}", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._disable_pipe_pane()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)
        self._cleanup_files()

    def send_input(self, data: str) -> None:
        if not data or self._stop.is_set():
            return
        try:
            subprocess.run(
                build_tmux_command(
                    ["send-keys", "-t", self.target, "-l", "--", data],
                    self.tmux_socket,
                ),
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as exc:
            logger.warning("send-keys failed session_id=%s: %s", self.session_id, exc)
            self.on_error(self.session_id, f"send-keys failed: {exc}")

    def refresh_for_viewer(self) -> None:
        """Re-emit snapshot + ready so a new viewer can catch up without restarting pipe-pane."""
        if self._stop.is_set():
            return
        snapshot = self._capture_snapshot()
        if snapshot is not None:
            self.on_snapshot(self.session_id, snapshot)
        self.on_ready(self.session_id)

    def resize(self, cols: int, rows: int) -> None:
        """Resize tmux window then pane so cols/rows can actually apply."""
        cols = max(20, min(int(cols), 500))
        rows = max(5, min(int(rows), 200))
        # Window resize first: a constrained layout may ignore pane-only resize.
        commands = (
            ["resize-window", "-t", self.target, "-x", str(cols), "-y", str(rows)],
            ["resize-pane", "-t", self.target, "-x", str(cols), "-y", str(rows)],
        )
        for argv in commands:
            try:
                subprocess.run(
                    build_tmux_command(argv, self.tmux_socket),
                    capture_output=True,
                    text=True,
                    check=True,
                    timeout=5,
                )
            except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as exc:
                logger.debug(
                    "%s failed session_id=%s cols=%s rows=%s: %s",
                    argv[0],
                    self.session_id,
                    cols,
                    rows,
                    exc,
                )

    def _run(self) -> None:
        try:
            snapshot = self._capture_snapshot()
            if snapshot is not None:
                self.on_snapshot(self.session_id, snapshot)

            self._tmpdir = tempfile.mkdtemp(prefix="whipai-term-")
            self._stream_path = str(Path(self._tmpdir) / "pane.stream")
            Path(self._stream_path).write_bytes(b"")

            self._enable_pipe_pane(self._stream_path)
            self.on_ready(self.session_id)

            offset = 0
            last_poll = 0.0
            last_text = snapshot or ""

            while not self._stop.is_set():
                try:
                    with open(self._stream_path, "rb") as handle:
                        handle.seek(offset)
                        chunk = handle.read()
                        if chunk:
                            offset = handle.tell()
                            self.on_output(
                                self.session_id,
                                chunk.decode("utf-8", errors="replace"),
                            )
                except OSError as exc:
                    logger.debug("stream read error session_id=%s: %s", self.session_id, exc)

                now = time.monotonic()
                if now - last_poll >= 0.5:
                    last_poll = now
                    text = self._capture_snapshot()
                    if text is not None and text != last_text:
                        self.on_snapshot(self.session_id, text)
                        last_text = text

                time.sleep(0.05)
        except Exception as exc:
            logger.exception("tmux live session failed session_id=%s", self.session_id)
            self.on_error(self.session_id, str(exc))
        finally:
            self._disable_pipe_pane()
            self._cleanup_files()

    def _cleanup_files(self) -> None:
        if self._stream_path:
            try:
                os.unlink(self._stream_path)
            except OSError:
                pass
            self._stream_path = None
        if self._tmpdir:
            try:
                os.rmdir(self._tmpdir)
            except OSError:
                pass
            self._tmpdir = None

    def _capture_snapshot(self) -> str | None:
        try:
            result = subprocess.run(
                build_tmux_command(
                    ["capture-pane", "-t", self.target, "-e", "-p"],
                    self.tmux_socket,
                ),
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
            return result.stdout
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as exc:
            logger.warning("capture-pane failed session_id=%s: %s", self.session_id, exc)
            return None

    def _enable_pipe_pane(self, stream_path: str) -> None:
        # Quote path for the shell fragment tmux runs.
        quoted = stream_path.replace("'", "'\\''")
        cmd = build_tmux_command(
            ["pipe-pane", "-t", self.target, "-o", f"cat >> '{quoted}'"],
            self.tmux_socket,
        )
        subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=5)

    def _disable_pipe_pane(self) -> None:
        try:
            subprocess.run(
                build_tmux_command(["pipe-pane", "-t", self.target], self.tmux_socket),
                capture_output=True,
                text=True,
                check=False,
                timeout=5,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
