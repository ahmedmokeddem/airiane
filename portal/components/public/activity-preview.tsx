"use client";

import { useState } from "react";

const formats = [
  { id: "play", label: "Play", title: "A little pattern, a fresh focus.", goal: "Make me a one-minute game with shapes.", description: "Notice a sequence, then recreate it. A small game with a clear beginning and end.", example: "Pattern play" },
  { id: "create", label: "Create", title: "Make something just for you.", goal: "I’d like to draw something with soft colours.", description: "Explore colours and simple shapes on a private canvas. There is no right picture to make.", example: "A colour moment" },
  { id: "unwind", label: "Unwind", title: "Follow a gentler rhythm.", goal: "Give me a quiet moment to settle.", description: "Take a short guided pause with a visual focus and a pace you can follow comfortably.", example: "A quiet focus" },
  { id: "reflect", label: "Reflect", title: "Give your thoughts a little room.", goal: "Help me sort what’s on my mind.", description: "Organise thoughts into simple groups. The words you write in this activity stay on your device.", example: "Make a little space" },
  { id: "step", label: "Small steps", title: "Find one thing you can do.", goal: "Help me choose one small thing for today.", description: "Explore a manageable next step, then choose whether to do it. You decide what counts as finished.", example: "One small beginning" },
] as const;
type Format = (typeof formats)[number]["id"];

export function ActivityPreview() {
  const [selected, setSelected] = useState<Format>("play");
  const [sequence, setSequence] = useState<string[]>([]);
  const [colour, setColour] = useState("#a3eee2");
  const format = formats.find(item => item.id === selected)!;
  const target = ["circle", "square", "triangle"];
  const finished = sequence.length === target.length;
  const matched = finished && sequence.every((shape, index) => shape === target[index]);

  return (
    <div className="creation-preview">
      <div className="creation-intro">
        <span className="creation-badge">Generative activities · Preview</span>
        <h3>Tell AIriane what would help. Explore something made for the moment.</h3>
        <p>A short game, a creative pause, a way to reflect. Start with your own idea and choose an activity before you begin.</p>
        <div className="creation-options" role="group" aria-label="Explore activity formats">
          {formats.map(item => (
            <button key={item.id} type="button" aria-pressed={selected === item.id}
              aria-controls="creation-example" onClick={() => { setSelected(item.id); setSequence([]); }}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="creation-availability">An upcoming app experience, currently in testing. These examples run only on this page; they do not contact an AI service or save a record.</p>
      </div>
      <div id="creation-example" className="creation-example">
        <p className="creation-request">“{format.goal}”</p>
        <div className="creation-sheet">
          <span className="creation-example-label">Illustrative activity · 1 minute</span>
          <h4>{format.example}</h4>
          {selected === "play" ? (
            <div className="pattern-example">
              <div className="pattern-target" aria-label="Pattern to repeat: circle, square, triangle">
                {target.map(shape => <span key={shape} className={`preview-shape shape-${shape}`} />)}
              </div>
              <p>Try the pattern from left to right.</p>
              <div className="pattern-buttons" role="group" aria-label="Repeat the pattern">
                {target.map(shape => <button key={shape} type="button" aria-label={`Choose ${shape}`} disabled={finished}
                  onClick={() => setSequence(current => [...current, shape])}>
                  <span aria-hidden="true" className={`preview-shape shape-${shape}`} />
                </button>)}
              </div>
              <p className="pattern-feedback" role="status">{finished ? matched ? "That’s the pattern. A small moment of focus." : "A different pattern. You can try again." : `${sequence.length} of 3 shapes chosen`}</p>
              {finished && <button type="button" className="preview-reset" onClick={() => setSequence([])}>Try again</button>}
            </div>
          ) : selected === "create" ? (
            <div className="canvas-example">
              <svg viewBox="0 0 320 150" role="img" aria-label="Illustrative canvas with a circle, curved line and square">
                <circle cx="95" cy="70" r="43" fill={colour} />
                <path d="M30 125C100 10 165 160 285 35" fill="none" stroke="#166a61" strokeWidth="5" strokeLinecap="round" />
                <rect x="205" y="72" width="52" height="52" rx="12" fill="#b9ade8" transform="rotate(12 231 98)" />
              </svg>
              <div className="preview-palette" role="group" aria-label="Choose a colour for the circle">
                {[["Mint", "#a3eee2"], ["Lavender", "#b9ade8"], ["Honey", "#ebcb87"]].map(([name, value]) => <button key={name} type="button" aria-label={name} aria-pressed={colour === value} style={{backgroundColor:value}} onClick={() => setColour(value)} />)}
              </div>
            </div>
          ) : selected === "unwind" ? (
            <div className="focus-example"><div aria-hidden="true"><i /><i /><i /></div><p>A little space. Your own pace.</p></div>
          ) : selected === "reflect" ? (
            <div className="reflection-example"><span>What I can influence</span><span>What can wait</span><span>What I can let go of</span></div>
          ) : (
            <div className="step-example"><span>Step away from the screen</span><span>Stretch for a moment</span><span>Choose your own small step</span></div>
          )}
          <h5>{format.title}</h5>
          <p>{format.description}</p>
        </div>
      </div>
      <p className="creation-continuity">Choose → play at your pace → save completion and feedback → continue the conversation. Your saved moments belong in My Journey.</p>
    </div>
  );
}
