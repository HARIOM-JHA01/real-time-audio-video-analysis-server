
import { WebSocketServer, WebSocket } from 'ws';
import { PassThrough } from 'stream';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DG_URL = 'wss://api.deepgram.com/v1/listen';
const PORT = process.env.DEEPGRAM_PROXY_PORT ? parseInt(process.env.DEEPGRAM_PROXY_PORT) : 8081;

if (!DEEPGRAM_API_KEY) {
  throw new Error('Missing DEEPGRAM_API_KEY in environment');
}

const wss = new WebSocketServer({ port: PORT });
console.log(`Deepgram proxy WebSocket server listening on ws://localhost:${PORT}`);

wss.on('connection', (clientWs) => {
  console.log('Frontend WebSocket connected');

  // Connect to Deepgram
  const dgWs = new WebSocket(DG_URL, {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
  });

  let keepAliveInterval: NodeJS.Timeout | null = null;

  dgWs.on('open', () => {
    console.log('Connected to Deepgram WebSocket');
    // Start sending keep-alive messages every 3 seconds
    keepAliveInterval = setInterval(() => {
      const keepAliveMsg = JSON.stringify({ type: 'KeepAlive' });
      dgWs.send(keepAliveMsg);
      // Optionally log: console.log('Sent KeepAlive message');
    }, 3000);
  });

// Forward audio from client to Deepgram
  clientWs.on('message', (data) => {
    if (dgWs.readyState === WebSocket.OPEN) {
      // Log audio chunk size safely
      try {
        const dataSize = data instanceof Buffer ? data.length : 
                        data instanceof ArrayBuffer ? data.byteLength : 
                        'unknown size';
        console.log('Forwarding audio chunk to Deepgram, size:', dataSize);
      } catch (e) {
        console.log('Forwarding audio chunk to Deepgram');
      }
      dgWs.send(data);
    } else {
      console.warn('Cannot forward audio - Deepgram connection not open');
    }
  });

  // Forward Deepgram transcriptions to client
  dgWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('Received from Deepgram:', JSON.stringify(msg).substring(0, 200) + '...');
      
      if (msg.channel && msg.channel.alternatives && msg.channel.alternatives[0]) {
        const transcript = msg.channel.alternatives[0].transcript;
        if (transcript && transcript.length > 0) {
          const response = { 
            type: 'transcription', 
            transcript, 
            isFinal: msg.is_final 
          };
          console.log('Sending transcript to client:', response);
          clientWs.send(JSON.stringify(response));
        }
      }
    } catch (err) {
      console.error('Error parsing Deepgram message:', err);
      // Forward raw message if not JSON
      clientWs.send(data);
    }
  });

  // Handle closes
  clientWs.on('close', () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    dgWs.close();
    console.log('Frontend WebSocket closed');
  });
  dgWs.on('close', () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    clientWs.close();
    console.log('Deepgram WebSocket closed');
  });

  clientWs.on('error', (err) => console.error('Frontend WS error:', err));
  dgWs.on('error', (err) => console.error('Deepgram WS error:', err));
});
