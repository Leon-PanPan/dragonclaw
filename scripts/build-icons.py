#!/usr/bin/env python3
"""
DragonClaw icon generator.

Generates per-platform 512×512 source PNGs plus downstream multi-resolution
.icns / .ico files, applying the padding rules each platform expects.

Single source of truth: build/logo-desktop.png (the watermark-free master
artwork). All platform variants are derived from it.

Padding rules per platform:
  * macOS  — Apple HIG: artwork inside the rounded square must keep ~10%
             inner safe area. We compose the source onto a transparent
             canvas that adds a 10% margin around the squircle.
  * Windows — Windows applies its own corner mask, so the source must be
             full-bleed (no transparent margin).
  * Linux  — Most desktop environments expect a square, full-bleed PNG.

Outputs (under src/assets/icons/):
  icon-mac-512.png / icon-mac-1024.png / icon-mac-256.png — macOS variants
  icon-win-512.png                                       — Windows 512×512
  icon-linux-512.png                                     — Linux 512×512
  icon-512/1024/256/128/64/48/32/16.png                  — back-compat ladder
  icon.icns                                              — multi-res macOS
  icon.ico                                               — multi-res Windows
"""

from __future__ import annotations

import io
import shutil
import struct
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'build'
OUT = ROOT / 'src' / 'assets' / 'icons'
OUT.mkdir(parents=True, exist_ok=True)

SRC = BUILD / 'logo-desktop.png'  # 2048×2048, watermark-free, full-bleed

# Apple HIG: artwork must keep ~10% inner safe area around the squircle.
MAC_INNER_RATIO = 0.80  # artwork occupies 80% of the canvas
MAC_MARGIN_RATIO = (1.0 - MAC_INNER_RATIO) / 2.0  # 10% on each side


