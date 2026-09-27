"""Main package for the UFC fight winner prediction project."""

import os


# Avoid loky warnings on some Windows installations without `wmic`.
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")
