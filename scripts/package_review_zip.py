#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import re
import subprocess
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT / "review_package_build"
ZIP_PATH = ROOT / "agentic_core_review_package_zh.zip"

PACKAGE_FILES = [
    (ROOT / "agentic_core_resource_model_zh.md", "agentic_core_resource_model_zh.md"),
    (ROOT / "brief_explanation_zh.md", "brief_explanation_zh.md"),
    (BUILD_DIR / "agentic_core_resource_model_zh.pdf", "agentic_core_resource_model_zh.pdf"),
    (BUILD_DIR / "brief_explanation_zh.pdf", "brief_explanation_zh.pdf"),
    (ROOT / "outputs/agentic_resource_results.csv", "outputs/agentic_resource_results.csv"),
    (ROOT / "outputs/agentic_resource_sensitivity.csv", "outputs/agentic_resource_sensitivity.csv"),
    (ROOT / "outputs/agentic_qwen3_sizing_sensitivity.csv", "outputs/agentic_qwen3_sizing_sensitivity.csv"),
    (ROOT / "outputs/agentic_resource_utilization.png", "outputs/agentic_resource_utilization.png"),
    (ROOT / "outputs/agentic_user_count_sensitivity.png", "outputs/agentic_user_count_sensitivity.png"),
    (ROOT / "outputs/nonlinear_model_options.png", "outputs/nonlinear_model_options.png"),
]


