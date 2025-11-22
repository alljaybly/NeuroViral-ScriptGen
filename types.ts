export interface ScriptSegment {
  startTime: number;
  endTime: number;
  label: string;
  text: string;
  visual: string;
}

export interface ScriptSource {
  title: string;
  uri: string;
}

export interface GeneratedScript {
  topic: string;
  segments: ScriptSegment[];
  sources?: ScriptSource[];
  keyFacts?: string[];
}

export enum Tone {
  URGENT = 'Urgent & Scientific',
  MOTIVATIONAL = 'Motivational & High Energy',
  CALM = 'Calm & Reassuring',
  STORYTELLING = 'Storytelling & Narrative',
  HUMOROUS = 'Humorous & Engaging',
  AUTHORITATIVE = 'Authoritative & Deep Dive',
  PERSONAL = 'Personal Anecdote'
}

export interface VoiceProfile {
  voiceName: string;
  analysis: string;
}

export interface GenerationRequest {
  topic: string;
  tone: Tone;
  duration: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  script: GeneratedScript;
  tone: Tone;
  duration: number;
}

export interface ScriptTemplate {
  label: string;
  topic: string;
  tone: Tone;
  duration: number;
  iconName: 'Smartphone' | 'Dumbbell' | 'BookHeart' | 'Zap' | 'TrendingUp' | 'Utensils';
}