// 診断結果が正しく表示されるよう修正したバージョン
class AutonomicNervousSystemAnalyzer {
    constructor() {
        this.video = document.getElementById('video');
        this.overlay = document.getElementById('overlay');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.resultsContainer = document.getElementById('results');
        this.calibrationStatus = document.getElementById('calibration-status');
        
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
        
        // 測定タイマー関連
        this.measurementTimer = null;
        this.measurementStartTime = null;
        this.measurementDuration = 10000; // 10秒
        this.measurementData = [];
        
        // キャリブレーション
        this.baseline = null;
        this.calibrationFrames = 0;
        this.calibrationData = null;
        this.isCalibrated = false;
        this.skipCalibration = true; // 一時的にキャリブレーションをスキップ
        
        this.setupEventListeners();
        this.initializeFaceMesh();
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startAnalysis());
        this.stopBtn.addEventListener('click', () => this.stopAnalysis());
    }
    
    async calibrateWithAverageFace() {
        console.log('平均顔でキャリブレーション開始...');
        this.showCalibrationStatus('キャリブレーション中...', 'info');
        
        // 画像を読み込み
        const img = new Image();
        img.src = 'averageface.png';
        
        return new Promise((resolve, reject) => {
            img.onload = async () => {
                try {
                    // Canvas作成
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    // FaceMeshで分析（初期化を待つ）
                    if (!this.faceMesh) {
                        throw new Error('FaceMeshが初期化されていません');
                    }
                    
                    // FaceMeshに画像を送信して結果を待つ
                    await new Promise((resolveAnalysis) => {
                        // 一時的にonResultsハンドラを変更
                        const originalOnResults = this.faceMesh.onResults;
                        
                        const calibrationHandler = (results) => {
                            if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
                                const landmarks = results.multiFaceLandmarks[0];
                                const metrics = this.analyzeMuscleStates(landmarks);
                                
                                // この値を基準値として保存
                                this.calibrationData = {
                                    baselineMetrics: metrics,
                                    targetSympathetic: 30,
                                    targetParasympathetic: 70
                                };
                                
                                this.isCalibrated = true;
                                console.log('キャリブレーション完了:', this.calibrationData);
                                this.showCalibrationStatus('キャリブレーション完了 (基準値: 交感神経30%, 副交感神経70%)', 'success');
                                
                                // 元のハンドラに戻す
                                this.faceMesh.onResults((results) => this.onFaceMeshResults(results));
                                resolveAnalysis();
                                resolve(true);
                            } else {
                                this.showCalibrationStatus('キャリブレーション失敗: 顔を検出できませんでした', 'error');
                                this.faceMesh.onResults((results) => this.onFaceMeshResults(results));
                                resolveAnalysis();
                                reject(new Error('平均顔から顔を検出できませんでした'));
                            }
                        };
                        
                        this.faceMesh.onResults(calibrationHandler);
                        
                        // 画像を送信
                        this.faceMesh.send({ image: canvas });
                    });
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => {
                this.showCalibrationStatus('キャリブレーション失敗: 画像を読み込めませんでした', 'error');
                reject(new Error('画像の読み込みに失敗しました'));
            };
        });
    }
    
    showCalibrationStatus(message, type) {
        if (this.calibrationStatus) {
            this.calibrationStatus.textContent = message;
            this.calibrationStatus.className = `calibration-status active ${type}`;
            
            // 成功メッセージは5秒後に非表示
            if (type === 'success') {
                setTimeout(() => {
                    this.calibrationStatus.classList.remove('active');
                }, 5000);
            }
        }
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
            // キャリブレーションが完了していない場合は実行（一時的にスキップ）
            if (!this.isCalibrated && !this.skipCalibration) {
                try {
                    console.log('キャリブレーション開始...');
                    await this.calibrateWithAverageFace();
                    console.log('キャリブレーション完了');
                } catch (error) {
                    console.error('キャリブレーションエラー:', error);
                    // キャリブレーションに失敗してもアプリは動作させる
                    console.log('キャリブレーションをスキップしてアプリを続行します');
                }
            }
            
            // HTTPS環境チェック
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                alert('このアプリケーションはHTTPS環境でのみ動作します。');
                return;
            }
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.resultsContainer.classList.add('active');
            this.isAnalyzing = true;
            
            // 10秒タイマーを開始
            this.startMeasurementTimer();
            
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
            
            // 測定中はデータを蓄積
            if (this.measurementTimer && autonomicState.sympathetic && autonomicState.parasympathetic) {
                this.measurementData.push({
                    sympathetic: autonomicState.sympathetic,
                    parasympathetic: autonomicState.parasympathetic
                });
            }
            
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
        // キャリブレーションデータがある場合は相対値を計算
        let adjustedMetrics = { ...metrics };
        
        if (this.isCalibrated && this.calibrationData) {
            const baseline = this.calibrationData.baselineMetrics;
            
            // 各メトリクスを基準値との相対値に調整
            adjustedMetrics.foreheadTension = this.calculateRelativeValue(metrics.foreheadTension, baseline.foreheadTension);
            adjustedMetrics.eyebrowTension = this.calculateRelativeValue(metrics.eyebrowTension, baseline.eyebrowTension);
            adjustedMetrics.eyeTension = this.calculateRelativeValue(metrics.eyeTension, baseline.eyeTension);
            adjustedMetrics.cheekTension = this.calculateRelativeValue(metrics.cheekTension, baseline.cheekTension);
            adjustedMetrics.mouthTension = this.calculateRelativeValue(metrics.mouthTension, baseline.mouthTension);
            adjustedMetrics.jawTension = this.calculateRelativeValue(metrics.jawTension, baseline.jawTension);
            adjustedMetrics.asymmetry = this.calculateRelativeValue(metrics.asymmetry, baseline.asymmetry);
            adjustedMetrics.blinkRate = metrics.blinkRate; // 瞬き率は相対値にしない
        }
        
        // 各メトリクスの重み付け（眉間を0.5に調整）
        const weights = {
            sympathetic: {
                foreheadTension: 0.10,
                eyebrowTension: 0.50,  // 眉間の重要度を0.5に
                eyeTension: 0.15,
                jawTension: 0.10,
                asymmetry: 0.10,
                highBlinkRate: 0.05
            },
            parasympathetic: {
                relaxedForehead: 0.15,
                relaxedEyes: 0.20,
                relaxedJaw: 0.10,
                relaxedCheeks: 0.40,   // 頬の重要度を調整
                normalBlinkRate: 0.15
            }
        };
        
        // 交感神経指標（調整されたメトリクスを使用）
        const sympatheticScore = 
            adjustedMetrics.foreheadTension * weights.sympathetic.foreheadTension +
            adjustedMetrics.eyebrowTension * weights.sympathetic.eyebrowTension +
            adjustedMetrics.eyeTension * weights.sympathetic.eyeTension +
            adjustedMetrics.jawTension * weights.sympathetic.jawTension +
            adjustedMetrics.asymmetry * weights.sympathetic.asymmetry +
            Math.abs(adjustedMetrics.blinkRate - 0.5) * weights.sympathetic.highBlinkRate;
        
        // 副交感神経指標（調整されたメトリクスを使用）
        const parasympatheticScore = 
            (1 - adjustedMetrics.foreheadTension) * weights.parasympathetic.relaxedForehead +
            (1 - adjustedMetrics.eyeTension) * weights.parasympathetic.relaxedEyes +
            (1 - adjustedMetrics.jawTension) * weights.parasympathetic.relaxedJaw +
            (1 - adjustedMetrics.cheekTension) * weights.parasympathetic.relaxedCheeks +
            (1 - Math.abs(adjustedMetrics.blinkRate - 0.5)) * weights.parasympathetic.normalBlinkRate;
        
        // 正規化とキャリブレーション調整
        let sympatheticRatio, parasympatheticRatio;
        
        if (this.isCalibrated && this.calibrationData) {
            // キャリブレーション基準に基づいて調整
            const baselineTotal = 0.3 + 0.7; // 30% + 70%
            const currentTotal = sympatheticScore + parasympatheticScore;
            
            if (currentTotal > 0) {
                // 基準値からの相対的な変化を計算
                const scaleFactor = baselineTotal / currentTotal;
                
                sympatheticRatio = (sympatheticScore * scaleFactor * 100);
                parasympatheticRatio = (parasympatheticScore * scaleFactor * 100);
                
                // 基準値（30/70）からの差分を適用
                const sympatheticDiff = sympatheticRatio - 50;
                const parasympatheticDiff = parasympatheticRatio - 50;
                
                sympatheticRatio = 30 + sympatheticDiff * 0.8; // 変化を0.8倍にして過敏にならないように
                parasympatheticRatio = 70 + parasympatheticDiff * 0.8;
                
                // 合計が100%になるように調整
                const totalRatio = sympatheticRatio + parasympatheticRatio;
                sympatheticRatio = (sympatheticRatio / totalRatio) * 100;
                parasympatheticRatio = (parasympatheticRatio / totalRatio) * 100;
            } else {
                sympatheticRatio = 30;
                parasympatheticRatio = 70;
            }
        } else {
            // キャリブレーションなしの場合は従来通り
            const total = sympatheticScore + parasympatheticScore;
            sympatheticRatio = total > 0 ? (sympatheticScore / total) * 100 : 50;
            parasympatheticRatio = total > 0 ? (parasympatheticScore / total) * 100 : 50;
        }
        
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
            let diagnosisText = state.diagnosis;
            if (this.isCalibrated) {
                diagnosisText += '\n\n※ 平均顔(交感神経30%、副交感神経70%)を基準にキャリブレーション済み';
            }
            diagnosisContent.textContent = diagnosisText;
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
    
    calculateRelativeValue(current, baseline) {
        // 基準値からの相対的な変化を計算
        // baseline が 0.5 の時、current が 0.5 なら結果は 0.5（変化なし）
        // baseline が 0.5 の時、current が 0.7 なら結果は 0.7（緊張増加）
        // baseline が 0.5 の時、current が 0.3 なら結果は 0.3（緊張減少）
        
        if (baseline === 0) {
            return current;
        }
        
        // 相対的な変化率を計算
        const relativeChange = current / baseline;
        
        // 0.5を中心とした新しい値を計算
        let adjustedValue = 0.5 * relativeChange;
        
        // 0-1の範囲に収める
        return Math.max(0, Math.min(1, adjustedValue));
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

// 測定タイマー関連のメソッドを追加
AutonomicNervousSystemAnalyzer.prototype.startMeasurementTimer = function() {
    this.measurementStartTime = Date.now();
    this.measurementData = [];
    
    // カウントダウン表示を更新
    this.updateCountdown();
    
    // 10秒後に測定終了
    this.measurementTimer = setTimeout(() => {
        this.finishMeasurement();
    }, this.measurementDuration);
    
    // 1秒ごとにカウントダウンを更新
    this.countdownInterval = setInterval(() => {
        this.updateCountdown();
    }, 100);
};

AutonomicNervousSystemAnalyzer.prototype.updateCountdown = function() {
    const elapsed = Date.now() - this.measurementStartTime;
    const remaining = Math.max(0, this.measurementDuration - elapsed);
    const seconds = Math.ceil(remaining / 1000);
    
    // カウントダウン表示を更新
    const countdownElement = document.getElementById('countdown-timer');
    if (!countdownElement) {
        // カウントダウン要素を作成
        const timer = document.createElement('div');
        timer.id = 'countdown-timer';
        timer.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 48px;
            font-weight: bold;
            color: #fff;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            z-index: 1000;
        `;
        document.querySelector('.video-container').appendChild(timer);
    }
    
    const timerElement = document.getElementById('countdown-timer');
    if (seconds > 0) {
        timerElement.textContent = `測定中: ${seconds}秒`;
    } else {
        timerElement.textContent = '測定完了！';
    }
};

AutonomicNervousSystemAnalyzer.prototype.finishMeasurement = function() {
    // タイマーをクリア
    clearInterval(this.countdownInterval);
    this.measurementTimer = null;
    
    // スコアを計算
    const score = this.calculateScore();
    
    // 結果を表示
    this.displayFinalScore(score);
    
    // 測定を停止
    this.stopAnalysis();
};

AutonomicNervousSystemAnalyzer.prototype.calculateScore = function() {
    if (this.measurementData.length === 0) {
        return { 
            score: 0, 
            sympathetic: 0,
            parasympathetic: 0,
            message: 'データが不十分です' 
        };
    }
    
    // 測定データの平均を計算
    let avgSympathetic = 0;
    let avgParasympathetic = 0;
    let validDataCount = 0;
    
    this.measurementData.forEach(data => {
        if (data.sympathetic !== undefined && data.parasympathetic !== undefined) {
            avgSympathetic += data.sympathetic;
            avgParasympathetic += data.parasympathetic;
            validDataCount++;
        }
    });
    
    if (validDataCount === 0) {
        return { 
            score: 0, 
            sympathetic: 0,
            parasympathetic: 0,
            message: 'データが不十分です' 
        };
    }
    
    avgSympathetic /= validDataCount;
    avgParasympathetic /= validDataCount;
    
    // スコアを計算 (副交感神経優位ほど高スコア)
    let score = Math.round(avgParasympathetic);
    
    // メッセージを決定
    let message = '';
    if (score >= 80) {
        message = '素晴らしい！非常にリラックスしています';
    } else if (score >= 65) {
        message = '良好！バランスの取れた状態です';
    } else if (score >= 50) {
        message = '普通。少しリラックスを心がけましょう';
    } else if (score >= 35) {
        message = '緊張気味。深呼吸をしてみましょう';
    } else {
        message = 'ストレス状態。休息が必要です';
    }
    
    return {
        score: score,
        sympathetic: Math.round(avgSympathetic),
        parasympathetic: Math.round(avgParasympathetic),
        message: message
    };
};

AutonomicNervousSystemAnalyzer.prototype.displayFinalScore = function(scoreData) {
    // スコア表示用の要素を作成
    const scoreDisplay = document.createElement('div');
    scoreDisplay.id = 'final-score';
    scoreDisplay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 40px;
        border-radius: 20px;
        text-align: center;
        z-index: 2000;
        min-width: 400px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;
    
    scoreDisplay.innerHTML = `
        <h2 style="margin-bottom: 20px; font-size: 32px;">測定結果</h2>
        <div style="font-size: 72px; font-weight: bold; color: #4CAF50; margin: 20px 0;">
            ${scoreData.score}<span style="font-size: 36px;">点</span>
        </div>
        <p style="font-size: 24px; margin: 20px 0;">${scoreData.message}</p>
        <div style="margin: 20px 0; font-size: 18px;">
            <div>交感神経: ${scoreData.sympathetic}%</div>
            <div>副交感神経: ${scoreData.parasympathetic}%</div>
        </div>
        <button onclick="document.getElementById('final-score').remove(); document.getElementById('countdown-timer').remove();" 
                style="margin-top: 20px; padding: 10px 30px; font-size: 18px; 
                       background: #4CAF50; color: white; border: none; 
                       border-radius: 5px; cursor: pointer;">
            閉じる
        </button>
    `;
    
    document.body.appendChild(scoreDisplay);
};