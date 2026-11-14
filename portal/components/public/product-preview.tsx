"use client";
import { useState } from "react";
import { Icon } from "../brand";
export function CompanionOrb() {
  return (
    <div className="companion-orb" aria-hidden="true">
      <span className="orb-face">
        <i />
        <i />
        <b />
      </span>
    </div>
  );
}
export function ProductPreview() {
  const [mode, setMode] = useState<"voice" | "text" | "journey">("voice");
  return (
    <div className="product-composition">
      <svg
        className="hero-thread"
        viewBox="0 0 680 760"
        fill="none"
        aria-hidden="true"
      >
        <path
          className="thread-shadow"
          d="M10 560C160 770 640 740 574 450C538 290 143 466 171 236C184 126 450 206 500 35"
        />
        <path
          className="thread-draw"
          pathLength="1"
          d="M10 560C160 770 640 740 574 450C538 290 143 466 171 236C184 126 450 206 500 35"
        />
        <circle cx="500" cy="35" r="6" />
      </svg>
      <div className="preview-note">
        <span className="tiny-spark" />A little space for yourself.
      </div>
      <div className={`preview-phone preview-${mode}`}>
        <div className="phone-status">
          <span>9:41</span>
          <span aria-hidden="true">● ▰</span>
        </div>
        <div className="phone-brand">
          Your companion<span>AIriane</span>
        </div>
        {mode === "voice" ? (
          <>
            <CompanionOrb />
            <p className="phone-prompt">
              No rush.
              <br />
              I’m here to listen.
            </p>
            <div className="voice-wave" aria-hidden="true">
              {Array.from({ length: 17 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    height: Math.max(
                      4,
                      Math.round(8 + Math.sin(i * 2) * 12 + Math.cos(i) * 12),
                    ),
                  }}
                />
              ))}
            </div>
            <div className="phone-controls">
              <span>
                <Icon name="voice" />
              </span>
              <span>
                <Icon name="message" />
              </span>
              <span className="end-call">⌁</span>
            </div>
          </>
        ) : mode === "text" ? (
          <div className="phone-chat">
            <p className="bubble patient-bubble">
              Long day. I just need a moment.
            </p>
            <div className="mini-orb" />
            <p className="bubble">
              We can take this slowly. You don’t need to have it all figured
              out.
            </p>
            <p className="bubble patient-bubble">Maybe something quiet?</p>
            <div className="mini-activity">
              <Icon name="leaf" />
              <strong>Calm Breathing</strong>
              <span>A minute, at your pace.</span>
            </div>
          </div>
        ) : (
          <div className="phone-journey">
            <p>Your Journey</p>
            <h3>
              Small moments.
              <br />
              Your own thread.
            </h3>
            <svg viewBox="0 0 200 220" fill="none" aria-hidden="true">
              <path
                d="M40 210C200 180 15 140 125 105S155 10 70 10"
                stroke="#79cbbd"
                strokeWidth="2"
              />
              <circle cx="40" cy="210" r="5" fill="#166a61" />
              <circle cx="125" cy="105" r="6" fill="#166a61" />
              <circle cx="70" cy="10" r="5" fill="#166a61" />
            </svg>
            <span className="journey-label journey-one">
              A moment to breathe
            </span>
            <span className="journey-label journey-two">
              Your saved reflection
            </span>
          </div>
        )}
      </div>
      <div
        className="preview-switch"
        role="group"
        aria-label="Explore product preview"
      >
        {(["voice", "text", "journey"] as const).map((tab) => (
          <button
            key={tab}
            aria-pressed={mode === tab}
            onClick={() => setMode(tab)}
          >
            <Icon
              name={
                tab === "voice" ? "voice" : tab === "text" ? "message" : "path"
              }
            />
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <p className="preview-disclosure">
        Illustrative preview of existing app experiences.
      </p>
    </div>
  );
}
