#!/usr/bin/env python3
"""Turn the Mansab Production Board into board data for this site.

The production board keeps all its data in one <script id="state"> JSON block.
This script pulls that block out and writes it as board.json, which you then
upload on the site's Admin page (live mode) or save as public/data/board.json
(demo mode, never committed).

    python3 tools/sync_board.py saved-board.html private/board.json
    python3 tools/sync_board.py saved-board.html private/board.json --urdu private/urdu.json

--urdu merges Urdu text into the board. The overlay file looks like:
    {
      "notes": {"production": "…", "custom": "…", "samples": "…"},
      "pos":     {"<po id>":     {"label": "…", "needsOKNote": "…", "mandatoryText": "…"}},
      "custom":  {"<custom id>": {"note": "…"}},
      "samples": {"<sample id>": {"detail": "…", "note": "…"}}
    }
Any field left out simply shows in English.
"""
import argparse
import json
import re
import sys


def extract_state(html):
    m = re.search(r'<script id="state" type="application/json">(.*?)</script>', html, re.S)
    if not m:
        sys.exit("No <script id=\"state\"> block found — is this the production board HTML?")
    return json.loads(m.group(1))


def merge_urdu(board, ur):
    if "notes" in ur:
        board.setdefault("notes", {})["ur"] = ur["notes"]
    for key in ("pos", "custom", "samples"):
        by_id = ur.get(key, {})
        for item in board.get(key, []):
            if item.get("id") in by_id:
                item.setdefault("ur", {}).update(by_id[item["id"]])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("board_html")
    ap.add_argument("out_json")
    ap.add_argument("--urdu")
    a = ap.parse_args()

    with open(a.board_html, encoding="utf-8") as f:
        board = extract_state(f.read())
    if a.urdu:
        with open(a.urdu, encoding="utf-8") as f:
            merge_urdu(board, json.load(f))
    with open(a.out_json, "w", encoding="utf-8") as f:
        json.dump(board, f, ensure_ascii=False, indent=1)
    print(f"wrote {a.out_json}: {len(board.get('pos', []))} production, "
          f"{len(board.get('custom', []))} custom, {len(board.get('samples', []))} samples")


if __name__ == "__main__":
    main()
