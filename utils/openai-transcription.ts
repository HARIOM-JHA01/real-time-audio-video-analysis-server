import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export interface TranscriptionResult {
    text: string;
    confidence?: number;
    isFinal: boolean;
}

/**
 * Transcribe audio buffer using OpenAI Whisper API
 * @param audioBuffer - Audio data as Buffer
 * @param mimeType - MIME type of the audio (e.g., 'audio/webm', 'audio/wav')
 * @returns Promise<TranscriptionResult>
 */
export async function transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string = 'audio/webm'
): Promise<TranscriptionResult> {
    try {
        console.log("🎤 Starting OpenAI Whisper transcription...");
        console.log("🎤 Audio buffer size:", audioBuffer.length, "bytes");
        console.log("🎤 MIME type:", mimeType);

        // Determine file extension based on MIME type
        let extension = '.webm';
        if (mimeType.includes('wav')) extension = '.wav';
        else if (mimeType.includes('mp3')) extension = '.mp3';
        else if (mimeType.includes('mp4')) extension = '.mp4';
        else if (mimeType.includes('ogg')) extension = '.ogg';

        // Create temporary file for the audio
        const tempDir = '/tmp';
        const tempFileName = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${extension}`;
        const tempFilePath = path.join(tempDir, tempFileName);

        console.log("🎤 Writing audio to temp file:", tempFilePath);

        // Write buffer to temporary file
        fs.writeFileSync(tempFilePath, audioBuffer);

        try {
            // Call OpenAI Whisper API
            console.log("🎤 Calling OpenAI Whisper API...");
            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(tempFilePath),
                model: "whisper-1",
                language: "en", // Specify English for better performance
                response_format: "verbose_json", // Get detailed response with confidence-like data
                temperature: 0, // More deterministic results
            });

            console.log("🎤 Whisper transcription response:", transcription);

            // Clean up temporary file
            try {
                fs.unlinkSync(tempFilePath);
                console.log("🗑️ Cleaned up temp file:", tempFilePath);
            } catch (cleanupError) {
                console.warn("⚠️ Failed to clean up temp file:", cleanupError);
            }

            // Return structured result
            const result: TranscriptionResult = {
                text: transcription.text || '',
                confidence: 0.9, // Whisper doesn't provide confidence, so we use a high default
                isFinal: true // Whisper always returns final results
            };

            console.log("✅ Transcription successful:", result.text);
            return result;

        } catch (apiError) {
            // Clean up temp file even if API call fails
            try {
                fs.unlinkSync(tempFilePath);
            } catch (cleanupError) {
                console.warn("⚠️ Failed to clean up temp file after error:", cleanupError);
            }
            throw apiError;
        }

    } catch (error) {
        console.error("❌ OpenAI Whisper transcription error:", error);

        // Return empty result on error
        return {
            text: '',
            confidence: 0,
            isFinal: true
        };
    }
}

/**
 * Check if OpenAI API key is configured
 */
export function checkOpenAIConfiguration(): boolean {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.error("❌ OPENAI_API_KEY is not set in environment variables");
        return false;
    }

    console.log("✅ OpenAI API key found, length:", apiKey.length);
    return true;
}

/**
 * Test OpenAI connection
 */
export async function testOpenAIConnection(): Promise<boolean> {
    try {
        // Try to list available models to test the connection
        const models = await openai.models.list();
        console.log("✅ OpenAI connection test successful");
        console.log("📋 Available models count:", models.data.length);
        return true;
    } catch (error) {
        console.error("❌ OpenAI connection test failed:", error);
        return false;
    }
}