"""Reject a ready response from an unrelated server when preview startup fails."""
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

