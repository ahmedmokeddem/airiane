import { useCallback, useEffect, useRef, useState } from 'react';
import { api, request } from '../../integration/api';
import { TAP_SETTLE_MS, acceptAnswer, nextQuestion, previousQuestion, progress, submission, withoutAnswer, type AssessmentResult, type Answers, type Definition, type Question } from './assessment-flow';

export type AssessmentState =
  | { phase: 'idle' }
  | { phase: 'offer'; definitions: Definition[] }
  | { phase: 'asking'; definition: Definition; answers: Answers; question: Question; suggested: number | null; number: number; total: number }
  | { phase: 'paused'; definition: Definition; answers: Answers; number: number; total: number }
  | { phase: 'saving'; definition: Definition; answers: Answers }
  | { phase: 'done'; definition: Definition; result: AssessmentResult | null; reportCreated: boolean; sharedWithDoctor: boolean };

export type AnswerSource = 'tap' | 'voice';

/**
 * Runs one questionnaire conversation. Answers stay on the phone until every question that applies
 * is answered; only then are they submitted, scored by the backend and added to a new report.
 * `onQuestion` lets the companion read each question aloud or in chat.
 *
 * Guards against skipped questions: an answer must name the question currently shown, and a tap
 * only counts once that question has been visible for TAP_SETTLE_MS (taps queued while the screen
 * lagged would otherwise land on the next questions). Back undoes the last answer.
 */
export function useAssessment(onQuestion: (question: Question, definition: Definition, number: number, total: number) => void) {
  const [state, setStateRaw] = useState<AssessmentState>({ phase: 'idle' });
  const [safety, setSafety] = useState<'none' | 'concern'>('none');
  const [requested, setRequested] = useState(false);
  const [settled, setSettled] = useState(true);
  const stateRef = useRef<AssessmentState>(state);
  const shownAt = useRef(0);
  const submitting = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useRef(onQuestion);
  useEffect(() => { notify.current = onQuestion; }, [onQuestion]);
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const setState = useCallback((next: AssessmentState) => { stateRef.current = next; setStateRaw(next); }, []);

  const ask = useCallback((definition: Definition, answers: Answers) => {
    // Safety follows the current Q9 answer, so going back and correcting it clears the alert.
    setSafety((answers.q9 ?? 0) > 0 ? 'concern' : 'none');
    const question = nextQuestion(definition, answers);
    if (!question) return false;
    const { number, total } = progress(definition, answers);
    setState({ phase: 'asking', definition, answers, question, suggested: null, number, total });
    shownAt.current = Date.now();
    setSettled(false);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettled(true), TAP_SETTLE_MS);
    notify.current(question, definition, number, total);
    return true;
  }, [setState]);

  const offer = useCallback(async () => {
    const definitions = await api.assessments();
    setState({ phase: 'offer', definitions });
    return definitions;
  }, [setState]);

  const begin = useCallback((definition: Definition) => {
    setRequested(false);
    ask(definition, {});
  }, [ask]);

  const suggest = useCallback((questionId: string, value: number) => {
    const current = stateRef.current;
    if (current.phase !== 'asking' || current.question.question_id !== questionId) return false;
    if (!(current.question.options ?? []).some(o => o.value === value)) return false;
    setState({ ...current, suggested: value });
    return true;
  }, [setState]);

  const clearSuggestion = useCallback(() => {
    const current = stateRef.current;
    if (current.phase === 'asking') setState({ ...current, suggested: null });
  }, [setState]);

  /**
   * Record `value` for `questionId`. Returns false when ignored: not the question on screen, a tap
   * before the question settled, or a submission already running. `hasDoctor`: the patient was told
   * a Q9 answer above 0 sends all answers to their connected doctor.
   */
  const answer = useCallback(async (questionId: string, value: number, sessionId: string | null, hasDoctor: boolean, source: AnswerSource = 'tap') => {
    const current = stateRef.current;
    if (current.phase !== 'asking') return false;
    if (!acceptAnswer(current.question, questionId, value, source, Date.now() - shownAt.current, submitting.current)) return false;
    const { definition } = current;
    const answers = { ...current.answers, [questionId]: value };
    if (ask(definition, answers)) return true;
    submitting.current = true;
    setState({ phase: 'saving', definition, answers });
    try {
      const saved = await api.submitAssessment(definition, submission(definition, answers), sessionId, hasDoctor);
      // A new report including this result; it stays private unless the patient shares reports.
      let reportCreated = false;
      try {
        const end = new Date(); const start = new Date(end.getTime() - 14 * 86400000);
        await request('/reports', { period_start: start.toISOString(), period_end: end.toISOString(), compare_previous: true });
        reportCreated = true;
      } catch { /* The result is saved even if the report could not be created now. */ }
      setState({ phase: 'done', definition, result: saved.result ?? null, reportCreated, sharedWithDoctor: !!saved.shared_with_doctor });
    } catch (error) {
      // Keep every answer so the patient can try again from the last question.
      const last = previousQuestion(definition, answers)!;
      ask(definition, withoutAnswer(definition, answers, last.question_id));
      throw error;
    } finally {
      submitting.current = false;
    }
    return true;
  }, [ask, setState]);

  /** Record the option the companion repeated back, after the patient confirmed it by voice. */
  const confirmSuggested = useCallback((sessionId: string | null, hasDoctor: boolean) => {
    const current = stateRef.current;
    if (current.phase !== 'asking' || current.suggested === null) return Promise.resolve(false);
    return answer(current.question.question_id, current.suggested, sessionId, hasDoctor, 'voice');
  }, [answer]);

  const back = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'asking') return;
    const last = previousQuestion(current.definition, current.answers);
    if (last) ask(current.definition, withoutAnswer(current.definition, current.answers, last.question_id));
  }, [ask]);

  /** Set the questionnaire aside (e.g. to do the daily check-in) and keep its answers. */
  const pause = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'asking') return false;
    setState({ phase: 'paused', definition: current.definition, answers: current.answers, number: current.number, total: current.total });
    return true;
  }, [setState]);

  const resume = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'paused') return false;
    return ask(current.definition, current.answers);
  }, [ask]);

  const askCareTeam = useCallback(async () => {
    await request('/review-requests', { session_id: null, reason: 'patient_requested_review' });
    setRequested(true);
  }, []);

  // Crisis support stays visible after closing; starting a new questionnaire resets it.
  const stop = useCallback(() => setState({ phase: 'idle' }), [setState]);
  return { state, safety, requested, settled, offer, begin, suggest, clearSuggestion, answer, confirmSuggested, back, pause, resume, askCareTeam, stop };
}
