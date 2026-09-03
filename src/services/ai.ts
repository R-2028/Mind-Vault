/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MultimodalCompanionResponse, AIAnalysisResult, DecryptedEntry } from '../types';

/**
 * Call the Multimodal AI Journal Companion powered by Gemini 3.7 Flash
 */
export async function sendMultimodalCheckIn(
  imageBase64: string | null,
  userMessage?: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>,
  previousMood?: string | null,
  recentResponses?: string[],
  recentSuggestions?: string[]
): Promise<MultimodalCompanionResponse> {
  const response = await fetch('/api/ai/multimodal-companion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      userMessage,
      conversationHistory,
      previousMood,
      recentResponses,
      recentSuggestions,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Companion request failed with status ${response.status}`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Invalid companion response structure');
  }

  return result.data as MultimodalCompanionResponse;
}

/**
 * Analyze raw journal reflection and extract structured cognitive metadata
 */
export async function analyzeJournalReflection(
  plaintext: string,
  tone?: string
): Promise<AIAnalysisResult> {
  const response = await fetch('/api/ai/analyze-reflection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plaintext,
      tone: tone || 'Grounded & Reflective',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Synthesis failed with status ${response.status}`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to extract AI metadata');
  }

  return result.data as AIAnalysisResult;
}

/**
 * Dialogue with Past Self (semantic historical reflection guide)
 */
export async function queryPastSelfDialogue(
  query: string,
  matchedEntries: DecryptedEntry[]
): Promise<string> {
  const response = await fetch('/api/ai/synthesize-past-self', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      matchedEntries,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Past self dialogue failed with status ${response.status}`);
  }

  const result = await response.json();
  return result.dialogue || 'No synthesis generated.';
}
