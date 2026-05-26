#!/usr/bin/env python3
"""
Track estimated GTMetrix credit spend for the pilot morning workflow.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List


BASE_DIR = Path(__file__).resolve().parents[1]
STATE_DIR = BASE_DIR / "reports" / "gtmetrix_credit_guard"
STATE_DIR.mkdir(parents=True, exist_ok=True)


def state_path(run_date: str) -> Path:
    return STATE_DIR / f"gtmetrix_credit_guard_{run_date}.json"


def load_state(run_date: str, daily_budget: int, reserve_credits: int) -> Dict[str, Any]:
    path = state_path(run_date)
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["daily_budget"] = daily_budget
        payload["reserve_credits"] = reserve_credits
        payload["spendable_budget"] = max(0, daily_budget - reserve_credits)
        payload["state_path"] = str(path)
        return payload

    return {
        "date": run_date,
        "daily_budget": daily_budget,
        "reserve_credits": reserve_credits,
        "spendable_budget": max(0, daily_budget - reserve_credits),
        "spent_estimated_credits": 0,
        "remaining_spendable_credits": max(0, daily_budget - reserve_credits),
        "attempts": [],
        "state_path": str(path),
    }


def save_state(state: Dict[str, Any]) -> None:
    path = Path(state["state_path"])
    payload = dict(state)
    payload.pop("state_path", None)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def recompute(state: Dict[str, Any]) -> Dict[str, Any]:
    spendable = max(0, int(state["daily_budget"]) - int(state["reserve_credits"]))
    spent = sum(int(item.get("estimated_credits", 0)) for item in state.get("attempts", []))
    state["spendable_budget"] = spendable
    state["spent_estimated_credits"] = spent
    state["remaining_spendable_credits"] = max(0, spendable - spent)
    return state


def print_json(payload: Dict[str, Any]) -> None:
    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")


def cmd_status(args: argparse.Namespace) -> int:
    state = load_state(args.date, args.daily_budget, args.reserve_credits)
    state = recompute(state)
    print_json(state)
    return 0


def cmd_plan(args: argparse.Namespace) -> int:
    state = load_state(args.date, args.daily_budget, args.reserve_credits)
    state = recompute(state)
    estimated = len(args.property_ids) * args.runs * max(1, args.property_retries + 1)
    payload = {
        **state,
        "planned_property_ids": args.property_ids,
        "planned_property_count": len(args.property_ids),
        "planned_runs": args.runs,
        "planned_property_retries": args.property_retries,
        "planned_estimated_credits": estimated,
        "can_run": estimated <= state["remaining_spendable_credits"],
    }
    print_json(payload)
    return 0 if payload["can_run"] else 1


def cmd_record(args: argparse.Namespace) -> int:
    state = load_state(args.date, args.daily_budget, args.reserve_credits)
    estimated = len(args.property_ids) * args.runs * max(1, args.property_retries + 1)
    attempt = {
        "attempt": args.attempt,
        "label": args.label,
        "property_ids": args.property_ids,
        "property_count": len(args.property_ids),
        "runs": args.runs,
        "property_retries": args.property_retries,
        "estimated_credits": estimated,
        "status": args.status,
    }
    state.setdefault("attempts", []).append(attempt)
    state = recompute(state)
    save_state(state)
    print_json(state)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="GTMetrix pilot credit guard")
    parser.add_argument("--date", default=date.today().isoformat(), help="Run date (YYYY-MM-DD)")
    parser.add_argument("--daily-budget", type=int, default=50, help="Daily GTMetrix credit budget")
    parser.add_argument("--reserve-credits", type=int, default=10, help="Credits held in reserve")

    subparsers = parser.add_subparsers(dest="command", required=True)

    status_parser = subparsers.add_parser("status", help="Show current credit state")
    status_parser.set_defaults(func=cmd_status)

    plan_parser = subparsers.add_parser("plan", help="Check whether a planned attempt fits budget")
    plan_parser.add_argument("--property-ids", nargs="+", required=True)
    plan_parser.add_argument("--runs", type=int, default=1)
    plan_parser.add_argument("--property-retries", type=int, default=0)
    plan_parser.set_defaults(func=cmd_plan)

    record_parser = subparsers.add_parser("record", help="Record an attempted spend")
    record_parser.add_argument("--attempt", type=int, required=True)
    record_parser.add_argument("--label", default="gtmetrix_attempt")
    record_parser.add_argument("--property-ids", nargs="+", required=True)
    record_parser.add_argument("--runs", type=int, default=1)
    record_parser.add_argument("--property-retries", type=int, default=0)
    record_parser.add_argument("--status", default="completed")
    record_parser.set_defaults(func=cmd_record)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
