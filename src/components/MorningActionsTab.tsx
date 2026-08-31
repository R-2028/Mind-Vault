/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Sun,
  Volume2,
  VolumeX,
  Plus,
  Zap,
  Clock,
  Sparkles,
  Flame,
  Check,
  Calendar,
} from 'lucide-react';
import { MicroAction } from '../types';
import { textToSpeech } from '../services/speech';

interface MorningActionsTabProps {
  actions: MicroAction[];
  onToggleAction: (actionId: string) => Promise<void>;
  onAddCustomAction: (task: string, friction_level: 'Micro' | 'Low' | 'Medium') => Promise<void>;
}

export const MorningActionsTab: React.FC<MorningActionsTabProps> = ({
  actions,
  onToggleAction,
  onAddCustomAction,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [newTaskText, setNewTaskText] = useState('');
  const [newFrictionLevel, setNewFrictionLevel] = useState<'Micro' | 'Low' | 'Medium'>('Micro');
  const [isSpeakingBriefing, setIsSpeakingBriefing] = useState(false);

  const pendingActions = actions.filter((a) => !a.completed);
  const completedActions = actions.filter((a) => a.completed);

  const displayedActions = actions.filter((a) => {
    if (filter === 'pending') return !a.completed;
    if (filter === 'completed') return a.completed;
    return true;
  });

  const completionRate =
    actions.length > 0 ? Math.round((completedActions.length / actions.length) * 100) : 0;

  const handlePlayBriefing = () => {
    if (textToSpeech.getIsSpeaking()) {
      textToSpeech.cancel();
      setIsSpeakingBriefing(false);
      return;
    }

    if (pendingActions.length === 0) {
      textToSpeech.speak('Good morning! You have no pending micro-actions. Your cognitive slate is clear.', {
        onStart: () => setIsSpeakingBriefing(true),
        onEnd: () => setIsSpeakingBriefing(false),
        onError: () => setIsSpeakingBriefing(false),
      });
      return;
    }

    const script = `Good morning. Here is your morning micro-action briefing extracted from your reflections. You have ${
      pendingActions.length
    } low-friction tasks. ${pendingActions
      .map(
        (a, i) =>
          `Task ${i + 1} (${a.friction_level} friction): ${a.task}.`
      )
      .join(' ')} Take it one step at a time. Have an intentional day!`;

    textToSpeech.speak(script, {
      rate: 0.95,
      onStart: () => setIsSpeakingBriefing(true),
      onEnd: () => setIsSpeakingBriefing(false),
      onError: () => setIsSpeakingBriefing(false),
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    await onAddCustomAction(newTaskText.trim(), newFrictionLevel);
    setNewTaskText('');
  };

  const getFrictionBadge = (level: 'Micro' | 'Low' | 'Medium') => {
    switch (level) {
      case 'Micro':
        return {
          label: '⚡ Micro (< 2 min)',
          class: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
        };
      case 'Low':
        return {
          label: '🌿 Low Friction (5 min)',
          class: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80',
        };
      case 'Medium':
        return {
          label: '🎯 Medium (10-15 min)',
          class: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
        };
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Audio Briefing Banner */}
      <section className="bg-gradient-to-r from-neutral-900 via-amber-950/20 to-neutral-900 border border-amber-900/40 rounded-2xl p-5 md:p-7 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400 shadow-inner">
              <Sun className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Morning Micro-Actions & Anxiety Unloaders
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Low-friction momentum starters synthesized by Gemini from your evening reflections.
              </p>
            </div>
          </div>

          {/* Audio Morning Briefing Button */}
          <button
            id="play-morning-briefing-btn"
            onClick={handlePlayBriefing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-lg ${
              isSpeakingBriefing
                ? 'bg-rose-900/80 text-rose-200 border border-rose-600'
                : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 shadow-amber-950/50'
            }`}
          >
            {isSpeakingBriefing ? (
              <>
                <VolumeX className="w-4 h-4 text-rose-300 animate-pulse" />
                <span>Stop Voice Briefing</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-neutral-950" />
                <span>Play Morning Audio Briefing (TTS)</span>
              </>
            )}
          </button>
        </div>

        {/* Progress & Momentum Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Pending Momentum:</span>
            <span className="text-sm font-bold text-amber-400">
              {pendingActions.length} tasks
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Completed Actions:</span>
            <span className="text-sm font-bold text-emerald-400">
              {completedActions.length} tasks
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Completion Rate:</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <span className="text-xs font-bold text-cyan-300">{completionRate}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Add Custom Micro-Action Form */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
        <form onSubmit={handleCreateTask} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Add an urgent or morning anchor task..."
            className="flex-1 px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
          />

          <div className="flex items-center gap-2">
            <select
              value={newFrictionLevel}
              onChange={(e) =>
                setNewFrictionLevel(e.target.value as 'Micro' | 'Low' | 'Medium')
              }
              className="px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="Micro">⚡ Micro (&lt; 2 min)</option>
              <option value="Low">🌿 Low (5 min)</option>
              <option value="Medium">🎯 Medium (10-15 min)</option>
            </select>

            <button
              id="add-custom-microaction-btn"
              type="submit"
              disabled={!newTaskText.trim()}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold rounded-xl text-xs transition border border-neutral-700 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Action</span>
            </button>
          </div>
        </form>
      </section>

      {/* Micro-Actions List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                filter === 'pending'
                  ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Pending ({pendingActions.length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                filter === 'completed'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Completed ({completedActions.length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                filter === 'all'
                  ? 'bg-neutral-800 border-neutral-700 text-white'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All ({actions.length})
            </button>
          </div>

          <span className="text-[11px] text-neutral-500">
            Encrypted client-side with vault key
          </span>
        </div>

        {displayedActions.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 border-dashed">
            <CheckCircle2 className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-neutral-300">
              {filter === 'pending'
                ? 'No pending micro-actions. You are fully caught up!'
                : 'No micro-actions in this view.'}
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Synthesize a new evening reflection in the Daily Reflection tab to generate personalized morning tasks.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedActions.map((action) => {
              const badge = getFrictionBadge(action.friction_level);
              return (
                <div
                  key={action.id}
                  onClick={() => onToggleAction(action.id)}
                  className={`p-4 rounded-2xl border transition flex items-start justify-between gap-3 cursor-pointer select-none ${
                    action.completed
                      ? 'bg-neutral-950/60 border-neutral-800/80 opacity-60'
                      : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      className="mt-0.5 text-neutral-400 hover:text-cyan-400 transition"
                    >
                      {action.completed ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-neutral-950">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <Circle className="w-5 h-5 text-neutral-500 hover:text-cyan-400" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <p
                        className={`text-xs font-medium leading-relaxed ${
                          action.completed ? 'line-through text-neutral-500' : 'text-neutral-200'
                        }`}
                      >
                        {action.task}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                        <span>Added {new Date(action.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${badge.class}`}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
