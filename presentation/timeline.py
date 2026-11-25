"""Lay out the presentation's timeline from the narration clips.

Reads presentation/narration.json and the clips made by tts.py (build/audio/<scene>-<n>.wav), then writes
  deck/timeline.js          the frame of every scene and sentence, for the deck to time its animation by
  build/narration.wav       the whole voice track, every clip at its place
  ../web/public/presentation/captions.vtt   captions for the website's player
  ../web/src/data/presentation_chapters.json  chapter start times for the website's chapter list

    .venv/bin/python -I presentation/timeline.py
"""

import json
import wave
from array import array
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUDIO = HERE / "build" / "audio"
FPS = 30
TRANSITION = 18  # frames two scenes overlap while one hands over to the next
LEAD = {"open": 3.4, "close": 1.0}  # seconds of picture before the first sentence of a scene
TAIL = {"meaning": 1.8, "close": 4.0, "india": 1.6}  # seconds of picture after the last sentence
DEFAULT_LEAD, DEFAULT_TAIL, DEFAULT_GAP = 0.9, 1.15, 0.36


def vtt_time(sec: float) -> str:
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


def main() -> None:
    scenes = json.loads((HERE / "narration.json").read_text())
    rate = None
    clips = {}
    for s in scenes:
        for k in range(len(s["segments"])):
            with wave.open(str(AUDIO / f"{s['id']}-{k}.wav")) as w:
                if rate is None:
                    rate, width, channels = w.getframerate(), w.getsampwidth(), w.getnchannels()
                assert (w.getframerate(), w.getsampwidth(), w.getnchannels()) == (rate, width, channels)
                clips[(s["id"], k)] = w.readframes(w.getnframes())
    assert width == 2, "expected 16-bit audio"

    out, start = [], 0  # start: absolute frame where the scene begins
    for i, s in enumerate(scenes):
        t = LEAD.get(s["id"], DEFAULT_LEAD)
        segs = []
        for k, g in enumerate(s["segments"]):
            n = len(clips[(s["id"], k)]) // (width * channels)
            dur = n / rate
            segs.append({"k": k, "at": round(t * FPS), "len": round(dur * FPS), "text": g["text"], "say": g.get("say", g["text"]), "sec": t})
            t += dur
            if k < len(s["segments"]) - 1:
                t += s["segments"][k + 1].get("pause", DEFAULT_GAP)
        t += TAIL.get(s["id"], DEFAULT_TAIL)
        length = round(t * FPS)
        out.append({"id": s["id"], "chapter": s.get("chapter", ""), "from": start, "len": length, "segs": segs})
        start += length - (TRANSITION if i < len(scenes) - 1 else 0)
    total = start

    # whole voice track
    samples = array("h", bytes(2 * channels * (round(total / FPS * rate) + rate)))
    for sc in out:
        for g in sc["segs"]:
            pcm = array("h", clips[(sc["id"], g["k"])])
            off = round((sc["from"] / FPS + g["sec"]) * rate) * channels
            samples[off : off + len(pcm)] = pcm
    (HERE / "build").mkdir(exist_ok=True)
    with wave.open(str(HERE / "build" / "narration.wav"), "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(samples.tobytes())

    # captions and chapters for the website
    site = HERE.parent / "web"
    (site / "public" / "presentation").mkdir(parents=True, exist_ok=True)
    cues = ["WEBVTT", ""]
    chapters = []
    names = {"open": "Opening", "close": "Closing"}
    for sc in out:
        chapters.append({
            "id": sc["id"],
            "title": sc["chapter"] or names.get(sc["id"], sc["id"]),
            "start": round(sc["from"] / FPS + (TRANSITION / FPS if sc["from"] else 0), 2),
            "text": " ".join(g["text"] for g in sc["segs"]),
        })
        for g in sc["segs"]:
            a = sc["from"] / FPS + g["sec"]
            b = a + g["len"] / FPS
            cues += [f"{vtt_time(a)} --> {vtt_time(b)}", g["text"], ""]
    (site / "public" / "presentation" / "captions.vtt").write_text("\n".join(cues))
    (site / "src" / "data" / "presentation_chapters.json").write_text(json.dumps({"duration": round(total / FPS, 2), "chapters": chapters}, indent=1))

    for sc in out:
        for g in sc["segs"]:
            del g["sec"]
    (HERE / "deck").mkdir(exist_ok=True)
    (HERE / "deck" / "timeline.js").write_text(
        "// Made by presentation/timeline.py from the narration clips. Do not edit by hand.\n"
        f"window.TIMELINE = {json.dumps({'fps': FPS, 'transition': TRANSITION, 'total': total, 'scenes': out})};\n"
    )
    print(f"{len(out)} scenes, {total} frames = {total / FPS / 60:.2f} minutes")
    for sc in out:
        print(f"  {sc['id']:9s} from {sc['from'] / FPS:6.1f}s  length {sc['len'] / FPS:5.1f}s")


if __name__ == "__main__":
    main()
