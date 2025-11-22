import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { GeneratedScript, Tone, VoiceProfile, ScriptSource } from "../types";

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

export const generateScript = async (topic: string, tone: Tone, duration: number, useSearch: boolean = false): Promise<GeneratedScript> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment variables.");
  }

  let prompt = `
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

  if (useSearch) {
    prompt += `
    IMPORTANT: Perform a Google Search to find the latest scientific, trending, or relevant data on this topic to ensure accuracy.
    Include a 'keyFacts' array in the JSON response with 3-5 short, punchy bullet points of specific research or facts found during the search.
    
    OUTPUT FORMAT:
    Return a RAW JSON object (do not use Markdown code blocks).
    Structure:
    {
      "segments": [
        {
          "startTime": number,
          "endTime": number,
          "label": "string",
          "text": "string",
          "visual": "string"
        }
      ],
      "keyFacts": ["string", "string", "string"]
    }
    `;
  }

  try {
    const config: any = {
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are a world-class viral content strategist specializing in neuroscience-backed YouTube Shorts. Your scripts are concise, rhythmic, and visually descriptive, focusing on high-retention visual storytelling.",
        },
    };

    if (useSearch) {
      // When using tools like googleSearch, we cannot set responseMimeType or responseSchema
      config.config.tools = [{ googleSearch: {} }];
    } else {
      config.config.responseMimeType = "application/json";
      config.config.responseSchema = scriptSchema;
    }

    const response = await ai.models.generateContent(config);

    const text = response.text;
    if (!text) throw new Error("No response text received");
    
    let parsedData;
    try {
      // Clean potential markdown markers if the model ignores the "raw json" instruction
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanText);
    } catch (e) {
      console.error("JSON Parse Error:", e, "Text:", text);
      throw new Error("Failed to parse generated script. The model might have returned invalid JSON.");
    }
    
    // Validate simple structure
    if (!parsedData.segments || !Array.isArray(parsedData.segments)) {
      throw new Error("Invalid response structure");
    }

    const script: GeneratedScript = {
      topic,
      segments: parsedData.segments,
      keyFacts: parsedData.keyFacts || []
    };

    // Extract grounding sources if available
    if (useSearch && response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      const chunks = response.candidates[0].groundingMetadata.groundingChunks;
      const sources: ScriptSource[] = [];
      
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri && chunk.web?.title) {
          // Avoid duplicates
          if (!sources.some(s => s.uri === chunk.web.uri)) {
            sources.push({
              title: chunk.web.title,
              uri: chunk.web.uri
            });
          }
        }
      });
      script.sources = sources;
    }

    return script;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

const getVoiceForTone = (tone: Tone): string => {
  // Mapping tones to specific Gemini TTS voices for optimal delivery
  switch (tone) {
    case Tone.URGENT: 
      return 'Fenrir'; // Intense, deep, commanding - ideal for high-stakes hooks
    case Tone.AUTHORITATIVE: 
      return 'Charon'; // Deep, resonant, serious - perfect for "Deep Dive" and scientific facts
    case Tone.MOTIVATIONAL: 
      return 'Zephyr'; // Energetic, clear, uplifting - great for fitness/hacks
    case Tone.HUMOROUS: 
      return 'Puck';   // Playful, expressive, mischievous - captures irony and wit
    case Tone.STORYTELLING: 
      return 'Puck';   // Engaging narrative style - good for flowing stories
    case Tone.PERSONAL: 
      return 'Zephyr'; // Relatable, conversational, warm - sounds like a friend
    case Tone.CALM: 
      return 'Kore';   // Soothing, soft, reassuring - perfect for anxiety relief
    default: 
      return 'Kore';
  }
};

export const analyzeVoiceStyle = async (base64Audio: string): Promise<VoiceProfile> => {
  if (!apiKey) throw new Error("API Key is missing");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { 
            inlineData: {
              mimeType: "audio/mp3",
              data: base64Audio
            }
          },
          {
            text: `Analyze the prosody, pitch, gender, and timbre of this voice sample. 
            Based on your analysis, map it to the closest available TTS voice from this list: 
            - 'Fenrir' (Intense, Deep, Urgent, Male)
            - 'Charon' (Authoritative, Low, Serious, Male)
            - 'Zephyr' (Energetic, Bright, Relatable, Female)
            - 'Puck' (Expressive, Playful, Storytelling, Male)
            - 'Kore' (Calm, Soothing, Relaxed, Female)

            Return a JSON object with the selected 'voiceName' and a short 1-sentence 'analysis' of why it matches.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            voiceName: { type: Type.STRING },
            analysis: { type: Type.STRING }
          },
          required: ["voiceName", "analysis"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Analysis failed");
    return JSON.parse(text) as VoiceProfile;

  } catch (error) {
    console.error("Voice Analysis Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string, tone: Tone, voiceOverride?: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");

  // Use override if provided, otherwise fallback to tone mapping
  const voiceName = voiceOverride || getVoiceForTone(tone);

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