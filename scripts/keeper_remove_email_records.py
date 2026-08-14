#!/usr/bin/env python3
"""Remove Keeper records by visible email/login field policy.

Run this from a local terminal where Keeper Commander can complete SSO/2FA
prompts. The script logs into Commander once, syncs the vault once, excludes the
new Marketing Ops shared folder, then dry-runs or removes matching records.

It never unmask-prints passwords or raw field values.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from typing import Any, Iterable

from keepercommander import api, subfolder, vault
from keepercommander.config_storage import loader as config_loader
from keepercommander.commands.record import RecordRemoveCommand
from keepercommander.params import KeeperParams


DEFAULT_EXCLUDED_FOLDERS = ("Marketing Ops Shared Credentials", "MarketingOps")
DEFAULT_DOMAINS = ("gmail.com", "laufhutte.com")
DEFAULT_CONFIG = "/Users/mark/Library/Application Support/.keeper/config.json"
SENSITIVE_FIELD_NAMES = {"(password)", "password", "secret", "oneTimeCode", "(oneTimeCode)", "totp"}
LOGIN_FIELD_TOKENS = ("login", "email", "username", "user name", "account login")
EMAIL_RE = re.compile(r"([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})", re.IGNORECASE)


@dataclass
class Candidate:
    uid: str
    title: str
    folders: list[str] = field(default_factory=list)
    matched_domains: set[str] = field(default_factory=set)
    matched_fields: set[str] = field(default_factory=set)


def login_and_sync(config_filename: str | None = None, user: str | None = None) -> KeeperParams:
    params = KeeperParams(config_filename=config_filename or "")
    if config_filename and os.path.exists(config_filename):
        with open(config_filename, "r", encoding="utf-8") as handle:
            params.config = json.load(handle)
        config_loader.load_config_properties(params)
    if user:
        params.user = user
    api.login(params)
    api.sync_down(params)
    return params


def record_folder_paths(params: KeeperParams, record_uid: str) -> list[str]:
    paths: list[str] = []
    for folder in subfolder.find_folders(params, record_uid):
        folder_uid = getattr(folder, "uid", "") or ""
        if folder_uid:
            paths.append(subfolder.get_folder_path(params, folder_uid))
        else:
            paths.append("/")
    return sorted(set(path for path in paths if path))


def excluded_by_folder(paths: Iterable[str], excluded_folders: tuple[str, ...]) -> bool:
    needles = [folder.lower() for folder in excluded_folders if folder]
    return any(needle in path.lower() for needle in needles for path in paths)


def iter_visible_field_values(record: vault.KeeperRecord) -> Iterable[tuple[str, str]]:
    for field_name, value in record.enumerate_fields():
        if str(field_name).strip() in SENSITIVE_FIELD_NAMES:
            continue
        yield from flatten_values(str(field_name), value)


def flatten_values(field_name: str, value: Any) -> Iterable[tuple[str, str]]:
    if value is None:
        return
    if isinstance(value, str):
        if value:
            yield field_name, value
        return
    if isinstance(value, list):
        for item in value:
            yield from flatten_values(field_name, item)
        return
    if isinstance(value, dict):
        for key, nested_value in value.items():
            nested_name = f"{field_name}.{key}"
            if str(key).strip() in SENSITIVE_FIELD_NAMES:
                continue
            yield from flatten_values(nested_name, nested_value)
        return
    text = str(value)
    if text:
        yield field_name, text


def find_domain_matches(record: vault.KeeperRecord, domains: tuple[str, ...]) -> tuple[set[str], set[str]]:
    matched_domains: set[str] = set()
    matched_fields: set[str] = set()
    for field_name, value in iter_visible_field_values(record):
        low = value.lower()
        for domain in domains:
            pattern = rf"(^|[^a-z0-9._%+-])[^@\s]*@{re.escape(domain)}($|[^a-z0-9.-])"
            if re.search(pattern, low):
                matched_domains.add(domain)
                matched_fields.add(field_name)
    return matched_domains, matched_fields


def is_login_field(field_name: str) -> bool:
    normalized = field_name.strip().lower().strip("()")
    return any(token in normalized for token in LOGIN_FIELD_TOKENS)


def find_non_keep_login_matches(
    record: vault.KeeperRecord,
    keep_domains: tuple[str, ...],
    include_non_email_login: bool = True,
) -> tuple[set[str], set[str]]:
    matched_domains: set[str] = set()
    matched_fields: set[str] = set()
    for field_name, value in iter_visible_field_values(record):
        if not is_login_field(field_name):
            continue
        emails = EMAIL_RE.findall(value)
        if emails:
            domains = {domain.lower() for _, domain in emails}
            if not any(domain in keep_domains for domain in domains):
                matched_domains.update(domains)
                matched_fields.add(field_name)
        elif include_non_email_login and value.strip():
            matched_domains.add("non-email-login")
            matched_fields.add(field_name)
    return matched_domains, matched_fields


def discover_candidates(
    params: KeeperParams,
    domains: tuple[str, ...],
    excluded_folders: tuple[str, ...],
    keep_domains: tuple[str, ...] = (),
    include_non_email_login: bool = True,
) -> list[Candidate]:
    candidates: list[Candidate] = []
    for record_uid in sorted(params.record_cache):
        record = vault.KeeperRecord.load(params, record_uid)
        if not record:
            continue
        paths = record_folder_paths(params, record_uid)
        if excluded_by_folder(paths, excluded_folders):
            continue
        if keep_domains:
            matched_domains, matched_fields = find_non_keep_login_matches(
                record,
                keep_domains,
                include_non_email_login=include_non_email_login,
            )
        else:
            matched_domains, matched_fields = find_domain_matches(record, domains)
        if matched_domains:
            candidates.append(
                Candidate(
                    uid=record_uid,
                    title=record.title or "(untitled)",
                    folders=paths,
                    matched_domains=matched_domains,
                    matched_fields=matched_fields,
                )
            )
    return candidates


def print_candidates(candidates: list[Candidate], excluded_folders: tuple[str, ...]) -> None:
    print("Keeper email-record cleanup summary")
    print(f"Excluded folders: {', '.join(excluded_folders)}")
    print(f"Candidate records: {len(candidates)}")
    for index, candidate in enumerate(candidates, start=1):
        domains = ", ".join(sorted(candidate.matched_domains))
        fields = ", ".join(sorted(candidate.matched_fields))
        folders = " | ".join(candidate.folders) if candidate.folders else "(root or unknown)"
        print(
            f"{index:03d}. UID={candidate.uid} "
            f"title={candidate.title!r} domains={domains} fields={fields} folders={folders}"
        )


def remove_candidates(params: KeeperParams, candidates: list[Candidate]) -> None:
    remover = RecordRemoveCommand()
    remover.execute(params, records=[candidate.uid for candidate in candidates], force=True)
    if getattr(params, "sync_data", False):
        api.sync_down(params)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Dry-run or remove Keeper records matching an email/login cleanup policy.")
    parser.add_argument("--domain", action="append", dest="domains", help="Email domain to remove. Repeatable.")
    parser.add_argument(
        "--keep-domain",
        action="append",
        dest="keep_domains",
        help="Remove records whose visible login/email/username fields do not use this domain. Repeatable.",
    )
    parser.add_argument(
        "--preserve-non-email-login",
        action="store_true",
        help="With --keep-domain, do not remove records whose login field is a non-email username.",
    )
    parser.add_argument(
        "--exclude-folder",
        action="append",
        dest="excluded_folders",
        help="Folder name/path fragment to exclude. Repeatable. Defaults exclude Marketing Ops Shared Credentials and MarketingOps.",
    )
    parser.add_argument("--config", default=os.environ.get("KEEPER_CONFIG_FILE", DEFAULT_CONFIG))
    parser.add_argument("--user", default=os.environ.get("KEEPER_USER", ""))
    parser.add_argument("--execute", action="store_true", help="Remove matching records after confirmation.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    domains = tuple(domain.lower().lstrip("@") for domain in (args.domains or list(DEFAULT_DOMAINS)))
    keep_domains = tuple(domain.lower().lstrip("@") for domain in (args.keep_domains or []))
    excluded_folders = tuple(args.excluded_folders or DEFAULT_EXCLUDED_FOLDERS)
    try:
        print(f"Using Keeper config: {args.config}")
        if keep_domains:
            print(f"Keep-domain mode: keeping login/email fields at {', '.join(keep_domains)}")
            if args.preserve_non_email_login:
                print("Non-email login values will be preserved.")
            else:
                print("Non-email login values will be candidates for removal.")
        params = login_and_sync(args.config, args.user)
        candidates = discover_candidates(
            params,
            domains,
            excluded_folders,
            keep_domains=keep_domains,
            include_non_email_login=not args.preserve_non_email_login,
        )
        print_candidates(candidates, excluded_folders)
        if not args.execute:
            print("Dry run only. No Keeper records were removed.")
            return 0
        if not candidates:
            print("No matching records to remove.")
            return 0
        print(f'Type DELETE {len(candidates)} to remove these records from your vault.')
        confirmation = input("Confirmation: ")
        if confirmation != f"DELETE {len(candidates)}":
            print("Canceled. No Keeper records were removed.")
            return 1
        remove_candidates(params, candidates)
        print(f"Removed {len(candidates)} matching Keeper records.")
        return 0
    except KeyboardInterrupt:
        print("\nCanceled.")
        return 130
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
