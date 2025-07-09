// 自律神経診断システム - リファクタリング版
class AutonomicNervousSystemAnalyzer {
    constructor() {
        this.initializeElements();
        this.initializeState();
        this.setupEventListeners();
        this.initializeFaceMesh();
    }

    // DOM要素の初期化
    initializeElements() {
        this.elements = {
            video: document.getElementById('video'),
            overlay: document.getElementById('overlay'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            resultsContainer: document.getElementById('results'),
            calibrationStatus: document.getElementById('calibration-status'),
            sympatheticBar: document.getElementById('sympathetic-bar'),
            sympatheticValue: document.getElementById('sympathetic-value'),
            parasympatheticBar: document.getElementById('parasympathetic-bar'),
            parasympatheticValue: document.getElementById('parasympathetic-value'),
            diagnosisContent: document.getElementById('diagnosis-content')
        };
    }

    // 状態の初期化
    initializeState() {
        this.state = {
            isAnalyzing: false,
            isCalibrated: false,
            faceMesh: null,
            camera: null,
            calibrationData: null,
            measurementTimer: null,
            measurementStartTime: null,
            measurementData: [],
            countdownInterval: null,
            blinkBuffer: [],
            blinkCount: 0,
            lastBlinkTime: Date.now()
        };

        this.config = {
            measurementDuration: 10000, // 10秒
            weights: {
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
                    relaxedCheeks: 0.40,
                    normalBlinkRate: 0.15
                }
            },
            calibration: {
                imagePath: 'averageface.png',
                targetSympathetic: 30,
                targetParasympathetic: 70
            }
        };
    }

