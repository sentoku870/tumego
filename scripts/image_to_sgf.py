#!/usr/bin/env python3
"""Convert a Go board screenshot into an SGF diagram.

This script reads an image either from the clipboard or a file dialog, detects
Go board grid intersections, classifies stones and saves an SGF file.
"""
from __future__ import annotations

import argparse
import math
import os
import sys
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np

try:
    import cv2  # type: ignore
except ImportError as exc:  # pragma: no cover - imported on demand
    raise SystemExit(
        "OpenCV (cv2) is required. Install it with `pip install opencv-python`."
    ) from exc

try:
    from PIL import Image, ImageGrab
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Pillow is required. Install it with `pip install pillow`."
    ) from exc


SGF_LETTERS = "abcdefghijklmnopqrstuvwxyz"


@dataclass
class DetectionResult:
    grid_x: Sequence[float]
    grid_y: Sequence[float]
    detected_size: int


@dataclass
class ClassificationResult:
    size_for_sgf: int
    black_points: List[Tuple[int, int]]
    white_points: List[Tuple[int, int]]
    empty_points: List[Tuple[int, int]]


def grab_image_from_clipboard() -> Optional[Image.Image]:
    """Try to obtain an image from the clipboard."""
    try:
        clip = ImageGrab.grabclipboard()
    except Exception:
        return None

    if isinstance(clip, Image.Image):
        return clip
    if isinstance(clip, list) and clip:
        # Some platforms return a list of file paths
        for item in clip:
            if isinstance(item, str) and os.path.exists(item):
                try:
                    return Image.open(item)
                except Exception:
                    continue
    return None


def ask_user_for_file() -> Image.Image:
    """Show a file dialog (or stdin fallback) to select an image."""
    try:
        from tkinter import Tk, filedialog

        root = Tk()
        root.withdraw()
        path = filedialog.askopenfilename(
            title="碁盤画像を選択",
            filetypes=[("Image files", "*.png;*.jpg;*.jpeg;*.bmp;*.gif"), ("All", "*.*")],
        )
        root.destroy()
        if not path:
            raise SystemExit("画像が選択されませんでした。終了します。")
        return Image.open(path)
    except Exception:
        # Headless environment fallback
        path = input("画像ファイルのパスを入力してください: ").strip()
        if not path:
            raise SystemExit("画像が指定されませんでした。終了します。")
        return Image.open(path)


def load_image(preferred_path: Optional[str]) -> Tuple[np.ndarray, str]:
    """Load an image either from clipboard, a provided path or a dialog."""
    img: Optional[Image.Image] = None
    source = ""

    if preferred_path:
        img = Image.open(preferred_path)
        source = preferred_path
    else:
        img = grab_image_from_clipboard()
        if img is not None:
            source = "clipboard"
        else:
            img = ask_user_for_file()
            source = "file"

    if img.mode != "RGB":
        img = img.convert("RGB")

    np_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    return np_img, source


