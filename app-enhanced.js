class EnhancedAutonomicAnalyzer {
    constructor() {
        this.video = document.getElementById('video');
        this.overlay = document.getElementById('overlay');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.resultsContainer = document.getElementById('results');
        
        this.faceMesh = null;
        this.camera = null;
        this.isAnalyzing = false;
        
        // 時系列データ保存（精度向上のため）
        this.timeSeriesData = {
            timestamps: [],
            foreheadTension: [],
            eyebrowTension: [],
            eyeTension: [],
            cheekTension: [],
            mouthTension: [],
            jawTension: [],
            blinkRate: [],
            pupilDilation: [],
            facialTemperature: [],
            heartRateVariability: []
        };
        
        // 個人差キャリブレーション
        this.calibrationData = {
            baseline: null,
            isCalibrating: false,
            calibrationFrames: 0
        };
        
        // 詳細な筋群マッピング
        this.detailedMuscleGroups = {
            frontalis: [9, 10, 151, 337, 299, 333, 298, 301],
            corrugator: [46, 53, 52, 65, 55, 276, 283, 282],
            orbicularisOculi: [33, 7, 163, 144, 145, 153, 154, 155],
            zygomaticus: [35, 31, 228, 229, 230, 231, 232, 233],
            orbicularisOris: [61, 84, 17, 314, 405, 308, 324, 318],
            masseter: [172, 136, 150, 149, 176, 148, 152, 377],
            temporalis: [54, 103, 67, 109, 10, 338, 297, 332]
        };
        
        // 高度な分析パラメータ
        this.advancedMetrics = {
            stressPatterns: [],
            emotionalStates: [],
            fatigueLevel: 0,
            concentrationLevel: 0
        };
        
        this.setupEventListeners();
        this.initializeFaceMesh();
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startAnalysis());
        this.stopBtn.addEventListener('click', () => this.stopAnalysis());
        
        // キャリブレーションボタンの追加
        const calibrateBtn = document.createElement('button');
        calibrateBtn.id = 'calibrateBtn';
        calibrateBtn.className = 'btn btn-info';
        calibrateBtn.textContent = 'キャリブレーション';
        calibrateBtn.addEventListener('click', () => this.startCalibration());
        this.startBtn.parentNode.insertBefore(calibrateBtn, this.stopBtn);
    }
    
    initializeFaceMesh() {
        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.7,  // より高い精度
            minTrackingConfidence: 0.7
        });
        
        this.faceMesh.onResults((results) => this.onFaceMeshResults(results));
    }
    
    startCalibration() {
        this.calibrationData.isCalibrating = true;
        this.calibrationData.calibrationFrames = 0;
        this.calibrationData.baseline = {
            forehead: [],
            eyebrow: [],
            eye: [],
            cheek: [],
            mouth: [],
            jaw: []
        };
        
        alert('リラックスした状態で10秒間お待ちください。基準値を測定します。');
        this.startAnalysis();
        
        setTimeout(() => {
            this.completeCalibration();
        }, 10000);
    }
    
    completeCalibration() {
        this.calibrationData.isCalibrating = false;
        
        // 基準値の平均を計算
        for (let key in this.calibrationData.baseline) {
            const values = this.calibrationData.baseline[key];
            this.calibrationData.baseline[key] = values.reduce((a, b) => a + b, 0) / values.length;
        }
        
        alert('キャリブレーション完了！個人に最適化された診断が可能になりました。');
    }
    
    async startAnalysis() {
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.resultsContainer.classList.add('active');
        this.isAnalyzing = true;
        
        this.camera = new Camera(this.video, {
            onFrame: async () => {
                if (this.isAnalyzing) {
                    await this.faceMesh.send({ image: this.video });
                }
            },
            width: 640,
            height: 480
        });
        
        await this.camera.start();
    }
    
    stopAnalysis() {
        this.isAnalyzing = false;
        if (this.camera) {
            this.camera.stop();
        }
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        
        // 詳細レポート生成
        this.generateDetailedReport();
    }
    
    onFaceMeshResults(results) {
        const ctx = this.overlay.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        
        this.overlay.width = this.video.videoWidth;
        this.overlay.height = this.video.videoHeight;
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            const landmarks = results.multiFaceLandmarks[0];
            
            this.drawEnhancedFaceMesh(ctx, landmarks);
            
            const metrics = this.analyzeEnhancedMuscleStates(landmarks);
            
            if (this.calibrationData.isCalibrating) {
                this.collectCalibrationData(metrics);
            } else {
                const autonomicState = this.calculateEnhancedAutonomicState(metrics);
                this.updateEnhancedUI(autonomicState);
                this.collectTimeSeriesData(metrics);
            }
        }
        
        ctx.restore();
    }
    
    drawEnhancedFaceMesh(ctx, landmarks) {
        // 筋群ごとに色分け
        const muscleColors = {
            frontalis: '#FF6B6B',
            corrugator: '#4ECDC4',
            orbicularisOculi: '#45B7D1',
            zygomaticus: '#96CEB4',
            orbicularisOris: '#FECA57',
            masseter: '#FF9FF3',
            temporalis: '#54A0FF'
        };
        
        for (const [muscleName, points] of Object.entries(this.detailedMuscleGroups)) {
            ctx.strokeStyle = muscleColors[muscleName];
            ctx.lineWidth = 2;
            
            for (let i = 0; i < points.length - 1; i++) {
                const start = landmarks[points[i]];
                const end = landmarks[points[i + 1]];
                
                ctx.beginPath();
                ctx.moveTo(start.x * this.overlay.width, start.y * this.overlay.height);
                ctx.lineTo(end.x * this.overlay.width, end.y * this.overlay.height);
                ctx.stroke();
            }
        }
        
        // 重要なランドマークを強調
        ctx.fillStyle = '#FF0000';
        for (const landmark of landmarks) {
            ctx.beginPath();
            ctx.arc(
                landmark.x * this.overlay.width,
                landmark.y * this.overlay.height,
                1, 0, 2 * Math.PI
            );
            ctx.fill();
        }
    }
    
    analyzeEnhancedMuscleStates(landmarks) {
        const metrics = {
            // 基本メトリクス
            foreheadTension: this.calculateDetailedForeheadTension(landmarks),
            eyebrowTension: this.calculateDetailedEyebrowTension(landmarks),
            eyeTension: this.calculateDetailedEyeTension(landmarks),
            cheekTension: this.calculateDetailedCheekTension(landmarks),
            mouthTension: this.calculateDetailedMouthTension(landmarks),
            jawTension: this.calculateDetailedJawTension(landmarks),
            
            // 高度なメトリクス
            blinkFrequency: this.detectBlinkFrequency(landmarks),
            eyeMovementPattern: this.analyzeEyeMovements(landmarks),
            facialMicroExpressions: this.detectMicroExpressions(landmarks),
            breathingPattern: this.estimateBreathingPattern(landmarks),
            skinTension: this.calculateSkinTension(landmarks),
            asymmetryDetails: this.calculateDetailedAsymmetry(landmarks),
            
            // 複合指標
            stressIndex: 0,
            fatigueIndex: 0,
            emotionalValence: 0,
            arousalLevel: 0
        };
        
        // 複合指標の計算
        metrics.stressIndex = this.calculateStressIndex(metrics);
        metrics.fatigueIndex = this.calculateFatigueIndex(metrics);
        metrics.emotionalValence = this.calculateEmotionalValence(metrics);
        metrics.arousalLevel = this.calculateArousalLevel(metrics);
        
        return metrics;
    }
    
    calculateDetailedForeheadTension(landmarks) {
        const frontalisPoints = this.detailedMuscleGroups.frontalis;
        let tensionMetrics = {
            horizontalWrinkles: 0,
            verticalWrinkles: 0,
            overallTension: 0
        };
        
        // 水平方向のしわ（前頭筋の収縮）
        for (let i = 0; i < frontalisPoints.length - 1; i++) {
            const p1 = landmarks[frontalisPoints[i]];
            const p2 = landmarks[frontalisPoints[i + 1]];
            const distance = this.calculateDistance(p1, p2);
            tensionMetrics.horizontalWrinkles += distance;
        }
        
        // 垂直方向の解析
        const topRow = [9, 10, 151, 337];
        const bottomRow = [299, 333, 298, 301];
        
        for (let i = 0; i < topRow.length; i++) {
            const top = landmarks[topRow[i]];
            const bottom = landmarks[bottomRow[i]];
            const verticalDist = Math.abs(top.y - bottom.y);
            tensionMetrics.verticalWrinkles += verticalDist;
        }
        
        // キャリブレーション補正
        if (this.calibrationData.baseline && this.calibrationData.baseline.forehead) {
            tensionMetrics.overallTension = 
                (tensionMetrics.horizontalWrinkles + tensionMetrics.verticalWrinkles) / 
                this.calibrationData.baseline.forehead;
        } else {
            tensionMetrics.overallTension = this.normalizeValue(
                tensionMetrics.horizontalWrinkles + tensionMetrics.verticalWrinkles,
                0.5, 2.0
            );
        }
        
        return tensionMetrics.overallTension;
    }
    
    calculateDetailedEyebrowTension(landmarks) {
        const corrugatorPoints = this.detailedMuscleGroups.corrugator;
        
        // 眉間のしわ（皺眉筋の活動）
        const glabellaDistance = this.calculateDistance(
            landmarks[corrugatorPoints[0]], 
            landmarks[corrugatorPoints[5]]
        );
        
        // 眉の上昇度
        const eyebrowElevation = (
            landmarks[corrugatorPoints[2]].y + 
            landmarks[corrugatorPoints[7]].y
        ) / 2;
        
        // 眉の角度
        const leftAngle = this.calculateAngle(
            landmarks[corrugatorPoints[0]],
            landmarks[corrugatorPoints[2]],
            landmarks[corrugatorPoints[4]]
        );
        
        const rightAngle = this.calculateAngle(
            landmarks[corrugatorPoints[5]],
            landmarks[corrugatorPoints[7]],
            landmarks[corrugatorPoints[9]]
        );
        
        const tensionScore = 
            this.normalizeValue(glabellaDistance, 0.05, 0.15) * 0.4 +
            this.normalizeValue(eyebrowElevation, 0.3, 0.5) * 0.3 +
            this.normalizeValue(Math.abs(leftAngle - rightAngle), 0, 0.5) * 0.3;
        
        return tensionScore;
    }
    
    calculateDetailedEyeTension(landmarks) {
        const leftEyePoints = this.detailedMuscleGroups.orbicularisOculi.slice(0, 4);
        const rightEyePoints = this.detailedMuscleGroups.orbicularisOculi.slice(4);
        
        // 瞼裂幅（まぶたの開き具合）
        const leftEyeOpenness = this.calculateEyeAspectRatio(landmarks, leftEyePoints);
        const rightEyeOpenness = this.calculateEyeAspectRatio(landmarks, rightEyePoints);
        
        // 瞬き検出
        const isBlinking = (leftEyeOpenness < 0.2 && rightEyeOpenness < 0.2);
        
        // 眼輪筋の緊張
        const orbicularTension = this.calculateMuscleContraction(
            landmarks, 
            this.detailedMuscleGroups.orbicularisOculi
        );
        
        // 総合的な眼の緊張度
        const eyeTension = isBlinking ? 0 : (
            (1 - (leftEyeOpenness + rightEyeOpenness) / 2) * 0.6 +
            orbicularTension * 0.4
        );
        
        return eyeTension;
    }
    
    calculateEyeAspectRatio(landmarks, eyePoints) {
        if (eyePoints.length < 4) return 0;
        
        const vertical1 = this.calculateDistance(
            landmarks[eyePoints[1]], 
            landmarks[eyePoints[3]]
        );
        const horizontal = this.calculateDistance(
            landmarks[eyePoints[0]], 
            landmarks[eyePoints[2]]
        );
        
        return vertical1 / (horizontal + 0.001);
    }
    
    detectBlinkFrequency(landmarks) {
        const leftEye = this.calculateEyeAspectRatio(
            landmarks, 
            this.detailedMuscleGroups.orbicularisOculi.slice(0, 4)
        );
        
        if (!this.blinkDetector) {
            this.blinkDetector = {
                lastState: 'open',
                blinkCount: 0,
                startTime: Date.now()
            };
        }
        
        const currentState = leftEye < 0.2 ? 'closed' : 'open';
        
        if (this.blinkDetector.lastState === 'open' && currentState === 'closed') {
            this.blinkDetector.blinkCount++;
        }
        
        this.blinkDetector.lastState = currentState;
        
        const elapsedMinutes = (Date.now() - this.blinkDetector.startTime) / 60000;
        return this.blinkDetector.blinkCount / Math.max(elapsedMinutes, 0.1);
    }
    
    detectMicroExpressions(landmarks) {
        if (!this.microExpressionBuffer) {
            this.microExpressionBuffer = [];
        }
        
        // 現在のフレームの特徴を保存
        const currentFeatures = {
            timestamp: Date.now(),
            mouth: this.extractMouthFeatures(landmarks),
            eyes: this.extractEyeFeatures(landmarks),
            brows: this.extractBrowFeatures(landmarks)
        };
        
        this.microExpressionBuffer.push(currentFeatures);
        
        // バッファサイズを制限（0.5秒分）
        const bufferDuration = 500;
        this.microExpressionBuffer = this.microExpressionBuffer.filter(
            f => Date.now() - f.timestamp < bufferDuration
        );
        
        // マイクロ表情の検出
        let microExpressionScore = 0;
        
        if (this.microExpressionBuffer.length > 5) {
            const variations = this.calculateFeatureVariations(this.microExpressionBuffer);
            microExpressionScore = variations.total;
        }
        
        return microExpressionScore;
    }
    
    calculateFeatureVariations(buffer) {
        let mouthVar = 0, eyeVar = 0, browVar = 0;
        
        for (let i = 1; i < buffer.length; i++) {
            const prev = buffer[i - 1];
            const curr = buffer[i];
            
            mouthVar += Math.abs(curr.mouth.width - prev.mouth.width);
            mouthVar += Math.abs(curr.mouth.height - prev.mouth.height);
            
            eyeVar += Math.abs(curr.eyes.leftOpenness - prev.eyes.leftOpenness);
            eyeVar += Math.abs(curr.eyes.rightOpenness - prev.eyes.rightOpenness);
            
            browVar += Math.abs(curr.brows.leftHeight - prev.brows.leftHeight);
            browVar += Math.abs(curr.brows.rightHeight - prev.brows.rightHeight);
        }
        
        return {
            mouth: this.normalizeValue(mouthVar, 0, 0.1),
            eyes: this.normalizeValue(eyeVar, 0, 0.1),
            brows: this.normalizeValue(browVar, 0, 0.1),
            total: (mouthVar + eyeVar + browVar) / 3
        };
    }
    
    extractMouthFeatures(landmarks) {
        const width = this.calculateDistance(landmarks[61], landmarks[291]);
        const height = this.calculateDistance(landmarks[13], landmarks[14]);
        const ratio = height / (width + 0.001);
        
        return { width, height, ratio };
    }
    
    extractEyeFeatures(landmarks) {
        const leftOpenness = this.calculateEyeAspectRatio(
            landmarks,
            this.detailedMuscleGroups.orbicularisOculi.slice(0, 4)
        );
        const rightOpenness = this.calculateEyeAspectRatio(
            landmarks,
            this.detailedMuscleGroups.orbicularisOculi.slice(4)
        );
        
        return { leftOpenness, rightOpenness };
    }
    
    extractBrowFeatures(landmarks) {
        const leftHeight = landmarks[this.detailedMuscleGroups.corrugator[2]].y;
        const rightHeight = landmarks[this.detailedMuscleGroups.corrugator[7]].y;
        
        return { leftHeight, rightHeight };
    }
    
    calculateStressIndex(metrics) {
        // ストレス指標の複合計算
        const stressFactors = {
            muscularTension: (
                metrics.foreheadTension * 0.2 +
                metrics.eyebrowTension * 0.15 +
                metrics.jawTension * 0.25 +
                metrics.eyeTension * 0.2 +
                metrics.mouthTension * 0.2
            ),
            blinkAbnormality: Math.abs(metrics.blinkFrequency - 15) / 15,
            microExpressions: metrics.facialMicroExpressions,
            asymmetry: metrics.asymmetryDetails
        };
        
        const stressIndex = 
            stressFactors.muscularTension * 0.4 +
            stressFactors.blinkAbnormality * 0.2 +
            stressFactors.microExpressions * 0.2 +
            stressFactors.asymmetry * 0.2;
        
        return Math.min(1, stressIndex);
    }
    
    calculateFatigueIndex(metrics) {
        // 疲労度指標
        const fatigueFactors = {
            eyeStrain: metrics.eyeTension * 0.3,
            blinkIrregularity: this.calculateBlinkIrregularity(),
            muscularFatigue: this.calculateMuscularFatigue(),
            droopiness: this.calculateFacialDroopiness(metrics)
        };
        
        return (
            fatigueFactors.eyeStrain +
            fatigueFactors.blinkIrregularity * 0.2 +
            fatigueFactors.muscularFatigue * 0.3 +
            fatigueFactors.droopiness * 0.2
        );
    }
    
    calculateBlinkIrregularity() {
        if (!this.blinkTimings) {
            this.blinkTimings = [];
        }
        
        if (this.blinkTimings.length < 5) return 0;
        
        // 瞬き間隔の標準偏差を計算
        const intervals = [];
        for (let i = 1; i < this.blinkTimings.length; i++) {
            intervals.push(this.blinkTimings[i] - this.blinkTimings[i - 1]);
        }
        
        const mean = intervals.reduce((a, b) => a + b) / intervals.length;
        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        
        return this.normalizeValue(stdDev, 0, 2000);
    }
    
    calculateMuscularFatigue() {
        // 時系列データから筋疲労を推定
        if (this.timeSeriesData.timestamps.length < 30) return 0;
        
        const recentData = this.timeSeriesData.foreheadTension.slice(-30);
        const trend = this.calculateTrend(recentData);
        
        return this.normalizeValue(trend, -0.01, 0.01);
    }
    
    calculateTrend(data) {
        if (data.length < 2) return 0;
        
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        const n = data.length;
        
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += data[i];
            sumXY += i * data[i];
            sumX2 += i * i;
        }
        
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }
    
    calculateEnhancedAutonomicState(metrics) {
        // 時系列分析を含む高度な自律神経状態計算
        const instantState = this.calculateInstantAutonomicState(metrics);
        const trendState = this.calculateTrendAutonomicState();
        const variabilityState = this.calculateVariabilityState();
        
        // 重み付け平均
        const sympathetic = 
            instantState.sympathetic * 0.5 +
            trendState.sympathetic * 0.3 +
            variabilityState.sympathetic * 0.2;
        
        const parasympathetic = 
            instantState.parasympathetic * 0.5 +
            trendState.parasympathetic * 0.3 +
            variabilityState.parasympathetic * 0.2;
        
        // 詳細な診断生成
        const diagnosis = this.generateEnhancedDiagnosis({
            sympathetic,
            parasympathetic,
            metrics,
            trends: trendState,
            variability: variabilityState
        });
        
        return {
            sympathetic: Math.round(sympathetic),
            parasympathetic: Math.round(parasympathetic),
            diagnosis,
            detailedMetrics: {
                stress: metrics.stressIndex,
                fatigue: metrics.fatigueIndex,
                emotionalValence: metrics.emotionalValence,
                arousal: metrics.arousalLevel
            },
            recommendations: this.generateRecommendations(sympathetic, parasympathetic, metrics)
        };
    }
    
    calculateInstantAutonomicState(metrics) {
        // 瞬時の自律神経状態
        const sympatheticFactors = {
            muscularTension: (
                metrics.foreheadTension * 0.2 +
                metrics.eyebrowTension * 0.15 +
                metrics.eyeTension * 0.2 +
                metrics.jawTension * 0.25 +
                metrics.mouthTension * 0.1 +
                metrics.cheekTension * 0.1
            ),
            arousal: metrics.arousalLevel * 0.3,
            stress: metrics.stressIndex * 0.4,
            blinkRate: this.normalizeValue(metrics.blinkFrequency, 10, 30) * 0.3
        };
        
        const parasympatheticFactors = {
            relaxation: (1 - sympatheticFactors.muscularTension) * 0.5,
            regularBreathing: metrics.breathingPattern * 0.2,
            emotionalBalance: (1 - Math.abs(metrics.emotionalValence - 0.5)) * 0.3
        };
        
        const totalSympathetic = Object.values(sympatheticFactors).reduce((a, b) => a + b, 0);
        const totalParasympathetic = Object.values(parasympatheticFactors).reduce((a, b) => a + b, 0);
        
        const total = totalSympathetic + totalParasympathetic;
        
        return {
            sympathetic: (totalSympathetic / total) * 100,
            parasympathetic: (totalParasympathetic / total) * 100
        };
    }
    
    calculateTrendAutonomicState() {
        // トレンドベースの分析
        if (this.timeSeriesData.timestamps.length < 30) {
            return { sympathetic: 50, parasympathetic: 50 };
        }
        
        const tensionTrend = this.calculateTrend(this.timeSeriesData.foreheadTension.slice(-30));
        const blinkTrend = this.calculateTrend(this.timeSeriesData.blinkRate.slice(-30));
        
        const increasingTension = tensionTrend > 0;
        const irregularBlinking = Math.abs(blinkTrend) > 0.1;
        
        const sympatheticTrend = (increasingTension ? 60 : 40) + (irregularBlinking ? 10 : -10);
        const parasympatheticTrend = 100 - sympatheticTrend;
        
        return {
            sympathetic: sympatheticTrend,
            parasympathetic: parasympatheticTrend
        };
    }
    
    calculateVariabilityState() {
        // 変動性分析（HRVのような概念）
        if (this.timeSeriesData.timestamps.length < 60) {
            return { sympathetic: 50, parasympathetic: 50 };
        }
        
        const recentData = this.timeSeriesData.foreheadTension.slice(-60);
        const variance = this.calculateVariance(recentData);
        
        // 高い変動性は副交感神経優位を示唆
        const highVariability = variance > 0.02;
        
        return {
            sympathetic: highVariability ? 40 : 60,
            parasympathetic: highVariability ? 60 : 40
        };
    }
    
    calculateVariance(data) {
        const mean = data.reduce((a, b) => a + b) / data.length;
        const squaredDiffs = data.map(value => Math.pow(value - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b) / data.length;
    }
    
    generateEnhancedDiagnosis(state) {
        const { sympathetic, parasympathetic, metrics, trends, variability } = state;
        
        let diagnosis = "";
        
        // 主要な診断
        if (sympathetic > 70) {
            diagnosis += "高い交感神経優位状態が検出されました。";
            if (metrics.stressIndex > 0.7) {
                diagnosis += "強いストレス反応が見られます。";
            }
            if (metrics.fatigueIndex > 0.6) {
                diagnosis += "疲労の蓄積も確認されています。";
            }
        } else if (parasympathetic > 70) {
            diagnosis += "副交感神経が優位な状態です。";
            if (metrics.fatigueIndex > 0.7) {
                diagnosis += "深い疲労状態の可能性があります。";
            } else {
                diagnosis += "良好なリラックス状態です。";
            }
        } else {
            diagnosis += "自律神経のバランスは比較的良好です。";
        }
        
        // トレンド分析
        if (trends.sympathetic > 60) {
            diagnosis += "\n緊張が高まる傾向にあります。";
        } else if (trends.parasympathetic > 60) {
            diagnosis += "\nリラックス傾向が見られます。";
        }
        
        // 変動性分析
        if (variability.parasympathetic > 60) {
            diagnosis += "\n自律神経の柔軟性は良好です。";
        } else {
            diagnosis += "\n自律神経の反応が硬直化している可能性があります。";
        }
        
        return diagnosis;
    }
    
    generateRecommendations(sympathetic, parasympathetic, metrics) {
        const recommendations = [];
        
        if (sympathetic > 65) {
            recommendations.push("深呼吸：4-7-8呼吸法（4秒吸って、7秒止めて、8秒吐く）");
            recommendations.push("プログレッシブ筋弛緩法：各筋群を順番に緊張させてから弛緩");
            
            if (metrics.eyeTension > 0.7) {
                recommendations.push("20-20-20ルール：20分ごとに20フィート先を20秒見る");
            }
            
            if (metrics.jawTension > 0.7) {
                recommendations.push("顎のマッサージ：側頭筋と咬筋を円を描くようにマッサージ");
            }
        }
        
        if (parasympathetic > 65 && metrics.fatigueIndex < 0.5) {
            recommendations.push("軽い運動：散歩やストレッチで適度な刺激を");
            recommendations.push("冷水での洗顔：交感神経を適度に刺激");
        }
        
        if (metrics.stressIndex > 0.6) {
            recommendations.push("マインドフルネス瞑想：今この瞬間に意識を向ける");
            recommendations.push("アロマテラピー：ラベンダーやベルガモットの香り");
        }
        
        return recommendations;
    }
    
    collectTimeSeriesData(metrics) {
        const timestamp = Date.now();
        
        this.timeSeriesData.timestamps.push(timestamp);
        this.timeSeriesData.foreheadTension.push(metrics.foreheadTension);
        this.timeSeriesData.eyebrowTension.push(metrics.eyebrowTension);
        this.timeSeriesData.eyeTension.push(metrics.eyeTension);
        this.timeSeriesData.cheekTension.push(metrics.cheekTension);
        this.timeSeriesData.mouthTension.push(metrics.mouthTension);
        this.timeSeriesData.jawTension.push(metrics.jawTension);
        this.timeSeriesData.blinkRate.push(metrics.blinkFrequency);
        
        // データサイズ制限（最新5分間）
        const fiveMinutesAgo = timestamp - 300000;
        const validIndices = this.timeSeriesData.timestamps.findIndex(
            t => t > fiveMinutesAgo
        );
        
        if (validIndices > 0) {
            for (const key in this.timeSeriesData) {
                this.timeSeriesData[key] = this.timeSeriesData[key].slice(validIndices);
            }
        }
    }
    
    collectCalibrationData(metrics) {
        this.calibrationData.calibrationFrames++;
        
        this.calibrationData.baseline.forehead.push(metrics.foreheadTension);
        this.calibrationData.baseline.eyebrow.push(metrics.eyebrowTension);
        this.calibrationData.baseline.eye.push(metrics.eyeTension);
        this.calibrationData.baseline.cheek.push(metrics.cheekTension);
        this.calibrationData.baseline.mouth.push(metrics.mouthTension);
        this.calibrationData.baseline.jaw.push(metrics.jawTension);
    }
    
    updateEnhancedUI(state) {
        // 基本的な表示更新
        document.getElementById('sympathetic-bar').style.width = `${state.sympathetic}%`;
        document.getElementById('sympathetic-value').textContent = `${state.sympathetic}%`;
        
        document.getElementById('parasympathetic-bar').style.width = `${state.parasympathetic}%`;
        document.getElementById('parasympathetic-value').textContent = `${state.parasympathetic}%`;
        
        document.getElementById('diagnosis-content').textContent = state.diagnosis;
        
        // 詳細メトリクスの表示（新規追加部分）
        this.updateDetailedMetrics(state.detailedMetrics);
        this.updateRecommendations(state.recommendations);
    }
    
    updateDetailedMetrics(metrics) {
        let detailsDiv = document.getElementById('detailed-metrics');
        if (!detailsDiv) {
            detailsDiv = document.createElement('div');
            detailsDiv.id = 'detailed-metrics';
            detailsDiv.className = 'detailed-metrics';
            document.getElementById('results').appendChild(detailsDiv);
        }
        
        detailsDiv.innerHTML = `
            <h3>詳細分析</h3>
            <div class="metric-item">
                <label>ストレス指数:</label>
                <div class="mini-progress">
                    <div class="mini-fill stress" style="width: ${metrics.stress * 100}%"></div>
                </div>
                <span>${Math.round(metrics.stress * 100)}%</span>
            </div>
            <div class="metric-item">
                <label>疲労度:</label>
                <div class="mini-progress">
                    <div class="mini-fill fatigue" style="width: ${metrics.fatigue * 100}%"></div>
                </div>
                <span>${Math.round(metrics.fatigue * 100)}%</span>
            </div>
            <div class="metric-item">
                <label>感情価:</label>
                <div class="mini-progress">
                    <div class="mini-fill emotion" style="width: ${metrics.emotionalValence * 100}%"></div>
                </div>
                <span>${metrics.emotionalValence > 0.5 ? 'ポジティブ' : 'ネガティブ'}</span>
            </div>
            <div class="metric-item">
                <label>覚醒度:</label>
                <div class="mini-progress">
                    <div class="mini-fill arousal" style="width: ${metrics.arousal * 100}%"></div>
                </div>
                <span>${Math.round(metrics.arousal * 100)}%</span>
            </div>
        `;
    }
    
    updateRecommendations(recommendations) {
        let recomDiv = document.getElementById('recommendations');
        if (!recomDiv) {
            recomDiv = document.createElement('div');
            recomDiv.id = 'recommendations';
            recomDiv.className = 'recommendations';
            document.getElementById('results').appendChild(recomDiv);
        }
        
        if (recommendations.length > 0) {
            recomDiv.innerHTML = `
                <h3>推奨アクション</h3>
                <ul>
                    ${recommendations.map(r => `<li>${r}</li>`).join('')}
                </ul>
            `;
        }
    }
    
    generateDetailedReport() {
        // 分析レポートの生成（コンソールに出力のみ）
        const report = {
            timestamp: new Date().toISOString(),
            sessionDuration: this.timeSeriesData.timestamps.length > 0 ? 
                (Date.now() - this.timeSeriesData.timestamps[0]) / 1000 : 0,
            averageMetrics: this.calculateAverageMetrics(),
            trends: this.analyzeTrends(),
            patterns: this.identifyPatterns(),
            summary: this.generateSummary()
        };
        
        console.log('詳細分析レポート:', report);
        
        // ブラウザに要約を表示
        this.displaySummaryInBrowser(report);
    }
    
    calculateAverageMetrics() {
        const metrics = {};
        const dataKeys = ['foreheadTension', 'eyebrowTension', 'eyeTension', 
                         'cheekTension', 'mouthTension', 'jawTension'];
        
        dataKeys.forEach(key => {
            const data = this.timeSeriesData[key];
            if (data.length > 0) {
                metrics[key] = {
                    average: data.reduce((a, b) => a + b) / data.length,
                    min: Math.min(...data),
                    max: Math.max(...data),
                    stdDev: this.calculateStandardDeviation(data)
                };
            }
        });
        
        return metrics;
    }
    
    calculateStandardDeviation(data) {
        const mean = data.reduce((a, b) => a + b) / data.length;
        const squaredDiffs = data.map(value => Math.pow(value - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b) / data.length;
        return Math.sqrt(avgSquaredDiff);
    }
    
    analyzeTrends() {
        const trends = {};
        const dataKeys = ['foreheadTension', 'eyebrowTension', 'eyeTension', 
                         'cheekTension', 'mouthTension', 'jawTension'];
        
        dataKeys.forEach(key => {
            const data = this.timeSeriesData[key];
            if (data.length > 10) {
                trends[key] = {
                    direction: this.calculateTrend(data) > 0 ? 'increasing' : 'decreasing',
                    strength: Math.abs(this.calculateTrend(data))
                };
            }
        });
        
        return trends;
    }
    
    identifyPatterns() {
        // パターン認識（簡略版）
        return {
            stressPeaks: this.findPeaks(this.timeSeriesData.foreheadTension),
            relaxationPeriods: this.findValleys(this.timeSeriesData.jawTension),
            cyclicPatterns: this.detectCycles()
        };
    }
    
    findPeaks(data) {
        const peaks = [];
        for (let i = 1; i < data.length - 1; i++) {
            if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > 0.7) {
                peaks.push({
                    index: i,
                    value: data[i],
                    timestamp: this.timeSeriesData.timestamps[i]
                });
            }
        }
        return peaks;
    }
    
    findValleys(data) {
        const valleys = [];
        for (let i = 1; i < data.length - 1; i++) {
            if (data[i] < data[i - 1] && data[i] < data[i + 1] && data[i] < 0.3) {
                valleys.push({
                    index: i,
                    value: data[i],
                    timestamp: this.timeSeriesData.timestamps[i]
                });
            }
        }
        return valleys;
    }
    
    detectCycles() {
        // 簡単な周期性検出
        if (this.timeSeriesData.foreheadTension.length < 60) return null;
        
        const data = this.timeSeriesData.foreheadTension;
        const autocorrelation = [];
        
        for (let lag = 1; lag < Math.min(30, data.length / 2); lag++) {
            let sum = 0;
            for (let i = 0; i < data.length - lag; i++) {
                sum += data[i] * data[i + lag];
            }
            autocorrelation.push({ lag, correlation: sum / (data.length - lag) });
        }
        
        return autocorrelation;
    }
    
    generateSummary() {
        const avgMetrics = this.calculateAverageMetrics();
        let summary = "分析セッションの要約:\n\n";
        
        // 全体的な緊張レベル
        const overallTension = Object.values(avgMetrics)
            .reduce((sum, metric) => sum + (metric?.average || 0), 0) / 
            Object.keys(avgMetrics).length;
        
        if (overallTension > 0.6) {
            summary += "全体的に高い筋緊張が観察されました。";
        } else if (overallTension < 0.3) {
            summary += "リラックスした状態が維持されていました。";
        } else {
            summary += "中程度の緊張レベルで推移しました。";
        }
        
        // 最も緊張した部位
        let maxTension = 0;
        let maxTensionArea = "";
        
        for (const [area, metrics] of Object.entries(avgMetrics)) {
            if (metrics?.average > maxTension) {
                maxTension = metrics.average;
                maxTensionArea = area;
            }
        }
        
        const areaNames = {
            foreheadTension: "前頭部",
            eyebrowTension: "眉間",
            eyeTension: "眼周囲",
            cheekTension: "頬",
            mouthTension: "口周り",
            jawTension: "顎"
        };
        
        summary += `\n最も緊張が見られた部位: ${areaNames[maxTensionArea] || maxTensionArea}`;
        
        return summary;
    }
    
    displaySummaryInBrowser(report) {
        // 分析要約をブラウザに表示
        let summaryDiv = document.getElementById('analysis-summary');
        if (!summaryDiv) {
            summaryDiv = document.createElement('div');
            summaryDiv.id = 'analysis-summary';
            summaryDiv.className = 'analysis-summary';
            document.getElementById('results').appendChild(summaryDiv);
        }
        
        const duration = Math.round(report.sessionDuration);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        summaryDiv.innerHTML = `
            <h3>分析セッションの要約</h3>
            <div class="summary-content">
                <p><strong>分析時間:</strong> ${minutes}分${seconds}秒</p>
                <div class="summary-text">${report.summary}</div>
            </div>
        `;
    }
    
    // 基本的なヘルパーメソッド
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
    
    calculateMuscleContraction(landmarks, musclePoints) {
        let totalContraction = 0;
        
        for (let i = 0; i < musclePoints.length - 1; i++) {
            const dist = this.calculateDistance(
                landmarks[musclePoints[i]], 
                landmarks[musclePoints[i + 1]]
            );
            totalContraction += dist;
        }
        
        return this.normalizeValue(totalContraction, 0.1, 0.5);
    }
    
    calculateDetailedCheekTension(landmarks) {
        const zygomaticusPoints = this.detailedMuscleGroups.zygomaticus;
        
        // 頬骨筋の収縮度
        const contraction = this.calculateMuscleContraction(landmarks, zygomaticusPoints);
        
        // 頬の膨らみ（面積）
        const volume = this.calculateAreaVolume(landmarks, zygomaticusPoints);
        
        return contraction * 0.6 + this.normalizeValue(volume, 0.01, 0.05) * 0.4;
    }
    
    calculateDetailedMouthTension(landmarks) {
        const orbicularisOrisPoints = this.detailedMuscleGroups.orbicularisOris;
        
        // 口輪筋の緊張
        const contraction = this.calculateMuscleContraction(landmarks, orbicularisOrisPoints);
        
        // 口角の位置
        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];
        const mouthCenter = landmarks[13];
        
        const cornerHeight = (leftCorner.y + rightCorner.y) / 2 - mouthCenter.y;
        const isSmiling = cornerHeight < 0;
        
        return isSmiling ? contraction * 0.5 : contraction;
    }
    
    calculateDetailedJawTension(landmarks) {
        const masseterPoints = this.detailedMuscleGroups.masseter;
        const temporalisPoints = this.detailedMuscleGroups.temporalis;
        
        // 咬筋の緊張
        const masseterTension = this.calculateMuscleContraction(landmarks, masseterPoints);
        
        // 側頭筋の緊張
        const temporalisTension = this.calculateMuscleContraction(landmarks, temporalisPoints);
        
        // 顎の開き具合
        const jawOpening = this.calculateDistance(landmarks[13], landmarks[14]);
        
        return (
            masseterTension * 0.4 + 
            temporalisTension * 0.4 + 
            (1 - this.normalizeValue(jawOpening, 0.01, 0.1)) * 0.2
        );
    }
    
    calculateDetailedAsymmetry(landmarks) {
        const leftPoints = [33, 35, 31, 228, 230, 234, 61, 84, 172, 136];
        const rightPoints = [362, 261, 340, 346, 348, 452, 291, 314, 397, 361];
        
        let totalAsymmetry = 0;
        
        for (let i = 0; i < leftPoints.length; i++) {
            const left = landmarks[leftPoints[i]];
            const right = landmarks[rightPoints[i]];
            
            const leftDist = Math.abs(left.x - 0.5);
            const rightDist = Math.abs(0.5 - right.x);
            
            totalAsymmetry += Math.abs(leftDist - rightDist);
        }
        
        return this.normalizeValue(totalAsymmetry, 0, 0.5);
    }
    
    estimateBreathingPattern(landmarks) {
        // 鼻の動きから呼吸パターンを推定
        const noseTip = landmarks[1];
        const noseBase = landmarks[5];
        
        if (!this.breathingBuffer) {
            this.breathingBuffer = [];
        }
        
        const noseMovement = this.calculateDistance(noseTip, noseBase);
        this.breathingBuffer.push(noseMovement);
        
        if (this.breathingBuffer.length > 60) {
            this.breathingBuffer.shift();
        }
        
        if (this.breathingBuffer.length < 10) return 0.5;
        
        // 呼吸の規則性を計算
        const variance = this.calculateVariance(this.breathingBuffer);
        return 1 - this.normalizeValue(variance, 0, 0.001);
    }
    
    calculateSkinTension(landmarks) {
        // 皮膚の張りを推定（複数の特徴点間の距離から）
        const skinPoints = [
            [10, 151], [151, 337], [337, 299],
            [35, 31], [31, 228], [228, 229],
            [261, 340], [340, 346], [346, 347]
        ];
        
        let totalTension = 0;
        
        for (const [p1, p2] of skinPoints) {
            const distance = this.calculateDistance(landmarks[p1], landmarks[p2]);
            totalTension += distance;
        }
        
        return this.normalizeValue(totalTension, 0.5, 2.0);
    }
    
    analyzeEyeMovements(landmarks) {
        // 眼球運動パターンの分析
        const leftPupil = landmarks[468];
        const rightPupil = landmarks[473];
        
        if (!this.eyeMovementBuffer) {
            this.eyeMovementBuffer = [];
        }
        
        this.eyeMovementBuffer.push({
            left: { x: leftPupil.x, y: leftPupil.y },
            right: { x: rightPupil.x, y: rightPupil.y }
        });
        
        if (this.eyeMovementBuffer.length > 30) {
            this.eyeMovementBuffer.shift();
        }
        
        if (this.eyeMovementBuffer.length < 5) return 0;
        
        // サッケード（急速眼球運動）の検出
        let saccades = 0;
        for (let i = 1; i < this.eyeMovementBuffer.length; i++) {
            const prev = this.eyeMovementBuffer[i - 1];
            const curr = this.eyeMovementBuffer[i];
            
            const leftMovement = Math.sqrt(
                Math.pow(curr.left.x - prev.left.x, 2) + 
                Math.pow(curr.left.y - prev.left.y, 2)
            );
            
            if (leftMovement > 0.01) saccades++;
        }
        
        return this.normalizeValue(saccades, 0, 10);
    }
    
    calculateEmotionalValence(metrics) {
        // 感情価の推定（ポジティブ/ネガティブ）
        const positiveFactors = {
            relaxedMouth: 1 - metrics.mouthTension,
            openEyes: 1 - metrics.eyeTension,
            smoothForehead: 1 - metrics.foreheadTension
        };
        
        const negativeFactors = {
            tenseBrows: metrics.eyebrowTension,
            tightJaw: metrics.jawTension,
            asymmetry: metrics.asymmetryDetails
        };
        
        const positive = Object.values(positiveFactors).reduce((a, b) => a + b) / 3;
        const negative = Object.values(negativeFactors).reduce((a, b) => a + b) / 3;
        
        return (positive - negative + 1) / 2; // 0-1の範囲に正規化
    }
    
    calculateArousalLevel(metrics) {
        // 覚醒度の推定
        const arousalFactors = {
            eyeOpenness: 1 - metrics.eyeTension,
            blinkRate: this.normalizeValue(metrics.blinkFrequency, 5, 30),
            microExpressions: metrics.facialMicroExpressions,
            muscularActivity: (
                metrics.foreheadTension + 
                metrics.eyebrowTension + 
                metrics.jawTension
            ) / 3
        };
        
        return (
            arousalFactors.eyeOpenness * 0.3 +
            arousalFactors.blinkRate * 0.2 +
            arousalFactors.microExpressions * 0.2 +
            arousalFactors.muscularActivity * 0.3
        );
    }
    
    calculateFacialDroopiness(metrics) {
        // 顔面の下垂度（疲労の指標）
        return (
            metrics.eyeTension * 0.4 +
            metrics.mouthTension * 0.3 +
            (1 - metrics.cheekTension) * 0.3
        );
    }
    
    calculateAreaVolume(landmarks, points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            const p1 = landmarks[points[i]];
            const p2 = landmarks[points[j]];
            area += p1.x * p2.y - p2.x * p1.y;
        }
        return Math.abs(area) / 2;
    }
}

