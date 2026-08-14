#!/usr/bin/env python3
"""Generate local edge-ready image derivatives from a Resi stabilization manifest."""

from __future__ import annotations

import argparse
import hashlib
import html
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

try:
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.ttLib import TTFont
except Exception:
    SVGPathPen = None
    TransformPen = None
    TTFont = None

try:
    import pillow_avif  # noqa: F401
except Exception:
    pillow_avif = None


USER_AGENT = "PropertyAnalytics-ResiEdgeAssetPrototype/2026-07-09"
MOBILE_HERO_AVIF_MAX_BYTES = 80_000
MOBILE_HERO_WEBP_MAX_BYTES = 80_000
CONTENT_BLOCK_AVIF_MAX_BYTES = 55_000
MIN_AVIF_QUALITY = 42
MIN_WEBP_QUALITY = 24
SHARED_LBLE_SVG = Path(__file__).resolve().parents[1] / "ops/cloudflare/shared/resi-edge-package/lble.svg"
FALLBACK_TAGLINE_FONT = Path("/System/Library/Fonts/Supplemental/Georgia Italic.ttf")


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
    try:
        ensure_parent(path)
        image.save(path, "AVIF", quality=quality)
        return True
    except Exception:
        return False


def save_avif_to_budget(image: Image.Image, path: Path, quality: int, max_bytes: int) -> tuple[bool, int]:
    for candidate_quality in range(quality, MIN_AVIF_QUALITY - 1, -4):
        if not save_avif(image, path, candidate_quality):
            return False, candidate_quality
        if path.stat().st_size <= max_bytes:
            return True, candidate_quality
    return True, MIN_AVIF_QUALITY


def save_webp_to_budget(image: Image.Image, path: Path, quality: int, max_bytes: int) -> tuple[bool, int]:
    for candidate_quality in range(quality, MIN_WEBP_QUALITY - 1, -4):
        save_webp(image, path, candidate_quality)
        if path.stat().st_size <= max_bytes:
            return True, candidate_quality
    return True, MIN_WEBP_QUALITY


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


def same_origin_public_asset(public_url: str) -> bool:
    return public_url.startswith("/assets/resi-edge-assets/") and public_url.endswith(".svg")


def first_font_url(manifest: dict[str, Any], family: str) -> str | None:
    wanted = family.lower()
    for font in manifest.get("mobile_shell", {}).get("fonts", []):
        if str(font.get("family", "")).lower() == wanted and font.get("url"):
            return str(font["url"])
    return None


def load_tagline_font(manifest: dict[str, Any], out_dir: Path) -> tuple[Any, str]:
    hero = manifest.get("mobile_shell", {}).get("hero", {})
    title_family = str(manifest.get("mobile_shell", {}).get("title_font") or "").strip()
    font_url = hero.get("title_svg_font_url") or (first_font_url(manifest, title_family) if title_family else None) or first_font_url(manifest, "Merriweather")
    if TTFont is None or SVGPathPen is None or TransformPen is None:
        raise RuntimeError("fontTools is required to generate path-backed tagline SVGs")
    if font_url:
        blob = download(str(font_url))
        font_path = out_dir / "sources" / f"title-font-{hashlib.sha256(blob).hexdigest()[:10]}.woff2"
        ensure_parent(font_path)
        font_path.write_bytes(blob)
        return TTFont(str(font_path)), str(font_url)
    if FALLBACK_TAGLINE_FONT.exists():
        return TTFont(str(FALLBACK_TAGLINE_FONT)), str(FALLBACK_TAGLINE_FONT)
    raise RuntimeError("No tagline SVG font source is available")


