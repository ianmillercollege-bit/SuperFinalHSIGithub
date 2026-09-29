"""The only place allowed to call the AI provider (BACKEND_CONTRACT.md section 3).

Live AI (claim extraction and answer drafting) is the optional 2:30 AM milestone and is not
wired in yet. Until it is, every response is built from seeded data and plain code:
  MOCK_MODE=true  -> "source": "mock"
  MOCK_MODE=false -> "source": "fallback" (live AI requested but unavailable, seeded data used)
"""

from settings import settings


def source_label() -> str:
    return "mock" if settings.mock_mode else "fallback"
