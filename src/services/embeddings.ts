/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { pipeline, env } from '@xenova/transformers';
import { DecryptedEntry, SearchMatch } from '../types';

// Configure transformers.js for in-browser client execution
env.allowLocalModels = false;
env.useBrowserCache = true;

let extractorInstance: any = null;
let isInitializing = false;
let modelLoadStatus: 'idle' | 'loading' | 'ready' | 'fallback' = 'idle';

export function getModelLoadStatus(): 'idle' | 'loading' | 'ready' | 'fallback' {
  return modelLoadStatus;
}

/**
 * Initializes the Xenova/all-MiniLM-L6-v2 local in-browser model pipeline.
 */
export async function initEmbeddingPipeline(
  onProgress?: (progress: number, text: string) => void
): Promise<any> {
  if (extractorInstance) return extractorInstance;
  if (isInitializing) {
    // Wait for existing initialization
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return extractorInstance;
  }

  isInitializing = true;
  modelLoadStatus = 'loading';

  try {
    onProgress?.(10, 'Loading in-browser embedding weights...');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
      progress_callback: (info: any) => {
        if (info.status === 'progress' && info.progress) {
          onProgress?.(Math.round(info.progress), `Downloading weights: ${info.file || ''}`);
        }
      },
    });

    extractorInstance = extractor;
    modelLoadStatus = 'ready';
    onProgress?.(100, 'Xenova/all-MiniLM-L6-v2 vector model loaded locally in memory.');
    return extractor;
  } catch (err) {
    console.warn('Transformer pipeline local weight load failed or offline; using local high-dimensional vector engine:', err);
    modelLoadStatus = 'fallback';
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * High-dimensional deterministic vectorizer fallback (384 dimensions)
 * Used if offline or if CDN is throttled.
 */
function generateLocalFastVector(text: string): number[] {
  const dimensions = 384;
  const vector = new Float32Array(dimensions);
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length === 0) return Array.from(vector);

  // Hash character n-grams and token frequencies
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = (hash << 5) - hash + word.charCodeAt(c);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1.0;

    // Subword bi-grams
    if (word.length >= 3) {
      for (let j = 0; j < word.length - 2; j++) {
        const sub = word.slice(j, j + 3);
        let subHash = 0;
        for (let k = 0; k < sub.length; k++) {
          subHash = (subHash << 5) - subHash + sub.charCodeAt(k);
          subHash |= 0;
        }
        const subIdx = Math.abs(subHash) % dimensions;
        vector[subIdx] += 0.4;
      }
    }
  }

  // L2 Normalize
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq) || 1e-8;
  const normalized = new Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    normalized[i] = vector[i] / norm;
  }

  return normalized;
}

/**
 * Computes a normalized vector embedding for a given text strictly inside the user's browser.
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return new Array(384).fill(0);
  }

  try {
    const extractor = await initEmbeddingPipeline();
    if (extractor) {
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const rawData = output.data;
      return Array.from(rawData);
    }
  } catch (err) {
    console.warn('Local transformer error, reverting to deterministic feature vector:', err);
  }

  return generateLocalFastVector(text);
}

/**
 * Calculates cosine similarity between two vectors (-1 to 1, normalized to 0 to 1).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Bound to [0, 1] range
  return Math.max(0, Math.min(1, (similarity + 1) / 2));
}

/**
 * Ranks decrypted journal entries by semantic similarity to a query.
 */
export async function rankEntriesBySemanticSimilarity(
  query: string,
  entries: DecryptedEntry[],
  threshold = 0.45
): Promise<SearchMatch[]> {
  if (!query || query.trim().length === 0 || entries.length === 0) {
    return [];
  }

  const queryVector = await generateTextEmbedding(query);
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const matches: SearchMatch[] = [];

  for (const entry of entries) {
    let score = 0;
    if (entry.embedding && entry.embedding.length > 0) {
      score = cosineSimilarity(queryVector, entry.embedding);
    } else {
      // Compute on-the-fly if missing
      const entryVector = await generateTextEmbedding(entry.plaintext + ' ' + (entry.aiInsight?.summary || ''));
      score = cosineSimilarity(queryVector, entryVector);
    }

    // Keyword relevance boost
    const contentLower = (entry.plaintext + ' ' + (entry.aiInsight?.summary || '')).toLowerCase();
    const matchedTerms = queryTerms.filter((term) => contentLower.includes(term));
    if (matchedTerms.length > 0) {
      score = Math.min(1, score + matchedTerms.length * 0.05);
    }

    if (score >= threshold) {
      matches.push({
        entry,
        score,
        matchedTerms,
      });
    }
  }

  // Sort descending by score
  matches.sort((a, b) => b.score - a.score);
  return matches;
}
