import { GoogleGenAI, Modality } from "@google/genai";
import { decodeBase64, decodeAudioData } from "../utils/audioUtils";

const API_KEY = process.env.API_KEY || '';

// Initialize client once
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateSpeechFromSelection = async (
  imageBase64: string,
  voiceName: string = 'Kore'
): Promise<AudioBuffer> => {
  if (!API_KEY) {
    throw new Error("API Key is missing.");
  }

  // Remove header if present (e.g. "data:image/png;base64,")
  const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

  try {
    // Step 1: Extract text from the image using a vision-capable model
    console.log("Step 1: Extracting text...");
    const extractionResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { 
              text: "Extract the text from this image. If the text is in Persian (Farsi), please add necessary vowel markers (Harakat/Erab) and specifically 'Ezafe' to ensure correct pronunciation when read aloud. Return ONLY the plain text content, do not use Markdown or labels." 
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

    let extractedText = extractionResponse.text;

    if (!extractedText || !extractedText.trim()) {
      throw new Error("متنی در تصویر پیدا نشد (No text found).");
    }

    extractedText = extractedText.trim();
    console.log("Extracted Text for TTS:", extractedText);

    // Step 2: Generate speech from the extracted text
    console.log(`Step 2: Generating speech using voice: ${voiceName}...`);
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
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const candidate = ttsResponse.candidates?.[0];
    const firstPart = candidate?.content?.parts?.[0];

    // Check if model returned text (error/refusal) instead of audio
    if (firstPart?.text && !firstPart?.inlineData) {
      console.warn("TTS Model returned text message:", firstPart.text);
      throw new Error(`مدل صوتی نتوانست متن را بخواند: ${firstPart.text}`);
    }

    const base64Audio = firstPart?.inlineData?.data;

    if (!base64Audio) {
      console.error("Full TTS Response:", JSON.stringify(ttsResponse, null, 2));
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