"use client";

import { useEffect, useRef, useState } from "react";
import chapters from "@/data/presentation_chapters.json";

type Chapter = { id: string; title: string; start: number; text: string };
const CH = chapters.chapters as Chapter[];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The narrated video, with a chapter list that jumps the video and follows it, and the full transcript. */
export function PresentationPlayer() {
  const video = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const on = () => setNow(v.currentTime);
    v.addEventListener("timeupdate", on);
    return () => v.removeEventListener("timeupdate", on);
  }, []);

  const current = CH.reduce((acc, c, i) => (now + 0.25 >= c.start ? i : acc), 0);
  const jump = (c: Chapter) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = c.start;
    void v.play().catch(() => undefined);
    v.focus({ preventScroll: true });
  };

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <figure className="m-0">
          <figcaption className="fig-title ui mb-3 text-[1.02rem] font-semibold leading-snug">
            The project in {Math.round(chapters.duration / 60)} minutes, narrated
          </figcaption>
          <div className="border border-ink bg-paper-2">
            <video
              ref={video}
              controls
              preload="metadata"
              playsInline
              poster="/presentation/poster.jpg"
              className="block aspect-video w-full bg-paper"
              aria-describedby="transcript"
            >
              <source src="/presentation/why-pay-anyone.mp4" type="video/mp4" />
              <track kind="captions" src="/presentation/captions.vtt" srcLang="en" label="English" />
              Your browser cannot play this video. <a href="/presentation/why-pay-anyone.mp4">Download the MP4</a>.
            </video>
          </div>
          <p className="ui mt-2 text-[0.84rem] text-ink-faint">
            1080p, {clock(chapters.duration)}, captions available. Narration is a synthetic voice (Sarvam AI, Bulbul v4); every chart is drawn from the same data as this site.
          </p>
        </figure>

        <nav aria-label="Video chapters">
          <h2 className="ui text-[1.02rem] font-semibold">Chapters</h2>
          <ol className="mt-3 border-t border-ink">
            {CH.map((c, i) => (
              <li key={c.id} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => jump(c)}
                  aria-current={i === current ? "true" : undefined}
                  className={`ui flex min-h-[44px] w-full items-baseline gap-3 py-2 text-left text-[0.92rem] ${i === current ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"}`}
                >
                  <span className="w-10 shrink-0 font-normal text-ink-faint">{clock(c.start)}</span>
                  <span className={i === current ? "underline decoration-2 underline-offset-4" : ""}>{c.title.replace(/^Chapter (\d)\. /, "$1. ")}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-col gap-3">
            <a href="/report/why-pay-anyone-report.pdf" className="btn btn-ink">
              Read the report (PDF)
            </a>
            <a href="/presentation/why-pay-anyone.mp4" download className="btn btn-ghost">
              Download the video
            </a>
          </div>
        </nav>
      </div>

      <section id="transcript" className="mt-12 max-w-[66ch]">
        <h2 className="text-[1.5rem]">Transcript</h2>
        <div className="mt-3 border-t border-ink pt-2">
          {CH.map((c) => (
            <div key={c.id} className="mt-4">
              <h3 className="ui text-[0.95rem] font-semibold">
                <button type="button" onClick={() => jump(c)} className="text-left hover:underline">
                  <span className="mr-2 font-normal text-ink-faint">{clock(c.start)}</span>
                  {c.title}
                </button>
              </h3>
              <p className="mt-1 text-[1.05rem] leading-[1.65]">{c.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
