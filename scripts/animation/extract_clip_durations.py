#!/usr/bin/env python3
import argparse
import json
import struct
from pathlib import Path
from typing import Dict, List, Tuple

try:
    import numpy as np
except ImportError:
    np = None


def read_glb(path: Path):
    with path.open("rb") as f:
        header = f.read(12)
        if len(header) < 12:
            raise ValueError("File too small")
        magic, version, length = struct.unpack("<4sII", header)
        if magic != b"glTF":
            raise ValueError("Not a GLB file")
        json_chunk = None
        bin_chunk = None
        while f.tell() < length:
            chunk_header = f.read(8)
            if len(chunk_header) < 8:
                break
            chunk_len, chunk_type = struct.unpack("<II", chunk_header)
            chunk_data = f.read(chunk_len)
            if chunk_type == 0x4E4F534A:  # JSON
                json_chunk = json.loads(chunk_data.decode("utf-8"))
            elif chunk_type == 0x004E4942:  # BIN
                bin_chunk = chunk_data
        if json_chunk is None:
            raise ValueError("Missing JSON chunk")
        return json_chunk, bin_chunk


def read_accessor(gltf, bin_chunk, accessor_index: int):
    accessor = gltf["accessors"][accessor_index]
    view = gltf["bufferViews"][accessor["bufferView"]]
    byte_offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    count = accessor["count"]
    component_type = accessor["componentType"]
    accessor_type = accessor["type"]

    if accessor_type != "SCALAR" or component_type != 5126:
        raise ValueError("Unsupported accessor type for animation time (expected SCALAR float32)")

    if np is None:
        raise RuntimeError("numpy is required for this script")

    data = np.frombuffer(bin_chunk, dtype=np.float32, count=count, offset=byte_offset)
    return data


def extract_durations(path: Path) -> List[Tuple[str, float]]:
    gltf, bin_chunk = read_glb(path)
    animations = gltf.get("animations", [])
    results = []
    for idx, anim in enumerate(animations):
        name = anim.get("name") or f"Animation_{idx}"
        max_time = 0.0
        min_time = None
        for sampler in anim.get("samplers", []):
            times = read_accessor(gltf, bin_chunk, sampler["input"])
            if times.size == 0:
                continue
            tmin = float(times.min())
            tmax = float(times.max())
            if min_time is None or tmin < min_time:
                min_time = tmin
            if tmax > max_time:
                max_time = tmax
        duration = max_time - (min_time or 0.0)
        results.append((name, duration))
    return results


def format_ts_object(durations_ms: Dict[str, int], indent: str) -> str:
    lines = [f"{indent}{name}: {durations_ms[name]}," for name in sorted(durations_ms)]
    return "\n".join(lines)


def update_registry_file(registry_path: Path, unit_type: str, durations_ms: Dict[str, int]):
    text = registry_path.read_text()
    unit_key = f"{unit_type}: {{"
    unit_index = text.find(unit_key)
    if unit_index == -1:
        raise ValueError(f"Unit '{unit_type}' not found in registry")

    brace_start = text.find("{", unit_index)
    depth = 0
    end_index = None
    for i in range(brace_start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end_index = i
                break
    if end_index is None:
        raise ValueError("Could not find end of unit block")

    block = text[brace_start : end_index + 1]
    clip_key = "clipDurationsMs:"
    indent_line_start = text.rfind("\n", 0, unit_index) + 1
    unit_indent = text[indent_line_start:unit_index]
    prop_indent = unit_indent + "  "
    value_indent = prop_indent + "  "

    new_obj = "{\n" + format_ts_object(durations_ms, value_indent) + f"\n{prop_indent}}}"

    if clip_key in block:
        clip_idx = block.find(clip_key)
        brace_idx = block.find("{", clip_idx)
        depth = 0
        clip_end = None
        for i in range(brace_idx, len(block)):
            if block[i] == "{":
                depth += 1
            elif block[i] == "}":
                depth -= 1
                if depth == 0:
                    clip_end = i
                    break
        if clip_end is None:
            raise ValueError("Could not parse clipDurationsMs block")
        updated_block = (
            block[:clip_idx]
            + f"{clip_key} {new_obj},"
            + block[clip_end + 1 :]
        )
    else:
        insert_at = block.rfind("}")
        updated_block = (
            block[:insert_at]
            + f"{prop_indent}clipDurationsMs: {new_obj},\n"
            + block[insert_at:]
        )

    updated_text = text[:brace_start] + updated_block + text[end_index + 1 :]
    registry_path.write_text(updated_text)


def main():
    parser = argparse.ArgumentParser(description="Extract GLB animation clip durations")
    parser.add_argument("glb", type=Path, help="Path to .glb file")
    parser.add_argument("--json", action="store_true", help="Output JSON to stdout")
    parser.add_argument("--ts", action="store_true", help="Output TS object snippet")
    parser.add_argument("--update-registry", type=Path, help="Path to unitAnimationRegistry.ts")
    parser.add_argument("--unit", type=str, help="Unit type key to update in registry")

    args = parser.parse_args()

    durations = extract_durations(args.glb)
    durations_ms = {name: int(round(seconds * 1000)) for name, seconds in durations}

    if args.json:
        print(json.dumps(durations_ms, indent=2, sort_keys=True))
    if args.ts:
        print(format_ts_object(durations_ms, "  "))

    if args.update_registry:
        if not args.unit:
            raise SystemExit("--unit is required with --update-registry")
        update_registry_file(args.update_registry, args.unit, durations_ms)

    if not args.json and not args.ts and not args.update_registry:
        for name, seconds in durations:
            print(f"{name}: {seconds:.3f}s")


if __name__ == "__main__":
    main()
