# AIrianne (RE:SONANCE / NeuroLoop) — Niche Evidence-Based Wellness Features & Neuro-Acoustics Spec

> **Regulatory Boundary (FDA General Wellness Policy / Section 3060(a) 21st Century Cures Act):**
> All features below are strictly framed as **General Wellness** interventions for relaxation, stress management, circadian hygiene, sensory grounding, and autonomic balance. They **never** claim to diagnose, treat, prevent, mitigate, or cure Major Depressive Disorder (MDD) or replace clinical TMS/psychiatric care.

---

## 1. Core + Niche Scientific Interventions

### A. Auditory & Cortical Neuromodulation (No "Annoying Buzz")
1. **40 Hz Amplitude-Modulated Natural Soundscapes (Acoustic GENUS)**
   - **Research:** Li-Huei Tsai Lab (MIT); Jirakittayakorn & Wongsawat (2017), *Frontiers in Neuroscience*.
   - **Mechanism:** Raw 40 Hz sine waves sound mechanical and unpleasant. Modulating the volume envelope (20–30% depth) of natural recordings (Nordic forest, rain, stream) at 40 Hz drives cortical gamma synchrony and microglia support while keeping the conscious listening experience soothing.
   - **Wellness Framing:** *"40 Hz Gamma-Modulated Soundscape for Mental Clarity & Calm."*

2. **Bilateral Alternating Auditory Panning (BLS)**
   - **Research:** Schubert et al. (2014), *"Facilitating Access to Emotions: Neural Signature of EMDR Stimulation"*, *PLoS ONE*; Rousseau et al. (2020).
   - **Mechanism:** Gentle 0.5–1.0 Hz stereo left-right panning (via Web Audio `StereoPannerNode`) of ambient chimes or rain droplets modulates the balance between the amygdala and dorsolateral prefrontal cortex (DLPFC), down-regulating emotional hyper-arousal and rumination loops.
   - **Wellness Framing:** *"Bilateral Stereo Grounding for Emotional Balance."*

3. **Biophilic Acoustic Grounding (Default Mode Network Down-Regulation)**
   - **Research:** Gould van Praag et al. (2017), *"Mind-wandering and alterations to default mode network connectivity when listening to naturalistic versus artificial sounds"*, *Scientific Reports* (Nature), 7, 45273.
   - **Mechanism:** Naturalistic sounds shift autonomic tone toward parasympathetic dominance (increased high-frequency HRV) and shift DMN connectivity outward, interrupting depressive rumination.

4. **1/f Pink Noise Acoustic Blanket**
   - **Research:** Ngo, Martinetz, Born, & Mölle (2013), *"Auditory closed-loop stimulation of the sleep slow oscillation enhances memory"*, *Neuron*.
   - **Mechanism:** Equal-energy-per-octave pink noise ($1/f$ spectral slope) sounds warmer and more organic than white noise and supports slow-wave restorative rest.

---

### B. Visual & Chronobiological Grounding
5. **Mid-Range Fractal Visuals ($D \approx 1.3 - 1.5$)**
   - **Research:** Hägerhäll, Laike, Taylor, Küller, & Martin (2008), *Perception*, 37(10), 1488–1494; Taylor (2021), *Sustainability*.
   - **Mechanism:** Viewing natural or procedurally generated fractals with a fractal dimension between **1.3 and 1.5** (matching trees, clouds, coastlines) increases frontal alpha EEG waves (wakeful relaxation) and reduces physiological skin-conductance stress by up to **60%**.
   - **Implementation:** Replace generic loading/breathing circles with a smoothly breathing, procedurally generated organic fractal silhouette ($D \approx 1.35$).

6. **Morning Melanopsin ipRGC Activation & Evening Blue Attenuation**
   - **Research:** Lam et al. (2016), *JAMA Psychiatry*, 73(1), 56–63.
   - **Mechanism:** Morning ~480 nm light stimulates melanopsin ipRGCs to reset circadian phase delay; evening amber/red avoids melatonin suppression.
   - **Implementation:** Arduino Bedside "NeuroPod" LED ring (sunrise amber-cyan ramp in the morning; zero-blue candle amber at night).

---

### C. Somatic & Olfactory Bypass (Zero Executive Effort)
7. **Cyclic Sighing (Physiological Sigh)**
   - **Research:** Balban, Neri, Kogon, Spiegel, & Huberman (2023), *"Brief structured respiration practices enhance mood and reduce physiological arousal"*, *Cell Reports Medicine*, 4(1), 100895.
   - **Mechanism:** Two rapid nasal inhales + extended oral exhale outperformed mindfulness meditation in boosting daily positive affect and lowering resting respiratory rate.

