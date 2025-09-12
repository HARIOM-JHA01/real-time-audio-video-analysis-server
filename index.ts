import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import { analyzeText } from "./utils/text-intelligence";
import { deepgram } from "./utils/deepgram";
import { analyzeVideoFrame } from "./utils/vision-analysis";
import { LiveTranscriptionEvents } from "@deepgram/sdk";

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

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Client connected ✅");

  // Create a new Deepgram connection for this client
  const deepgramWS = deepgram.listen.live({
    model: "nova-2",
    language: "en-US",
    smart_format: true,
    interim_results: false,
    utterance_end_ms: 1000,
  });

  deepgramWS.on(LiveTranscriptionEvents.Open, () => {
    console.log("Deepgram connection opened");
  });

  deepgramWS.on(LiveTranscriptionEvents.Transcript, (data) => {
    console.log("Transcript received:", data);

    if (data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
      const transcript = data.channel.alternatives[0].transcript;
      const confidence = data.channel.alternatives[0].confidence;

      if (transcript && transcript.trim().length > 0) {
        // Send transcription back to client
        ws.send(JSON.stringify({
          type: 'transcription',
          data: {
            text: transcript,
            confidence: confidence
          },
          timestamp: Date.now()
        }));
      }
    }
  });

  deepgramWS.on(LiveTranscriptionEvents.Error, (error) => {
    console.error("Deepgram error:", error);
    ws.send(JSON.stringify({
      type: 'error',
      data: 'Transcription error occurred',
      timestamp: Date.now()
    }));
  });

  // Handle incoming messages from client
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'audio':
          // Convert base64 audio to buffer and send to Deepgram
          const audioBuffer = Buffer.from(data.data, 'base64');
          if (deepgramWS.getReadyState() === 1) {
            deepgramWS.send(audioBuffer.buffer);
          }
          break;

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
    if (deepgramWS.getReadyState() === 1) {
      deepgramWS.finish();
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 WebSocket server running on ws://localhost:${PORT}`);
});