def save(img: Image.Image, path: Path, size: int | None = None) -> Image.Image:
    """Resize (LANCZOS) and save as RGBA PNG. Returns the resized image."""
    if size is not None and img.size != (size, size):
        img = img.resize((size, size), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert('RGBA').save(path, 'PNG', optimize=True)
    print(f'  wrote {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)')
    return img


def mac_variant(size: int) -> Image.Image:
    """Compose the source artwork onto a transparent canvas with 10% margin
    so Apple HIG's ~10% inner safe area is respected."""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = round(size * MAC_INNER_RATIO)
    src_resized = Image.open(SRC).convert('RGBA').resize(
        (inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.alpha_composite(src_resized, (offset, offset))
    return canvas


def win_variant(size: int) -> Image.Image:
    """Full-bleed: Windows masks the corners itself."""
    return Image.open(SRC).convert('RGBA').resize((size, size), Image.LANCZOS)


def linux_variant(size: int) -> Image.Image:
    """Full-bleed: most Linux DEs handle masking themselves."""
    return Image.open(SRC).convert('RGBA').resize((size, size), Image.LANCZOS)


def make_ico(sources: list[tuple[int, Path]], out: Path) -> None:
    """Build a multi-resolution .ico from a list of (size, png_path).

    The legacy ICO directory can only encode widths/heights up to 256, so
    we write PNG-encoded entries for sizes >= 256 manually.
    """
    images: list[tuple[int, bytes]] = []
    for s, p in sources:
        im = Image.open(p).convert('RGBA')
        if im.size != (s, s):
            im = im.resize((s, s), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format='PNG')
        images.append((s, buf.getvalue()))

    num = len(images)
    header = struct.pack('<HHH', 0, 1, num)
    offset = 6 + 16 * num
    entries = b''
    data = b''
    for s, blob in images:
        w = s if s < 256 else 0
        h = s if s < 256 else 0
        entry = struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, len(blob), offset)
        entries += entry
        data += blob
        offset += len(blob)
    out.write_bytes(header + entries + data)
    print(f'  wrote {out.relative_to(ROOT)} ({out.stat().st_size:,} bytes)')


def make_icns(sources: list[tuple[int, Path]], out: Path) -> None:
    """Build a .icns via macOS `iconutil`.

    Apple iconset file naming uses underscores:
        icon_16x16.png          -> 16
        icon_16x16@2x.png       -> 32
        icon_32x32.png          -> 32
        icon_32x32@2x.png       -> 64
        icon_128x128.png        -> 128
        icon_128x128@2x.png     -> 256
        icon_256x256.png        -> 256
        icon_256x256@2x.png     -> 512
        icon_512x512.png        -> 512
        icon_512x512@2x.png     -> 1024
    """
    iconset_dir = out.with_suffix('.iconset')
    if iconset_dir.exists():
        shutil.rmtree(iconset_dir)
    iconset_dir.mkdir()

    name_map = {
        16: 'icon_16x16.png',
        32: 'icon_32x32.png',
        64: 'icon_32x32@2x.png',
        128: 'icon_128x128.png',
        256: 'icon_256x256.png',
        512: 'icon_512x512.png',
        1024: 'icon_512x512@2x.png',
    }
    for s, p in sources:
        target = iconset_dir / name_map[s]
        im = Image.open(p).convert('RGBA')
        if im.size != (s, s):
            im = im.resize((s, s), Image.LANCZOS)
        im.save(target, 'PNG', optimize=True)

    subprocess.run(['iconutil', '-c', 'icns', str(iconset_dir),
                    '-o', str(out)], check=True)
    shutil.rmtree(iconset_dir)
    print(f'  wrote {out.relative_to(ROOT)} ({out.stat().st_size:,} bytes)')


def main() -> int:
    if not SRC.exists():
        print(f'ERROR: source artwork not found: {SRC}', file=sys.stderr)
        return 1

    print('== DragonClaw icon generator ==')
    print(f'  source: {SRC.relative_to(ROOT)} '
          f'({Image.open(SRC).size[0]}x{Image.open(SRC).size[1]})')

    # 1) Per-platform master PNGs at 512×512.
    save(mac_variant(512), OUT / 'icon-mac-512.png', 512)
    save(win_variant(512), OUT / 'icon-win-512.png', 512)
    save(linux_variant(512), OUT / 'icon-linux-512.png', 512)

    # 2) macOS 1024 for the dock.
    save(mac_variant(1024), OUT / 'icon-mac-1024.png', 1024)

    # 3) Back-compat scale ladder (macOS-style: padded).
    save(mac_variant(512), OUT / 'icon-512.png', 512)
    save(mac_variant(1024), OUT / 'icon-1024.png', 1024)
    save(mac_variant(256), OUT / 'icon-256.png', 256)
    save(mac_variant(256), OUT / 'icon-mac-256.png', 256)
    save(mac_variant(128), OUT / 'icon-128.png', 128)
    save(mac_variant(64), OUT / 'icon-64.png', 64)
    save(mac_variant(48), OUT / 'icon-48.png', 48)
    save(mac_variant(32), OUT / 'icon-32.png', 32)
    save(mac_variant(16), OUT / 'icon-16.png', 16)

    # 4) Windows ICO — multi-resolution from the full-bleed master.
    ico_sizes = [16, 24, 32, 48, 64, 128, 256, 512]
    ico_paths: list[tuple[int, Path]] = []
    for s in ico_sizes:
        p = OUT / f'_tmp-ico-{s}.png'
        save(win_variant(s), p, s)
        ico_paths.append((s, p))
    make_ico(ico_paths, OUT / 'icon.ico')
    for _, p in ico_paths:
        p.unlink()

    # 5) macOS ICNS — multi-resolution from the padded master.
    icns_sizes = [16, 32, 64, 128, 256, 512, 1024]
    icns_paths: list[tuple[int, Path]] = []
    for s in icns_sizes:
        p = OUT / f'_tmp-icns-{s}.png'
        save(mac_variant(s), p, s)
        icns_paths.append((s, p))
    make_icns(icns_paths, OUT / 'icon.icns')
    for _, p in icns_paths:
        p.unlink()

    print('Done.')
    return 0


if __name__ == '__main__':
    sys.exit(main())