8. **0.1 Hz Resonance Frequency Pacing**
   - **Research:** Pizzoli et al. (2021), *Scientific Reports*, 11, 6614; Caldwell & Steffen (2018), *International Journal of Psychophysiology*.
   - **Mechanism:** ~6 breaths/min (4.5s inhale / 5.5s exhale) synchronizes respiratory sinus arrhythmia with the baroreflex arc, strengthening vagal tone.

9. **Trigeminal-Vagal Cold Face Reset (Mammalian Dive Reflex)**
   - **Research:** Cold Face Test / DBT TIPP somatic literature.
   - **Mechanism:** Cold stimulus ($<10^\circ\text{C}$) on forehead/upper cheeks activates trigeminal nerve ($V_1/V_2$) $\to$ brainstem $\to$ vagus nerve, triggering immediate parasympathetic heart-rate deceleration during acute panic or overwhelm.
   - **Implementation:** 30-second voice-guided "Acute Reset" prompting the user to hold a cool cloth or splash cool water on their cheeks while listening to the slow chime.

10. **Proustian Olfactory Grounding (Direct Amygdala-Hippocampal Bypass)**
    - **Research:** Young et al. (2024), *"Recall of Autobiographical Memories Following Odor vs Verbal Cues Among Adults With Major Depressive Disorder"*, *JAMA Network Open*, 7(2), e2356001.
    - **Mechanism:** Olfaction is the only sense that bypasses the thalamus and projects directly to the amygdala and hippocampus, breaking negative rumination faster than verbal prompts.
    - **Implementation:** Voice agent suggests a 30-second "Sensory Anchor" using a familiar bedside scent (pine, citrus, coffee) paired with a pleasant memory.

---

## 2. Audio & Nature Sound Architecture

### Why Pre-Bundled + Procedural + ElevenLabs Hybrid Wins
1. **Pre-Bundled CC0 Nature Loops (Zero Latency, Offline-Safe for Expo Demo):**
   - Stored in `mobile/assets/audio/` (or `portal/` / web public assets).
   - Generated/sourced locally so the Sunday live table demo never fails due to Wi-Fi drops.
2. **Real-Time DSP Processing (40 Hz AM + Bilateral Panning + Pink Noise):**
   - Any nature soundscape or procedural ambient synth can be passed through:
     - **40 Hz LFO Amplitude Modulator** (subtle 20–30% gain modulation).
     - **0.5 Hz Bilateral Stereo Panner** (smooth left-right oscillation for headphone grounding).
3. **ElevenLabs Sound Effects API (`POST /v1/sound-generation`) On-Demand:**
   - Uses `RE_ELEVENLABS_API_KEY` with `"loop": true` and `model_id: "eleven_text_to_sound_v3"` to generate custom user-requested scenes (e.g., *"Finnish birch forest in light rain"*).

---

## 3. Prompt Template for Teammate / External LLM

> **Copy-paste below if handing off to another coding agent:**
>
> We are building **AIrianne (RE:SONANCE / NeuroLoop)** for Aalto University Challenge #343 ("Beyond the Clinic") and the Arduino Track at Junction 2026. It is a zero-effort General Wellness ambient companion for post-TMS recovery.
>
> Strictly maintain the **FDA General Wellness** boundary: never claim to diagnose, treat, prevent, or cure depression. Frame all features around relaxation, stress management, circadian rhythm, and autonomic balance.
>
> Currently, `backend/` (FastAPI + PostgreSQL), `mobile/` (Expo SDK 58 + ElevenLabs LiveKit voice), and `portal/` (Next.js clinician portal) are integrated and verified. The `nature` and `breathing` activities in `mobile/src/features/activity/activity-cues.ts` currently only have visual timers and no audio playback.
>
> Your next tasks:
> 1. Integrate the `NeuroAudioEngine` (40 Hz amplitude modulation, 0.5 Hz bilateral stereo panning, and procedural pink-noise/ambient synthesis) with pre-bundled nature sound loops (`forest_birds`, `gentle_rain`, `nordic_stream`).
> 2. Add support for **Cyclic Sighing** (double inhale + long exhale) and **0.1 Hz Resonance Breathing** in `activity-cues.ts`.
> 3. Render a $D \approx 1.35$ organic fractal visual canvas during listening sessions.
> 4. Connect the Arduino Bedside "NeuroPod" via Web Serial API for circadian sunrise/sunset lighting synchronized with the active session.
