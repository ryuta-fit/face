// 診断結果が正しく表示されるよう修正したバージョン
class AutonomicNervousSystemAnalyzer {
    constructor() {
        this.video = document.getElementById('video');
        this.overlay = document.getElementById('overlay');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.resultsContainer = document.getElementById('results');
        
        this.faceMesh = null;
        this.camera = null;
        this.isAnalyzing = false;
        
        // データ保存用
        this.dataBuffer = {
            forehead: [],
            eyebrows: [],
            eyes: [],
            cheeks: [],
            mouth: [],
            jaw: []
        };
        
        // キャリブレーション
        this.baseline = null;
        this.calibrationFrames = 0;
        
        this.setupEventListeners();
        this.initializeFaceMesh();
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startAnalysis());
        this.stopBtn.addEventListener('click', () => this.stopAnalysis());
    }
    
    initializeFaceMesh() {
        // FaceMeshコンストラクタが利用可能になるまで待機
        if (typeof FaceMesh === 'undefined') {
            setTimeout(() => this.initializeFaceMesh(), 100);
            return;
        }
        
        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.faceMesh.onResults((results) => this.onFaceMeshResults(results));
    }
    
    async startAnalysis() {
        try {
            // HTTPS環境チェック
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                alert('このアプリケーションはHTTPS環境でのみ動作します。');
                return;
            }
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.resultsContainer.classList.add('active');
            this.isAnalyzing = true;
            
            // カメラアクセスを明示的に要求
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    } 
                });
                
                // ストリームを一旦停止
                stream.getTracks().forEach(track => track.stop());
            } catch (err) {
                console.error('カメラアクセスエラー:', err);
                if (err.name === 'NotAllowedError') {
                    alert('カメラへのアクセスが拒否されました。ブラウザの設定でカメラの使用を許可してください。');
                } else if (err.name === 'NotFoundError') {
                    alert('カメラが見つかりません。カメラが接続されていることを確認してください。');
                } else {
                    alert('カメラの起動に失敗しました: ' + err.message);
                }
                this.stopAnalysis();
                return;
            }
            
            // カメラの初期化
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    if (this.isAnalyzing && this.faceMesh) {
                        await this.faceMesh.send({ image: this.video });
                    }
                },
                width: 640,
                height: 480
            });
            
            await this.camera.start();
            
            // 初期値を設定
            this.updateUI({
                sympathetic: 50,
                parasympathetic: 50,
                diagnosis: "分析を開始しました。顔を画面に向けてください...",
                confidence: 0
            });
            
        } catch (error) {
            console.error('カメラの起動に失敗:', error);
            alert('カメラへのアクセスに失敗しました。\n\n考えられる原因:\n- HTTPSでアクセスしていない\n- カメラの使用が拒否されている\n- 他のアプリがカメラを使用中');
            this.stopAnalysis();
        }
    }
    
    stopAnalysis() {
        this.isAnalyzing = false;
        if (this.camera) {
            this.camera.stop();
        }
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
    }
    
    onFaceMeshResults(results) {
        const ctx = this.overlay.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        
        // キャンバスサイズを調整
        this.overlay.width = this.video.videoWidth;
        this.overlay.height = this.video.videoHeight;
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            const landmarks = results.multiFaceLandmarks[0];
            
            // 顔メッシュを描画
            this.drawFaceMesh(ctx, landmarks);
            
            // 筋肉の状態を分析
            const muscleMetrics = this.analyzeMuscleStates(landmarks);
            
            // 自律神経状態を計算
            const autonomicState = this.calculateAutonomicState(muscleMetrics);
            
            // UIを更新
            this.updateUI(autonomicState);
            
        } else {
            // 顔が検出されない場合
            this.updateUI({
                sympathetic: 50,
                parasympathetic: 50,
                diagnosis: "顔が検出されません。カメラに顔を向けてください。",
                confidence: 0
            });
        }
        
        ctx.restore();
    }
    
    drawFaceMesh(ctx, landmarks) {
        // メッシュの描画
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 1;
        
        // FACEMESH_TESSSELATIONが定義されていない場合の対処
        if (typeof FACEMESH_TESSELATION !== 'undefined') {
            const connections = FACEMESH_TESSELATION;
            for (const connection of connections) {
                const start = landmarks[connection[0]];
                const end = landmarks[connection[1]];
                
                ctx.beginPath();
                ctx.moveTo(start.x * this.overlay.width, start.y * this.overlay.height);
                ctx.lineTo(end.x * this.overlay.width, end.y * this.overlay.height);
                ctx.stroke();
            }
        }
        
        // ランドマークポイントを描画
        ctx.fillStyle = '#FF0000';
        for (const landmark of landmarks) {
            ctx.beginPath();
            ctx.arc(
                landmark.x * this.overlay.width,
                landmark.y * this.overlay.height,
                2, 0, 2 * Math.PI
            );
            ctx.fill();
        }
    }
    
    analyzeMuscleStates(landmarks) {
        const metrics = {
            foreheadTension: this.calculateForeheadTension(landmarks),
            eyebrowTension: this.calculateEyebrowTension(landmarks),
            eyeTension: this.calculateEyeTension(landmarks),
            cheekTension: this.calculateCheekTension(landmarks),
            mouthTension: this.calculateMouthTension(landmarks),
            jawTension: this.calculateJawTension(landmarks),
            asymmetry: this.calculateFacialAsymmetry(landmarks),
            blinkRate: this.detectBlinkRate(landmarks)
        };
        
        return metrics;
    }
    
    calculateForeheadTension(landmarks) {
        // 前頭部のポイント
        const foreheadPoints = [9, 10, 151, 337, 299, 333, 298, 301];
        let totalDistance = 0;
        let count = 0;
        
        for (let i = 0; i < foreheadPoints.length - 1; i++) {
            if (landmarks[foreheadPoints[i]] && landmarks[foreheadPoints[i + 1]]) {
                const p1 = landmarks[foreheadPoints[i]];
                const p2 = landmarks[foreheadPoints[i + 1]];
                totalDistance += this.calculateDistance(p1, p2);
                count++;
            }
        }
        
        if (count === 0) return 0.5;
        
        const avgDistance = totalDistance / count;
        return this.normalizeValue(avgDistance * 10, 0.3, 0.7);
    }
    
    calculateEyebrowTension(landmarks) {
        // 眉のポイント
        const leftEyebrow = [70, 63, 105, 66, 107];
        const rightEyebrow = [300, 293, 334, 296, 336];
        
        // 眉の高さを計算
        let leftHeight = 0;
        let rightHeight = 0;
        let count = 0;
        
        for (const point of leftEyebrow) {
            if (landmarks[point]) {
                leftHeight += landmarks[point].y;
                count++;
            }
        }
        
        for (const point of rightEyebrow) {
            if (landmarks[point]) {
                rightHeight += landmarks[point].y;
                count++;
            }
        }
        
        if (count === 0) return 0.5;
        
        const avgHeight = (leftHeight + rightHeight) / count;
        return this.normalizeValue(1 - avgHeight, 0.3, 0.7);
    }
    
    calculateEyeTension(landmarks) {
        // 目のポイント
        const leftEyeUpper = [159, 158, 157, 173];
        const leftEyeLower = [145, 144, 163, 7];
        const rightEyeUpper = [386, 385, 384, 398];
        const rightEyeLower = [374, 373, 390, 249];
        
        // 目の開き具合を計算
        let leftOpenness = 0;
        let rightOpenness = 0;
        
        if (landmarks[159] && landmarks[145]) {
            leftOpenness = this.calculateDistance(landmarks[159], landmarks[145]);
        }
        
        if (landmarks[386] && landmarks[374]) {
            rightOpenness = this.calculateDistance(landmarks[386], landmarks[374]);
        }
        
        const avgOpenness = (leftOpenness + rightOpenness) / 2;
        return this.normalizeValue(1 - avgOpenness * 20, 0, 1);
    }
    
    calculateCheekTension(landmarks) {
        // 頬のポイント
        const leftCheek = [35, 31, 228, 229, 230];
        const rightCheek = [264, 102, 415, 308, 292];
        
        // 頬の張りを計算
        let tension = 0;
        let count = 0;
        
        for (let i = 0; i < leftCheek.length - 1; i++) {
            if (landmarks[leftCheek[i]] && landmarks[leftCheek[i + 1]]) {
                tension += this.calculateDistance(
                    landmarks[leftCheek[i]], 
                    landmarks[leftCheek[i + 1]]
                );
                count++;
            }
        }
        
        if (count === 0) return 0.5;
        
        return this.normalizeValue(tension / count * 10, 0.3, 0.7);
    }
    
    calculateMouthTension(landmarks) {
        // 口のポイント
        const upperLip = [61, 62, 63, 64, 65];
        const lowerLip = [78, 79, 80, 81, 82];
        
        let mouthHeight = 0;
        let mouthWidth = 0;
        
        if (landmarks[13] && landmarks[14]) {
            mouthHeight = this.calculateDistance(landmarks[13], landmarks[14]);
        }
        
        if (landmarks[61] && landmarks[291]) {
            mouthWidth = this.calculateDistance(landmarks[61], landmarks[291]);
        }
        
        if (mouthWidth === 0) return 0.5;
        
        const ratio = mouthHeight / mouthWidth;
        return this.normalizeValue(ratio * 5, 0, 1);
    }
    
    calculateJawTension(landmarks) {
        // 顎のポイント
        const jawLine = [172, 136, 150, 149, 176, 148, 152, 377];
        
        let tension = 0;
        let count = 0;
        
        // 顎のラインの角度を計算
        for (let i = 1; i < jawLine.length - 1; i++) {
            if (landmarks[jawLine[i - 1]] && landmarks[jawLine[i]] && landmarks[jawLine[i + 1]]) {
                const angle = this.calculateAngle(
                    landmarks[jawLine[i - 1]],
                    landmarks[jawLine[i]],
                    landmarks[jawLine[i + 1]]
                );
                tension += Math.abs(angle - Math.PI);
                count++;
            }
        }
        
        if (count === 0) return 0.5;
        
        return this.normalizeValue(tension / count, 0, 1);
    }
    
    calculateFacialAsymmetry(landmarks) {
        // 左右対称性をチェック
        const pairs = [
            [33, 263],   // 左右の目頭
            [61, 291],   // 左右の口角
            [70, 300],   // 左右の眉頭
            [172, 397]   // 左右の顎
        ];
        
        let asymmetry = 0;
        let count = 0;
        
        for (const [left, right] of pairs) {
            if (landmarks[left] && landmarks[right]) {
                const leftDist = Math.abs(landmarks[left].x - 0.5);
                const rightDist = Math.abs(0.5 - landmarks[right].x);
                asymmetry += Math.abs(leftDist - rightDist);
                count++;
            }
        }
        
        if (count === 0) return 0;
        
        return this.normalizeValue(asymmetry / count * 10, 0, 1);
    }
    
    detectBlinkRate(landmarks) {
        // 瞬き検出（簡易版）
        const leftEye = this.calculateEyeTension(landmarks);
        
        if (!this.blinkBuffer) {
            this.blinkBuffer = [];
            this.blinkCount = 0;
            this.lastBlinkTime = Date.now();
        }
        
        this.blinkBuffer.push(leftEye);
        if (this.blinkBuffer.length > 10) {
            this.blinkBuffer.shift();
        }
        
        // 瞬きの検出
        if (this.blinkBuffer.length >= 3) {
            const current = this.blinkBuffer[this.blinkBuffer.length - 1];
            const previous = this.blinkBuffer[this.blinkBuffer.length - 2];
            
            if (current > 0.8 && previous < 0.8) {
                this.blinkCount++;
            }
        }
        
        // 1分あたりの瞬き回数を計算
        const elapsed = (Date.now() - this.lastBlinkTime) / 60000;
        const blinkRate = elapsed > 0 ? this.blinkCount / elapsed : 15;
        
        return this.normalizeValue(blinkRate, 10, 25);
    }
    
    calculateAutonomicState(metrics) {
        // 各メトリクスの重み付け
        const weights = {
            sympathetic: {
                foreheadTension: 0.15,
                eyebrowTension: 0.40,
                eyeTension: 0.20,
                jawTension: 0.10,
                asymmetry: 0.10,
                highBlinkRate: 0.05
            },
            parasympathetic: {
                relaxedForehead: 0.20,
                relaxedEyes: 0.25,
                relaxedJaw: 0.25,
                relaxedCheeks: 0.15,
                normalBlinkRate: 0.15
            }
        };
        
        // 交感神経指標
        const sympatheticScore = 
            metrics.foreheadTension * weights.sympathetic.foreheadTension +
            metrics.eyebrowTension * weights.sympathetic.eyebrowTension +
            metrics.eyeTension * weights.sympathetic.eyeTension +
            metrics.jawTension * weights.sympathetic.jawTension +
            metrics.asymmetry * weights.sympathetic.asymmetry +
            Math.abs(metrics.blinkRate - 0.5) * weights.sympathetic.highBlinkRate;
        
        // 副交感神経指標
        const parasympatheticScore = 
            (1 - metrics.foreheadTension) * weights.parasympathetic.relaxedForehead +
            (1 - metrics.eyeTension) * weights.parasympathetic.relaxedEyes +
            (1 - metrics.jawTension) * weights.parasympathetic.relaxedJaw +
            (1 - metrics.cheekTension) * weights.parasympathetic.relaxedCheeks +
            (1 - Math.abs(metrics.blinkRate - 0.5)) * weights.parasympathetic.normalBlinkRate;
        
        // 正規化
        const total = sympatheticScore + parasympatheticScore;
        const sympatheticRatio = total > 0 ? (sympatheticScore / total) * 100 : 50;
        const parasympatheticRatio = total > 0 ? (parasympatheticScore / total) * 100 : 50;
        
        // 診断メッセージ
        let diagnosis = "";
        let confidence = this.calculateConfidence(metrics);
        
        if (confidence < 0.3) {
            diagnosis = "データが不十分です。もう少し時間をおいて測定してください。";
        } else if (sympatheticRatio > 65) {
            diagnosis = "交感神経が優位な状態です。ストレスや緊張が高まっている可能性があります。深呼吸やリラックス法を試してみてください。";
        } else if (parasympatheticRatio > 65) {
            diagnosis = "副交感神経が優位な状態です。リラックスしている良い状態ですが、活動には適度な緊張感も必要です。";
        } else {
            diagnosis = "交感神経と副交感神経のバランスが取れた良い状態です。この状態を維持することで健康的な自律神経の働きが期待できます。";
        }
        
        // 追加のアドバイス
        if (metrics.eyeTension > 0.7) {
            diagnosis += "\n\n目の緊張が高いようです。定期的に遠くを見て目を休めましょう。";
        }
        
        if (metrics.jawTension > 0.7) {
            diagnosis += "\n\n顎に力が入っているようです。意識的に顎の力を抜いてみてください。";
        }
        
        return {
            sympathetic: Math.round(sympatheticRatio),
            parasympathetic: Math.round(parasympatheticRatio),
            diagnosis: diagnosis,
            confidence: confidence,
            rawMetrics: metrics
        };
    }
    
    calculateConfidence(metrics) {
        // 信頼度を計算（0-1の範囲）
        let confidence = 1;
        
        // 極端な値がある場合は信頼度を下げる
        for (const key in metrics) {
            const value = metrics[key];
            if (value < 0.1 || value > 0.9) {
                confidence *= 0.8;
            }
        }
        
        // データのばらつきが大きい場合も信頼度を下げる
        const values = Object.values(metrics);
        const avg = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
        
        if (variance > 0.2) {
            confidence *= 0.7;
        }
        
        return confidence;
    }
    
    updateUI(state) {
        // 交感神経
        const sympatheticBar = document.getElementById('sympathetic-bar');
        const sympatheticValue = document.getElementById('sympathetic-value');
        if (sympatheticBar && sympatheticValue) {
            sympatheticBar.style.width = `${state.sympathetic}%`;
            sympatheticValue.textContent = `${state.sympathetic}%`;
        }
        
        // 副交感神経
        const parasympatheticBar = document.getElementById('parasympathetic-bar');
        const parasympatheticValue = document.getElementById('parasympathetic-value');
        if (parasympatheticBar && parasympatheticValue) {
            parasympatheticBar.style.width = `${state.parasympathetic}%`;
            parasympatheticValue.textContent = `${state.parasympathetic}%`;
        }
        
        // 診断内容
        const diagnosisContent = document.getElementById('diagnosis-content');
        if (diagnosisContent) {
            diagnosisContent.textContent = state.diagnosis;
        }
        
        // 信頼度インジケーター（オプション）
        this.updateConfidenceIndicator(state.confidence);
    }
    
    updateConfidenceIndicator(confidence) {
        let indicator = document.getElementById('confidence-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'confidence-indicator';
            indicator.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                padding: 5px 10px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                border-radius: 5px;
                font-size: 12px;
            `;
            document.querySelector('.video-container').appendChild(indicator);
        }
        
        const level = confidence > 0.7 ? '高' : confidence > 0.4 ? '中' : '低';
        const color = confidence > 0.7 ? '#4CAF50' : confidence > 0.4 ? '#FFC107' : '#F44336';
        
        indicator.textContent = `信頼度: ${level}`;
        indicator.style.borderLeft = `3px solid ${color}`;
    }
    
    // ユーティリティ関数
    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = (p1.z || 0) - (p2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    calculateAngle(p1, p2, p3) {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        
        const dot = v1.x * v2.x + v1.y * v2.y;
        const det = v1.x * v2.y - v1.y * v2.x;
        
        return Math.atan2(det, dot);
    }
    
    normalizeValue(value, min, max) {
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    // MediaPipeライブラリの読み込み確認
    let initAttempts = 0;
    const maxAttempts = 50;
    
    function tryInit() {
        initAttempts++;
        
        if (typeof FaceMesh !== 'undefined' && typeof Camera !== 'undefined') {
            console.log('ライブラリの読み込みが完了しました');
            new AutonomicNervousSystemAnalyzer();
        } else if (initAttempts < maxAttempts) {
            console.log(`ライブラリを読み込み中... (${initAttempts}/${maxAttempts})`);
            setTimeout(tryInit, 200);
        } else {
            console.error('ライブラリの読み込みに失敗しました');
            alert('システムの初期化に失敗しました。ページを再読み込みしてください。');
        }
    }
    
    tryInit();
});