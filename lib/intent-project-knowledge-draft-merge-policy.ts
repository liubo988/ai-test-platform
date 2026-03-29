export type IntentProjectKnowledgeDraftMergePolicyFeedbackStatus =
  | 'preferred'
  | 'neutral'
  | 'probationary'
  | 'deprioritized';

export type IntentProjectKnowledgeDraftMergePolicyKnowledgeChangeSignal = 'positive' | 'negative';

export interface IntentProjectKnowledgeDraftMergePolicyCandidateLike {
  candidateId: string;
  alreadyCovered?: boolean;
  feedback?: {
    status?: IntentProjectKnowledgeDraftMergePolicyFeedbackStatus;
    knowledgeChangeSignal?: IntentProjectKnowledgeDraftMergePolicyKnowledgeChangeSignal;
  } | null;
}

export function isIntentProjectKnowledgeDraftCandidateDeprioritized(
  candidate: IntentProjectKnowledgeDraftMergePolicyCandidateLike
): boolean {
  return candidate.feedback?.status === 'deprioritized';
}

export function isIntentProjectKnowledgeDraftCandidateProbationary(
  candidate: IntentProjectKnowledgeDraftMergePolicyCandidateLike
): boolean {
  return candidate.feedback?.status === 'probationary';
}

export function isIntentProjectKnowledgeDraftCandidateNegativeHistory(
  candidate: IntentProjectKnowledgeDraftMergePolicyCandidateLike
): boolean {
  return candidate.feedback?.knowledgeChangeSignal === 'negative';
}

export function isIntentProjectKnowledgeDraftCandidateSelectable(
  candidate: IntentProjectKnowledgeDraftMergePolicyCandidateLike
): boolean {
  return candidate.alreadyCovered !== true;
}

export function isIntentProjectKnowledgeDraftCandidateMergeRecommended(
  candidate: IntentProjectKnowledgeDraftMergePolicyCandidateLike
): boolean {
  return (
    isIntentProjectKnowledgeDraftCandidateSelectable(candidate) &&
    !isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate) &&
    !isIntentProjectKnowledgeDraftCandidateProbationary(candidate) &&
    !isIntentProjectKnowledgeDraftCandidateNegativeHistory(candidate)
  );
}

export function isIntentProjectKnowledgeDraftCandidateDeferredByDefault(
  candidate: IntentProjectKnowledgeDraftMergePolicyCandidateLike
): boolean {
  return isIntentProjectKnowledgeDraftCandidateSelectable(candidate) && !isIntentProjectKnowledgeDraftCandidateMergeRecommended(candidate);
}

export function defaultIntentProjectKnowledgeDraftCandidateIds(
  candidates: IntentProjectKnowledgeDraftMergePolicyCandidateLike[]
): string[] {
  return candidates.filter(isIntentProjectKnowledgeDraftCandidateMergeRecommended).map((candidate) => candidate.candidateId);
}

export function allSelectableIntentProjectKnowledgeDraftCandidateIds(
  candidates: IntentProjectKnowledgeDraftMergePolicyCandidateLike[]
): string[] {
  return candidates.filter(isIntentProjectKnowledgeDraftCandidateSelectable).map((candidate) => candidate.candidateId);
}
