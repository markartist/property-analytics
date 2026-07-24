#!/usr/bin/env python3
"""Generate local edge-ready image derivatives from a Resi stabilization manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import ssl
import sys
import urllib.request
from urllib.parse import urlparse
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, features


USER_AGENT = "PropertyAnalytics-ResiEdgeAssetPrototype/2026-07-09"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "asset"


def load_manifest(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    context = ssl.create_default_context()
    with urllib.request.urlopen(request, context=context, timeout=45) as response:
        return response.read()


def open_image(blob: bytes) -> Image.Image:
    image = Image.open(BytesIO(blob))
    image.load()
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")
    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, "white")
        background.paste(image, mask=image.getchannel("A"))
        image = background
    return image


def resize_to_width(image: Image.Image, width: int) -> Image.Image:
    ratio = width / image.width
    height = max(1, round(image.height * ratio))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def center_crop_box(image: Image.Image, target_width: int, target_height: int, x_bias: float = 0.5) -> tuple[int, int, int, int]:
    target_ratio = target_width / target_height
    source_ratio = image.width / image.height
    if source_ratio > target_ratio:
        crop_width = round(image.height * target_ratio)
        max_x = image.width - crop_width
        left = round(max_x * x_bias)
        return (left, 0, left + crop_width, image.height)

    crop_height = round(image.width / target_ratio)
    top = max(0, round((image.height - crop_height) / 2))
    return (0, top, image.width, top + crop_height)


def crop_resize(image: Image.Image, target_width: int, target_height: int, x_bias: float = 0.5) -> tuple[Image.Image, tuple[int, int, int, int]]:
    box = center_crop_box(image, target_width, target_height, x_bias)
    cropped = image.crop(box)
    resized = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
    return resized, box


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def save_webp(image: Image.Image, path: Path, quality: int) -> None:
    ensure_parent(path)
    image.save(path, "WEBP", quality=quality, method=6)


def save_avif(image: Image.Image, path: Path, quality: int) -> bool:
    if not features.check("avif"):
        return False
    ensure_parent(path)
    image.save(path, "AVIF", quality=quality)
    return True


def file_record(path: Path, public_url: str | None, source_url: str, role: str, variant: str, transform: dict[str, Any]) -> dict[str, Any]:
    blob = path.read_bytes()
    return {
        "role": role,
        "variant": variant,
        "path": str(path),
        "publicUrl": public_url,
        "sourceUrl": source_url,
        "bytes": len(blob),
        "sha256": hashlib.sha256(blob).hexdigest(),
        "transform": transform,
    }


def path_from_public_url(public_url: str, public_base_url: str, local_root: Path) -> Path:
    if public_url.startswith(public_base_url):
        suffix = public_url[len(public_base_url) :].lstrip("/")
    else:
        parsed_path = urlparse(public_url).path.lstrip("/")
        marker = "resi-edge-assets/"
        suffix = parsed_path.split(marker, 1)[1] if marker in parsed_path else public_url.rsplit("/", 1)[-1]
    return local_root / suffix


def r2_key_from_public_url(public_url: str, fallback_key_prefix: str) -> str:
    parsed_path = urlparse(public_url).path.lstrip("/")
    marker = "resi-edge-assets/"
    if marker in parsed_path:
        return marker + parsed_path.split(marker, 1)[1]
    return fallback_key_prefix + public_url.rsplit("/", 1)[-1]


def draw_label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str) -> None:
    font = ImageFont.load_default()
    x, y = xy
    bbox = draw.textbbox((x, y), text, font=font)
    padding = 6
    draw.rectangle(
        (bbox[0] - padding, bbox[1] - padding, bbox[2] + padding, bbox[3] + padding),
        fill=(21, 40, 75),
    )
    draw.text((x, y), text, fill="white", font=font)


def create_crop_sheet(source: Image.Image, variants: list[tuple[str, Image.Image, tuple[int, int, int, int]]], output: Path) -> None:
    tile_width = 280
    gutter = 18
    label_height = 42
    source_thumb = resize_to_width(source, tile_width)
    thumbs: list[tuple[str, Image.Image]] = [("source", source_thumb)]
    for label, image, box in variants:
        thumb = image.resize((tile_width, round(tile_width * image.height / image.width)), Image.Resampling.LANCZOS)
        thumbs.append((f"{label} crop {box}", thumb))

    width = len(thumbs) * tile_width + (len(thumbs) + 1) * gutter
    height = max(image.height for _, image in thumbs) + label_height + gutter * 2
    sheet = Image.new("RGB", (width, height), (246, 246, 245))
    draw = ImageDraw.Draw(sheet)
    x = gutter
    for label, image in thumbs:
        sheet.paste(image, (x, label_height + gutter))
        draw_label(draw, (x, gutter), label)
        x += tile_width + gutter
    ensure_parent(output)
    sheet.save(output, "PNG")


def planned_width_from_url(url: str, default_width: int) -> int:
    match = re.search(r"-(\d+)\.(?:avif|webp|jpg|jpeg|png)$", url)
    return int(match.group(1)) if match else default_width


def generate(manifest_path: Path, out_dir: Path, quality: int) -> dict[str, Any]:
    manifest = load_manifest(manifest_path)
    property_code = manifest["property"]["propertyCode"]
    public_base = manifest["r2"]["publicBaseUrl"]
    assets_root = out_dir / "assets"
    sources_root = out_dir / "sources"
    inventory: list[dict[str, Any]] = []
    source_records: list[dict[str, Any]] = []

    def fetch_source(role: str, url: str) -> Image.Image:
        blob = download(url)
        source_path = sources_root / f"{slugify(role)}-{hashlib.sha256(blob).hexdigest()[:10]}.jpg"
        ensure_parent(source_path)
        source_path.write_bytes(blob)
        image = open_image(blob)
        source_records.append(
            {
                "role": role,
                "sourceUrl": url,
                "path": str(source_path),
                "bytes": len(blob),
                "sha256": hashlib.sha256(blob).hexdigest(),
                "width": image.width,
                "height": image.height,
            }
        )
        return image

    hero = manifest["hero"]
    hero_source = fetch_source("hero", hero["source"])
    crop = hero["mobileCrop"]
    target_width = int(crop["targetWidth"])
    target_height = int(crop["targetHeight"])
    crop_variants = []
    for label, bias in (("left", 0.38), ("center", 0.5), ("right", 0.62)):
        variant, box = crop_resize(hero_source, target_width, target_height, bias)
        crop_variants.append((label, variant, box))
    create_crop_sheet(hero_source, crop_variants, out_dir / "hero-mobile-crop-review.png")

    center_crop = crop_variants[1][1]
    center_box = crop_variants[1][2]
    hero_mobile_avif_url = hero["plannedAssets"]["mobileAvif"]
    hero_mobile_webp_url = hero["plannedAssets"]["mobileWebp"]
    hero_mobile_avif_path = path_from_public_url(hero_mobile_avif_url, public_base, assets_root)
    hero_mobile_webp_path = path_from_public_url(hero_mobile_webp_url, public_base, assets_root)
    if save_avif(center_crop, hero_mobile_avif_path, quality):
        inventory.append(
            file_record(
                hero_mobile_avif_path,
                hero_mobile_avif_url,
                hero["source"],
                "hero",
                "mobile-avif",
                {"cropBox": center_box, "width": target_width, "height": target_height, "strategy": "center-out"},
            )
        )
    save_webp(center_crop, hero_mobile_webp_path, quality)
    inventory.append(
        file_record(
            hero_mobile_webp_path,
            hero_mobile_webp_url,
            hero["source"],
            "hero",
            "mobile-webp",
            {"cropBox": center_box, "width": target_width, "height": target_height, "strategy": "center-out"},
        )
    )

    desktop_width = planned_width_from_url(hero["plannedAssets"]["desktopAvif"], 1600)
    desktop = resize_to_width(hero_source, desktop_width)
    hero_desktop_avif_url = hero["plannedAssets"]["desktopAvif"]
    hero_desktop_webp_url = hero["plannedAssets"]["desktopWebp"]
    hero_desktop_avif_path = path_from_public_url(hero_desktop_avif_url, public_base, assets_root)
    hero_desktop_webp_path = path_from_public_url(hero_desktop_webp_url, public_base, assets_root)
    if save_avif(desktop, hero_desktop_avif_path, quality):
        inventory.append(
            file_record(
                hero_desktop_avif_path,
                hero_desktop_avif_url,
                hero["source"],
                "hero",
                "desktop-avif",
                {"width": desktop.width, "height": desktop.height, "strategy": "resize-width"},
            )
        )
    save_webp(desktop, hero_desktop_webp_path, quality)
    inventory.append(
        file_record(
            hero_desktop_webp_path,
            hero_desktop_webp_url,
            hero["source"],
            "hero",
            "desktop-webp",
            {"width": desktop.width, "height": desktop.height, "strategy": "resize-width"},
        )
    )

    for rewrite in manifest.get("imageRewrites", []):
        role = rewrite["role"]
        source = fetch_source(role, rewrite["source"])
        avif_url = rewrite["plannedAvif"]
        webp_url = rewrite["plannedWebp"]
        width = planned_width_from_url(avif_url, 900)
        resized = resize_to_width(source, width)
        avif_path = path_from_public_url(avif_url, public_base, assets_root)
        webp_path = path_from_public_url(webp_url, public_base, assets_root)
        transform = {"width": resized.width, "height": resized.height, "strategy": "resize-width"}
        if save_avif(resized, avif_path, quality):
            inventory.append(file_record(avif_path, avif_url, rewrite["source"], role, "avif", transform))
        save_webp(resized, webp_path, quality)
        inventory.append(file_record(webp_path, webp_url, rewrite["source"], role, "webp", transform))

    run_packet = {
        "schemaVersion": "2026-07-09.prototype",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "manifestPath": str(manifest_path),
        "propertyCode": property_code,
        "propertyName": manifest["property"]["name"],
        "encoder": {
            "pillowAvif": bool(features.check("avif")),
            "pillowWebp": bool(features.check("webp")),
            "quality": quality,
        },
        "outputs": {
            "assetsRoot": str(assets_root),
            "sourcesRoot": str(sources_root),
            "cropReview": str(out_dir / "hero-mobile-crop-review.png"),
        },
        "sources": source_records,
        "assets": inventory,
        "r2": manifest["r2"],
        "uploadPlan": [
            {
                "localPath": record["path"],
                "bucket": manifest["r2"]["bucket"],
                "r2Key": r2_key_from_public_url(record["publicUrl"], manifest["r2"]["keyPrefix"]),
                "publicUrl": record["publicUrl"],
            }
            for record in inventory
            if record.get("publicUrl")
        ],
        "liveTrafficChanged": False,
    }
    ensure_parent(out_dir / "generated-assets.json")
    (out_dir / "generated-assets.json").write_text(json.dumps(run_packet, indent=2), encoding="utf-8")
    return run_packet


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--quality", type=int, default=78)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    packet = generate(args.manifest.resolve(), args.out_dir.resolve(), args.quality)
    print(json.dumps({"assets": len(packet["assets"]), "outDir": str(args.out_dir.resolve())}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
