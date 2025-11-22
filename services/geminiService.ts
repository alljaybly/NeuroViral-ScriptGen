import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { GeneratedScript, Tone } from "../types";

const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

const scriptSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startTime: { type: Type.INTEGER, description: "Start time in seconds" },
          endTime: { type: Type.INTEGER, description: "End time in seconds" },
          label: { type: Type.STRING, description: "Section label (HOOK, PROBLEM, SOLUTION, DEMONSTRATION, CTA)" },
          text: { type: Type.STRING, description: "The spoken script/voiceover text" },
          visual: { type: Type.STRING, description: "Detailed visual description including animations, text overlays, camera angles, and B-roll suggestions." },
        },
        required: ["startTime", "endTime", "label", "text", "visual"],
      },
    },
  },
  required: ["segments"],
};

export const generateScript = async (topic: string, tone: Tone, duration: number): Promise<GeneratedScript> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment variables.");
  }

  const prompt = `
    Create a ${duration}-second YouTube Short script about "${topic}".
    Tone: ${tone}.
    
    You MUST follow this exact viral structure and timing, scaled specifically for a ${duration}-second video:
    1. HOOK (First ~10-15%): A counter-intuitive statement or urgent hook.
    2. PROBLEM (Next ~20%): Explain the scientific mechanism or the relatable struggle.
    3. SOLUTION (Next ~20%): Introduce the specific technique, concept, or fix.
    4. DEMONSTRATION (Next ~35%): A guided practice or specific example of applying the solution.
    5. CTA (Last ~5s): Urgent call to save this video and specifically share it with a friend who needs this.

    VISUAL GUIDELINES:
    - Visuals MUST be dynamic and high-retention.
    - Include specific camera directions (e.g., "Crash zoom", "Split screen", "Dolly in").
    - Specify on-screen text overlays (e.g., [TEXT: "Don't Panic"]).
    - Suggest precise animations or B-roll (e.g., "3D animation of cortisol spiking", "Black & white montage").
    - Ensure visuals perfectly sync with the audio pacing.

    Ensure the total duration is strictly ${duration} seconds.
    The start and end times of the segments must be continuous and sum up to exactly ${duration}.
    The content should be punchy, direct, and high-retention.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: scriptSchema,
        systemInstruction: "You are a world-class viral content strategist specializing in neuroscience-backed YouTube Shorts. Your scripts are concise, rhythmic, and visually descriptive, focusing on high-retention visual storytelling.",
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response text received");
    
    const parsedData = JSON.parse(jsonText);
    
    // Validate simple structure
    if (!parsedData.segments || !Array.isArray(parsedData.segments)) {
      throw new Error("Invalid response structure");
    }

    return {
      topic,
      segments: parsedData.segments
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

const getVoiceForTone = (tone: Tone): string => {
  // Mapping tones to specific Gemini TTS voices for optimal delivery
  switch (tone) {
    case Tone.URGENT: 
      return 'Fenrir'; // Intense, deep, commanding
    case Tone.AUTHORITATIVE: 
      return 'Charon'; // Deep, serious, authoritative
    case Tone.MOTIVATIONAL: 
      return 'Zephyr'; // Energetic, clear, uplifting
    case Tone.HUMOROUS: 
      return 'Puck';   // Playful, expressive, mischievous
    case Tone.STORYTELLING: 
      return 'Puck';   // Engaging narrative style
    case Tone.PERSONAL: 
      return 'Zephyr'; // Relatable, conversational
    case Tone.CALM: 
      return 'Kore';   // Soothing, soft, reassuring
    default: 
      return 'Kore';
  }
};

export const generateSpeech = async (text: string, tone: Tone): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");

  const voiceName = getVoiceForTone(tone);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};

export const generateImage = async (visualDescription: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { text: `Create a high-quality, cinematic, photorealistic 16:9 image for a YouTube Short video based on this description: ${visualDescription}. Ensure the style is modern, engaging, and high-definition.` }
        ]
      },
      // No responseMimeType or responseSchema for image generation models
    });

    // Iterate to find image part
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};
