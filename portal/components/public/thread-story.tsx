"use client";
import { useState } from "react";
const story = [
  {
    title: "A thread, not a map",
    text: "In the story of Ariadne, a simple thread offered a way through the labyrinth. It didn’t choose the path. It helped someone find their own.",
  },
  {
    title: "A little room to untangle",
    text: "Some days call for conversation. Others, a quiet activity. AIriane makes room for both, without needing you to know exactly what comes next.",
  },
  {
    title: "Your pace. Your way.",
    text: "Your reflections and completed activities form a personal Journey. Small moments you choose to keep, without a score for how you should be doing.",
  },
];
export function ThreadStory() {
  const [step, setStep] = useState(0);
  return (
    <div className="thread-story">
      <div
        className="story-options"
        role="group"
        aria-label="The story behind AIriane"
      >
        {story.map((s, i) => (
          <button
            key={s.title}
            aria-pressed={step === i}
            onClick={() => setStep(i)}
          >
            <span aria-hidden="true" />
            {s.title}
          </button>
        ))}
      </div>
      <div className="story-visual">
        <svg viewBox="0 0 700 180" fill="none" aria-hidden="true">
          <path
            d="M0 140C90 140 80 30 170 60S230 170 330 130S400 15 490 55S550 150 700 55"
            stroke="#d0e5df"
            strokeWidth="2"
          />
          <path
            className="story-progress"
            pathLength="1"
            style={{ strokeDasharray: `${(step + 1) / 3} 1` }}
            d="M0 140C90 140 80 30 170 60S230 170 330 130S400 15 490 55S550 150 700 55"
            stroke="#166a61"
            strokeWidth="3"
          />
        </svg>
        <div aria-live="polite">
          <h3>{story[step].title}</h3>
          <p>{story[step].text}</p>
        </div>
      </div>
    </div>
  );
}
