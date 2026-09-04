from __future__ import annotations

from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
WORKER_PATH = ROOT / "ops" / "cloudflare" / "agent-readiness-monitor" / "worker.js"


def _extract_success_exec_block() -> str:
    text = WORKER_PATH.read_text(encoding="utf-8")
    start = text.index("async function writeSuccess")
    insert_start = text.index("`INSERT INTO agent_readiness_results (", start)
    block_end = text.index("  );", insert_start)
    return text[insert_start:block_end]


def _top_level_items(array_text: str) -> list[str]:
    items: list[str] = []
    current: list[str] = []
    depth = 0
    quote: str | None = None
    escaped = False

    for char in array_text:
        if quote:
            current.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue

        if char in ("'", '"', "`"):
            quote = char
            current.append(char)
        elif char in "([{":
            depth += 1
            current.append(char)
        elif char in ")]}":
            depth -= 1
            current.append(char)
        elif char == "," and depth == 0:
            item = "".join(current).strip()
            if item:
                items.append(item)
            current = []
        else:
            current.append(char)

    item = "".join(current).strip()
    if item:
        items.append(item)
    return items


def test_agent_readiness_success_insert_placeholder_count_matches_bind_count() -> None:
    block = _extract_success_exec_block()
    sql_start = block.index("`")
    sql_end = block.index("`", sql_start + 1)
    sql = block[sql_start + 1 : sql_end]
    bind_start = block.index("[", sql_end)
    bind_end = block.rindex("]")
    binds = _top_level_items(block[bind_start + 1 : bind_end])

    assert sql.count("?") == len(binds)