def glyph_advance(font: Any, glyph_name: str) -> int:
    metrics = font["hmtx"].metrics
    return int(metrics.get(glyph_name, (font["head"].unitsPerEm // 2, 0))[0])


def line_width(font: Any, glyph_names: list[str], scale: float, letter_spacing: float) -> float:
    if not glyph_names:
        return 0.0
    width_units = sum(glyph_advance(font, glyph) for glyph in glyph_names)
    return width_units * scale + max(0, len(glyph_names) - 1) * letter_spacing


def glyph_names_for_text(font: Any, text: str) -> list[str]:
    cmap = font.getBestCmap()
    return [cmap.get(ord(char), ".notdef") for char in text]


def render_svg_text_paths(
    font: Any,
    lines: list[str],
    width: int,
    height: int,
    font_size: float,
    line_gap: float,
    letter_spacing: float,
    horizontal_padding: float,
    viewbox_bleed: float = 0,
    fill: str = "#FFFFFF",
) -> str:
    glyph_set = font.getGlyphSet()
    units_per_em = font["head"].unitsPerEm
    scale = font_size / units_per_em
    total_height = len(lines) * font_size + max(0, len(lines) - 1) * line_gap
    first_baseline = (height - total_height) / 2 + font_size * 0.82
    paths: list[str] = []
    layout_width = max(1.0, width - horizontal_padding * 2)
    for index, line in enumerate(lines):
        glyph_names = glyph_names_for_text(font, line)
        x = horizontal_padding + (layout_width - line_width(font, glyph_names, scale, letter_spacing)) / 2
        baseline = first_baseline + index * (font_size + line_gap)
        for glyph_name in glyph_names:
            glyph = glyph_set[glyph_name]
            pen = SVGPathPen(glyph_set)
            transform_pen = TransformPen(pen, (scale, 0, 0, -scale, x, baseline))
            glyph.draw(transform_pen)
            path_data = pen.getCommands()
            if path_data:
                paths.append(f'<path d="{path_data}"/>')
            x += glyph_advance(font, glyph_name) * scale + letter_spacing
    body = "".join(paths)
    safe_bleed = max(0.0, viewbox_bleed)
    viewbox_x = -safe_bleed
    viewbox_width = width + safe_bleed * 2
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox_x:g} 0 {viewbox_width:g} {height}" '
        f'width="{width}" height="{height}" role="img" aria-label="{html.escape(" ".join(lines))}">'
        f'<g fill="{fill}" transform="skewX(-7 {width / 2:.1f} {height / 2:.1f})">{body}</g></svg>\n'
    )


def generate_property_tagline_svg(manifest: dict[str, Any], out_dir: Path, assets_root: Path, public_base: str) -> dict[str, Any] | None:
    hero = manifest.get("mobile_shell", {}).get("hero", {})
    if hero.get("title_mode") != "property_tagline_svg":
        return None
    public_url = str(hero.get("title_svg") or "")
    if not same_origin_public_asset(public_url):
        raise RuntimeError("property tagline SVG must use /assets/resi-edge-assets/.../*.svg")
    title_text = str(hero.get("title_text") or "").strip()
    lines = hero.get("title_svg_lines")
    if not isinstance(lines, list) or not all(isinstance(line, str) and line.strip() for line in lines):
        lines = [line.strip() for line in re.split(r"\s*/\s*|\n", title_text) if line.strip()]
    if not lines:
        raise RuntimeError("property tagline SVG requires title_text or title_svg_lines")
    width = int(hero.get("title_svg_width") or 680)
    height = int(hero.get("title_svg_height") or 210)
    font_size = float(hero.get("title_svg_font_size") or (78 if len(lines) == 1 else 68))
    line_gap = float(hero.get("title_svg_line_gap") or -8)
    letter_spacing = float(hero.get("title_svg_letter_spacing") or -1.5)
    horizontal_padding = float(hero.get("title_svg_horizontal_padding") or 56)
    viewbox_bleed = float(hero.get("title_svg_viewbox_bleed") or 0)
    font, font_source = load_tagline_font(manifest, out_dir)
    svg = render_svg_text_paths(font, [line.strip() for line in lines], width, height, font_size, line_gap, letter_spacing, horizontal_padding, viewbox_bleed)
    path = path_from_public_url(public_url, public_base, assets_root)
    ensure_parent(path)
    path.write_text(svg, encoding="utf-8")
    return file_record(
        path,
        public_url,
        f"manifest://mobile_shell.hero.title_text#{font_source}",
        "hero-title",
        "property-tagline-svg",
        {
            "strategy": "text-to-svg-paths",
            "width": width,
            "height": height,
            "lines": lines,
            "fontSource": font_source,
            "fontDependencyRuntime": False,
            "horizontalPadding": horizontal_padding,
        },
    )


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


def with_extension(url: str, extension: str) -> str:
    return re.sub(r"\.(?:avif|webp|jpg|jpeg|png)$", f".{extension}", url)


def normalize_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    if manifest.get("schema_version") != "resi_edge_manifest_v1":
        return manifest

    target = manifest["target"]
    property_code = target["property_code"]
    public_base = f"https://assets.venterradev.com/resi-edge-assets/{property_code}/"
    mobile_shell = manifest["mobile_shell"]
    hero = mobile_shell["hero"]
    hero_mobile_avif = hero["image_mobile"]

    image_rewrites = []
    for block in mobile_shell.get("content_blocks", []):
        source = block.get("source_image_url")
        planned_avif = block.get("image_url")
        if not source or not planned_avif:
            continue
        image_rewrites.append(
            {
                "role": block.get("kind") or f"content-block-{block.get('sequence', len(image_rewrites) + 1)}",
                "source": source,
                "plannedAvif": planned_avif,
                "plannedWebp": with_extension(planned_avif, "webp"),
            }
        )

    return {
        **manifest,
        "property": {
            "propertyCode": property_code,
            "name": target["property_name"],
        },
        "r2": {
            "bucket": "resi-edge-assets",
            "publicBaseUrl": public_base,
            "keyPrefix": f"resi-edge-assets/{property_code}/",
        },
        "hero": {
            "source": hero["source_image"],
            "mobileCrop": {
                "targetWidth": 750,
                "targetHeight": 1000,
            },
            "plannedAssets": {
                "mobileAvif": hero_mobile_avif,
                "mobileWebp": with_extension(hero_mobile_avif, "webp"),
            },
        },
        "imageRewrites": image_rewrites,
    }


def generate(manifest_path: Path, out_dir: Path, quality: int) -> dict[str, Any]:
    manifest = normalize_manifest(load_manifest(manifest_path))
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
    hero_mobile_avif_saved, hero_mobile_avif_quality = save_avif_to_budget(
        center_crop,
        hero_mobile_avif_path,
        quality,
        MOBILE_HERO_AVIF_MAX_BYTES,
    )
    if hero_mobile_avif_saved:
        inventory.append(
            file_record(
                hero_mobile_avif_path,
                hero_mobile_avif_url,
                hero["source"],
                "hero",
                "mobile-avif",
                {
                    "cropBox": center_box,
                    "width": target_width,
                    "height": target_height,
                    "strategy": "center-out",
                    "quality": hero_mobile_avif_quality,
                    "maxBytes": MOBILE_HERO_AVIF_MAX_BYTES,
                },
            )
        )
    hero_mobile_webp_saved, hero_mobile_webp_quality = save_webp_to_budget(
        center_crop,
        hero_mobile_webp_path,
        quality,
        MOBILE_HERO_WEBP_MAX_BYTES,
    )
    if hero_mobile_webp_saved:
        inventory.append(
            file_record(
                hero_mobile_webp_path,
                hero_mobile_webp_url,
                hero["source"],
                "hero",
                "mobile-webp",
                {
                    "cropBox": center_box,
                    "width": target_width,
                    "height": target_height,
                    "strategy": "center-out",
                    "quality": hero_mobile_webp_quality,
                    "maxBytes": MOBILE_HERO_WEBP_MAX_BYTES,
                },
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
        avif_saved, avif_quality = save_avif_to_budget(resized, avif_path, quality, CONTENT_BLOCK_AVIF_MAX_BYTES)
        if avif_saved:
            inventory.append(file_record(avif_path, avif_url, rewrite["source"], role, "avif", {**transform, "quality": avif_quality, "maxBytes": CONTENT_BLOCK_AVIF_MAX_BYTES}))
        save_webp(resized, webp_path, quality)
        inventory.append(file_record(webp_path, webp_url, rewrite["source"], role, "webp", transform))

    property_tagline = generate_property_tagline_svg(manifest, out_dir, assets_root, public_base)
    if property_tagline:
        inventory.append(property_tagline)

    run_packet = {
        "schemaVersion": "2026-07-09.prototype",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "manifestPath": str(manifest_path),
        "propertyCode": property_code,
        "propertyName": manifest["property"]["name"],
        "encoder": {
            "pillowAvif": any(record["variant"].endswith("avif") or record["variant"] == "avif" for record in inventory),
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
    if SHARED_LBLE_SVG.exists():
        run_packet["uploadPlan"].append(
            {
                "localPath": str(SHARED_LBLE_SVG),
                "bucket": manifest["r2"]["bucket"],
                "r2Key": "resi-edge-assets/shared/lble.svg",
                "publicUrl": "/assets/resi-edge-assets/shared/lble.svg",
            }
        )
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
