import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface VideoAnalysisResult {
    description: string;
    objects?: string[];
    scene?: string;
    mood?: string;
    emotions?: { [key: string]: number };
}

export async function analyzeVideoFrame(base64Image: string): Promise<VideoAnalysisResult> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Analyze this image focusing on emotions and environment. Respond in plain conversational English without any markdown formatting, bullet points, or numbered lists. Provide a natural description covering: the scene and environment, key objects visible, the general setting, detailed emotion analysis including happiness, sadness, excitement, calmness, and stress levels, plus overall mood assessment. Focus on emotional state and atmosphere rather than personal identification. Keep the response flowing and natural like you're describing what you see to a friend."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                                detail: "low" // Use low detail for faster processing
                            }
                        }
                    ]
                }
            ],
            max_tokens: 300,
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content || "No description available";

        // Parse the response to extract structured data
        const description = content;

        // Extract structured data
        const objects = extractObjects(content);
        const scene = extractScene(content);
        const mood = extractMood(content);
        const emotions = extractEmotions(content);

        return {
            description,
            objects,
            scene,
            mood,
            emotions
        };
    } catch (error) {
        console.error('Error analyzing video frame:', error);
        throw new Error('Video frame analysis failed');
    }
}

function extractObjects(text: string): string[] {
    const objects: string[] = [];
    const commonObjects = [
        'laptop', 'computer', 'monitor', 'screen', 'keyboard', 'mouse',
        'chair', 'desk', 'table', 'bed', 'sofa',
        'book', 'phone', 'coffee', 'cup', 'bottle',
        'plant', 'flower', 'tree', 'window', 'door',
        'light', 'lamp', 'camera', 'microphone',
        'cat', 'dog', 'bird', 'car', 'bicycle',
        'headphones', 'glasses', 'clock', 'picture', 'frame'
    ];

    const lowerText = text.toLowerCase();
    commonObjects.forEach(obj => {
        if (lowerText.includes(obj)) {
            objects.push(obj);
        }
    });

    return [...new Set(objects)]; // Remove duplicates
}

function extractScene(text: string): string {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('office') || lowerText.includes('workspace') || lowerText.includes('desk')) {
        return 'office/workspace';
    }
    if (lowerText.includes('kitchen')) {
        return 'kitchen';
    }
    if (lowerText.includes('bedroom') || lowerText.includes('bed')) {
        return 'bedroom';
    }
    if (lowerText.includes('living room') || lowerText.includes('sofa') || lowerText.includes('couch')) {
        return 'living room';
    }
    if (lowerText.includes('outdoor') || lowerText.includes('outside') || lowerText.includes('park')) {
        return 'outdoor';
    }
    if (lowerText.includes('bathroom')) {
        return 'bathroom';
    }

    return 'indoor space';
}

function extractMood(text: string): string {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('happy') || lowerText.includes('joy') || lowerText.includes('smiling')) {
        return 'happy';
    }
    if (lowerText.includes('sad') || lowerText.includes('melancholy')) {
        return 'sad';
    }
    if (lowerText.includes('focused') || lowerText.includes('concentrated') || lowerText.includes('working')) {
        return 'focused';
    }
    if (lowerText.includes('relaxed') || lowerText.includes('calm') || lowerText.includes('peaceful')) {
        return 'relaxed';
    }
    if (lowerText.includes('busy') || lowerText.includes('active')) {
        return 'busy';
    }

    return 'neutral';
}

function extractEmotions(text: string): { [key: string]: number } {
    const lowerText = text.toLowerCase();
    const emotions: { [key: string]: number } = {};

    // Happiness indicators
    const happinessWords = ['happy', 'joy', 'joyful', 'smiling', 'cheerful', 'pleased', 'delighted', 'content', 'upbeat'];
    const happinessScore = happinessWords.reduce((score, word) => 
        score + (lowerText.includes(word) ? 0.2 : 0), 0);
    emotions.happiness = Math.min(happinessScore, 1.0);

    // Sadness indicators
    const sadnessWords = ['sad', 'melancholy', 'down', 'depressed', 'gloomy', 'unhappy', 'sorrowful'];
    const sadnessScore = sadnessWords.reduce((score, word) => 
        score + (lowerText.includes(word) ? 0.25 : 0), 0);
    emotions.sadness = Math.min(sadnessScore, 1.0);

    // Excitement indicators
    const excitementWords = ['excited', 'energetic', 'enthusiastic', 'thrilled', 'animated', 'vibrant'];
    const excitementScore = excitementWords.reduce((score, word) => 
        score + (lowerText.includes(word) ? 0.25 : 0), 0);
    emotions.excitement = Math.min(excitementScore, 1.0);

    // Calmness indicators
    const calmnessWords = ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'composed'];
    const calmnessScore = calmnessWords.reduce((score, word) => 
        score + (lowerText.includes(word) ? 0.25 : 0), 0);
    emotions.calmness = Math.min(calmnessScore, 1.0);

    // Stress indicators
    const stressWords = ['stressed', 'tense', 'anxious', 'worried', 'overwhelmed', 'frantic', 'agitated'];
    const stressScore = stressWords.reduce((score, word) => 
        score + (lowerText.includes(word) ? 0.25 : 0), 0);
    emotions.stress = Math.min(stressScore, 1.0);

    // Focus indicators
    const focusWords = ['focused', 'concentrated', 'attentive', 'engaged', 'absorbed'];
    const focusScore = focusWords.reduce((score, word) => 
        score + (lowerText.includes(word) ? 0.25 : 0), 0);
    emotions.focus = Math.min(focusScore, 1.0);

    // Default neutral state if no emotions detected
    const totalEmotions = Object.values(emotions).reduce((sum, val) => sum + val, 0);
    if (totalEmotions === 0) {
        emotions.neutral = 0.7;
    }

    return emotions;
}