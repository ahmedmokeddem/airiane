import { useCallback, useEffect, useRef, useState } from 'react';
import { api, request } from '../../integration/api';
import { nextQuestion, progress, submission, type AssessmentResult, type Answers, type Definition, type Question } from './assessment-flow';

export type AssessmentState =
  | { phase: 'idle' }
  | { phase: 'offer'; definitions: Definition[] }
  | { phase: 'asking'; definition: Definition; answers: Answers; question: Question; suggested: number | null; number: number; total: number }
  | { phase: 'saving'; definition: Definition; answers: Answers }
  | { phase: 'done'; definition: Definition; result: AssessmentResult | null; reportCreated: boolean; sharedWithDoctor: boolean };

/**
 * Runs one questionnaire conversation. Answers stay on the phone until every question that applies
 * is answered; only then are they submitted, scored by the backend and added to a new report.
 * `onQuestion` lets the companion read each question aloud or in chat.
 */
export function useAssessment(onQuestion: (question: Question, definition: Definition, number: number, total: number) => void) {
  const [state, setState] = useState<AssessmentState>({ phase: 'idle' });
  const [safety, setSafety] = useState<'none' | 'concern'>('none');
  const [requested, setRequested] = useState(false);
  const notify = useRef(onQuestion);
  useEffect(() => { notify.current = onQuestion; }, [onQuestion]);

  const ask = useCallback((definition: Definition, answers: Answers) => {
    const question = nextQuestion(definition, answers);
    if (!question) return false;
    const { number, total } = progress(definition, answers);
    setState({ phase: 'asking', definition, answers, question, suggested: null, number, total });
    notify.current(question, definition, number, total);
    return true;
  }, []);

  const offer = useCallback(async () => {
    const definitions = await api.assessments();
    setState({ phase: 'offer', definitions });
    return definitions;
  }, []);

  const begin = useCallback((definition: Definition) => {
    setSafety('none'); setRequested(false);
    ask(definition, {});
  }, [ask]);

  const suggest = useCallback((questionId: string, value: number) => {
    let applied = false;
    setState(current => {
      if (current.phase !== 'asking' || current.question.question_id !== questionId) return current;
      if (!(current.question.options ?? []).some(o => o.value === value)) return current;
      applied = true;
      return { ...current, suggested: value };
    });
    return applied;
  }, []);

  /** `hasDoctor`: a doctor is connected, so the patient was told a Q9 answer above 0 is sent to them. */
  const answer = useCallback(async (value: number, sessionId: string | null, hasDoctor: boolean) => {
    if (state.phase !== 'asking') return;
    const { definition, question } = state;
    const answers = { ...state.answers, [question.question_id]: value };
    if (question.question_id === 'q9' && value > 0) setSafety('concern');
    if (ask(definition, answers)) return;
    setState({ phase: 'saving', definition, answers });
    const saved = await api.submitAssessment(definition, submission(definition, answers), sessionId, hasDoctor);
    // A new report including this result; it stays private unless the patient shares reports.
    let reportCreated = false;
    try {
      const end = new Date(); const start = new Date(end.getTime() - 14 * 86400000);
      await request('/reports', { period_start: start.toISOString(), period_end: end.toISOString(), compare_previous: true });
      reportCreated = true;
    } catch { /* The result is saved even if the report could not be created now. */ }
    setState({ phase: 'done', definition, result: saved.result ?? null, reportCreated, sharedWithDoctor: !!saved.shared_with_doctor });
  }, [state, ask]);

  const askCareTeam = useCallback(async () => {
    await request('/review-requests', { session_id: null, reason: 'patient_requested_review' });
    setRequested(true);
  }, []);

  const stop = useCallback(() => setState({ phase: 'idle' }), []);
  return { state, safety, requested, offer, begin, suggest, answer, askCareTeam, stop };
}
