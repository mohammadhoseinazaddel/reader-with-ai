import { GoogleGenAI, Modality } from "@google/genai";
import { decodeBase64, decodeAudioData } from "../utils/audioUtils";

const API_KEY = process.env.API_KEY || '';

// Initialize client once
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateSpeechFromSelection = async (
  imageBase64: string,
  promptText: string = "Read the text clearly from this image."
): Promise<AudioBuffer> => {
  if (!API_KEY) {
    throw new Error("API Key is missing.");
  }

  // Remove header if present (e.g. "data:image/png;base64,")
  const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

  try {
    // Step 1: Extract text from the image using a vision-capable model
    // The TTS model (gemini-2.5-flash-preview-tts) does not support image input directly.
    const extractionResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { 
              text: "Extract all the text from this image exactly as it appears. If the text is in Persian, keep it in Persian. If there is no text, simply describe what is in the image in Persian. Return ONLY the text or description to be read aloud." 
            },
            {
              inlineData: {
                mimeType: "image/png",
                data: cleanBase64
              }
            }
          ]
        }
      ]
    });

    const extractedText = extractionResponse.text;

    if (!extractedText) {
      throw new Error("Could not extract text from the image.");
    }

    console.log("Extracted Text for TTS:", extractedText);

    // Step 2: Generate speech from the extracted text
    const ttsResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [
        {
          parts: [
            { text: extractedText }
          ]
        }
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini TTS.");
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const pcmData = decodeBase64(base64Audio);
    const audioBuffer = await decodeAudioData(pcmData, audioContext, 24000, 1);
    
    return audioBuffer;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};