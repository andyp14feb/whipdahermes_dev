from __future__ import annotations

import errno
import fcntl
import logging
import os
import pty
import select
import signal
import struct
import subprocess
import termios
import threading
import time

from capture.atch_capture import ATCH_TAIL_LINES, ATCH_TAIL_MAX_CHARS

logger = logging.getLogger(__name__)

ATCH_SESSION_ID_PREFIX = "atch:"

# Agent attach must not honor the default detach char (^\); browser Ctrl-\ would
# otherwise silently detach the live bridge while the session keeps running.
ATCH_ATTACH_ARGV = ("atch", "-E", "-q", "-r", "winch", "attach")


def atch_name_from_session_id(session_id: str) -> str:
    if session_id.startswith(ATCH_SESSION_ID_PREFIX):
        return session_id[len(ATCH_SESSION_ID_PREFIX) :]
    return session_id


def _set_winsize(fd: int, rows: int, cols: int) -> None:
    rows = max(5, min(int(rows), 200))
    cols = max(20, min(int(cols), 500))
    packed = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, packed)


class AtchLiveSession:
    """True Live for atch: attach under a PTY and bridge I/O + resize.

    Spawns ``atch -E -q -r winch attach <session>`` under a PTY (openpty+Popen) so the
    raw byte stream matches a human attach client. Snapshot for new viewers
    uses ``atch tail -n`` + ATCH_TAIL_MAX_CHARS (same as Non-Live capture) — attach replay streams via on_output
    on first connect.
    """

    def __init__(
        self,
        session_id: str,
        on_output,
        on_error,
        on_ready,
        on_snapshot,
        atch_bin: str = "atch",
    ) -> None:
        self.session_id = session_id
        self.on_output = on_output
        self.on_error = on_error
        self.on_ready = on_ready
        self.on_snapshot = on_snapshot
        self.atch_bin = atch_bin
        self.name = atch_name_from_session_id(session_id)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._master_fd: int | None = None
        self._child_pid: int | None = None
        self._proc: subprocess.Popen | None = None
        self._fd_lock = threading.Lock()
        self._cols = 80
        self._rows = 24

    def start(self) -> None:
        if not self.name:
            self.on_error(self.session_id, "invalid atch session id")
            return
        self._thread = threading.Thread(
            target=self._run, name=f"atch-live-{self.name}", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._close_master()
        self._reap_child(timeout=2.0)
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def send_input(self, data: str) -> None:
        if not data or self._stop.is_set():
            return
        raw = data.encode("utf-8", errors="replace")
        with self._fd_lock:
            fd = self._master_fd
            if fd is None:
                return
            try:
                os.write(fd, raw)
            except OSError as exc:
                logger.warning("atch PTY write failed session_id=%s: %s", self.session_id, exc)
                self.on_error(self.session_id, f"atch input failed: {exc}")

    def refresh_for_viewer(self) -> None:
        """Catch up a new viewer without restarting the attach PTY."""
        if self._stop.is_set():
            return
        snapshot = self._capture_tail_snapshot()
        if snapshot is not None:
            self.on_snapshot(self.session_id, snapshot)
        self.on_ready(self.session_id)

    def resize(self, cols: int, rows: int) -> None:
        cols = max(20, min(int(cols), 500))
        rows = max(5, min(int(rows), 200))
        self._cols = cols
        self._rows = rows
        with self._fd_lock:
            fd = self._master_fd
            if fd is None:
                return
            try:
                _set_winsize(fd, rows, cols)
            except OSError as exc:
                logger.debug(
                    "atch winsize failed session_id=%s cols=%s rows=%s: %s",
                    self.session_id,
                    cols,
                    rows,
                    exc,
                )

    def _run(self) -> None:
        slave_fd: int | None = None
        became_ready = False
        try:
            snapshot = self._capture_tail_snapshot()
            if snapshot is not None:
                self.on_snapshot(self.session_id, snapshot)

            # Prefer openpty+Popen over pty.fork: the machine-agent is already
            # multi-threaded (heartbeat/command/WS), and forkpty is unsafe there.
            master_fd, slave_fd = pty.openpty()
            try:
                _set_winsize(master_fd, self._rows, self._cols)
            except OSError:
                pass

            env = os.environ.copy()
            env.setdefault("TERM", "xterm-256color")
            argv = [self.atch_bin, *ATCH_ATTACH_ARGV[1:], self.name]
            try:
                proc = subprocess.Popen(
                    argv,
                    stdin=slave_fd,
                    stdout=slave_fd,
                    stderr=slave_fd,
                    env=env,
                    close_fds=True,
                    start_new_session=True,
                )
            except FileNotFoundError:
                os.close(master_fd)
                self.on_error(self.session_id, "atch binary not found")
                return
            except OSError as exc:
                os.close(master_fd)
                self.on_error(self.session_id, f"failed to spawn atch: {exc}")
                return
            finally:
                # Parent keeps master; child has its own slave fds.
                try:
                    os.close(slave_fd)
                except OSError:
                    pass
                slave_fd = None

            with self._fd_lock:
                self._child_pid = proc.pid
                self._master_fd = master_fd
                self._proc = proc

            flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
            fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

            self.on_ready(self.session_id)
            became_ready = True

            while not self._stop.is_set():
                try:
                    ready, _, _ = select.select([master_fd], [], [], 0.2)
                except (ValueError, OSError):
                    break
                if master_fd not in ready:
                    if self._child_exited():
                        break
                    continue
                try:
                    chunk = os.read(master_fd, 4096)
                except OSError as exc:
                    if exc.errno in (errno.EAGAIN, errno.EWOULDBLOCK):
                        continue
                    break
                if not chunk:
                    break
                self.on_output(
                    self.session_id,
                    chunk.decode("utf-8", errors="replace"),
                )
        except Exception as exc:
            logger.exception("atch live session failed session_id=%s", self.session_id)
            self.on_error(self.session_id, str(exc))
        finally:
            if slave_fd is not None:
                try:
                    os.close(slave_fd)
                except OSError:
                    pass
            self._close_master()
            self._reap_child(timeout=1.0)
            if became_ready and not self._stop.is_set():
                # Unexpected child exit while still subscribed.
                self.on_error(self.session_id, "atch attach ended")

    def _capture_tail_snapshot(self) -> str | None:
        try:
            result = subprocess.run(
                [self.atch_bin, "tail", "-n", str(ATCH_TAIL_LINES), self.name],
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
            raw = result.stdout or ""
            if len(raw) > ATCH_TAIL_MAX_CHARS:
                raw = raw[-ATCH_TAIL_MAX_CHARS:]
            return raw
        except FileNotFoundError:
            self.on_error(self.session_id, "atch binary not found")
            return None
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            logger.warning("atch tail failed session_id=%s: %s", self.session_id, exc)
            return None

    def _child_exited(self) -> bool:
        proc = self._proc
        if proc is not None:
            return proc.poll() is not None
        pid = self._child_pid
        if pid is None:
            return True
        try:
            waited, _ = os.waitpid(pid, os.WNOHANG)
            return waited == pid
        except ChildProcessError:
            return True

    def _close_master(self) -> None:
        with self._fd_lock:
            fd = self._master_fd
            self._master_fd = None
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                pass

    def _reap_child(self, timeout: float) -> None:
        proc = self._proc
        if proc is not None:
            if proc.poll() is None:
                try:
                    proc.send_signal(signal.SIGTERM)
                except OSError:
                    pass
                try:
                    proc.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    try:
                        proc.kill()
                    except OSError:
                        pass
                    try:
                        proc.wait(timeout=1)
                    except subprocess.TimeoutExpired:
                        pass
            self._proc = None
            self._child_pid = None
            return

        pid = self._child_pid
        if pid is None:
            return
        deadline = time.monotonic() + timeout
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass
        while time.monotonic() < deadline:
            try:
                waited, _ = os.waitpid(pid, os.WNOHANG)
                if waited == pid:
                    self._child_pid = None
                    return
            except ChildProcessError:
                self._child_pid = None
                return
            time.sleep(0.05)
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass
        try:
            os.waitpid(pid, 0)
        except ChildProcessError:
            pass
        self._child_pid = None