    // イベントリスナーの設定
    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.startAnalysis());
        this.elements.stopBtn.addEventListener('click', () => this.stopAnalysis());
    }

    // MediaPipe Face Meshの初期化
    initializeFaceMesh() {
        if (typeof FaceMesh === 'undefined') {
            setTimeout(() => this.initializeFaceMesh(), 100);
            return;
        }

        this.state.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        this.state.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.state.faceMesh.onResults((results) => this.onFaceMeshResults(results));
    }

    // キャリブレーション
    async calibrateWithAverageFace() {
        console.log('平均顔でキャリブレーション開始...');
        this.showCalibrationStatus('キャリブレーション中...', 'info');

        try {
            const img = await this.loadImage(this.config.calibration.imagePath);
            const canvas = this.createCanvasFromImage(img);
            const calibrationData = await this.analyzeImageWithFaceMesh(canvas);
            
            this.state.calibrationData = {
                baselineMetrics: calibrationData,
                ...this.config.calibration
            };
            
            this.state.isCalibrated = true;
            console.log('キャリブレーション完了:', this.state.calibrationData);
            this.showCalibrationStatus(
                `キャリブレーション完了 (基準値: 交感神経${this.config.calibration.targetSympathetic}%, 副交感神経${this.config.calibration.targetParasympathetic}%)`, 
                'success'
            );
        } catch (error) {
            console.error('キャリブレーションエラー:', error);
            this.showCalibrationStatus('キャリブレーション失敗: ' + error.message, 'error');
        }
    }

    // 画像読み込み
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
            img.src = src;
        });
    }

    // 画像からCanvasを作成
    createCanvasFromImage(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas;
    }

    // FaceMeshで画像を分析
    analyzeImageWithFaceMesh(canvas) {
        return new Promise((resolve, reject) => {
            if (!this.state.faceMesh) {
                reject(new Error('FaceMeshが初期化されていません'));
                return;
            }

            const originalOnResults = this.state.faceMesh.onResults;
            
            this.state.faceMesh.onResults((results) => {
                this.state.faceMesh.onResults = originalOnResults;
                
                if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
                    const landmarks = results.multiFaceLandmarks[0];
                    const metrics = this.analyzeMuscleStates(landmarks);
                    resolve(metrics);
                } else {
                    reject(new Error('顔を検出できませんでした'));
                }
            });
            
            this.state.faceMesh.send({ image: canvas });
        });
    }

    // 分析開始
    async startAnalysis() {
        try {
            // キャリブレーション
            if (!this.state.isCalibrated) {
                await this.calibrateWithAverageFace();
            }

            // HTTPS環境チェック
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                alert('このアプリケーションはHTTPS環境でのみ動作します。');
                return;
            }

            this.setAnalysisState(true);
            this.startMeasurementTimer();

            // カメラ起動
            await this.startCamera();
            
            this.updateUI({
                sympathetic: 50,
                parasympathetic: 50,
                diagnosis: "分析を開始しました。顔を画面に向けてください...",
                confidence: 0
            });
            
        } catch (error) {
            console.error('分析開始エラー:', error);
            alert('エラーが発生しました: ' + error.message);
            this.stopAnalysis();
        }
    }

    // カメラ起動
    async startCamera() {
        // カメラアクセス権限の確認
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        });
        
        stream.getTracks().forEach(track => track.stop());

        // カメラの初期化
        this.state.camera = new Camera(this.elements.video, {
            onFrame: async () => {
                if (this.state.isAnalyzing && this.state.faceMesh) {
                    await this.state.faceMesh.send({ image: this.elements.video });
                }
            },
            width: 640,
            height: 480
        });
        
        await this.state.camera.start();
    }

    // 分析状態の設定
    setAnalysisState(isAnalyzing) {
        this.state.isAnalyzing = isAnalyzing;
        this.elements.startBtn.disabled = isAnalyzing;
        this.elements.stopBtn.disabled = !isAnalyzing;
        this.elements.resultsContainer.classList.toggle('active', isAnalyzing);
    }

    // 分析停止
    stopAnalysis() {
        this.state.isAnalyzing = false;
        if (this.state.camera) {
            this.state.camera.stop();
        }
        this.setAnalysisState(false);
    }

    // FaceMesh結果処理
    onFaceMeshResults(results) {
        const ctx = this.elements.overlay.getContext('2d');
        this.clearCanvas(ctx);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            const landmarks = results.multiFaceLandmarks[0];
            
            this.drawFaceMesh(ctx, landmarks);
            const muscleMetrics = this.analyzeMuscleStates(landmarks);
            const autonomicState = this.calculateAutonomicState(muscleMetrics);
            
            // 測定中はデータを蓄積
            if (this.state.measurementTimer && autonomicState.sympathetic && autonomicState.parasympathetic) {
                this.state.measurementData.push({
                    sympathetic: autonomicState.sympathetic,
                    parasympathetic: autonomicState.parasympathetic
                });
            }
            
            this.updateUI(autonomicState);
        } else {
            this.updateUI({
                sympathetic: 50,
                parasympathetic: 50,
                diagnosis: "顔が検出されません。カメラに顔を向けてください。",
                confidence: 0
            });
        }
    }

    // Canvas初期化
    clearCanvas(ctx) {
        ctx.save();
        ctx.clearRect(0, 0, this.elements.overlay.width, this.elements.overlay.height);
        this.elements.overlay.width = this.elements.video.videoWidth;
        this.elements.overlay.height = this.elements.video.videoHeight;
    }

    // 顔メッシュ描画
    drawFaceMesh(ctx, landmarks) {
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 1;
        
        if (typeof FACEMESH_TESSELATION !== 'undefined') {
            for (const connection of FACEMESH_TESSELATION) {
                const start = landmarks[connection[0]];
                const end = landmarks[connection[1]];
                
                ctx.beginPath();
                ctx.moveTo(start.x * this.elements.overlay.width, start.y * this.elements.overlay.height);
                ctx.lineTo(end.x * this.elements.overlay.width, end.y * this.elements.overlay.height);
                ctx.stroke();
            }
        }
        
        ctx.fillStyle = '#FF0000';
        for (const landmark of landmarks) {
            ctx.beginPath();
            ctx.arc(
                landmark.x * this.elements.overlay.width,
                landmark.y * this.elements.overlay.height,
                2, 0, 2 * Math.PI
            );
            ctx.fill();
        }
        
        ctx.restore();
    }

    // 筋肉状態の分析
    analyzeMuscleStates(landmarks) {
        return {
            foreheadTension: this.calculateForeheadTension(landmarks),
            eyebrowTension: this.calculateEyebrowTension(landmarks),
            eyeTension: this.calculateEyeTension(landmarks),
            cheekTension: this.calculateCheekTension(landmarks),
            mouthTension: this.calculateMouthTension(landmarks),
            jawTension: this.calculateJawTension(landmarks),
            asymmetry: this.calculateFacialAsymmetry(landmarks),
            blinkRate: this.detectBlinkRate(landmarks)
        };
    }

    // 各部位の緊張度計算メソッド
    calculateForeheadTension(landmarks) {
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
        
        return count === 0 ? 0.5 : this.normalizeValue(totalDistance / count * 10, 0.3, 0.7);
    }

    calculateEyebrowTension(landmarks) {
        const leftEyebrow = [70, 63, 105, 66, 107];
        const rightEyebrow = [300, 293, 334, 296, 336];
        
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
        
        return count === 0 ? 0.5 : this.normalizeValue(1 - (leftHeight + rightHeight) / count, 0.3, 0.7);
    }

    calculateEyeTension(landmarks) {
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
        const leftCheek = [35, 31, 228, 229, 230];
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
        
        return count === 0 ? 0.5 : this.normalizeValue(tension / count * 10, 0.3, 0.7);
    }

    calculateMouthTension(landmarks) {
        let mouthHeight = 0;
        let mouthWidth = 0;
        
        if (landmarks[13] && landmarks[14]) {
            mouthHeight = this.calculateDistance(landmarks[13], landmarks[14]);
        }
        
        if (landmarks[61] && landmarks[291]) {
            mouthWidth = this.calculateDistance(landmarks[61], landmarks[291]);
        }
        
        return mouthWidth === 0 ? 0.5 : this.normalizeValue(mouthHeight / mouthWidth * 5, 0, 1);
    }

    calculateJawTension(landmarks) {
        const jawLine = [172, 136, 150, 149, 176, 148, 152, 377];
        let tension = 0;
        let count = 0;
        
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
        
        return count === 0 ? 0.5 : this.normalizeValue(tension / count, 0, 1);
    }

    calculateFacialAsymmetry(landmarks) {
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
        
        return count === 0 ? 0 : this.normalizeValue(asymmetry / count * 10, 0, 1);
    }

    detectBlinkRate(landmarks) {
        const eyeTension = this.calculateEyeTension(landmarks);
        
        this.state.blinkBuffer.push(eyeTension);
        if (this.state.blinkBuffer.length > 10) {
            this.state.blinkBuffer.shift();
        }
        
        if (this.state.blinkBuffer.length >= 3) {
            const current = this.state.blinkBuffer[this.state.blinkBuffer.length - 1];
            const previous = this.state.blinkBuffer[this.state.blinkBuffer.length - 2];
            
            if (current > 0.8 && previous < 0.8) {
                this.state.blinkCount++;
            }
        }
        
        const elapsed = (Date.now() - this.state.lastBlinkTime) / 60000;
        const blinkRate = elapsed > 0 ? this.state.blinkCount / elapsed : 15;
        
        return this.normalizeValue(blinkRate, 10, 25);
    }

    // 自律神経状態の計算
    calculateAutonomicState(metrics) {
        let adjustedMetrics = { ...metrics };
        
        // キャリブレーションによる調整
        if (this.state.isCalibrated && this.state.calibrationData) {
            adjustedMetrics = this.applyCalibration(metrics);
        }
        
        // スコア計算
        const scores = this.calculateScores(adjustedMetrics);
        
        // 比率計算
        const ratios = this.calculateRatios(scores);
        
        // 診断生成
        const diagnosis = this.generateDiagnosis(ratios, metrics);
        const confidence = this.calculateConfidence(metrics);
        
        return {
            sympathetic: Math.round(ratios.sympathetic),
            parasympathetic: Math.round(ratios.parasympathetic),
            diagnosis: diagnosis,
            confidence: confidence,
            rawMetrics: metrics
        };
    }

    // キャリブレーション適用
    applyCalibration(metrics) {
        const baseline = this.state.calibrationData.baselineMetrics;
        const adjusted = {};
        
        Object.keys(metrics).forEach(key => {
            if (key === 'blinkRate') {
                adjusted[key] = metrics[key];
            } else {
                adjusted[key] = this.calculateRelativeValue(metrics[key], baseline[key]);
            }
        });
        
        return adjusted;
    }

    // スコア計算
    calculateScores(metrics) {
        const weights = this.config.weights;
        
        const sympatheticScore = 
            metrics.foreheadTension * weights.sympathetic.foreheadTension +
            metrics.eyebrowTension * weights.sympathetic.eyebrowTension +
            metrics.eyeTension * weights.sympathetic.eyeTension +
            metrics.jawTension * weights.sympathetic.jawTension +
            metrics.asymmetry * weights.sympathetic.asymmetry +
            Math.abs(metrics.blinkRate - 0.5) * weights.sympathetic.highBlinkRate;
        
        const parasympatheticScore = 
            (1 - metrics.foreheadTension) * weights.parasympathetic.relaxedForehead +
            (1 - metrics.eyeTension) * weights.parasympathetic.relaxedEyes +
            (1 - metrics.jawTension) * weights.parasympathetic.relaxedJaw +
            (1 - metrics.cheekTension) * weights.parasympathetic.relaxedCheeks +
            (1 - Math.abs(metrics.blinkRate - 0.5)) * weights.parasympathetic.normalBlinkRate;
        
        return { sympatheticScore, parasympatheticScore };
    }

    // 比率計算
    calculateRatios(scores) {
        if (this.state.isCalibrated && this.state.calibrationData) {
            return this.calculateCalibratedRatios(scores);
        } else {
            return this.calculateDefaultRatios(scores);
        }
    }

    calculateCalibratedRatios(scores) {
        const { sympatheticScore, parasympatheticScore } = scores;
        const currentTotal = sympatheticScore + parasympatheticScore;
        
        if (currentTotal > 0) {
            const scaleFactor = 1 / currentTotal;
            let sympatheticRatio = sympatheticScore * scaleFactor * 100;
            let parasympatheticRatio = parasympatheticScore * scaleFactor * 100;
            
            // 基準値からの差分を適用
            const sympatheticDiff = (sympatheticRatio - 50) * 0.8;
            const parasympatheticDiff = (parasympatheticRatio - 50) * 0.8;
            
            sympatheticRatio = this.config.calibration.targetSympathetic + sympatheticDiff;
            parasympatheticRatio = this.config.calibration.targetParasympathetic + parasympatheticDiff;
            
            // 正規化
            const totalRatio = sympatheticRatio + parasympatheticRatio;
            return {
                sympathetic: (sympatheticRatio / totalRatio) * 100,
                parasympathetic: (parasympatheticRatio / totalRatio) * 100
            };
        }
        
        return {
            sympathetic: this.config.calibration.targetSympathetic,
            parasympathetic: this.config.calibration.targetParasympathetic
        };
    }

    calculateDefaultRatios(scores) {
        const total = scores.sympatheticScore + scores.parasympatheticScore;
        return {
            sympathetic: total > 0 ? (scores.sympatheticScore / total) * 100 : 50,
            parasympathetic: total > 0 ? (scores.parasympatheticScore / total) * 100 : 50
        };
    }

    // 診断生成
    generateDiagnosis(ratios, metrics) {
        let diagnosis = "";
        
        if (ratios.sympathetic > 65) {
            diagnosis = "交感神経が優位な状態です。ストレスや緊張が高まっている可能性があります。深呼吸やリラックス法を試してみてください。";
        } else if (ratios.parasympathetic > 65) {
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
        
        return diagnosis;
    }

    // 信頼度計算
    calculateConfidence(metrics) {
        let confidence = 1;
        
        for (const key in metrics) {
            const value = metrics[key];
            if (value < 0.1 || value > 0.9) {
                confidence *= 0.8;
            }
        }
        
        const values = Object.values(metrics);
        const avg = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
        
        if (variance > 0.2) {
            confidence *= 0.7;
        }
        
        return confidence;
    }

    // UI更新
    updateUI(state) {
        // プログレスバー更新
        if (this.elements.sympatheticBar && this.elements.sympatheticValue) {
            this.elements.sympatheticBar.style.width = `${state.sympathetic}%`;
            this.elements.sympatheticValue.textContent = `${state.sympathetic}%`;
        }
        
        if (this.elements.parasympatheticBar && this.elements.parasympatheticValue) {
            this.elements.parasympatheticBar.style.width = `${state.parasympathetic}%`;
            this.elements.parasympatheticValue.textContent = `${state.parasympathetic}%`;
        }
        
        // 診断内容更新
        if (this.elements.diagnosisContent) {
            let diagnosisText = state.diagnosis;
            if (this.state.isCalibrated) {
                diagnosisText += `\n\n※ 平均顔(交感神経${this.config.calibration.targetSympathetic}%、副交感神経${this.config.calibration.targetParasympathetic}%)を基準にキャリブレーション済み`;
            }
            this.elements.diagnosisContent.textContent = diagnosisText;
        }
        
        // 信頼度インジケーター更新
        this.updateConfidenceIndicator(state.confidence);
    }

    // 信頼度インジケーター更新
    updateConfidenceIndicator(confidence) {
        let indicator = document.getElementById('confidence-indicator');
        if (!indicator) {
            indicator = this.createConfidenceIndicator();
        }
        
        const level = confidence > 0.7 ? '高' : confidence > 0.4 ? '中' : '低';
        const color = confidence > 0.7 ? '#4CAF50' : confidence > 0.4 ? '#FFC107' : '#F44336';
        
        indicator.textContent = `信頼度: ${level}`;
        indicator.style.borderLeft = `3px solid ${color}`;
    }

    createConfidenceIndicator() {
        const indicator = document.createElement('div');
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
        return indicator;
    }

    // キャリブレーションステータス表示
    showCalibrationStatus(message, type) {
        if (this.elements.calibrationStatus) {
            this.elements.calibrationStatus.textContent = message;
            this.elements.calibrationStatus.className = `calibration-status active ${type}`;
            
            if (type === 'success') {
                setTimeout(() => {
                    this.elements.calibrationStatus.classList.remove('active');
                }, 5000);
            }
        }
    }

    // 測定タイマー関連
    startMeasurementTimer() {
        this.state.measurementStartTime = Date.now();
        this.state.measurementData = [];
        
        this.updateCountdown();
        
        this.state.measurementTimer = setTimeout(() => {
            this.finishMeasurement();
        }, this.config.measurementDuration);
        
        this.state.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 100);
    }

    updateCountdown() {
        const elapsed = Date.now() - this.state.measurementStartTime;
        const remaining = Math.max(0, this.config.measurementDuration - elapsed);
        const seconds = Math.ceil(remaining / 1000);
        
        let timerElement = document.getElementById('countdown-timer');
        if (!timerElement) {
            timerElement = this.createCountdownTimer();
        }
        
        if (seconds > 0) {
            timerElement.textContent = `測定中: ${seconds}秒`;
        } else {
            timerElement.textContent = '測定完了！';
        }
    }

    createCountdownTimer() {
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
        return timer;
    }

    finishMeasurement() {
        clearInterval(this.state.countdownInterval);
        this.state.measurementTimer = null;
        
        const score = this.calculateFinalScore();
        this.displayFinalScore(score);
        this.stopAnalysis();
    }

    calculateFinalScore() {
        if (this.state.measurementData.length === 0) {
            return { 
                score: 0, 
                sympathetic: 0,
                parasympathetic: 0,
                message: 'データが不十分です' 
            };
        }
        
        let avgSympathetic = 0;
        let avgParasympathetic = 0;
        let validDataCount = 0;
        
        this.state.measurementData.forEach(data => {
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
        
        const score = Math.round(avgParasympathetic);
        const message = this.getScoreMessage(score);
        
        return {
            score: score,
            sympathetic: Math.round(avgSympathetic),
            parasympathetic: Math.round(avgParasympathetic),
            message: message
        };
    }

    getScoreMessage(score) {
        if (score >= 80) return '素晴らしい！非常にリラックスしています';
        if (score >= 65) return '良好！バランスの取れた状態です';
        if (score >= 50) return '普通。少しリラックスを心がけましょう';
        if (score >= 35) return '緊張気味。深呼吸をしてみましょう';
        return 'ストレス状態。休息が必要です';
    }

    displayFinalScore(scoreData) {
        const scoreDisplay = this.createScoreDisplay(scoreData);
        document.body.appendChild(scoreDisplay);
    }

    createScoreDisplay(scoreData) {
        const display = document.createElement('div');
        display.id = 'final-score';
        display.style.cssText = `
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
        
        display.innerHTML = `
            <h2 style="margin-bottom: 20px; font-size: 32px;">測定結果</h2>
            <div style="font-size: 72px; font-weight: bold; color: #4CAF50; margin: 20px 0;">
                ${scoreData.score}<span style="font-size: 36px;">点</span>
            </div>
            <p style="font-size: 24px; margin: 20px 0;">${scoreData.message}</p>
            <div style="margin: 20px 0; font-size: 18px;">
                <div>交感神経: ${scoreData.sympathetic}%</div>
                <div>副交感神経: ${scoreData.parasympathetic}%</div>
            </div>
            <button onclick="this.parentElement.remove(); document.getElementById('countdown-timer')?.remove();" 
                    style="margin-top: 20px; padding: 10px 30px; font-size: 18px; 
                           background: #4CAF50; color: white; border: none; 
                           border-radius: 5px; cursor: pointer;">
                閉じる
            </button>
        `;
        
        return display;
    }

    // ユーティリティメソッド
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
        if (baseline === 0) return current;
        
        const relativeChange = current / baseline;
        let adjustedValue = 0.5 * relativeChange;
        
        return Math.max(0, Math.min(1, adjustedValue));
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
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