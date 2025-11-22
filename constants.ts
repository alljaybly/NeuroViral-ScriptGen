import { GeneratedScript, Tone, ScriptTemplate } from './types';

// The exact example from the user request, used as the initial state
export const DEFAULT_SCRIPT: GeneratedScript = {
  topic: "Anxiety Relief",
  segments: [
    {
      startTime: 0,
      endTime: 5,
      label: "HOOK",
      text: "Your brain has a delete button for anxiety. Here's how to press it.",
      visual: "Close up of a person looking stressed, then a digital 'DELETE' button overlay."
    },
    {
      startTime: 5,
      endTime: 15,
      label: "PROBLEM",
      text: "When you overthink, your amygdala hijacks your prefrontal cortex. This creates a loop of stress and worry that feels impossible to escape.",
      visual: "Animation of brain: Amygdala glowing red, overpowering the front section."
    },
    {
      startTime: 15,
      endTime: 25,
      label: "SOLUTION",
      text: "This 3-word mantra from neuroscience research interrupts that loop immediately: 'Clear. Mind. Still.'",
      visual: "Text appears on screen rhythmically: Clear. Mind. Still."
    },
    {
      startTime: 25,
      endTime: 40,
      label: "DEMONSTRATION",
      text: "Say it with me now. Breathe in: 'Clear.' Hold: 'Mind.' Breathe out: 'Still.' [3 second pause] Again. Breathe in: 'Clear.' Hold: 'Mind.' Breathe out: 'Still.'",
      visual: "Split screen: Person demonstrating breathing + Text cues fading in/out."
    },
    {
      startTime: 40,
      endTime: 45,
      label: "CTA",
      text: "Save this for later. Share it with a friend who needs peace. Your calm is one breath away.",
      visual: "Person smiling, calm. Save and Share icons pop up."
    }
  ]
};

export const TONES = [
  Tone.URGENT,
  Tone.MOTIVATIONAL,
  Tone.CALM,
  Tone.STORYTELLING,
  Tone.HUMOROUS,
  Tone.AUTHORITATIVE,
  Tone.PERSONAL
];

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    label: 'Tech Tip',
    topic: 'Hidden Smartphone Battery Trick',
    tone: Tone.URGENT,
    duration: 45,
    iconName: 'Smartphone'
  },
  {
    label: 'Fitness Hack',
    topic: 'Fix Your Posture in 30 Seconds',
    tone: Tone.MOTIVATIONAL,
    duration: 40,
    iconName: 'Dumbbell'
  },
  {
    label: 'Recipe Hack',
    topic: '3-Ingredient Mug Cake in 60 Seconds',
    tone: Tone.HUMOROUS,
    duration: 50,
    iconName: 'Utensils'
  },
  {
    label: 'Life Lesson',
    topic: 'The Rule of Thirds for Happiness',
    tone: Tone.STORYTELLING,
    duration: 60,
    iconName: 'BookHeart'
  },
  {
    label: 'Productivity',
    topic: 'The 2-Minute Rule to Stop Procrastination',
    tone: Tone.AUTHORITATIVE,
    duration: 50,
    iconName: 'Zap'
  },
  {
    label: 'Finance',
    topic: 'Stop Buying Coffee? Do This Instead',
    tone: Tone.URGENT,
    duration: 45,
    iconName: 'TrendingUp'
  }
];