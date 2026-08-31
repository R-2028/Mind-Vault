/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  VolumeX,
  Lock,
  Calendar,
  CheckCircle2,
  Share2,
  Trash2,
  Clock,
  Shield,
  HelpCircle,
  Tag,
  ArrowRight,
  Camera,
  Video,
  MapPin,
  Compass,
  Bell,
  AlertOctagon,
  Sliders,
} from 'lucide-react';
import { DecryptedEntry, GraphNodeType, GeolocationData } from '../types';
import { textToSpeech } from '../services/speech';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { getCurrentDeviceLocation } from '../services/maps';
import { VisualCompanionModal } from './VisualCompanionModal';
import { LocationPickerMap } from './LocationPickerMap';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';

interface DailyReflectionTabProps {
  entries: DecryptedEntry[];
  onSaveEntry: (
    plaintext: string,
    tone: string,
    tags: string[],
    location?: GeolocationData
  ) => Promise<DecryptedEntry>;
  onDeleteEntry: (id: string) => Promise<void>;
  isProcessing: boolean;
  onAddMicroAction?: (task: string, frictionLevel: 'Micro' | 'Low' | 'Medium') => void;
}

const PROMPT_INSPIRATIONS = [
  'What gave you the most energizing flow today?',
  'What unspoken blocker was quietly draining your focus?',
  'What is 1 core decision you made and what did it teach you?',
  'Who or what helped you make meaningful progress?',
];

const TONE_OPTIONS = [
  { id: 'Grounded', label: 'Grounded & Calm', color: 'text-emerald-400 border-emerald-500/30' },
  { id: 'Vulnerable', label: 'Raw & Vulnerable', color: 'text-amber-400 border-amber-500/30' },
  { id: 'Strategic', label: 'Analytical & Strategic', color: 'text-cyan-400 border-cyan-500/30' },
  { id: 'Cathartic', label: 'Stress Unloading', color: 'text-rose-400 border-rose-500/30' },
];

