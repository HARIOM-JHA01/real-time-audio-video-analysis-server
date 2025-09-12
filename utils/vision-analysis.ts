import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface VideoAnalysisResult {
    description: string;
    objects?: string[];
    scene?: string;
    mood?: string;
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
                            text: "Analyze this image and provide: 1) A brief description of what you see 2) Key objects present 3) The general scene/setting 4) The mood/atmosphere. Keep your response concise but informative."
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
            max_tokens: 200,
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content || "No description available";

        // Parse the response to extract structured data
        const description = content;

        // Simple object detection based on common objects mentioned
        const objects = extractObjects(content);
        const scene = extractScene(content);
        const mood = extractMood(content);

        return {
            description,
            objects,
            scene,
            mood
        };
    } catch (error) {
        console.error('Error analyzing video frame:', error);
        throw new Error('Video frame analysis failed');
    }
}

function extractObjects(text: string): string[] {
    const objects: string[] = [];
    const commonObjects = [
        'person', 'people', 'man', 'woman', 'child', 'baby',
        'laptop', 'computer', 'monitor', 'screen', 'keyboard', 'mouse',
        'chair', 'desk', 'table', 'bed', 'sofa',
        'book', 'phone', 'coffee', 'cup', 'bottle',
        'plant', 'flower', 'tree', 'window', 'door',
        'light', 'lamp', 'camera', 'microphone',
        'cat', 'dog', 'bird', 'car', 'bicycle'
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