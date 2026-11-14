# Haven — Screens

16 screens, 390×844, arranged left to right in flow order on the "App Presentation" page. Each
connector below is a real Figma prototype interaction (tap → navigate) in the file, not just a drawn
arrow — press **Play** on the page to click through.

Flow overview:

```
Splash → Home ──┬─→ Treatment Hub ──┬─→ Breathing Exercise ──→ (back to Treatment Hub)
                 │                   └─→ Sound Relaxation ──→ (back to Treatment Hub)
                 ├─→ Chat Mode Select ──┬─→ Text Chat ──→ (back to Home)
                 │                      └─→ Voice Chat: Camera Choice ──┬─→ Video Chat
                 │                                                      └─→ Camera & Data Consent
                 │                                                            → Questionnaire Intro
                 │                                                            → PHQ-9 → BDI-II
                 │                                                            → Facial Recording (30s)
                 │                                                            → Recording Complete
                 │                                                            → Video Chat
                 └─→ Report Analysis ──→ (back to Home)
Video Chat ──→ Report Analysis (optional "view my report" link) and ──→ (back to Home)
```

---

### 1. Splash / init
**Purpose:** First moment on launch — set the calm tone before anything else loads.
**Key elements:** Logo mark (96px), "Haven" wordmark, tagline "Gentle support for every day." Centered,
otherwise empty — no loading bar, nothing clinical.
**Flow:** → Home (auto-advance after load; tap anywhere in the demo).

### 2. Home
**Purpose:** Daily landing point; surfaces the one thing the AI coach thinks is worth doing today, plus
quick access to the three feature areas.
**Key elements:** Greeting header ("Good evening, Alex"), a full-width "Today's breathing moment"
suggestion card, two side-by-side cards (Treatment, Chat), bottom nav (Home / Treatment / Chat /
Report).
**Flow:** → Treatment Hub, → Chat Mode Select, → Report Analysis.

### 3. Treatment Hub
**Purpose:** Entry point to the two calming tools.
**Key elements:** Header "Treatment" + back, two stacked cards — "Breathing exercise" (3 min),
"Sound relaxation" (Baroque · Rain · Leaves).
**Flow:** → Breathing Exercise, → Sound Relaxation; back → Home.

### 4. Breathing Exercise
**Purpose:** Guided breathing with a visual pacing cue.
**Key elements:** Large circular progress ring (accent stroke) with "Inhale" + a count inside, an
instruction line below it ("Breathe in slowly through your nose for 4 seconds."), cycle counter
("Cycle 2 of 6"), Pause button, "End session" ghost link. The ring is drawn mid-cycle (~70% progress)
to read as animated even as a static frame.
**Flow:** back → Treatment Hub.

### 5. Sound Relaxation
**Purpose:** Ambient sound player for Baroque music, rain, or leaves.
**Key elements:** Now-playing card (track name, remaining time, a flat bar "waveform"), transport row
(previous / play-pause / next) with a progress bar, and three selectable chips for the three sound
options (one shown selected).
**Flow:** back → Treatment Hub.

### 6. Chat Mode Select
**Purpose:** Let the user choose how they want to talk to the AI coach.
**Key elements:** Header "Chat with Haven", two full-width option cards — "Text" and "Voice" — each
with a "Choose" action, footer reassurance ("You can always switch later.").
**Flow:** → Text Chat, → Voice Chat: Camera Choice.

### 7. Text Chat
**Purpose:** Text conversation with the AI coach.
**Key elements:** Header with small Logo + "Haven" + "Here for you", a short chat transcript (AI bubble,
user bubble, AI bubble) demonstrating the coach referencing a past habit, bottom input bar with mic and
send actions.
**Flow:** back → Home.

### 8. Voice Chat — Camera Choice
**Purpose:** Before a voice call starts, let the user opt in or out of camera-based facial analysis.
**Key elements:** Header "Voice chat", explanatory line that camera use is optional, two option cards —
"Camera off — just talk" and "Camera on" (badged "Optional check-in") — footnote that it can be turned
off anytime mid-call.
**Flow:** camera off → Video Chat; camera on → Camera & Data Consent.

### 9. Camera & Data Consent
**Purpose:** Explicit consent before any facial capture happens — required by the spec ahead of the
questionnaires and recording.
**Key elements:** Camera glyph, plain-language explanation of what the analysis does and why, a
3-item reassurance checklist (secure cloud processing, used only to personalize support, can be turned
off anytime), primary "I agree, continue" + secondary "Not now".
**Flow:** → Questionnaire Intro.

### 10. Questionnaire Intro (pop-up)
**Purpose:** Set expectations before the two questionnaires — the one place in the file that is a true
floating modal (and the one screen allowed a soft shadow, per the design system's elevation rule).
**Key elements:** Dimmed backdrop, centered card: "Just two quick check-ins", short explanation
("about 3 minutes"), primary "Start" + ghost "Skip for now".
**Flow:** → PHQ-9 Questionnaire.

### 11. PHQ-9 Questionnaire
**Purpose:** First standardized check-in question.
**Key elements:** "Check-in 1 of 2" header + progress bar, one PHQ-9-style question ("Over the last 2
weeks, how often have you felt little interest or pleasure in doing things?"), four selectable answer
rows (one shown selected), "Next" button.
**Flow:** → BDI-II Questionnaire.

### 12. BDI-II Questionnaire
**Purpose:** Second standardized check-in question.
**Key elements:** "Check-in 2 of 2" header + progress bar (near full), one BDI-II-style question
(outlook on the future), four selectable answer rows, "Next" button.
**Flow:** → Facial Recording.

### 13. Facial Recording (30s)
**Purpose:** The 30-second facial capture itself.
**Key elements:** Countdown ring (accent stroke, ~60% progress) with seconds remaining ("18"), a
camera-preview panel with an abstract face silhouette (vector shapes only — no photo), instruction line
("Look at the camera and relax — this will only take a moment."), small "Cancel" text action.
**Flow:** → Recording Complete.

### 14. Recording Complete
**Purpose:** Unambiguous success state so the user knows the capture is done before moving on.
**Key elements:** Checkmark glyph in an accent circle, "All done!", reassuring subcopy, primary
"Continue" button.
**Flow:** → Video Chat.

### 15. Video Chat
**Purpose:** The live video conversation with the AI coach (camera-on path), or a bare audio call
(camera-off path reaches the same screen with the preview panel simply unused).
**Key elements:** Header with call timer, a large self-view panel (abstract face silhouette, sage tone),
a small inset Logo mark indicating the AI's presence, bottom controls (mic toggle, camera toggle, end
call).
**Flow:** → Report Analysis (optional "view my report"); back → Home.

### 16. Report Analysis
**Purpose:** Show the facial-analysis trend over time in a plain, reassuring way — explicitly
placeholder data, never framed as a diagnosis.
**Key elements:** Header "Your report", a 3-tile summary card (mood trend, check-ins this week, streak
— one figure highlighted in accent), a 6-week flat line trend chart (one notable point in accent, rest
in ink), a short "Notable changes" list in plain language, a caption disclaiming it's a general trend,
not a diagnosis.
**Flow:** back → Home.
