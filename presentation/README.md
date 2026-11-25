# Presentation video

The narrated video on `/presentation` (`web/public/presentation/why-pay-anyone.mp4`), rebuilt from this folder.

1. `narration.json`: the script, one entry per sentence (`text` is shown as captions; `say` is how numbers are spoken).
2. `SARVAM_API_KEY=... ../.venv/bin/python -I tts.py`: one voice clip per sentence (Sarvam AI, Bulbul v4, voice `shubh_en_narration`), into `build/audio/`. Clips are only re-made when their text changes.
3. `../.venv/bin/python -I timeline.py`: lays out scenes and sentences, writes `deck/timeline.js`, the voice track, `web/public/presentation/captions.vtt` and the chapter list the site shows.
4. `../.venv/bin/python -I deckdata.py`: copies the numbers the charts need from `web/src/data` into `deck/data.js`.
5. `node render.mjs stills price+12` to check single frames; `node render.mjs video --workers 8` to render every frame with Chrome and encode with ffmpeg (about 6 minutes of work).

`deck/deck.js` draws each frame as a pure function of the frame number (no CSS animation), following Remotion's motion guidance: eased and spring-like interpolation, a wipe between scenes, a safe area of 120 px.
