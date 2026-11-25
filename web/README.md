# Website

The interactive site for "Why Pay Anyone?" (Next.js, React, Tailwind). It reads small JSON tables from `src/data/` (exported from `../data/processed/` by `../pipeline/export_web_data.py`), runs the economic models in the browser (`src/models/`), and has one server route, `src/app/api/chat/route.ts`, for the chatbot.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
```

The chatbot route streams its answer and tries, in order, Gemini 2.5 Flash with thinking off (`GEMINI_FAST_MODEL`), Gemini 2.5 Flash-Lite (`GEMINI_LITE_MODEL`), MiniMax (`MINIMAX_API_KEY`, optional `MINIMAX_MODEL`) and the newer Gemini model (`GEMINI_MODEL`), all with `GEMINI_API_KEY`. A provider that has not started answering by its deadline is skipped. Limits: `CHAT_DAILY_CAP` and `CHAT_PER_IP_PER_10MIN`. Put keys in `.env.local` or the host's environment variables; never commit them. Without any key it answers from a few canned replies.

Pages: `/` (home), `/journey` (guided reading), `/m1` to `/m6` and `/india` (the seven chapters), `/concepts`, `/data`, `/presentation` (the narrated video) and `/report` (the PDF report). The video, its captions and the report PDF are static files in `public/`.
