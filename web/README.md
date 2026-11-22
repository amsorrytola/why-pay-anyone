# Website

The interactive site for "Why Pay Anyone?" (Next.js, React, Tailwind). It reads small JSON tables from `src/data/` (exported from `../data/processed/` by `../pipeline/export_web_data.py`), runs the economic models in the browser (`src/models/`), and has one server route, `src/app/api/chat/route.ts`, for the chatbot.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
```

The chatbot needs `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, `CHAT_DAILY_CAP`, `CHAT_PER_IP_PER_10MIN`) in `.env.local` or the host's environment variables. Without a key it answers from a few canned replies. Never commit the key.
