"""Turn the narration script into speech with Sarvam AI's Bulbul text-to-speech.

Reads presentation/narration.json (scenes, each a list of sentence segments) and writes one WAV file per
segment to presentation/build/audio/<scene>-<n>.wav, so the pictures can be timed to each sentence. A scene is only sent again if its text or the voice
settings changed (a hash is kept next to each file).

The API key is read from the SARVAM_API_KEY environment variable and is never written anywhere.

    SARVAM_API_KEY=... .venv/bin/python -I presentation/tts.py [--only id1,id2] [--speaker name]
"""

import base64
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "build" / "audio"
URL = "https://api.sarvam.ai/text-to-speech"

SETTINGS = {
    "model": "bulbul:v4-flash",
    "speaker": "shubh_en_narration",
    "language_code": "en-IN",
    "pace": 1.2,
    "speech_sample_rate": 44100,
    "output_audio_codec": "wav",
}


def speak(text: str, key: str, settings: dict) -> bytes:
    body = json.dumps({"text": text, **settings}).encode()
    req = urllib.request.Request(
        URL,
        data=body,
        headers={"api-subscription-key": key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Sarvam returned HTTP {e.code}: {e.read()[:400].decode(errors='replace')}")
    return base64.b64decode("".join(data["audios"]))


def main() -> None:
    key = os.environ.get("SARVAM_API_KEY", "").strip()
    if not key:
        raise SystemExit("Set SARVAM_API_KEY first.")
    args = sys.argv[1:]
    settings = dict(SETTINGS)
    only = None
    script = HERE / "narration.json"
    out = OUT
    i = 0
    while i < len(args):
        if args[i] == "--only":
            only = set(args[i + 1].split(","))
            i += 2
        elif args[i] == "--speaker":
            settings["speaker"] = args[i + 1]
            i += 2
        elif args[i] == "--script":
            script = Path(args[i + 1])
            i += 2
        elif args[i] == "--out":
            out = Path(args[i + 1])
            i += 2
        else:
            raise SystemExit(f"Unknown argument {args[i]}")
    out.mkdir(parents=True, exist_ok=True)
    scenes = json.loads(script.read_text())
    items = []
    for s in scenes:
        if "segments" in s:
            items += [{"id": f"{s['id']}-{k}", **g} for k, g in enumerate(s["segments"])]
        else:
            items.append(s)
    for s in items:
        if only and s["id"] not in only and s["id"].rsplit("-", 1)[0] not in only:
            continue
        text = s["say"] if "say" in s else s["text"]
        digest = hashlib.sha256(json.dumps([text, settings], sort_keys=True).encode()).hexdigest()
        wav, stamp = out / f"{s['id']}.wav", out / f"{s['id']}.sha"
        if wav.exists() and stamp.exists() and stamp.read_text() == digest:
            print(f"{s['id']}: unchanged")
            continue
        if len(text) > 2500:
            raise SystemExit(f"{s['id']}: {len(text)} characters, the limit is 2,500")
        wav.write_bytes(speak(text, key, settings))
        stamp.write_text(digest)
        print(f"{s['id']}: {len(text)} characters -> {wav.name}")


if __name__ == "__main__":
    main()