def detect_grid_lines(image: np.ndarray) -> DetectionResult:
    """Detect grid lines on the Go board image."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(gray, 40, 120, apertureSize=3)

    lines = None
    for threshold in range(200, 80, -20):
        lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold)
        if lines is not None and len(lines) >= 8:
            break
    if lines is None:
        raise RuntimeError("格子線を検出できませんでした。画像を確認してください。")

    height, width = gray.shape
    vertical_positions: List[float] = []
    horizontal_positions: List[float] = []

    for rho_theta in lines:
        rho, theta = float(rho_theta[0][0]), float(rho_theta[0][1])
        angle = (theta % np.pi) * 180.0 / np.pi
        rho, theta = normalize_rho_theta(rho, theta)
        angle = (theta % np.pi) * 180.0 / np.pi

        if angle < 15 or angle > 165:
            cos_theta = math.cos(theta)
            if abs(cos_theta) < 1e-6:
                continue
            x = rho / cos_theta
            if -width * 0.1 <= x <= width * 1.1:
                vertical_positions.append(x)
        elif 75 < angle < 105:
            sin_theta = math.sin(theta)
            if abs(sin_theta) < 1e-6:
                continue
            y = rho / sin_theta
            if -height * 0.1 <= y <= height * 1.1:
                horizontal_positions.append(y)

    vertical = cluster_positions(vertical_positions, width)
    horizontal = cluster_positions(horizontal_positions, height)

    if len(vertical) < 3 or len(horizontal) < 3:
        raise RuntimeError("格子線の検出数が不足しています。画像が正しいか確認してください。")

    if abs(len(vertical) - len(horizontal)) > 1:
        print(
            "警告: 垂直線と水平線の検出数に差があります ({} vs {}).".format(
                len(vertical), len(horizontal)
            )
        )

    detected_size = int(round((len(vertical) + len(horizontal)) / 2))
    return DetectionResult(grid_x=vertical, grid_y=horizontal, detected_size=detected_size)


def normalize_rho_theta(rho: float, theta: float) -> Tuple[float, float]:
    """Ensure rho is positive for easier processing."""
    if rho < 0:
        rho = -rho
        theta -= np.pi
    theta = (theta + np.pi) % np.pi
    return rho, theta


def cluster_positions(positions: Iterable[float], length: int) -> List[float]:
    """Cluster line positions that are close to each other."""
    positions = sorted(p for p in positions)
    if not positions:
        return []

    tolerance = max(length / 200.0, 5.0)
    clusters: List[List[float]] = [[positions[0]]]

    for pos in positions[1:]:
        current_cluster = clusters[-1]
        if abs(pos - np.mean(current_cluster)) <= tolerance:
            current_cluster.append(pos)
        else:
            clusters.append([pos])

    return [float(np.mean(cluster)) for cluster in clusters]


def determine_sgf_size(detected: DetectionResult) -> Tuple[int, bool]:
    """Determine board size to use for SGF."""
    detected_size = detected.detected_size
    print(f"自動検出路数: {detected_size}")

    if detected_size in {9, 13, 19}:
        return detected_size, False

    if 9 < detected_size < 13 or 13 < detected_size < 19:
        print("部分図と判断し、19路盤として扱います。")
        return 19, True

    print("検出された路数が標準値ではありません。")
    choice = prompt_user_size_choice()
    if choice == "auto":
        return detected_size, False
    return int(choice), True


def prompt_user_size_choice() -> str:
    """Ask user to choose board size when detection is ambiguous."""
    options = {"9", "13", "19", "auto"}
    while True:
        answer = input("路数を選択してください (9/13/19/auto): ").strip().lower()
        if answer in options:
            return answer
        print("無効な入力です。もう一度入力してください。")


def build_coordinate_mapping(source_count: int, target_count: int) -> List[int]:
    """Map indices from detected grid to SGF size."""
    if source_count <= 1:
        return [0]
    if source_count == target_count:
        return list(range(source_count))

    positions = np.linspace(0, target_count - 1, source_count)
    mapped = np.rint(positions).astype(int)
    mapped = np.clip(mapped, 0, target_count - 1)

    # Ensure monotonicity (no duplicates decreasing)
    for i in range(1, len(mapped)):
        if mapped[i] <= mapped[i - 1]:
            mapped[i] = min(target_count - 1, mapped[i - 1] + 1)
    return mapped.tolist()


def classify_stones(
    image: np.ndarray,
    detected: DetectionResult,
    sgf_size: int,
) -> ClassificationResult:
    """Classify intersections as black, white or empty."""
    grid_x = sorted(detected.grid_x)
    grid_y = sorted(detected.grid_y)
    detected_size = len(grid_x)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    x0, x1 = int(max(0, math.floor(grid_x[0]))), int(min(image.shape[1] - 1, math.ceil(grid_x[-1])))
    y0, y1 = int(max(0, math.floor(grid_y[0]))), int(min(image.shape[0] - 1, math.ceil(grid_y[-1])))

    board_region = gray[y0:y1, x0:x1]
    board_mean = float(np.mean(board_region))
    board_std = float(np.std(board_region))
    dynamic = max(board_std * 0.6, 12.0)

    black_threshold = board_mean - dynamic
    white_threshold = board_mean + dynamic

    avg_spacing_x = float(np.mean(np.diff(grid_x))) if len(grid_x) > 1 else 10.0
    avg_spacing_y = float(np.mean(np.diff(grid_y))) if len(grid_y) > 1 else 10.0
    radius = int(max(3.0, min(avg_spacing_x, avg_spacing_y) * 0.3))

    mapped_x = build_coordinate_mapping(detected_size, sgf_size)
    mapped_y = build_coordinate_mapping(len(grid_y), sgf_size)

    black_points: Dict[Tuple[int, int], float] = {}
    white_points: Dict[Tuple[int, int], float] = {}
    empty_points: Dict[Tuple[int, int], float] = {}

    for idx_y, y in enumerate(grid_y):
        for idx_x, x in enumerate(grid_x):
            cx = int(round(x))
            cy = int(round(y))
            patch = extract_patch(gray, cx, cy, radius)
            if patch.size == 0:
                continue
            patch_mean = float(np.mean(patch))

            point = (mapped_x[idx_x], mapped_y[idx_y])
            if patch_mean <= black_threshold:
                store_best_point(black_points, point, board_mean - patch_mean)
            elif patch_mean >= white_threshold:
                store_best_point(white_points, point, patch_mean - board_mean)
            else:
                store_best_point(empty_points, point, -abs(patch_mean - board_mean))

    # Remove points classified as stones from empty set
    for point in list(empty_points.keys()):
        if point in black_points or point in white_points:
            empty_points.pop(point, None)

    return ClassificationResult(
        size_for_sgf=sgf_size,
        black_points=sorted(black_points.keys()),
        white_points=sorted(white_points.keys()),
        empty_points=sorted(empty_points.keys()),
    )


def extract_patch(gray: np.ndarray, cx: int, cy: int, radius: int) -> np.ndarray:
    """Extract a circular patch around the intersection."""
    height, width = gray.shape
    x0 = max(0, cx - radius)
    y0 = max(0, cy - radius)
    x1 = min(width - 1, cx + radius)
    y1 = min(height - 1, cy + radius)

    patch = gray[y0 : y1 + 1, x0 : x1 + 1]
    if patch.size == 0:
        return patch

    h, w = patch.shape
    yy, xx = np.ogrid[:h, :w]
    mask = (xx - (w - 1) / 2.0) ** 2 + (yy - (h - 1) / 2.0) ** 2 <= (radius * 0.6) ** 2
    masked = patch[mask]
    if masked.size > 0:
        return masked
    return patch


def store_best_point(store: Dict[Tuple[int, int], float], point: Tuple[int, int], score: float) -> None:
    current = store.get(point)
    if current is None or score > current:
        store[point] = score


def sgf_coordinate(point: Tuple[int, int]) -> str:
    x, y = point
    return SGF_LETTERS[x] + SGF_LETTERS[y]


def build_sgf(classification: ClassificationResult) -> str:
    parts = [f"(;SZ[{classification.size_for_sgf}]"]

    if classification.black_points:
        blacks = "".join(f"[{sgf_coordinate(pt)}]" for pt in classification.black_points)
        parts.append(f"AB{blacks}")
    if classification.white_points:
        whites = "".join(f"[{sgf_coordinate(pt)}]" for pt in classification.white_points)
        parts.append(f"AW{whites}")

    parts.append(")")
    return "\n".join(parts)


def save_sgf(content: str, output_path: Optional[str], source: str) -> str:
    if output_path:
        path = output_path
    else:
        base_name = "board_from_clipboard" if source == "clipboard" else "board"
        path = f"{base_name}.sgf"

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="囲碁盤面画像からSGFを生成")
    parser.add_argument("--input", "-i", help="入力画像ファイルのパス")
    parser.add_argument("--output", "-o", help="出力SGFファイルのパス")
    args = parser.parse_args(argv)

    cv_image, source = load_image(args.input)
    print(f"画像取得元: {source}")

    try:
        detected = detect_grid_lines(cv_image)
    except Exception as exc:
        print(f"格子線検出エラー: {exc}")
        return 1

    try:
        sgf_size, _was_manual = determine_sgf_size(detected)
    except Exception as exc:
        print(f"路数判定エラー: {exc}")
        return 1

    classification = classify_stones(cv_image, detected, sgf_size)

    sgf_content = build_sgf(classification)
    print("生成されたSGF:\n" + sgf_content)

    output_path = save_sgf(sgf_content, args.output, source)
    print(f"SGFを保存しました: {output_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
