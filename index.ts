import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import { analyzeText } from "./utils/text-intelligence";
import { analyzeVideoFrame } from "./utils/vision-analysis";
import { transcribeAudio, checkOpenAIConfiguration, testOpenAIConnection } from "./utils/openai-transcription";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// POST endpoint to analyze text
app.post("/analyze", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const analysisResult = await analyzeText(text);
    res.json(analysisResult);
  } catch (error) {
    console.error("Error analyzing text:", error);
    res.status(500).json({ error: "Text analysis failed" });
  }
});

// POST endpoint for vision analysis (direct API access)
app.post("/vision-analysis", async (req, res) => {
  console.log("🎥 Received vision analysis request");
  try {
    const { base64Image } = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: "Image data is required" });
    }

    console.log("🎥 Processing vision analysis for image, size:", 
      base64Image.length > 100 ? `${base64Image.substring(0, 100)}... (${base64Image.length} chars)` : base64Image);

    // Analyze using OpenAI Vision
    const analysisResult = await analyzeVideoFrame(base64Image);
    console.log("🎥 Vision analysis successful:", analysisResult);

    res.json(analysisResult);
  } catch (error) {
    console.error("❌ Vision analysis error:", error);
    res.status(500).json({ error: "Vision analysis failed" });
  }
});

// POST endpoint to transcribe audio using OpenAI Whisper
app.post("/transcribe", async (req, res) => {
  console.log("🎤 Received transcription request");

  try {
    const { audioData, mimeType } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: "Audio data is required" });
    }

    console.log("🎤 Processing audio data, MIME type:", mimeType);

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    console.log("🎤 Audio buffer size:", audioBuffer.length, "bytes");

    // Check if buffer has sufficient data for Whisper
    if (audioBuffer.length < 1000) {
      console.log("🎤 Audio buffer too small for Whisper:", audioBuffer.length, "bytes");
      return res.status(400).json({ error: "Audio data too small for transcription" });
    }

    // Transcribe using OpenAI Whisper
    const transcriptionResult = await transcribeAudio(audioBuffer, mimeType || 'audio/webm');

    console.log("🎤 Transcription successful:", transcriptionResult.text);

    res.json({
      text: transcriptionResult.text,
      confidence: transcriptionResult.confidence,
      isFinal: transcriptionResult.isFinal,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error("❌ Transcription error:", error);
    res.status(500).json({ error: "Transcription failed" });
  }
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", async (ws) => {
  console.log("Client connected ✅");

  // Check OpenAI configuration on connection
  console.log("� Checking OpenAI configuration...");
  if (!checkOpenAIConfiguration()) {
    console.error("❌ OpenAI not configured properly");
    ws.send(JSON.stringify({
      type: 'error',
      data: 'OpenAI configuration error',
      timestamp: Date.now()
    }));
    return;
  }

  // Test OpenAI connection
  console.log("🔗 Testing OpenAI connection...");
  const connectionTest = await testOpenAIConnection();
  if (!connectionTest) {
    console.error("❌ OpenAI connection test failed");
    ws.send(JSON.stringify({
      type: 'error',
      data: 'OpenAI connection failed',
      timestamp: Date.now()
    }));
    return;
  }

  console.log("✅ OpenAI Whisper ready for transcription");

  // Handle incoming messages from client
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log("📨 Received message from client:", data.type, "at", new Date().toISOString());

      switch (data.type) {
        case 'video-frame':
          // Analyze video frame with GPT-4o Vision
          try {
            const analysis = await analyzeVideoFrame(data.data);
            ws.send(JSON.stringify({
              type: 'video-analysis',
              data: analysis,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error('Video analysis error:', error);
            ws.send(JSON.stringify({
              type: 'error',
              data: 'Video analysis failed',
              timestamp: Date.now()
            }));
          }
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: 'Message processing failed',
        timestamp: Date.now()
      }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected ❌");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 WebSocket server running on ws://localhost:${PORT}`);
});