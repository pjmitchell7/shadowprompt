"""Accept colored preview startup and reject an unrelated ready server."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
from pathlib import Path
import tempfile
import threading

import pytest


SPEC = importlib.util.spec_from_file_location(
    "shadowprompt_console_browser_test",
    Path(__file__).resolve().parents[1] / "tests-browser" / "console_test.py",
)
CONSOLE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CONSOLE)


class ReadyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"old preview")

    def log_message(self, *_args):
        pass


class FailedPreview:
    def __init__(self):
        self.polls = 0

    def poll(self):
        self.polls += 1
        return None if self.polls < 3 else 1


class RunningPreview:
    def poll(self):
        return None


@pytest.mark.parametrize("colored", [False, True])
def test_ready_preview_with_plain_or_ci_colored_startup(colored):
    server = ThreadingHTTPServer(("127.0.0.1", 0), ReadyHandler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    port = str(server.server_address[1])
    url = f"http://127.0.0.1:{port}/shadowprompt/"
    # Vite bolds Local and the port separately when CI enables colors.
    startup = (
        f"  \x1b[1mLocal\x1b[22m:   \x1b[36mhttp://127.0.0.1:"
        f"\x1b[1m{port}\x1b[22m/shadowprompt/\x1b[39m\n"
        if colored else f"  Local:   {url}\n"
    )
    try:
        with tempfile.TemporaryFile() as log:
            log.write(startup.encode("utf-8"))
            log.flush()
            CONSOLE.wait_for_server(url, RunningPreview(), log, port)
    finally:
        server.shutdown()
        worker.join(timeout=2)
        server.server_close()


def test_ready_old_server_cannot_satisfy_failed_preview():
    server = ThreadingHTTPServer(("127.0.0.1", 0), ReadyHandler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    port = str(server.server_address[1])
    try:
        with tempfile.TemporaryFile() as log:
            with pytest.raises(RuntimeError, match="exited before becoming ready"):
                CONSOLE.wait_for_server(
                    f"http://127.0.0.1:{port}/shadowprompt/",
                    FailedPreview(), log, port,
                )
    finally:
        server.shutdown()
        worker.join(timeout=2)
        server.server_close()

