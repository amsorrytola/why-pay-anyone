# Website

The interactive site for "Why Pay Anyone?" (Next.js, React, Tailwind). It reads small JSON tables from `src/data/` (exported from `../data/processed/` by `../pipeline/export_web_data.py`), runs the economic models in the browser (`src/models/`), and has one server route, `src/app/api/chat/route.ts`, for the chatbot.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
```

The chatbot route tries MiniMax first (`MINIMAX_API_KEY`, optional `MINIMAX_MODEL`), then Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL`), then a backup Gemini model (`GEMINI_BACKUP_MODEL`), so one busy provider does not stop it. Limits: `CHAT_DAILY_CAP` and `CHAT_PER_IP_PER_10MIN`. Put keys in `.env.local` or the host's environment variables; never commit them. Without any key it answers from a few canned replies.

Pages: `/` (home), `/journey` (guided reading), `/m1` to `/m6` and `/india` (the seven chapters), `/concepts`, `/data`, `/presentation` (the narrated video) and `/report` (the PDF report). The video, its captions and the report PDF are static files in `public/`.
