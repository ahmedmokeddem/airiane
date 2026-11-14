# Why AIriane suggests what it suggests

This is the explanation to give judges. Everything below is implemented in
`backend/app/guidance.py` as plain rules; there is no hidden model.

## What the suggestion is based on

Only values the patient **said and then confirmed on screen** in today's check-in:
mood (0–10), energy (0–10) and sleep (hours). Nothing is inferred from tone of voice or the camera
(see "What is not built" below).

| Today's confirmed check-in | What moves to the front | Why |
|---|---|---|
| No check-in yet | Calm Breathing, then the catalog order | A safe, low-effort default |
| Mood ≤ 4 | Short walk, message someone, favourite song, daylight, tidy one thing | Behavioural activation: small doable actions and contact counter withdrawal |
| Sleep < 6 h | Daylight, breathing, gentle stretch, water | Light is the main body-clock signal; keep demands low after a short night |
| Energy ≤ 3 | Breathing, water, warm cup, shoulder release, song, grounding | Lowest-effort options first; anhedonia and fatigue make high-effort tasks a barrier |

If several apply, energy wins, because an activity the patient cannot start helps nobody. An
activity the patient picks from the catalog is always offered first.

## Evidence behind each kind of activity

These are the well-established findings the short in-app reasons paraphrase. **Check each citation
before putting it on a slide**; they were written from memory, not looked up for this document.

- **Behavioural activation** (walk, warm cup, tidy, water): an established psychological treatment
  for depression, comparable to CBT in trials, and simpler to deliver (Ekers et al., 2014
  meta-analysis; Richards et al., 2016, *Lancet*, COBRA trial).
- **Physical activity / walking**: exercise reduces depressive symptoms (Schuch et al., 2016
  meta-analysis; Singh et al., 2023, *Br J Sports Med* umbrella review).
- **Slow paced breathing**: associated with increased heart-rate variability and lower
  self-reported arousal (Zaccaro et al., 2018, *Front Hum Neurosci* review).
- **Daylight exposure**: light is the primary circadian time cue; bright-light treatment improves
  mood in depression (Golden et al., 2005 meta-analysis).
- **Muscle release**: progressive muscle relaxation lowers self-reported stress and anxiety.
- **Music listening**: associated with short-term mood improvement and lower stress.
- **Brief social contact**: social withdrawal is both a symptom and a maintaining factor in
  depression; low-pressure contact is a standard behavioural-activation target.
- **40 Hz sound**: gamma sensory stimulation is early-stage research (mostly animal and small human
  studies in Alzheimer's disease). It is offered as a calm listening pause, **not** as a treatment,
  and the app says so.

## The doctor's "Needs attention" flag

A transparent rule over data the patient currently shares with that doctor, not a relapse
prediction:

- the patient asked for a check-in (needs "check-in requests" sharing);
- latest confirmed mood ≤ 3, energy ≤ 3 or sleep < 5 h in the last 7 days (needs report sharing);
- latest mood is 3 or more points below the average of earlier check-ins;
- there were check-ins before, but none for 7–21 days.

The thresholds are demo assumptions. A clinical team must set and validate them before real use.

## What is not built, and why

**Voice-emotion and facial recognition are not implemented.** The app does not analyse tone of
voice or the camera image:

- The camera is local preview only by design: no frame leaves the phone, and the API contract has
  no field that could carry one.
- The voice provider returns words, not validated emotion measurements.
- No voice or face "depression detector" is validated for clinical use, and in the EU emotion
  inference from biometrics is tightly regulated; a wrong reading shown to a doctor could do harm.

To add it responsibly: run an on-device model (nothing uploaded), ask separate explicit consent,
present its output to the patient as a suggestion to confirm (like check-in answers), and validate
it with the clinical partner before any of it reaches a doctor.
