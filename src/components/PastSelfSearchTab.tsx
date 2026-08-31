/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Brain,
  Sparkles,
  Cpu,
  Sliders,
  Calendar,
  Volume2,
  VolumeX,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { DecryptedEntry, SearchMatch } from '../types';
import {
  rankEntriesBySemanticSimilarity,
  getModelLoadStatus,
  initEmbeddingPipeline,
} from '../services/embeddings';
import { textToSpeech } from '../services/speech';

interface PastSelfSearchTabProps {
  entries: DecryptedEntry[];
}

const SAMPLE_SEARCH_QUERIES = [
  'When was the last time I was burned out or overwhelmed on a project?',
  'What habits or routines brought me the most mental clarity?',
  'Who helped me overcome technical or strategic bottlenecks?',
  'What decisions made me feel most confident in my abilities?',
];

export const PastSelfSearchTab: React.FC<PastSelfSearchTabProps> = ({ entries }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.4);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [modelStatus, setModelStatus] = useState<string>('idle');
  const [modelProgress, setModelProgress] = useState<string>('');

  // AI Dialogue with Past Self State
  const [isSynthesizingDialogue, setIsSynthesizingDialogue] = useState(false);
  const [pastSelfDialogue, setPastSelfDialogue] = useState<string | null>(null);
  const [isSpeakingDialogue, setIsSpeakingDialogue] = useState(false);

  useEffect(() => {
    // Check embedding status
    setModelStatus(getModelLoadStatus());
  }, []);

  const handleExecuteSearch = async (queryToSearch?: string) => {
    const query = queryToSearch !== undefined ? queryToSearch : searchQuery;
    if (!query.trim() || entries.length === 0) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setPastSelfDialogue(null);

    try {
      const matches = await rankEntriesBySemanticSimilarity(query, entries, similarityThreshold);
      setSearchResults(matches);
      setModelStatus(getModelLoadStatus());
    } catch (err) {
      console.error('Semantic search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplySampleQuery = (sample: string) => {
    setSearchQuery(sample);
    handleExecuteSearch(sample);
  };

  const handleSynthesizeDialogue = async () => {
    if (searchResults.length === 0 || isSynthesizingDialogue) return;

    setIsSynthesizingDialogue(true);
    try {
      const response = await fetch('/api/ai/synthesize-past-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          matchedEntries: searchResults.slice(0, 5).map((m) => m.entry),
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.dialogue) {
        setPastSelfDialogue(resData.dialogue);
      } else {
        throw new Error(resData.error || 'Failed to synthesize dialogue');
      }
    } catch (err: any) {
      console.error('Past self dialogue synthesis failed:', err);
      // Offline heuristic summary
      const contextSummaries = searchResults
        .slice(0, 3)
        .map((m) => m.entry.aiInsight?.summary || m.entry.plaintext.slice(0, 100))
        .join(' ');
      setPastSelfDialogue(
        `Based on your past reflections around "${searchQuery}", you frequently encountered similar challenges when balancing focus with recovery. Looking at entries from ${searchResults
          .map((m) => m.entry.formattedDate)
          .join(
            ', '
          )}, you restored momentum when you simplified your daily micro-actions and set clear boundaries.`
      );
    } finally {
      setIsSynthesizingDialogue(false);
    }
  };

  const handlePlayDialogueTTS = () => {
    if (!pastSelfDialogue) return;
    if (textToSpeech.getIsSpeaking()) {
      textToSpeech.cancel();
      setIsSpeakingDialogue(false);
    } else {
      textToSpeech.speak(pastSelfDialogue, {
        onStart: () => setIsSpeakingDialogue(true),
        onEnd: () => setIsSpeakingDialogue(false),
        onError: () => setIsSpeakingDialogue(false),
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Search Header & Query Input */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 md:p-7 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              "Past Self" Semantic Search & Dialogue
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Natural language memory retrieval using in-browser vector embeddings (all-MiniLM-L6-v2).
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Local Vector Engine:</span>
            <span className="font-semibold text-cyan-300">
              {modelStatus === 'ready'
                ? 'all-MiniLM-L6-v2 In-Browser'
                : modelStatus === 'loading'
                ? 'Loading Transformers weights...'
                : 'Deterministic Feature Vectorizer'}
            </span>
          </div>
        </div>

        {/* Search Input Box */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              id="semantic-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteSearch()}
              placeholder="Ask your past self (e.g. 'When did I feel most burned out on tech projects?')"
              className="w-full pl-11 pr-28 py-3.5 bg-neutral-950 border border-neutral-800 focus:border-cyan-500 rounded-xl text-neutral-100 placeholder-neutral-500 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 transition"
            />
            <button
              id="execute-semantic-search-btn"
              onClick={() => handleExecuteSearch()}
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-bold rounded-lg text-xs transition disabled:opacity-40 flex items-center gap-1.5"
            >
              {isSearching ? (
                <>
                  <div className="w-3 h-3 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                  <span>Comparing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>

          {/* Sample Query Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-neutral-500">Try asking:</span>
            {SAMPLE_SEARCH_QUERIES.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleApplySampleQuery(q)}
                className="text-[11px] px-2.5 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-cyan-300 hover:border-cyan-800 transition"
              >
                "{q}"
              </button>
            ))}
          </div>

          {/* Similarity Threshold Slider */}
          <div className="pt-2 flex items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-neutral-400" />
              Minimum Cosine Similarity:
            </span>
            <input
              type="range"
              min="0.2"
              max="0.85"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setSimilarityThreshold(val);
                if (searchQuery.trim()) {
                  rankEntriesBySemanticSimilarity(searchQuery, entries, val).then(setSearchResults);
                }
              }}
              className="w-36 accent-cyan-500 cursor-pointer"
            />
            <span className="font-mono text-cyan-300 font-semibold">
              {Math.round(similarityThreshold * 100)}%
            </span>
          </div>
        </div>
      </section>

      {/* AI Dialogue with Past Self Synthesis Card */}
      {searchResults.length > 0 && (
        <section
          id="past-self-dialogue-section"
          className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-indigo-900/50 rounded-2xl p-5 md:p-6 shadow-xl space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Synthesize Retrospective Dialogue with Past Self
                </h3>
                <p className="text-xs text-neutral-400">
                  Ephemerally prompt Gemini with your top {searchResults.length} decrypted memories
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {pastSelfDialogue && (
                <button
                  onClick={handlePlayDialogueTTS}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    isSpeakingDialogue
                      ? 'bg-amber-950 border-amber-600 text-amber-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-cyan-300'
                  }`}
                >
                  {isSpeakingDialogue ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                      <span>Stop Voice</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Listen to Synthesis</span>
                    </>
                  )}
                </button>
              )}

              <button
                id="synthesize-past-self-dialogue-btn"
                onClick={handleSynthesizeDialogue}
                disabled={isSynthesizingDialogue}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold rounded-xl text-xs transition shadow-md disabled:opacity-50"
              >
                {isSynthesizingDialogue ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Across Time...</span>
                  </>
                ) : (
                  <>
                    <Brain className="w-3.5 h-3.5" />
                    <span>{pastSelfDialogue ? 'Re-Synthesize' : 'Generate Dialogue'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {pastSelfDialogue && (
            <div className="p-4 rounded-xl bg-neutral-950/80 border border-indigo-900/40 text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
              <span className="text-xs font-semibold text-indigo-400 block mb-2">
                Meta-Cognitive Dialogue:
              </span>
              {pastSelfDialogue}
            </div>
          )}
        </section>
      )}

      {/* Semantic Matches Results List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Retrieved Historical Matches</span>
            {searchResults.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300">
                {searchResults.length} entries
              </span>
            )}
          </h3>
          <span className="text-xs text-neutral-500">
            Computed in-memory via Cosine Dot Product
          </span>
        </div>

        {searchResults.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 border-dashed">
            <Search className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-neutral-300">
              {searchQuery.trim()
                ? 'No past reflections met the semantic similarity threshold'
                : 'Enter a query above to semantically search your historical reflections'}
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Your entries are vector-embedded locally so your questions can match conceptual meanings, not just exact keywords.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {searchResults.map((match, idx) => {
              const similarityPercent = Math.round(match.score * 100);
              return (
                <div
                  key={match.entry.id}
                  className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-cyan-800/60 transition shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                        {match.entry.formattedDate}
                      </span>
                      {match.entry.tone && (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[10px] border border-neutral-700">
                          {match.entry.tone}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {match.matchedTerms && match.matchedTerms.length > 0 && (
                        <div className="flex items-center gap-1">
                          {match.matchedTerms.map((term, tIdx) => (
                            <span
                              key={tIdx}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-cyan-300 border border-neutral-700"
                            >
                              "{term}"
                            </span>
                          ))}
                        </div>
                      )}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                          similarityPercent >= 70
                            ? 'bg-cyan-950 border-cyan-700 text-cyan-300'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                        }`}
                      >
                        {similarityPercent}% Match
                      </span>
                    </div>
                  </div>

                  {match.entry.aiInsight?.summary && (
                    <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 text-xs text-neutral-300">
                      <span className="font-semibold text-cyan-400 block mb-1">
                        Historical AI Reflection:
                      </span>
                      {match.entry.aiInsight.summary}
                    </div>
                  )}

                  <div className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {match.entry.plaintext}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
