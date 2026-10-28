"""Disposable morning fixture for manual browser QA. Run from the project root.

Uses localhost:5001 (separate from the main 127.0.0.1 cookie). Ctrl+C cleans up.
Never reads or writes the project's runtime database.
"""
import sys
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app, now


if __name__ == "__main__":
    morning = now().replace(hour=9, minute=20, second=0)
    with tempfile.TemporaryDirectory(prefix="tidy-browser-qa-") as folder, patch("app.now", return_value=morning):
        app = create_app({"DATABASE": str(Path(folder) / "fixture.db"), "SECRET_KEY": "browser-fixture-only"})
        client = app.test_client()
        token = client.get("/api/session").json["csrf_token"]
        result = client.post("/api/login", json={"email": "pradyun@vit.ac.in", "password": "pass123"}, headers={"X-CSRF-Token": token})
        token = result.json["csrf_token"]
        result = client.post("/api/book", json={"type_id": 1, "scheduled_start_time": (morning + timedelta(days=1)).replace(hour=10, minute=0).isoformat(), "notes": "Disposable browser QA request; use the explicit staff presentation start."}, headers={"X-CSRF-Token": token})
        assert result.status_code == 201, result.json
        print("Disposable morning QA at http://localhost:5001. Student and staff demo buttons are available.", flush=True)
        app.run(host="127.0.0.1", port=5001, debug=False)
