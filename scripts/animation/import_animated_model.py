#!/usr/bin/env python3
import argparse
import shutil
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Import an animated GLB with standard naming")
    parser.add_argument("--unit", required=True, help="Unit type key (e.g., warrior)")
    parser.add_argument("--src", required=True, help="Path to source .glb")
    parser.add_argument(
        "--dest-dir",
        default="client/public/models",
        help="Destination directory (default: client/public/models)",
    )
    args = parser.parse_args()

    src = Path(args.src).expanduser().resolve()
    if not src.exists():
        raise SystemExit(f"Source not found: {src}")

    dest_dir = Path(args.dest_dir).resolve()
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest_name = f"{args.unit}_animated.glb"
    dest_path = dest_dir / dest_name

    shutil.copy2(src, dest_path)
    print(f"Copied: {src} -> {dest_path}")
    print("Next: update unitAnimationRegistry.ts with animatedModelPath and clips")


if __name__ == "__main__":
    main()
