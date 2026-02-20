import * as http from 'http';
import * as vscode from 'vscode';
import WebSocket, { WebSocketServer } from 'ws';

export class VoiceCallServer {
    private httpServer: http.Server | null = null;
    private wsServer: WebSocketServer | null = null;
    private clients: Set<WebSocket> = new Set();
    private port: number;
    private onMessage: ((data: any) => void) | null = null;

    constructor(port: number = 9876) {
        this.port = port;
    }

    public start(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.httpServer = http.createServer((req, res) => {
                if (req.url === '/' || req.url === '/index.html') {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(this.getHtmlPage());
                } else if (req.url === '/favicon.ico') {
                    res.writeHead(204);
                    res.end();
                } else {
                    res.writeHead(404);
                    res.end();
                }
            });

            this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${this.port} is already in use. Try a different port.`));
                } else {
                    reject(err);
                }
            });

            this.httpServer.listen(this.port, () => {
                this.wsServer = new WebSocketServer({ server: this.httpServer! });
                
                this.wsServer.on('connection', (ws: WebSocket) => {
                    this.clients.add(ws);
                    console.log('[VoiceCallServer] Client connected');
                    
                    ws.on('message', (data: string) => {
                        try {
                            const message = JSON.parse(data.toString());
                            if (this.onMessage) {
                                this.onMessage(message);
                            }
                        } catch (e) {
                            console.error('[VoiceCallServer] Failed to parse message:', e);
                        }
                    });

                    ws.on('close', () => {
                        this.clients.delete(ws);
                        console.log('[VoiceCallServer] Client disconnected');
                    });
                });

                const url = `http://localhost:${this.port}`;
                console.log(`[VoiceCallServer] Server started at ${url}`);
                resolve(url);
            });
        });
    }

    public stop(): void {
        if (this.wsServer) {
            this.wsServer.close();
            this.wsServer = null;
        }
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
        }
        this.clients.clear();
        console.log('[VoiceCallServer] Server stopped');
    }

    public send(data: any): void {
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    public onClientMessage(callback: (data: any) => void): void {
        this.onMessage = callback;
    }

    private getHtmlPage(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Asterix Channel - Voice Call</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #e4e4e4; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        
        .container { max-width: 500px; width: 100%; }
        
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #4fc3f7; margin: 0 0 5px 0; font-size: 28px; }
        .header p { color: #888; margin: 0; }
        
        .card { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border-radius: 16px; padding: 24px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); }
        
        .call-status { text-align: center; padding: 10px 0 20px; }
        .status-icon { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 36px; background: rgba(79, 195, 247, 0.1); transition: all 0.3s; }
        .status-icon.connecting { background: rgba(255, 193, 7, 0.2); animation: pulse 1.5s infinite; }
        .status-icon.connected { background: rgba(76, 175, 80, 0.2); }
        .status-icon.error { background: rgba(244, 67, 54, 0.2); }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        .status-text { font-size: 18px; font-weight: 500; }
        .status-text.idle { color: #888; }
        .status-text.connecting { color: #ffc107; }
        .status-text.connected { color: #4caf50; }
        .status-text.error { color: #f44336; }
        
        .audio-visualizer { height: 50px; display: flex; align-items: center; justify-content: center; gap: 4px; margin: 20px 0; }
        .audio-bar { width: 6px; background: linear-gradient(to top, #4fc3f7, #29b6f6); border-radius: 3px; transition: height 0.05s; height: 8px; }
        
        .call-controls { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        
        button { 
            padding: 14px 28px; 
            cursor: pointer; 
            background: linear-gradient(135deg, #4fc3f7, #29b6f6); 
            color: #1a1a2e; 
            border: none; 
            border-radius: 30px; 
            font-size: 15px;
            font-weight: 600;
            transition: all 0.2s;
            min-width: 130px;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(79, 195, 247, 0.3); }
        button:active { transform: translateY(0); }
        button:disabled { background: #444; color: #888; cursor: not-allowed; transform: none; box-shadow: none; }
        
        button.end { background: linear-gradient(135deg, #ef5350, #e53935); }
        button.end:hover { box-shadow: 0 5px 20px rgba(239, 83, 80, 0.3); }
        
        button.mute { background: linear-gradient(135deg, #ffa726, #ff9800); }
        button.mute:hover { box-shadow: 0 5px 20px rgba(255, 167, 38, 0.3); }
        button.mute.active { background: linear-gradient(135deg, #78909c, #607d8b); }
        
        .connection-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
        .info-box { background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; text-align: center; }
        .info-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { font-size: 14px; font-weight: 500; margin-top: 4px; color: #4fc3f7; }
        
        .hidden { display: none !important; }
        
        .volume-control { margin-top: 15px; }
        .volume-control label { display: block; font-size: 12px; color: #888; margin-bottom: 8px; }
        .volume-control input { width: 100%; accent-color: #4fc3f7; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Asterix Channel</h1>
            <p>Voice Call Test</p>
        </div>
        
        <div class="card">
            <div class="call-status">
                <div class="status-icon" id="statusIcon">📞</div>
                <div class="status-text idle" id="statusText">Ready to call</div>
            </div>
            
            <div class="audio-visualizer" id="audioViz">
                ${Array(20).fill('<div class="audio-bar"></div>').join('')}
            </div>
            
            <div class="call-controls">
                <button id="startBtn">Start Call</button>
                <button id="endBtn" class="end hidden">End Call</button>
                <button id="muteBtn" class="mute hidden">Mute</button>
            </div>
            
            <div class="volume-control">
                <label>Speaker Volume</label>
                <input type="range" id="volumeSlider" min="0" max="100" value="100">
            </div>
        </div>
        
        <div class="card">
            <div class="connection-info">
                <div class="info-box">
                    <div class="info-label">Connection</div>
                    <div class="info-value" id="connState">new</div>
                </div>
                <div class="info-box">
                    <div class="info-label">ICE State</div>
                    <div class="info-value" id="iceState">new</div>
                </div>
                <div class="info-box">
                    <div class="info-label">Local Audio</div>
                    <div class="info-value" id="localAudioState">inactive</div>
                </div>
                <div class="info-box">
                    <div class="info-label">Remote Audio</div>
                    <div class="info-value" id="remoteAudioState">inactive</div>
                </div>
            </div>
        </div>
    </div>

    <audio id="remoteAudio" autoplay></audio>

    <script>
        let ws = null;
        let pc1 = null;
        let pc2 = null;
        let localStream = null;
        let audioContext = null;
        let analyser = null;
        let animationId = null;
        let isMuted = false;

        const elements = {
            statusIcon: document.getElementById('statusIcon'),
            statusText: document.getElementById('statusText'),
            startBtn: document.getElementById('startBtn'),
            endBtn: document.getElementById('endBtn'),
            muteBtn: document.getElementById('muteBtn'),
            volumeSlider: document.getElementById('volumeSlider'),
            connState: document.getElementById('connState'),
            iceState: document.getElementById('iceState'),
            localAudioState: document.getElementById('localAudioState'),
            remoteAudioState: document.getElementById('remoteAudioState'),
            remoteAudio: document.getElementById('remoteAudio'),
            audioViz: document.getElementById('audioViz')
        };

        function setStatus(text, type, icon) {
            elements.statusText.textContent = text;
            elements.statusText.className = 'status-text ' + type;
            elements.statusIcon.textContent = icon;
            elements.statusIcon.className = 'status-icon ' + type;
        }

        function sendToExtension(message) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        }

        function log(message) {
            console.log('[VoiceCall]', message);
            sendToExtension({ type: 'log', message });
        }

        function visualizeAudio() {
            if (!analyser) return;
            
            const bars = elements.audioViz.querySelectorAll('.audio-bar');
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            function draw() {
                if (!analyser) return;
                animationId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray);
                
                const step = Math.floor(dataArray.length / bars.length);
                bars.forEach((bar, i) => {
                    const value = dataArray[i * step];
                    const height = Math.max(4, (value / 255) * 40);
                    bar.style.height = height + 'px';
                });
            }
            draw();
        }

        function stopVisualization() {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            elements.audioViz.querySelectorAll('.audio-bar').forEach(bar => {
                bar.style.height = '8px';
            });
        }

        async function startCall() {
            try {
                setStatus('Requesting microphone...', 'connecting', '🎤');
                log('Requesting microphone access...');

                localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                });

                log('Microphone access granted');
                elements.localAudioState.textContent = 'active';
                elements.localAudioState.style.color = '#4caf50';

                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(localStream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                visualizeAudio();

                setStatus('Connecting...', 'connecting', '📞');
                log('Creating peer connections...');

                const config = {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                };

                pc1 = new RTCPeerConnection(config);
                pc2 = new RTCPeerConnection(config);

                localStream.getTracks().forEach(track => {
                    pc1.addTrack(track, localStream);
                });
                log('Added local audio track');

                pc2.ontrack = event => {
                    log('Received remote audio track');
                    elements.remoteAudio.srcObject = event.streams[0];
                    elements.remoteAudioState.textContent = 'active';
                    elements.remoteAudioState.style.color = '#4caf50';
                };

                pc1.onicecandidate = e => {
                    if (e.candidate) {
                        pc2.addIceCandidate(e.candidate);
                    }
                };

                pc2.onicecandidate = e => {
                    if (e.candidate) {
                        pc1.addIceCandidate(e.candidate);
                    }
                };

                pc1.onconnectionstatechange = () => {
                    elements.connState.textContent = pc1.connectionState;
                    log('Connection state: ' + pc1.connectionState);
                    
                    if (pc1.connectionState === 'connected') {
                        setStatus('Connected', 'connected', '✅');
                        log('Call established successfully!');
                    } else if (pc1.connectionState === 'failed' || pc1.connectionState === 'disconnected') {
                        setStatus('Call ended', 'error', '❌');
                        cleanup();
                    }
                };

                pc1.oniceconnectionstatechange = () => {
                    elements.iceState.textContent = pc1.iceConnectionState;
                };

                log('Starting SDP exchange...');
                
                const offer = await pc1.createOffer();
                await pc1.setLocalDescription(offer);
                
                await pc2.setRemoteDescription(offer);
                
                const answer = await pc2.createAnswer();
                await pc2.setLocalDescription(answer);
                
                await pc1.setRemoteDescription(answer);
                
                log('SDP exchange complete');

                elements.startBtn.classList.add('hidden');
                elements.endBtn.classList.remove('hidden');
                elements.muteBtn.classList.remove('hidden');

            } catch (error) {
                log('Error: ' + error.message);
                setStatus('Error: ' + error.message, 'error', '❌');
                cleanup();
            }
        }

        function toggleMute() {
            if (!localStream) return;
            
            isMuted = !isMuted;
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });

            if (isMuted) {
                elements.muteBtn.textContent = 'Unmute';
                elements.muteBtn.classList.add('active');
                elements.localAudioState.textContent = 'muted';
                elements.localAudioState.style.color = '#ffa726';
                log('Microphone muted');
            } else {
                elements.muteBtn.textContent = 'Mute';
                elements.muteBtn.classList.remove('active');
                elements.localAudioState.textContent = 'active';
                elements.localAudioState.style.color = '#4caf50';
                log('Microphone unmuted');
            }
        }

        function endCall() {
            log('Ending call...');
            cleanup();
            setStatus('Call ended', 'idle', '📞');
            
            elements.startBtn.classList.remove('hidden');
            elements.endBtn.classList.add('hidden');
            elements.muteBtn.classList.add('hidden');
            elements.muteBtn.textContent = 'Mute';
            elements.muteBtn.classList.remove('active');
            isMuted = false;
        }

        function cleanup() {
            stopVisualization();

            if (audioContext) {
                audioContext.close();
                audioContext = null;
                analyser = null;
            }

            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
            }

            if (pc1) {
                pc1.close();
                pc1 = null;
            }

            if (pc2) {
                pc2.close();
                pc2 = null;
            }

            elements.remoteAudio.srcObject = null;
            elements.connState.textContent = 'new';
            elements.iceState.textContent = 'new';
            elements.localAudioState.textContent = 'inactive';
            elements.localAudioState.style.color = '#4fc3f7';
            elements.remoteAudioState.textContent = 'inactive';
            elements.remoteAudioState.style.color = '#4fc3f7';
        }

        function connectWebSocket() {
            const wsUrl = 'ws://localhost:' + window.location.port;
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                log('Connected to VSCode extension');
            };

            ws.onclose = () => {
                log('Disconnected from VSCode extension');
            };

            ws.onerror = (error) => {
                log('WebSocket error');
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    // Handle messages from extension if needed
                } catch (e) {}
            };
        }

        elements.startBtn.addEventListener('click', startCall);
        elements.endBtn.addEventListener('click', endCall);
        elements.muteBtn.addEventListener('click', toggleMute);
        elements.volumeSlider.addEventListener('input', (e) => {
            elements.remoteAudio.volume = e.target.value / 100;
        });

        connectWebSocket();
    </script>
</body>
</html>`;
    }
}
