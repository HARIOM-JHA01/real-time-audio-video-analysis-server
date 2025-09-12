import { deepgram } from "./deepgram";

export async function analyzeText(text: string) {
    const { result, error } = await deepgram.read.analyzeText(
        { text },
        {
            language: "en",
            summarize: true,
            sentiment: true,
            topics: true,
            intents: true
        }
    );

    if (error) {
        console.error("Error analyzing text:", error);
        throw new Error("Text analysis failed");
    }

    return result;
}