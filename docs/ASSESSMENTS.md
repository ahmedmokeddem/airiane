# Full assessment questionnaires (assets/Book1.ods)

Code: `backend/app/assessments.py` (definitions + scoring), `mobile/src/features/assessment/`
(conversation), `portal/components/assessment-results.tsx` (doctor view).

## What was implemented from the spreadsheet

| Sheet | Content | Where it is used |
|---|---|---|
| Sheet1 PHQ-9 | Q1–Q9 scored 0–3, total 0–27 | Questions, scoring |
| Sheet1 PHQ-9 | Bands 0–9 low · 10–14 medium · 15–27 high, "Scale bar visualize" | Scale bar in the doctor report |
| Sheet1 PHQ-9 | Q10 functional impairment, "not calculated in the final result" | Asked and reported, not added |
| Sheet1 PHQ-9 | "If Q9 > 0: extra question" | Safety follow-up (below) |
| Sheet1 "BDI-II" | 21 questions, total 0–63 | Questions, scoring |
| Sheet2 | PHQ-9 preliminary assessment, suggested action, interpretation per band | Doctor report, verbatim |
| Sheet2 | BDI mapping: 8 symptom groups and 4 severity bands | Group scores + severity in the doctor report |
| Sheet3 | 4 source links | `citations` on each questionnaire |

The sheet's own example answers (the "x" marks) score **10/27, Moderate depressive symptoms**, Q9
positive. This is a backend test.

## Decisions (agreed with the product owner)

1. **Extra question:** "If Q9 > 0: extra question" is PHQ-9 Q10 (functional impairment, the purple
   row). It is asked only when Q9 > 0, uses the official PHQ-9 labels (Not difficult at all ·
   Somewhat difficult · Very difficult · Extremely difficult) and is never added to the total.
2. **Q9 > 0 sends everything to the doctor:** if a doctor is connected, the patient is told before
   the first question that answering Q9 above "Not at all" sends all their answers to that doctor.
   On submission the doctor receives a flagged item with every question and the answer chosen,
   even without report sharing; it stops being visible if the connection is ended. Crisis contacts
   (112, MIELI Crisis Helpline 09 2525 0111 — verify before real use) are shown at once.
3. **Extended set:** reworded BDI-II themes, not the licensed BDI-II; results say "Indicative only".
4. **BDI bands:** the standard BDI-II cut-offs from the 1996 manual (Beck, Steer & Brown):
   0–13 minimal, 14–19 mild, 20–28 moderate, 29–63 severe (Sheet2). Sheet1's 0–9/10–27/28–63 are
   not the published bands.
5. **Labels:** PHQ-9 uses the official "Not at all · Several days · More than half the days ·
   Nearly every day". The extended set has no official generic labels (the BDI-II uses per-item
   statements), so it uses Not at all · A little · Quite a lot · Very much, with Q4 (enjoyment)
   reversed so more enjoyment scores lower.
6. **Patients see their total only**; the severity wording is for the clinician.

## Flow

The patient asks for a "full assessment" (or taps "Fuller check" on Home). The companion reads
each question; spoken or typed answers only highlight an option, and the patient taps to record
it. Nothing is saved until every applicable question is answered. The backend then scores it,
the app creates a new report, and the doctor sees the result if the patient shares reports.
Doctors' patient lists flag a positive Q9 ("all answers sent to you") or a PHQ-9 of 10+ under
"Needs attention".

Database: apply `database/migrations/0003_clinical_questionnaires.sql` on PostgreSQL (the
baseline forbade clinical questionnaires). The development SQLite database needs nothing.
