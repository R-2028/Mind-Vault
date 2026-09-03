/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Send,
  Lock,
  CheckCircle2,
  Eye,
  Activity,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Shield,
  RotateCcw,
  Compass,
  Smile,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  MultimodalCompanionResponse,
  CompanionMessage,
  DecryptedEntry,
} from '../types';
import { sendMultimodalCheckIn } from '../services/ai';
import { textToSpeech } from '../services/speech';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface VisualCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsVaultEntry: (plaintext: string, tone: string, tags: string[]) => Promise<DecryptedEntry>;
  onAddMicroAction?: (task: string, frictionLevel: 'Micro' | 'Low' | 'Medium') => void;
}

export const VisualCompanionModal: React.FC<VisualCompanionModalProps> = ({
  isOpen,
  onClose,
  onSaveAsVaultEntry,
  onAddMicroAction,
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [previousMood, setPreviousMood] = useState<string | null>(null);
  const [recentResponses, setRecentResponses] = useState<string[]>([]);
  const [recentSuggestions, setRecentSuggestions] = useState<string[]>([]);
  const [showDebugDrawer, setShowDebugDrawer] = useState(false);
  const [latestDebugPayload, setLatestDebugPayload] = useState<any>(null);
  const [copiedDebug, setCopiedDebug] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const {
    isListening: isDictating,
    interimTranscript,
    error: dictationError,
    toggleListening: handleToggleDictation,
    stopListening: stopDictation,
  } = useSpeechRecognition({
    onFinalResult: (finalChunk) => {
      if (finalChunk) {
        setMessageInput((prev) => {
          const cleaned = prev ? prev.trim() + ' ' : '';
          return cleaned + finalChunk;
        });
      }
    },
  });

  // Initialize camera when opened
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
      if (textToSpeech.getIsSpeaking()) {
        textToSpeech.cancel();
      }
    };
  }, [isOpen]);

  // Ensure stream is bound to video element whenever active
  useEffect(() => {
    if (isCameraActive && mediaStreamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      videoRef.current.play().catch((err) => {
        console.warn('Video auto-play prevented:', err);
      });
    }
  }, [isCameraActive]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });
        mediaStreamRef.current = stream;
        setIsCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (e) {
            console.warn('Play video exception:', e);
          }
        }
      } else {
        setCameraError('Webcam access not supported in this browser environment.');
      }
    } catch (err: any) {
      console.warn('Camera permission error:', err);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera access was declined or blocked by browser permissions. Please allow camera access in your browser address bar.'
          : err?.name === 'NotFoundError'
          ? 'No camera device was detected on your system.'
          : 'Unable to access camera. You can still use voice or text check-in.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const takeSnapshot = (): string | null => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedSnapshot(dataUrl);
        return dataUrl;
      }
    }
    return null;
  };

  const handleSendMessage = async (e?: React.FormEvent, explicitMessage?: string) => {
    if (e) e.preventDefault();
    if (isSending) return;

    if (isDictating) {
      stopDictation();
    }

    // Always capture fresh live snapshot if camera is active to eliminate cached frames
    let snapshotToUse: string | null = null;
    if (isCameraActive) {
      snapshotToUse = takeSnapshot();
    } else if (capturedSnapshot) {
      snapshotToUse = capturedSnapshot;
    }

    const currentMsg = (explicitMessage !== undefined ? explicitMessage : messageInput).trim();
    if (!currentMsg && !snapshotToUse) {
      return;
    }

    const userMessageObj: CompanionMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: currentMsg || '[Visual check-in with live camera snapshot]',
      timestamp: Date.now(),
      snapshotUrl: snapshotToUse || undefined,
    };

    setMessages((prev) => [...prev, userMessageObj]);
    setMessageInput('');
    setIsSending(true);

    try {
      // Build history
      const history = messages.slice(-4).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const companionResponse: MultimodalCompanionResponse = await sendMultimodalCheckIn(
        snapshotToUse,
        currentMsg,
        history,
        previousMood,
        recentResponses,
        recentSuggestions
      );

      const detectedMood =
        companionResponse.detected_mood ||
        companionResponse.visual_observations?.detected_mood ||
        companionResponse.debug_info?.detected_mood ||
        'Calm/Content';

      // Update previous mood state
      setPreviousMood(detectedMood);

      if (companionResponse.companion_response) {
        setRecentResponses((prev) => [
          ...prev.slice(-4),
          companionResponse.companion_response,
        ]);
      }

      if (companionResponse.actionable_decompression?.suggestion) {
        setRecentSuggestions((prev) => [
          ...prev.slice(-4),
          companionResponse.actionable_decompression.suggestion,
        ]);
      }

      // Populate Live Debug Inspector Payload
      setLatestDebugPayload({
        detected_mood: detectedMood,
        confidence: companionResponse.confidence || companionResponse.visual_observations?.confidence || 'HIGH',
        previous_mood: previousMood,
        mood_changed: Boolean(previousMood && previousMood !== detectedMood),
        physical_markers:
          companionResponse.physical_markers || companionResponse.visual_observations?.physical_markers || {
            eyes: 'Alert',
            mouth: 'Neutral',
            brow: 'Calm',
            posture: 'Upright',
          },
        model_used: companionResponse.debug_info?.model_used || 'gemini-3.7-flash',
        observation_angle: companionResponse.debug_info?.observation_angle || 'Physical Markers',
        tracked_recent_responses: [...recentResponses.slice(-2), companionResponse.companion_response],
        tracked_recent_suggestions: [
          ...recentSuggestions.slice(-2),
          companionResponse.actionable_decompression?.suggestion,
        ].filter(Boolean),
        raw_response: companionResponse,
        timestamp: new Date().toLocaleTimeString(),
      });

      const assistantMessageObj: CompanionMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: companionResponse.companion_response,
        timestamp: Date.now(),
        visualObservation: {
          ...companionResponse.visual_observations,
          detected_mood: detectedMood,
          confidence: companionResponse.confidence || companionResponse.visual_observations?.confidence,
          physical_markers:
            companionResponse.physical_markers || companionResponse.visual_observations?.physical_markers,
        },
        decompression: companionResponse.actionable_decompression,
        debugInfo: companionResponse.debug_info,
      };

      setMessages((prev) => [...prev, assistantMessageObj]);
    } catch (err: any) {
      console.warn('Companion request offline fallback active:', err?.message || err);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: 'assistant',
          text: "I'm right here with you. Take a slow breath. Let me know what felt most heavy or significant today.",
          timestamp: Date.now(),
          visualObservation: {
            fatigue_level: 'Moderate',
            detected_cues: ['Gentle focus'],
            incongruence_noted: false,
          },
          decompression: {
            suggestion: 'Rest your eyes for 60 seconds and unclench your shoulders.',
            friction_level: 'Micro',
          },
        },
      ]);
    } finally {
      setIsSending(false);
      setCapturedSnapshot(null);
    }
  };

  const handleSpeakText = (id: string, text: string) => {
    if (isSpeakingId === id) {
      textToSpeech.cancel();
      setIsSpeakingId(null);
    } else {
      textToSpeech.speak(text, {
        onStart: () => setIsSpeakingId(id),
        onEnd: () => setIsSpeakingId(null),
        onError: () => setIsSpeakingId(null),
      });
    }
  };

  const handleSaveCheckInToVault = async () => {
    if (messages.length === 0) return;
    const conversationSummary = messages
      .map((m) => `${m.role === 'user' ? 'Me' : 'Mind Companion'}: ${m.text}`)
      .join('\n\n');

    try {
      await onSaveAsVaultEntry(
        `[Visual Check-in Reflection]\n\n${conversationSummary}`,
        'Grounded',
        ['visual-companion', 'multimodal-checkin']
      );
      setSaveSuccessMsg('Saved to Encrypted Vault!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Failed to save to vault:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="visual-companion-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-950/80 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 p-0.5 shadow-md">
              <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center text-cyan-400">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Visual AI Journal Companion
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-semibold">
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Intuitive multimodal reflection calibrated to your visual fatigue and cognitive state
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDebugDrawer((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-sm ${
                showDebugDrawer
                  ? 'bg-amber-950/80 border-amber-600 text-amber-300 ring-1 ring-amber-500/40'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
              title="Inspect raw Gemini API return payload and anti-repetition variables"
            >
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Debug Fields</span>
              {showDebugDrawer ? (
                <ChevronUp className="w-3 h-3 text-amber-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              )}
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleSaveCheckInToVault}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/60 text-xs font-semibold transition shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {saveSuccessMsg || 'Encrypt & Save to Vault'}
                </span>
                <span className="sm:hidden">{saveSuccessMsg ? 'Saved' : 'Save'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Expandable Debug Inspector Panel */}
        {showDebugDrawer && (
          <div className="px-5 py-3.5 border-b border-amber-900/50 bg-neutral-950 text-neutral-200 text-xs space-y-3 animate-fade-in max-h-60 overflow-y-auto font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Terminal className="w-4 h-4" />
                <span>Gemini Visual AI Debug Inspector & Variables</span>
              </div>
              <div className="flex items-center gap-2">
                {latestDebugPayload && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(latestDebugPayload, null, 2));
                      setCopiedDebug(true);
                      setTimeout(() => setCopiedDebug(false), 2000);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white text-[11px]"
                  >
                    {copiedDebug ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                    <span>{copiedDebug ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                )}
                <span className="text-[10px] text-neutral-500">
                  {latestDebugPayload?.timestamp || 'Awaiting initial check-in'}
                </span>
              </div>
            </div>

            {latestDebugPayload ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                {/* Column 1: Mood Tracking */}
                <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                  <div className="text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">Mood Detection Comparison</div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Current Mood:</span>
                    <span className="text-cyan-300 font-bold">{latestDebugPayload.detected_mood}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Previous Mood:</span>
                    <span className="text-neutral-300">{latestDebugPayload.previous_mood || 'None (Initial)'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Confidence / Change:</span>
                    <span className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${latestDebugPayload.mood_changed ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'bg-neutral-800 text-neutral-300'}`}>
                      {latestDebugPayload.confidence} • {latestDebugPayload.mood_changed ? 'SHIFT DETECTED' : 'UNCHANGED (ANGLE ROTATED)'}
                    </span>
                  </div>
                </div>

                {/* Column 2: Physical Markers */}
                <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1">
                  <div className="text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">Physical Markers (Order 1-4)</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                    <div><span className="text-neutral-400">1. Eyes:</span> <span className="text-emerald-300">{latestDebugPayload.physical_markers?.eyes || 'Alert'}</span></div>
                    <div><span className="text-neutral-400">2. Mouth:</span> <span className="text-emerald-300">{latestDebugPayload.physical_markers?.mouth || 'Neutral'}</span></div>
                    <div><span className="text-neutral-400">3. Brow:</span> <span className="text-emerald-300">{latestDebugPayload.physical_markers?.brow || 'Relaxed'}</span></div>
                    <div><span className="text-neutral-400">4. Posture:</span> <span className="text-emerald-300">{latestDebugPayload.physical_markers?.posture || 'Upright'}</span></div>
                  </div>
                  <div className="text-[10px] text-neutral-400 pt-0.5 border-t border-neutral-800">
                    Model: <span className="text-cyan-400">{latestDebugPayload.model_used}</span>
                  </div>
                </div>

                {/* Column 3: Anti-Repetition Guard */}
                <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1">
                  <div className="text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">Anti-Repetition Tracking</div>
                  <div className="text-[10px] text-neutral-300">
                    Tracked Responses: <span className="text-amber-400 font-bold">{latestDebugPayload.tracked_recent_responses?.length || 1}</span> / 3
                  </div>
                  <div className="text-[10px] text-neutral-300">
                    Tracked Actions: <span className="text-amber-400 font-bold">{latestDebugPayload.tracked_recent_suggestions?.length || 1}</span> / 3
                  </div>
                  <div className="text-[10px] text-cyan-400 truncate">
                    Angle: {latestDebugPayload.observation_angle}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-neutral-900/50 border border-neutral-800/80 text-neutral-400 text-center text-xs">
                Take a check-in snapshot with camera or speech to inspect Gemini's structured raw output, confidence scores, and rotation variables.
              </div>
            )}
          </div>
        )}

        {/* Modal Body - 2 Columns on Desktop */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Left: Webcam Stream & Visual Feedback Area (5 cols) */}
          <div className="lg:col-span-5 p-4 border-b lg:border-b-0 lg:border-r border-neutral-800 bg-neutral-950/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  Live Visual Demeanor
                </span>
                <button
                  onClick={isCameraActive ? stopCamera : startCamera}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition flex items-center gap-1 ${
                    isCameraActive
                      ? 'bg-rose-950/50 border-rose-800 text-rose-300 hover:bg-rose-900/60'
                      : 'bg-cyan-950/50 border-cyan-800 text-cyan-300 hover:bg-cyan-900/60'
                  }`}
                >
                  {isCameraActive ? (
                    <>
                      <CameraOff className="w-3 h-3" />
                      <span>Turn Off</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3 h-3" />
                      <span>Start Camera</span>
                    </>
                  )}
                </button>
              </div>

              {/* Camera Video Viewport */}
              <div className="relative aspect-[4/3] w-full rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden flex items-center justify-center">
                {/* Always mount video element so ref is never null */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    (e.target as HTMLVideoElement).play().catch(() => {});
                  }}
                  className={`w-full h-full object-cover transform -scale-x-100 ${
                    isCameraActive && !capturedSnapshot ? 'block' : 'hidden'
                  }`}
                />

                {/* Subtle Framing Guides when live */}
                {isCameraActive && !capturedSnapshot && (
                  <div className="absolute inset-4 border border-dashed border-cyan-500/20 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                    <div className="flex justify-between text-[10px] text-cyan-400/50 font-mono">
                      <span>[FACIAL CUES]</span>
                      <span>[POSTURE]</span>
                    </div>
                    <div className="text-center text-[10px] text-neutral-400/60 font-mono">
                      Mind Companion Observation
                    </div>
                  </div>
                )}

                {/* Captured Snapshot Display */}
                {capturedSnapshot && (
                  <img
                    src={capturedSnapshot}
                    alt="Captured Snapshot"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Inactive State Display */}
                {!isCameraActive && !capturedSnapshot && (
                  <div className="text-center p-4">
                    <Camera className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    <p className="text-xs text-neutral-400 font-medium">Camera is inactive</p>
                    <p className="text-[11px] text-neutral-500 mt-1 max-w-[200px] mx-auto">
                      Enable your camera so Gemini can observe gentle fatigue cues.
                    </p>
                    <button
                      onClick={startCamera}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-cyan-600 text-neutral-950 text-xs font-bold hover:bg-cyan-500 transition"
                    >
                      Enable Camera
                    </button>
                  </div>
                )}

                {/* Snap action overlay button */}
                {isCameraActive && (
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                    <button
                      onClick={() => takeSnapshot()}
                      title="Capture snapshot frame"
                      className="px-2.5 py-1 rounded-lg bg-neutral-950/80 border border-neutral-700 text-neutral-200 text-[11px] font-medium hover:bg-cyan-950 hover:border-cyan-700 hover:text-cyan-300 transition backdrop-blur-sm"
                    >
                      Freeze Frame
                    </button>
                  </div>
                )}
              </div>

              {capturedSnapshot && (
                <div className="mt-2 flex items-center justify-between p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300">
                  <span className="text-[11px] text-cyan-300">Snapshot captured & ready</span>
                  <button
                    onClick={() => setCapturedSnapshot(null)}
                    className="text-[11px] text-neutral-400 hover:text-rose-400 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retake
                  </button>
                </div>
              )}

              {cameraError && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>

            {/* Privacy & Zero-Knowledge Guarantee badge */}
            <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800/80 text-[11px] text-neutral-400 space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Shield className="w-3.5 h-3.5" />
                <span>Zero-Retention Multimodal Policy</span>
              </div>
              <p className="leading-relaxed">
                Video frames and speech are analyzed ephemerally in RAM and never stored in cloud storage or training sets.
              </p>
            </div>
          </div>

          {/* Right: Companion Dialogue Thread (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between h-[450px] lg:h-[520px] bg-neutral-900">
            {/* Messages Scroll Area */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans"
            >
              {messages.length === 0 && (
                <div className="text-center py-10 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-950/60 border border-cyan-800 text-cyan-400 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-neutral-200">
                    How was your day? Speak or reflect freely.
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto leading-relaxed">
                    Mind Vault looks at your energy level and listens to your words to offer grounded reflection and decompression steps.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {[
                      'I wrapped up a long project, feeling tired but relieved.',
                      'My brain is buzzing with too many ideas.',
                      'Felt a lot of resistance starting my day.',
                    ].map((sample, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setMessageInput(sample);
                        }}
                        className="text-[11px] px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-cyan-300 hover:border-cyan-800 transition text-left"
                      >
                        "{sample}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  } space-y-1.5`}
                >
                  <div
                    className={`max-w-[88%] p-3.5 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-neutral-950 font-medium rounded-tr-none shadow-md'
                        : 'bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-tl-none space-y-3'
                    }`}
                  >
                    {/* User snapshot thumbnail if attached */}
                    {msg.snapshotUrl && (
                      <img
                        src={msg.snapshotUrl}
                        alt="Check-in Snapshot"
                        className="w-24 h-18 object-cover rounded-lg border border-neutral-800 mb-2"
                      />
                    )}

                    {/* Message Text */}
                    <div className="leading-relaxed whitespace-pre-wrap">{msg.text}</div>

                    {/* Assistant Extra Metadata (Mood Classification, Visual Markers & Decompression) */}
                    {msg.role === 'assistant' && msg.visualObservation && (
                      <div className="pt-2.5 border-t border-neutral-800/80 space-y-2.5">
                        {/* Detected Mood & Confidence Badge */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {msg.visualObservation.detected_mood && (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 shadow-sm ${
                                msg.visualObservation.detected_mood === 'Happy/Joyful'
                                  ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
                                  : msg.visualObservation.detected_mood === 'Sad/Low'
                                  ? 'bg-sky-950/80 border-sky-700/80 text-sky-300'
                                  : msg.visualObservation.detected_mood === 'Excited/Energetic'
                                  ? 'bg-amber-950/80 border-amber-700/80 text-amber-300'
                                  : msg.visualObservation.detected_mood === 'Stressed/Anxious'
                                  ? 'bg-rose-950/80 border-rose-700/80 text-rose-300'
                                  : msg.visualObservation.detected_mood === 'Tired/Fatigued'
                                  ? 'bg-indigo-950/80 border-indigo-700/80 text-indigo-300'
                                  : msg.visualObservation.detected_mood === 'Mixed/Complex'
                                  ? 'bg-purple-950/80 border-purple-700/80 text-purple-300'
                                  : 'bg-teal-950/80 border-teal-700/80 text-teal-300'
                              }`}
                            >
                              <Smile className="w-3.5 h-3.5" />
                              <span>{msg.visualObservation.detected_mood}</span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-900/80 border border-neutral-700 text-neutral-300 font-mono uppercase">
                                {msg.visualObservation.confidence || 'HIGH'}
                              </span>
                            </span>
                          )}

                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-900 border border-neutral-700 text-neutral-300 flex items-center gap-1">
                            <Activity className="w-3 h-3 text-cyan-400" />
                            Visual Fatigue: {msg.visualObservation.fatigue_level}
                          </span>

                          {msg.visualObservation.incongruence_noted && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-950/70 border border-amber-700 text-amber-300 font-semibold">
                              Subtle incongruence noted
                            </span>
                          )}
                        </div>

                        {/* Physical Markers Breakdown */}
                        {msg.visualObservation.physical_markers && (
                          <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-neutral-900/60 border border-neutral-800 text-[10px]">
                            <div className="flex items-center gap-1 text-neutral-400">
                              <span className="font-semibold text-neutral-300">Eyes:</span>{' '}
                              <span className="truncate">{msg.visualObservation.physical_markers.eyes || 'Alert'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-neutral-400">
                              <span className="font-semibold text-neutral-300">Mouth:</span>{' '}
                              <span className="truncate">{msg.visualObservation.physical_markers.mouth || 'Neutral'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-neutral-400">
                              <span className="font-semibold text-neutral-300">Brow:</span>{' '}
                              <span className="truncate">{msg.visualObservation.physical_markers.brow || 'Relaxed'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-neutral-400">
                              <span className="font-semibold text-neutral-300">Posture:</span>{' '}
                              <span className="truncate">{msg.visualObservation.physical_markers.posture || 'Upright'}</span>
                            </div>
                          </div>
                        )}

                        {/* Anti-Repetition Diagnostic Angle Badge */}
                        {msg.debugInfo && (
                          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-neutral-900/40 border border-neutral-800/60 text-[10px] text-neutral-400">
                            <div className="flex items-center gap-1 text-cyan-400/90">
                              <Compass className="w-3 h-3" />
                              <span>Angle: {msg.debugInfo.observation_angle || 'Physical Markers'}</span>
                            </div>
                            {msg.debugInfo.mood_changed ? (
                              <span className="text-amber-400 font-medium">Shifted from previous mood</span>
                            ) : (
                              <span className="text-emerald-400/90 font-medium">Anti-repetition rotation active</span>
                            )}
                          </div>
                        )}

                        {/* Decompression Box */}
                        {msg.decompression && (
                          <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-amber-900/40 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                                Actionable Decompression ({msg.decompression.friction_level} Friction)
                              </span>
                              {onAddMicroAction && (
                                <button
                                  onClick={() =>
                                    onAddMicroAction(
                                      msg.decompression!.suggestion,
                                      msg.decompression!.friction_level
                                    )
                                  }
                                  className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                >
                                  <PlusCircle className="w-3 h-3" />
                                  Add to Micro-Actions
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-neutral-300">
                              {msg.decompression.suggestion}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Message Action Bar (TTS & Timestamp & Alternate Angle button) */}
                  <div className="flex items-center gap-2 px-1 text-[10px] text-neutral-500">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleSpeakText(msg.id, msg.text)}
                          className="text-neutral-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          {isSpeakingId === msg.id ? (
                            <>
                              <VolumeX className="w-3 h-3 text-amber-400 animate-pulse" />
                              <span className="text-amber-300">Stop Speaking</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3 text-cyan-400" />
                              <span>Read Aloud</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() =>
                            handleSendMessage(
                              undefined,
                              'Can you observe from another angle and suggest an alternate decompression step?'
                            )
                          }
                          className="text-neutral-400 hover:text-cyan-300 flex items-center gap-1 transition disabled:opacity-40"
                          title="Rotate observation angle and ensure varied response"
                        >
                          <RotateCcw className="w-3 h-3 text-cyan-400/80" />
                          <span>Alternate Angle</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex items-start space-y-1.5">
                  <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 rounded-tl-none flex items-center gap-2 text-neutral-400 text-xs">
                    <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>Mind Companion is observing and reflecting...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input & Controls Box */}
            <div className="p-3.5 border-t border-neutral-800 bg-neutral-950/80">
              <form onSubmit={handleSendMessage} className="space-y-2">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={
                      isDictating
                        ? 'Listening live to your voice...'
                        : 'Unpack your thoughts or speak what comes to mind...'
                    }
                    className="w-full pl-3.5 pr-24 py-2.5 bg-neutral-900 border border-neutral-800 focus:border-cyan-500 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none"
                  />

                  <div className="absolute right-2 flex items-center gap-1">
                    {/* Dictation Button */}
                    <button
                      type="button"
                      onClick={handleToggleDictation}
                      title="Voice Dictation"
                      className={`p-1.5 rounded-lg border transition ${
                        isDictating
                          ? 'bg-rose-950 border-rose-600 text-rose-300 animate-pulse'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-cyan-300'
                      }`}
                    >
                      {isDictating ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSending || (!messageInput.trim() && !capturedSnapshot && !isCameraActive)}
                      className="p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-bold transition disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Interim Live Speech Transcript Bubble */}
                {isDictating && interimTranscript && (
                  <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/80 text-[11px] text-cyan-200 flex items-center gap-2 animate-fade-in">
                    <span className="px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-cyan-900 text-cyan-300">
                      Live
                    </span>
                    <span className="italic text-neutral-200">"{interimTranscript}"</span>
                  </div>
                )}

                {dictationError && (
                  <div className="p-2 rounded-lg bg-rose-950/50 border border-rose-800 text-[11px] text-rose-300">
                    {dictationError}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1">
                  <span>
                    {isCameraActive ? '📸 Live camera frame will accompany your message' : '💡 Tip: Turn on camera for visual fatigue alignment'}
                  </span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden canvas for snapshot capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