export const DailyReflectionTab: React.FC<DailyReflectionTabProps> = ({
  entries,
  onSaveEntry,
  onDeleteEntry,
  isProcessing,
  onAddMicroAction,
}) => {
  const [journalText, setJournalText] = useState('');
  const [selectedTone, setSelectedTone] = useState('Grounded');
  const [tagsInput, setTagsInput] = useState('');
  const [isSpeakingSummary, setIsSpeakingSummary] = useState(false);
  const [latestSavedEntry, setLatestSavedEntry] = useState<DecryptedEntry | null>(null);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [isVisualCompanionOpen, setIsVisualCompanionOpen] = useState(false);
  const [attachedLocation, setAttachedLocation] = useState<GeolocationData | null>(null);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Quick toggle location picker map
  const handleToggleLocationPicker = () => {
    setIsLocationPickerOpen((prev) => !prev);
  };

  // Hook-based speech recognition with separate final and interim state
  const {
    isListening,
    interimTranscript,
    error: speechError,
    toggleListening: handleToggleDictation,
    stopListening,
  } = useSpeechRecognition({
    onFinalResult: (finalChunk) => {
      if (finalChunk) {
        setJournalText((prev) => {
          const cleaned = prev ? prev.trim() + ' ' : '';
          return cleaned + finalChunk;
        });
      }
    },
  });

  // Check speech synthesis speaking state
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSpeakingSummary(textToSpeech.getIsSpeaking());
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const handleApplyPrompt = (prompt: string) => {
    setJournalText((prev) => {
      const header = `[Prompt: ${prompt}]\n`;
      return prev ? `${prev}\n\n${header}` : header;
    });
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSubmitReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalText.trim() || isProcessing) return;

    if (isListening) {
      stopListening();
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0);

    try {
      const saved = await onSaveEntry(journalText, selectedTone, tags, attachedLocation || undefined);
      setLatestSavedEntry(saved);
      setJournalText('');
      setTagsInput('');
      setAttachedLocation(null);
    } catch (err: any) {
      console.error('Failed to save reflection:', err);
    }
  };

  const handlePlayTTS = (text: string) => {
    if (textToSpeech.getIsSpeaking()) {
      textToSpeech.cancel();
      setIsSpeakingSummary(false);
    } else {
      textToSpeech.speak(text, {
        onStart: () => setIsSpeakingSummary(true),
        onEnd: () => setIsSpeakingSummary(false),
        onError: () => setIsSpeakingSummary(false),
      });
    }
  };

  const getNodeColor = (type: GraphNodeType) => {
    switch (type) {
      case 'Mood':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/80';
      case 'Project':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80';
      case 'Habit':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
      case 'Person':
        return 'bg-violet-950/60 text-violet-300 border-violet-800/80';
      case 'Skill':
        return 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80';
      case 'Tech':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/80';
      default:
        return 'bg-neutral-800 text-neutral-300 border-neutral-700';
    }
  };

  const filteredEntries = entries.filter((e) => {
    if (!searchHistoryQuery.trim()) return true;
    const q = searchHistoryQuery.toLowerCase();
    return (
      e.plaintext.toLowerCase().includes(q) ||
      (e.aiInsight?.summary || '').toLowerCase().includes(q) ||
      (e.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8">
      {/* Multimodal Visual Companion Hero Banner */}
      <section className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-cyan-950/40 border border-cyan-800/50 rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-950/80 border border-cyan-700/80 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white">Visual AI Journal Companion</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold">
                Gemini 3.7 Flash
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 max-w-xl leading-relaxed">
              Unpack your day with multimodal dialogue. Gemini observes subtle visual fatigue cues, listens to your voice, and suggests low-friction decompression.
            </p>
          </div>
        </div>

        <button
          id="launch-visual-companion-btn"
          type="button"
          onClick={() => setIsVisualCompanionOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-neutral-950 font-bold text-xs transition shadow-lg shadow-cyan-950/50 shrink-0"
        >
          <Video className="w-4 h-4" />
          <span>Launch Camera Check-in</span>
        </button>
      </section>

      {/* Editor & Live Dictation Section */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 md:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Daily Reflection & Mind Unloading
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Reflect freely. Your thoughts are encrypted in-memory before saving.
            </p>
          </div>

          {/* Tone Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-neutral-400 font-medium mr-1">Emotional Context:</span>
            {TONE_OPTIONS.map((tone) => (
              <button
                key={tone.id}
                type="button"
                onClick={() => setSelectedTone(tone.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                  selectedTone === tone.id
                    ? `${tone.color} bg-neutral-800 shadow-sm`
                    : 'border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
                }`}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Inspiration Pills */}
        <div className="pt-3 pb-2">
          <div className="flex items-center gap-1 text-[11px] text-neutral-400 mb-1.5">
            <HelpCircle className="w-3 h-3 text-cyan-400" />
            <span>Prompt Inspirations:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PROMPT_INSPIRATIONS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPrompt(prompt)}
                className="text-[11px] px-2.5 py-1 rounded-md bg-neutral-950/70 border border-neutral-800 text-neutral-300 hover:text-cyan-300 hover:border-cyan-800/80 transition text-left"
              >
                + {prompt}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmitReflection} className="mt-3 space-y-4">
          <div className="relative">
            <textarea
              id="reflection-textarea"
              ref={textareaRef}
              rows={6}
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="Speak or type what is on your mind... What went well today? What caused friction? How are you feeling right now?"
              className="w-full px-4 py-3.5 bg-neutral-950 border border-neutral-800 focus:border-cyan-500 rounded-xl text-neutral-100 placeholder-neutral-500 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-cyan-500 transition resize-y font-sans"
            />

            {/* Live Dictation Active Indicator */}
            {isListening && (
              <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-950/90 border border-rose-600 text-rose-200 text-xs font-semibold animate-pulse shadow-lg">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Listening Live...
              </div>
            )}

            {/* Interim Transcript Live Display */}
            {isListening && interimTranscript && (
              <div className="mt-2 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-200 flex items-center gap-2 animate-fade-in shadow-inner">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-900/80 text-cyan-300 border border-cyan-700/60">
                  Speaking
                </span>
                <span className="italic text-neutral-200">"{interimTranscript}"</span>
              </div>
            )}
          </div>

          {speechError && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <span className="font-semibold">Speech Dictation:</span> {speechError}
            </div>
          )}

          {/* Bottom Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Camera Visual Companion Trigger */}
              <button
                id="camera-companion-trigger-btn"
                type="button"
                onClick={() => setIsVisualCompanionOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-950/50 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/60 transition shadow-sm"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Camera Check-in</span>
              </button>

              {/* Mic Dictation Trigger */}
              <button
                id="voice-dictation-btn"
                type="button"
                onClick={handleToggleDictation}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition shadow-sm ${
                  isListening
                    ? 'bg-rose-900/60 border-rose-600 text-rose-100 hover:bg-rose-900'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-cyan-300 hover:border-cyan-800'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>Stop Dictation</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Voice Dictate (Web Speech)</span>
                  </>
                )}
              </button>

              {/* Location Pinning Trigger */}
              <button
                id="location-tag-btn"
                type="button"
                onClick={handleToggleLocationPicker}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-sm ${
                  isLocationPickerOpen
                    ? 'bg-purple-900/70 border-purple-500 text-purple-200'
                    : attachedLocation
                    ? 'bg-purple-950/80 border-purple-700 text-purple-300'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-purple-300 hover:border-purple-800'
                }`}
                title="Pin location via Google Map or GPS"
              >
                <MapPin className={`w-3.5 h-3.5 ${attachedLocation || isLocationPickerOpen ? 'text-purple-400' : 'text-neutral-400'}`} />
                <span>
                  {attachedLocation
                    ? 'Location Pinned'
                    : isLocationPickerOpen
                    ? 'Close Map'
                    : 'Pin Location'}
                </span>
              </button>

              {/* Notification Integrations Trigger */}
              <button
                id="notification-settings-btn"
                type="button"
                onClick={() => setIsNotificationModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-neutral-800 bg-neutral-950 text-neutral-300 hover:text-cyan-300 hover:border-cyan-800 transition shadow-sm"
                title="Configure Slack, Discord, or Email notifications"
              >
                <Bell className="w-3.5 h-3.5 text-cyan-400" />
                <span>Alerts</span>
              </button>

              {/* Tag Input */}
              <div className="relative flex-1 min-w-[160px] sm:w-52">
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Tags (comma-separated)..."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-neutral-500 hidden sm:inline">
                {journalText.length} characters
              </span>
              <button
                id="encrypt-and-synthesize-btn"
                type="submit"
                disabled={!journalText.trim() || isProcessing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-neutral-950 font-bold rounded-xl text-xs transition shadow-lg shadow-cyan-950/50 disabled:opacity-40"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                    <span>Encrypting & Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Encrypt & Synthesize Mind</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Attached Location Status Chip */}
          {attachedLocation && !isLocationPickerOpen && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-purple-950/40 border border-purple-900/60 text-xs text-purple-200 animate-fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="font-semibold truncate">
                  {attachedLocation.addressName || attachedLocation.formattedAddress}
                </span>
                <span className="text-[10px] text-purple-400/80 font-mono shrink-0 hidden sm:inline">
                  ({(attachedLocation.lat ?? attachedLocation.latitude).toFixed(4)}, {(attachedLocation.lng ?? attachedLocation.longitude).toFixed(4)})
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLocationPickerOpen(true)}
                  className="px-2 py-0.5 rounded text-[11px] font-medium text-purple-300 hover:text-white bg-purple-900/60 hover:bg-purple-800 transition"
                >
                  Edit Map
                </button>
                <button
                  type="button"
                  onClick={() => setAttachedLocation(null)}
                  className="p-1 rounded text-purple-400 hover:text-rose-300 hover:bg-purple-900/50 transition"
                  title="Remove location"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Embedded Google Map Location Picker */}
          {isLocationPickerOpen && (
            <LocationPickerMap
              initialLocation={attachedLocation}
              onSelectLocation={(loc) => {
                setAttachedLocation(loc);
                setIsLocationPickerOpen(false);
              }}
              onCancel={() => setIsLocationPickerOpen(false)}
            />
          )}
        </form>
      </section>

      {/* Latest AI Synthesis Result Banner */}
      {latestSavedEntry && latestSavedEntry.aiInsight && (
        <section
          id="latest-synthesis-card"
          className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-cyan-800/60 rounded-2xl p-5 md:p-6 shadow-2xl space-y-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 text-cyan-400 pointer-events-none">
            <Sparkles className="w-32 h-32" />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Ephemeral AI Synthesis</h3>
                <p className="text-[11px] text-neutral-400">
                  Extracted from your latest reflection & encrypted locally
                </p>
              </div>
            </div>

            {/* TTS Playback */}
            <button
              id="tts-play-summary-btn"
              onClick={() => handlePlayTTS(latestSavedEntry.aiInsight?.summary || '')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                isSpeakingSummary
                  ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-cyan-300 hover:border-cyan-700'
              }`}
            >
              {isSpeakingSummary ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>Stop Speaking</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Read Aloud (Web Speech)</span>
                </>
              )}
            </button>
          </div>

          {/* Empathetic Summary */}
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800/90 text-sm text-neutral-200 leading-relaxed">
            <span className="text-xs font-semibold text-cyan-400 block mb-1">
              Empathetic Validating Summary:
            </span>
            {latestSavedEntry.aiInsight.summary}
          </div>

          {/* Burnout / Friction Alert Dispatch Badge */}
          {latestSavedEntry.aiInsight.trigger_alert && (
            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/80 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <AlertOctagon className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <span className="font-bold text-purple-200 block">
                    Cognitive Friction Alert Triggered
                  </span>
                  <span className="text-[11px] text-purple-300/80">
                    {latestSavedEntry.aiInsight.alert_reason ||
                      'Elevated burnout & fatigue detected. Sanitized alert dispatched to external integrations.'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotificationModalOpen(true)}
                className="px-3 py-1 rounded-lg bg-purple-900/80 hover:bg-purple-800 border border-purple-700 text-purple-200 text-[11px] font-semibold transition shrink-0"
              >
                View Dispatch
              </button>
            </div>
          )}

          {/* Micro Actions Preview */}
          {latestSavedEntry.aiInsight.micro_actions && latestSavedEntry.aiInsight.micro_actions.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-amber-400 block mb-2">
                Morning Micro-Actions Ready for Tomorrow:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {latestSavedEntry.aiInsight.micro_actions.map((act, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-neutral-950/90 border border-amber-900/40 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="text-neutral-200 font-medium">{act.task}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/70 border border-amber-800 text-amber-300">
                        {act.friction_level} Friction
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge Graph Nodes */}
          {latestSavedEntry.aiInsight.graph_nodes && latestSavedEntry.aiInsight.graph_nodes.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-neutral-400 block mb-1.5">
                New Knowledge Entities Connected to Graph:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {latestSavedEntry.aiInsight.graph_nodes.map((node) => (
                  <span
                    key={node.id}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${getNodeColor(
                      node.type
                    )}`}
                  >
                    <span className="text-[10px] opacity-70">[{node.type}]</span>
                    {node.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Historical Decrypted Journal Entries Feed */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Decrypted Reflection Memory ({filteredEntries.length})
            </h3>
            <p className="text-xs text-neutral-400">
              Only accessible when vault is unlocked with your master key.
            </p>
          </div>

          <input
            type="text"
            value={searchHistoryQuery}
            onChange={(e) => setSearchHistoryQuery(e.target.value)}
            placeholder="Search decrypted entries..."
            className="px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 w-full sm:w-64"
          />
        </div>

        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 border-dashed">
            <Lock className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-neutral-300">No reflections in memory yet</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Write your first thought above or use Voice Dictation to start building your second brain.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              const isExpanded = expandedEntryId === entry.id;
              return (
                <article
                  key={entry.id}
                  className="p-4 md:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 transition shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        {entry.formattedDate}
                      </span>
                      {entry.tone && (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-medium border border-neutral-700">
                          {entry.tone}
                        </span>
                      )}
                      {entry.location && (
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/80 text-purple-300 text-[10px] flex items-center gap-1 font-sans">
                          <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                          <span className="truncate max-w-[220px]">
                            {entry.location.addressName || entry.location.formattedAddress || `${entry.location.latitude}, ${entry.location.longitude}`}
                          </span>
                        </span>
                      )}
                      {(entry.tags || []).map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-full bg-cyan-950/40 border border-cyan-900 text-cyan-300 text-[10px]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          handlePlayTTS(entry.aiInsight?.summary || entry.plaintext)
                        }
                        title="Read aloud"
                        className="p-1.5 text-neutral-400 hover:text-cyan-300 rounded-lg hover:bg-neutral-800 transition"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteEntry(entry.id)}
                        title="Delete encrypted reflection"
                        className="p-1.5 text-neutral-400 hover:text-rose-400 rounded-lg hover:bg-neutral-800 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Summary Preview */}
                  {entry.aiInsight?.summary && (
                    <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 text-xs text-cyan-200/90 leading-relaxed">
                      <span className="font-semibold text-cyan-400 mr-1">AI Synthesis:</span>
                      {entry.aiInsight.summary}
                    </div>
                  )}

                  {/* Plaintext Content */}
                  <div className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {isExpanded
                      ? entry.plaintext
                      : entry.plaintext.length > 250
                      ? entry.plaintext.slice(0, 250) + '...'
                      : entry.plaintext}
                  </div>

                  {entry.plaintext.length > 250 && (
                    <button
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
                    >
                      {isExpanded ? 'Show less' : 'Read full reflection'}
                    </button>
                  )}

                  {/* Connected Entities Tag Badges */}
                  {entry.aiInsight?.graph_nodes && entry.aiInsight.graph_nodes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-neutral-800/60">
                      <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                        <Share2 className="w-3 h-3 text-neutral-400" />
                        Entities:
                      </span>
                      {entry.aiInsight.graph_nodes.map((node) => (
                        <span
                          key={node.id}
                          className={`text-[10px] px-2 py-0.5 rounded border ${getNodeColor(
                            node.type
                          )}`}
                        >
                          {node.label}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Visual AI Companion Modal */}
      <VisualCompanionModal
        isOpen={isVisualCompanionOpen}
        onClose={() => setIsVisualCompanionOpen(false)}
        onSaveAsVaultEntry={onSaveEntry}
        onAddMicroAction={onAddMicroAction}
      />

      {/* External Notification Integrations Modal */}
      {isNotificationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-purple-400" />
                Notification Integrations (Slack / Discord / Email)
              </h3>
              <button
                type="button"
                onClick={() => setIsNotificationModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                ✕
              </button>
            </div>
            <NotificationSettingsPanel onSaved={() => setIsNotificationModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
