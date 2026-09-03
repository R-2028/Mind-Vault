/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GraphNodeType = 'Project' | 'Mood' | 'Person' | 'Skill' | 'Habit' | 'Tech';

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  frequency?: number;
  val?: number; // for force graph sizing
  entryIds?: string[];
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  relationship: string;
}

export interface MicroAction {
  id: string;
  task: string;
  friction_level: 'Micro' | 'Low' | 'Medium';
  completed: boolean;
  createdAt: string;
  entryId?: string;
}

export interface AIAnalysisResult {
  summary: string;
  trigger_alert?: boolean;
  alert_reason?: string;
  micro_actions: Array<{
    task: string;
    friction_level: 'Micro' | 'Low' | 'Medium';
  }>;
  graph_nodes: Array<{
    id: string;
    label: string;
    type: GraphNodeType;
  }>;
  graph_edges: Array<{
    source: string;
    target: string;
    relationship: string;
  }>;
}

export interface UserNotificationPreferences {
  enabled: boolean;
  channel: 'Slack' | 'Discord' | 'Email';
  webhookUrl?: string;
  emailRecipient?: string;
  triggerOnBurnout: boolean;
  triggerOnFriction: boolean;
  triggerOnAllReflections: boolean;
  lastDispatchedAt?: number;
}

export interface GeolocationData {
  latitude: number;
  longitude: number;
  lat?: number;
  lng?: number;
  accuracy?: number;
  formattedAddress?: string;
  addressName?: string;
  placeId?: string;
}

export interface DecryptedEntry {
  id: string;
  timestamp: number;
  formattedDate: string;
  plaintext: string;
  tone?: string;
  tags?: string[];
  aiInsight?: AIAnalysisResult;
  embedding?: number[];
  location?: GeolocationData; // Encrypted with AES-GCM inside ciphertext
}

export interface EncryptedVaultRecord {
  id: string;
  timestamp: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64 (contains plaintext + location + insights)
  embeddingVector?: number[]; // local vector
}

export interface UserRoleClaim {
  isAdmin: boolean;
  role: 'admin' | 'user';
  email?: string;
}

export interface DailySubmissionVolume {
  date: string;
  count: number;
  dayName: string;
}

export interface ServiceHealthItem {
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'STANDBY';
  latencyMs: number;
  details: string;
}

export interface AdminUserRecord {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: number;
  lastLogin: number;
  encryptedRecordCount: number;
  isAdmin: boolean;
}

export interface AdminSystemStats {
  totalUsers: number;
  totalEncryptedRecords: number;
  activeSessions: number;
  zeroKnowledgeViolations: 0; // Always 0 by cryptographic design
  lastUpdated: string;
  uptimePercentage?: number;
  avgAiLatencyMs?: number;
  dailySubmissionVolume?: DailySubmissionVolume[];
  serviceHealth?: ServiceHealthItem[];
}

export interface AdminNotificationRecord {
  id: string;
  timestamp: number;
  triggerType: 'FATIGUE_SPIKE' | 'FRICTION_RESOLVED' | 'ENCRYPTION_WIPE' | 'MICRO_ACTION_COMPLETED';
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  sanitizedMessage: string;
  channel: 'Slack' | 'Discord' | 'Email' | 'Internal';
  status: 'SENT' | 'FILTERED' | 'FAILED';
}


export interface VaultMetadata {
  isInitialized: boolean;
  masterSalt: string; // base64 salt
  verificationCiphertext: string; // base64 encrypted test token
  verificationIv: string; // base64 iv
  createdAt: number;
  lastBackupAt?: number;
  storageProvider: 'indexeddb' | 'firestore';
}

export interface SecurityAuditLog {
  id: string;
  timestamp: number;
  event: string;
  category: 'CRYPTO' | 'AUTH' | 'STORAGE' | 'AI_PROXY' | 'EMBEDDING' | 'MEMORY';
  details: string;
  status: 'SUCCESS' | 'WARN' | 'INFO';
}

export interface SearchMatch {
  entry: DecryptedEntry;
  score: number; // 0 to 1 cosine similarity
  matchedTerms: string[];
}

export type DetectedMoodType = 
  | 'Happy/Joyful' 
  | 'Sad/Low' 
  | 'Excited/Energetic' 
  | 'Stressed/Anxious' 
  | 'Calm/Content' 
  | 'Tired/Fatigued' 
  | 'Mixed/Complex' 
  | 'Neutral';

export interface PhysicalMarkers {
  eyes?: string;
  mouth?: string;
  brow?: string;
  posture?: string;
}

export interface MultimodalObservation {
  fatigue_level: 'High' | 'Moderate' | 'Low' | 'Energized' | 'Neutral' | 'Undetected';
  detected_cues: string[];
  incongruence_noted: boolean;
  detected_mood?: DetectedMoodType;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  physical_markers?: PhysicalMarkers;
}

export interface ActionableDecompression {
  suggestion: string;
  friction_level: 'Micro' | 'Low' | 'Medium';
}

export interface MultimodalDebugInfo {
  detected_mood: DetectedMoodType;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  previous_mood?: string | null;
  mood_changed: boolean;
  model_used: string;
  turn_index?: number;
  observation_angle?: string;
  action_category?: string;
  raw_gemini_timestamp?: number;
}

export interface MultimodalCompanionResponse {
  companion_response: string;
  detected_mood?: DetectedMoodType;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  physical_markers?: PhysicalMarkers;
  visual_observations: MultimodalObservation;
  actionable_decompression: ActionableDecompression;
  debug_info?: MultimodalDebugInfo;
}

export interface CompanionMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  snapshotUrl?: string;
  visualObservation?: MultimodalObservation;
  decompression?: ActionableDecompression;
  debugInfo?: MultimodalDebugInfo;
}