// CSSの追加スタイル
const enhancedStyles = `
.btn-info {
    background-color: #17a2b8;
    color: white;
}

.btn-info:hover {
    background-color: #138496;
}

.detailed-metrics {
    margin-top: 30px;
    padding: 20px;
    background-color: #f8f9fa;
    border-radius: 8px;
}

.metric-item {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
    gap: 15px;
}

.metric-item label {
    min-width: 120px;
    font-weight: bold;
}

.mini-progress {
    flex: 1;
    height: 15px;
    background-color: #e9ecef;
    border-radius: 8px;
    overflow: hidden;
}

.mini-fill {
    height: 100%;
    transition: width 0.3s ease;
}

.mini-fill.stress {
    background-color: #dc3545;
}

.mini-fill.fatigue {
    background-color: #fd7e14;
}

.mini-fill.emotion {
    background-color: #20c997;
}

.mini-fill.arousal {
    background-color: #6f42c1;
}

.recommendations {
    margin-top: 30px;
    padding: 20px;
    background-color: #e7f3ff;
    border-radius: 8px;
    border: 1px solid #b8daff;
}

.recommendations h3 {
    color: #004085;
    margin-bottom: 15px;
}

.recommendations ul {
    list-style-type: none;
    padding-left: 0;
}

.recommendations li {
    padding: 8px 0;
    padding-left: 25px;
    position: relative;
}

.recommendations li:before {
    content: "✓";
    position: absolute;
    left: 0;
    color: #28a745;
    font-weight: bold;
}
`;

// スタイルを追加
const styleElement = document.createElement('style');
styleElement.textContent = enhancedStyles;
document.head.appendChild(styleElement);

// 初期化を変更
document.addEventListener('DOMContentLoaded', () => {
    new EnhancedAutonomicAnalyzer();
});