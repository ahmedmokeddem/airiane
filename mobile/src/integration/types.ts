// Generated from the repository's canonical OpenAPI by scripts/generate-contracts.mjs.
import type { components } from '../../../contracts/generated/api';
export type { components } from '../../../contracts/generated/api';
export type DTO<K extends keyof components['schemas']> = components['schemas'][K];
export type Session = DTO<'ConversationSession'>;
export type Recommendation = DTO<'Recommendation'>;
export type ActivitySession = DTO<'ActivitySession'>;
export type Journey = DTO<'MyJourneyItemPage'>;
export type Bootstrap = DTO<'AgentConnectionBootstrap'>;
