import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk"
const deepgramApiKey = process.env.DEEPGRAM_API_KEY || "";
export const deepgram = createClient(deepgramApiKey);