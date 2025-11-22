export interface ScriptSegment {
  startTime: number;
  endTime: number;
  label: string;
  text: string;
  visual: string;
}

export interface GeneratedScript {
  topic: string;
  segments: ScriptSegment[];
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

export interface GenerationRequest {
  topic: string;
  tone: Tone;
  duration: number;
}