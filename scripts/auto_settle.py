"""Auto-settle and synchronize predictions and fight results.

Run automatically or manually on fight night/Sundays:
    python -m scripts.auto_settle
"""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.auto_settle_service import sync_and_settle


def main():
    print("[info] Running automatic prediction settlement & sync...")
    res = sync_and_settle()
    print(f"[success] Status: {res['status']}")
    print(f"[info] Settled: {res['settled_count']} new fight(s)")
    print(f"[info] Logged: {res['new_logged_count']} new upcoming pick(s)")
    print(f"[info] Total resolved: {res['total_resolved']} | Accuracy: {res['accuracy']}")
    print(f"[info] Pending picks: {res['pending']}")
    print(f"[message] {res['message']}")


if __name__ == "__main__":
    main()
