import * as vscode from 'vscode';

export class WebRTCTestPanel {
    public static currentPanel: WebRTCTestPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (WebRTCTestPanel.currentPanel) {
            WebRTCTestPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'webrtcTest',
            'Voice Call Test',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        WebRTCTestPanel.currentPanel = new WebRTCTestPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.webview.html = this._getHtmlForWebview();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'log':
                        console.log('[Voice Call]', message.text);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private _getHtmlForWebview(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice Call Test</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #1e1e1e; color: #d4d4d4; margin: 0; }
        h1 { color: #569cd6; margin-bottom: 10px; }
        h2 { color: #9cdcfe; font-size: 16px; margin: 0 0 10px 0; }
        
        .container { max-width: 600px; margin: 0 auto; }
        
        .card { background: #252526; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        
        .call-controls { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        
        button { 
            padding: 12px 24px; 
            margin: 5px; 
            cursor: pointer; 
            background: #0e639c; 
            color: white; 
            border: none; 
            border-radius: 6px; 
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
        }
        button:hover { background: #1177bb; }
        button:disabled { background: #3c3c3c; cursor: not-allowed; }
        button.danger { background: #c42b1c; }
        button.danger:hover { background: #d63a2b; }
        button.success { background: #2d8a3e; }
        button.success:hover { background: #36a04a; }
        button.warning { background: #cc6600; }
        button.warning:hover { background: #e67300; }
        button.active { background: #4ec9b0; color: #1e1e1e; }
        
        .call-status { text-align: center; padding: 20px; }
        .status-indicator { 
            display: inline-block; 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            margin-right: 8px;
            vertical-align: middle;
        }
        .status-indicator.idle { background: #6e6e6e; }
        .status-indicator.connecting { background: #dcdcaa; animation: pulse 1s infinite; }
        .status-indicator.connected { background: #4ec9b0; animation: pulse 2s infinite; }
        .status-indicator.error { background: #f14c4c; }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .audio-visualizer { 
            height: 60px; 
            background: #1e1e1e; 
            border-radius: 6px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            gap: 3px;
            padding: 10px;
            margin-top: 10px;
        }
        .audio-bar { 
            width: 4px; 
            background: #4ec9b0; 
            border-radius: 2px;
            transition: height 0.05s;
        }
        
        .volume-slider { 
            width: 100%; 
            margin-top: 10px;
        }
        
        #logs { 
            background: #1e1e1e; 
            padding: 12px; 
            border-radius: 6px; 
            max-height: 200px; 
            overflow-y: auto; 
            font-family: 'Consolas', 'Courier New', monospace; 
            font-size: 11px;
        }
        .log-entry { margin: 2px 0; }
        
        .peer-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .peer-box { background: #1e1e1e; padding: 12px; border-radius: 6px; text-align: center; }
        .peer-label { font-size: 12px; color: #808080; margin-bottom: 4px; }
        .peer-state { font-weight: bold; }
        
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Voice Call Test</h1>
        
        <div class="card">
            <div class="call-status">
                <span class="status-indicator idle" id="statusIndicator"></span>
                <span id="statusText">Ready to start call</span>
            </div>
            
            <div class="call-controls">
                <button id="startCallBtn" class="success">Start Voice Call</button>
                <button id="endCallBtn" class="danger hidden">End Call</button>
                <button id="muteBtn" class="warning hidden">Mute</button>
            </div>
            
            <div class="audio-visualizer" id="localAudioViz">
                <div class="audio-bar" style="height: 10px;"></div>
                <div class="audio-bar" style="height: 10px;"></div>
                <div class="audio-bar" style="height: 10px;"></div>
                <div class="audio-bar" style="height: 10px;"></div>
                <div class="audio-bar" style="height: 10px;"></div>
                <div class="audio-bar" style="height: 10px;"></div>
                <div class="audio-bar" style="height: 10px;"></div>
                <div class="audio-bar" style="height: 10px;"></div>
                <div class="audio-bar" style="height: 10px;"></div>
                <div class="audio-bar" style="height: 10px;"></div>
            </div>
            
            <div style="margin-top: 10px;">
                <label class="peer-label">Local Volume</label>
                <input type="range" class="volume-slider" id="localVolume" min="0" max="100" value="100">
            </div>
        </div>
        
        <div class="card">
            <h2>Connection Status</h2>
            <div class="peer-info">
                <div class="peer-box">
                    <div class="peer-label">Local Peer</div>
                    <div class="peer-state" id="localState">new</div>
                </div>
                <div class="peer-box">
                    <div class="peer-label">Remote Peer</div>
                    <div class="peer-state" id="remoteState">new</div>
                </div>
            </div>
            <div class="peer-info">
                <div class="peer-box">
                    <div class="peer-label">Local ICE</div>
                    <div class="peer-state" id="localIceState">new</div>
                </div>
                <div class="peer-box">
                    <div class="peer-label">Remote ICE</div>
                    <div class="peer-state" id="remoteIceState">new</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>Call Logs</h2>
            <div id="logs"></div>
        </div>
    </div>

    <audio id="localAudio" autoplay muted></audio>
    <audio id="remoteAudio" autoplay></audio>

    <script>
        const vscode = acquireVsCodeApi();
        
        let pc1 = null;
        let pc2 = null;
        let localStream = null;
        let isMuted = false;
        let localAudioContext = null;
        let analyser = null;
        let animationId = null;
        
        function log(text, type = 'info') {
            const logs = document.getElementById('logs');
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.style.color = type === 'error' ? '#f14c4c' : type === 'success' ? '#4ec9b0' : '#d4d4d4';
            entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + text;
            logs.appendChild(entry);
            logs.scrollTop = logs.scrollHeight;
            vscode.postMessage({ command: 'log', text });
        }

        function setStatus(text, state) {
            document.getElementById('statusText').textContent = text;
            const indicator = document.getElementById('statusIndicator');
            indicator.className = 'status-indicator ' + state;
        }

        function updateStates() {
            if (pc1) {
                document.getElementById('localState').textContent = pc1.connectionState;
                document.getElementById('localIceState').textContent = pc1.iceConnectionState;
            }
            if (pc2) {
                document.getElementById('remoteState').textContent = pc2.connectionState;
                document.getElementById('remoteIceState').textContent = pc2.iceConnectionState;
            }
        }

        function visualizeAudio() {
            if (!analyser) return;
            
            const bars = document.querySelectorAll('#localAudioViz .audio-bar');
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            function draw() {
                if (!analyser) return;
                animationId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray);
                
                const step = Math.floor(dataArray.length / bars.length);
                bars.forEach((bar, i) => {
                    const value = dataArray[i * step];
                    const height = Math.max(4, (value / 255) * 50);
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
            const bars = document.querySelectorAll('#localAudioViz .audio-bar');
            bars.forEach(bar => bar.style.height = '10px');
        }

        async function startVoiceCall() {
            try {
                log('Requesting microphone access...');
                setStatus('Requesting microphone...', 'connecting');
                
                localStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }, 
                    video: false 
                });
                
                log('Microphone access granted', 'success');
                
                const localAudio = document.getElementById('localAudio');
                localAudio.srcObject = localStream;
                
                localAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = localAudioContext.createMediaStreamSource(localStream);
                analyser = localAudioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                visualizeAudio();
                
                log('Creating peer connections...');
                
                const config = {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                };
                
                pc1 = new RTCPeerConnection(config);
                pc2 = new RTCPeerConnection(config);
                
                localStream.getTracks().forEach(track => {
                    pc1.addTrack(track, localStream);
                    log('Added local audio track');
                });
                
                pc2.ontrack = event => {
                    log('Received remote audio track', 'success');
                    const remoteAudio = document.getElementById('remoteAudio');
                    remoteAudio.srcObject = event.streams[0];
                };
                
                pc1.onicecandidate = e => {
                    if (e.candidate) {
                        log('Local ICE candidate found');
                        pc2.addIceCandidate(e.candidate);
                    }
                };
                
                pc2.onicecandidate = e => {
                    if (e.candidate) {
                        log('Remote ICE candidate found');
                        pc1.addIceCandidate(e.candidate);
                    }
                };
                
                pc1.onconnectionstatechange = () => {
                    updateStates();
                    log('Local connection state: ' + pc1.connectionState);
                    if (pc1.connectionState === 'connected') {
                        setStatus('Call connected', 'connected');
                        log('Voice call established!', 'success');
                    }
                };
                
                pc2.onconnectionstatechange = () => {
                    updateStates();
                    log('Remote connection state: ' + pc2.connectionState);
                };
                
                pc1.oniceconnectionstatechange = () => updateStates();
                pc2.oniceconnectionstatechange = () => updateStates();
                
                setStatus('Establishing connection...', 'connecting');
                log('Creating and exchanging SDP...');
                
                const offer = await pc1.createOffer();
                await pc1.setLocalDescription(offer);
                
                await pc2.setRemoteDescription(offer);
                
                const answer = await pc2.createAnswer();
                await pc2.setLocalDescription(answer);
                
                await pc1.setRemoteDescription(answer);
                
                log('SDP exchange complete');
                updateStates();
                
                document.getElementById('startCallBtn').classList.add('hidden');
                document.getElementById('endCallBtn').classList.remove('hidden');
                document.getElementById('muteBtn').classList.remove('hidden');
                
            } catch (error) {
                log('Error: ' + error.message, 'error');
                setStatus('Call failed', 'error');
                cleanup();
            }
        }

        function toggleMute() {
            if (!localStream) return;
            
            isMuted = !isMuted;
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });
            
            const btn = document.getElementById('muteBtn');
            if (isMuted) {
                btn.textContent = 'Unmute';
                btn.classList.add('active');
                log('Microphone muted');
            } else {
                btn.textContent = 'Mute';
                btn.classList.remove('active');
                log('Microphone unmuted');
            }
        }

        function endCall() {
            log('Ending call...');
            cleanup();
            setStatus('Call ended', 'idle');
            log('Call ended', 'success');
            
            document.getElementById('startCallBtn').classList.remove('hidden');
            document.getElementById('endCallBtn').classList.add('hidden');
            document.getElementById('muteBtn').classList.add('hidden');
            document.getElementById('muteBtn').textContent = 'Mute';
            document.getElementById('muteBtn').classList.remove('active');
            isMuted = false;
        }

        function cleanup() {
            stopVisualization();
            
            if (localAudioContext) {
                localAudioContext.close();
                localAudioContext = null;
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
            
            document.getElementById('localAudio').srcObject = null;
            document.getElementById('remoteAudio').srcObject = null;
            
            document.getElementById('localState').textContent = 'new';
            document.getElementById('remoteState').textContent = 'new';
            document.getElementById('localIceState').textContent = 'new';
            document.getElementById('remoteIceState').textContent = 'new';
        }

        document.getElementById('localVolume').addEventListener('input', e => {
            const remoteAudio = document.getElementById('remoteAudio');
            remoteAudio.volume = e.target.value / 100;
        });

        document.getElementById('startCallBtn').addEventListener('click', startVoiceCall);
        document.getElementById('endCallBtn').addEventListener('click', endCall);
        document.getElementById('muteBtn').addEventListener('click', toggleMute);
    </script>
</body>
</html>`;
    }

    public dispose() {
        WebRTCTestPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
