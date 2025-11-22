# NeuroViral ScriptGen 🧠

> **Your brain has a delete button for boring content. This app removes it.**

NeuroViral ScriptGen is a specialized React application designed to generate high-retention YouTube Short scripts using a neuroscience-backed viral formula: **Hook - Problem - Solution - Demonstration - Call to Action (CTA)**.

Powered by Google's Gemini API, it generates scripts, creates visual cues (images), and produces lifelike text-to-speech audio previews with synchronized subtitles.

## 🚀 Features

-   **Scientific Formula**: Automatically structures content into the viral 5-step framework.
-   **Multi-Modal AI**:
    -   **Text**: Generates punchy, timed scripts using `gemini-2.5-flash`.
    -   **Audio**: Generates emotive voiceovers using `gemini-2.5-flash-preview-tts`.
    -   **Vision**: Creates storyboard visual assets using `gemini-2.5-flash-image`.
-   **Smart Tones**: Select from tones like *Urgent & Scientific*, *Humorous*, or *Authoritative* with mapped voice personalities (Fenrir, Charon, Zephyr, Puck).
-   **Live Preview**:
    -   Audio player with specific voice skins.
    -   **Karaoke-style synchronized subtitles** for pacing checks.
    -   Visual cue image generation with customizable prompts.
-   **Export & Share**:
    -   Download scripts as JSON, Markdown, or Text.
    -   Quick share via Twitter or Email.
-   **Custom Duration**: Adjust script timing between 30s and 60s.

## 🛠️ Tech Stack

-   **Frontend**: React 19, TypeScript
-   **Styling**: Tailwind CSS
-   **Icons**: Lucide React
-   **AI**: Google GenAI SDK (`@google/genai`)

## 🤖 AI Models Used

| Feature | Model |
| :--- | :--- |
| Script Generation | `gemini-2.5-flash` |
| Text-to-Speech | `gemini-2.5-flash-preview-tts` |
| Image Generation | `gemini-2.5-flash-image` |

## 📦 Installation & Setup

1.  **Clone the repository**
2.  **Install dependencies**
    ```bash
    npm install
    ```
3.  **Set up API Key**
    Ensure your Google Gemini API key is available in your environment as `API_KEY`.
4.  **Run the application**
    ```bash
    npm start
    ```

## 📂 Project Structure

-   `App.tsx`: Main controller and layout.
-   `services/geminiService.ts`: Handles all interactions with Google GenAI (Text, Audio, Image).
-   `components/ScriptSegmentCard.tsx`: The UI powerhouse displaying the timeline, audio player, subtitles, and visuals.
-   `components/InputForm.tsx`: User input for topic, tone, and duration.
-   `types.ts`: Type definitions for scripts and segments.
-   `constants.ts`: Default data and configuration options.

---

*Built for creators who want to hack the algorithm with science.*