def convert_inline(text: str) -> str:
    placeholders: list[str] = []

    def hold_code(match: re.Match[str]) -> str:
        placeholders.append(f"<code>{html.escape(match.group(1))}</code>")
        return f"@@CODE{len(placeholders) - 1}@@"

    def render_inline_math(match: re.Match[str]) -> str:
        return rf"\({match.group(1)}\)"

    text = re.sub(r"`([^`]+)`", hold_code, text)
    text = html.escape(text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    text = re.sub(r"\$([^$]+)\$", render_inline_math, text)
    for index, value in enumerate(placeholders):
        text = text.replace(f"@@CODE{index}@@", value)
    return text


def split_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def render_table(lines: list[str], start: int) -> tuple[str, int]:
    header = split_table_row(lines[start])
    index = start + 2
    rows: list[list[str]] = []
    while index < len(lines) and lines[index].strip().startswith("|"):
        rows.append(split_table_row(lines[index]))
        index += 1

    parts = ["<table><thead><tr>"]
    parts.extend(f"<th>{convert_inline(cell)}</th>" for cell in header)
    parts.append("</tr></thead><tbody>")
    for row in rows:
        parts.append("<tr>")
        parts.extend(f"<td>{convert_inline(cell)}</td>" for cell in row)
        parts.append("</tr>")
    parts.append("</tbody></table>")
    return "".join(parts), index


def markdown_to_html(markdown: str, base_dir: Path) -> str:
    lines = markdown.splitlines()
    parts: list[str] = []
    paragraph: list[str] = []
    in_code = False
    code_lines: list[str] = []
    in_math = False
    math_lines: list[str] = []
    index = 0

    def flush_paragraph() -> None:
        if paragraph:
            parts.append(f"<p>{convert_inline(' '.join(paragraph))}</p>")
            paragraph.clear()

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if stripped.startswith("```"):
            flush_paragraph()
            if in_code:
                parts.append(f"<pre><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
                code_lines.clear()
                in_code = False
            else:
                in_code = True
            index += 1
            continue

        if in_code:
            code_lines.append(line)
            index += 1
            continue

        if stripped == "$$":
            flush_paragraph()
            if in_math:
                parts.append(f"<div class=\"math-block\">\\[{html.escape(chr(10).join(math_lines))}\\]</div>")
                math_lines.clear()
                in_math = False
            else:
                in_math = True
            index += 1
            continue

        if in_math:
            math_lines.append(line)
            index += 1
            continue

        if not stripped:
            flush_paragraph()
            index += 1
            continue

        image_match = re.match(r"!\[[^\]]*\]\(([^)]+)\)", stripped)
        if image_match:
            flush_paragraph()
            image_path = image_match.group(1)
            parts.append(f'<img src="{html.escape(image_path)}" alt="">')
            index += 1
            continue

        if stripped.startswith("|") and index + 1 < len(lines) and re.match(r"^\|?[\s:|-]+\|", lines[index + 1].strip()):
            flush_paragraph()
            table_html, index = render_table(lines, index)
            parts.append(table_html)
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            parts.append(f"<h{level}>{convert_inline(heading.group(2))}</h{level}>")
            index += 1
            continue

        if stripped.startswith("- "):
            flush_paragraph()
            items = []
            while index < len(lines) and lines[index].strip().startswith("- "):
                items.append(lines[index].strip()[2:])
                index += 1
            parts.append("<ul>" + "".join(f"<li>{convert_inline(item)}</li>" for item in items) + "</ul>")
            continue

        paragraph.append(stripped)
        index += 1

    flush_paragraph()
    mathjax = """
    <script>
    window.MathJax = {
      tex: {
        inlineMath: [['\\\\(', '\\\\)']],
        displayMath: [['\\\\[', '\\\\]']],
        processEscapes: true
      },
      svg: { fontCache: 'global' },
      startup: {
        pageReady: () => {
          return MathJax.startup.defaultPageReady().then(() => {
            document.body.classList.add('mathjax-ready');
          });
        }
      }
    };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
    """
    css = """
    body { font-family: "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color: #1f2933; line-height: 1.62; margin: 32px; }
    h1, h2, h3 { color: #102a43; page-break-after: avoid; }
    h1 { font-size: 26px; border-bottom: 2px solid #bcccdc; padding-bottom: 8px; }
    h2 { font-size: 20px; margin-top: 28px; }
    h3 { font-size: 16px; margin-top: 22px; }
    p, li { font-size: 12px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0 18px; font-size: 10px; page-break-inside: avoid; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: top; }
    th { background: #f1f5f9; color: #102a43; }
    code { font-family: Consolas, monospace; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
    pre { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; overflow-wrap: break-word; white-space: pre-wrap; }
    .math-block { background: #f8fafc; border-left: 3px solid #829ab1; padding: 8px 10px; margin: 10px 0; overflow-x: auto; }
    img { max-width: 100%; display: block; margin: 16px auto; page-break-inside: avoid; }
    a { color: #0b69a3; text-decoration: none; }
    """
    return f"<!doctype html><html><head><meta charset=\"utf-8\"><base href=\"{base_dir.as_uri()}/\">{mathjax}<style>{css}</style></head><body>{''.join(parts)}</body></html>"


def write_html(markdown_path: Path, html_path: Path) -> None:
    html_path.write_text(markdown_to_html(markdown_path.read_text(encoding="utf-8"), ROOT), encoding="utf-8")


def html_to_pdf(chrome: str, html_path: Path, pdf_path: Path) -> None:
    chrome_profile = Path("/tmp/agentic-review-chrome-profile")
    chrome_profile.mkdir(exist_ok=True)
    subprocess.run(
        [
            chrome,
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            "--no-zygote",
            "--disable-dev-shm-usage",
            "--disable-crash-reporter",
            "--disable-crashpad",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=8000",
            "--print-to-pdf-no-header",
            f"--user-data-dir={chrome_profile}",
            f"--print-to-pdf={pdf_path}",
            html_path.as_uri(),
        ],
        check=True,
        cwd=ROOT,
    )


def build_package(chrome: str) -> None:
    BUILD_DIR.mkdir(exist_ok=True)
    conversions = [
        ("agentic_core_resource_model_zh", ROOT / "agentic_core_resource_model_zh.md"),
        ("brief_explanation_zh", ROOT / "brief_explanation_zh.md"),
    ]
    for name, markdown_path in conversions:
        html_path = BUILD_DIR / f"{name}.html"
        pdf_path = BUILD_DIR / f"{name}.pdf"
        write_html(markdown_path, html_path)
        html_to_pdf(chrome, html_path, pdf_path)

    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path, archive_name in PACKAGE_FILES:
            archive.write(path, archive_name)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Chinese review zip package with Markdown PDFs.")
    parser.add_argument("--chrome", default="/usr/bin/google-chrome")
    args = parser.parse_args()
    build_package(args.chrome)


if __name__ == "__main__":
    main()
