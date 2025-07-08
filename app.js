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
        
        this.muscleStates = {
            forehead: [],
            eyebrows: [],
            eyes: [],
            cheeks: [],
            mouth: [],
            jaw: []
        };
        
        this.setupEventListeners();
        this.initializeFaceMesh();
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startAnalysis());
        this.stopBtn.addEventListener('click', () => this.stopAnalysis());
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
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.faceMesh.onResults((results) => this.onFaceMeshResults(results));
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
    }
    
    onFaceMeshResults(results) {
        const ctx = this.overlay.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        
        this.overlay.width = this.video.videoWidth;
        this.overlay.height = this.video.videoHeight;
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            const landmarks = results.multiFaceLandmarks[0];
            
            this.drawFaceMesh(ctx, landmarks);
            
            const muscleMetrics = this.analyzeMuscleStates(landmarks);
            
            const autonomicState = this.calculateAutonomicState(muscleMetrics);
            
            this.updateUI(autonomicState);
        }
        
        ctx.restore();
    }
    
    drawFaceMesh(ctx, landmarks) {
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 1;
        
        const connections = FACEMESH_TESSELATION;
        for (const connection of connections) {
            const start = landmarks[connection[0]];
            const end = landmarks[connection[1]];
            
            ctx.beginPath();
            ctx.moveTo(start.x * this.overlay.width, start.y * this.overlay.height);
            ctx.lineTo(end.x * this.overlay.width, end.y * this.overlay.height);
            ctx.stroke();
        }
        
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
            microMovements: this.detectMicroMovements(landmarks)
        };
        
        return metrics;
    }
    
    calculateForeheadTension(landmarks) {
        const foreheadPoints = [9, 10, 151, 337, 299, 333, 298, 301, 368, 264, 447, 366, 401, 435, 410, 415, 394];
        let totalDistance = 0;
        
        for (let i = 0; i < foreheadPoints.length - 1; i++) {
            const p1 = landmarks[foreheadPoints[i]];
            const p2 = landmarks[foreheadPoints[i + 1]];
            totalDistance += this.calculateDistance(p1, p2);
        }
        
        return this.normalizeValue(totalDistance, 0.5, 2.0);
    }
    
    calculateEyebrowTension(landmarks) {
        const leftEyebrow = [46, 53, 52, 65, 55];
        const rightEyebrow = [276, 283, 282, 295, 285];
        
        const leftHeight = this.calculateAverageHeight(landmarks, leftEyebrow);
        const rightHeight = this.calculateAverageHeight(landmarks, rightEyebrow);
        
        const eyeCenter = landmarks[468] || landmarks[473];
        const avgHeight = (leftHeight + rightHeight) / 2;
        const relativeHeight = avgHeight - eyeCenter.y;
        
        return this.normalizeValue(relativeHeight, -0.1, 0.1);
    }
    
    calculateEyeTension(landmarks) {
        const leftEye = [33, 7, 163, 144, 145, 153, 154, 155, 133];
        const rightEye = [362, 398, 384, 385, 386, 387, 388, 466, 263];
        
        const leftOpenness = this.calculateEyeOpenness(landmarks, leftEye);
        const rightOpenness = this.calculateEyeOpenness(landmarks, rightEye);
        
        return 1 - ((leftOpenness + rightOpenness) / 2);
    }
    
    calculateCheekTension(landmarks) {
        const leftCheek = [35, 31, 228, 229, 230, 231, 232, 233, 234];
        const rightCheek = [261, 340, 346, 347, 348, 349, 350, 451, 452];
        
        const leftVolume = this.calculateAreaVolume(landmarks, leftCheek);
        const rightVolume = this.calculateAreaVolume(landmarks, rightCheek);
        
        return this.normalizeValue((leftVolume + rightVolume) / 2, 0.01, 0.05);
    }
    
    calculateMouthTension(landmarks) {
        const upperLip = [61, 84, 17, 314, 405, 308, 324, 318];
        const lowerLip = [78, 95, 88, 178, 87, 14, 317, 402];
        
        const mouthWidth = this.calculateDistance(landmarks[61], landmarks[291]);
        const mouthHeight = this.calculateDistance(landmarks[13], landmarks[14]);
        
        const ratio = mouthHeight / mouthWidth;
        
        return this.normalizeValue(ratio, 0.05, 0.4);
    }
    
    calculateJawTension(landmarks) {
        const jawLine = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 397, 288, 361, 323];
        
        let variability = 0;
        for (let i = 0; i < jawLine.length - 2; i++) {
            const angle = this.calculateAngle(
                landmarks[jawLine[i]],
                landmarks[jawLine[i + 1]],
                landmarks[jawLine[i + 2]]
            );
            variability += Math.abs(angle - Math.PI);
        }
        
        return this.normalizeValue(variability, 0, Math.PI * jawLine.length);
    }
    
    calculateFacialAsymmetry(landmarks) {
        const leftSide = [33, 35, 31, 228, 230, 234];
        const rightSide = [362, 261, 340, 346, 348, 452];
        
        let asymmetry = 0;
        for (let i = 0; i < leftSide.length; i++) {
            const leftPoint = landmarks[leftSide[i]];
            const rightPoint = landmarks[rightSide[i]];
            const centerX = 0.5;
            
            const leftDist = Math.abs(leftPoint.x - centerX);
            const rightDist = Math.abs(rightPoint.x - centerX);
            asymmetry += Math.abs(leftDist - rightDist);
        }
        
        return this.normalizeValue(asymmetry, 0, 0.5);
    }
    
    detectMicroMovements(landmarks) {
        this.muscleStates.forehead.push(landmarks[9]);
        if (this.muscleStates.forehead.length > 30) {
            this.muscleStates.forehead.shift();
        }
        
        if (this.muscleStates.forehead.length < 5) return 0;
        
        let movement = 0;
        for (let i = 1; i < this.muscleStates.forehead.length; i++) {
            const prev = this.muscleStates.forehead[i - 1];
            const curr = this.muscleStates.forehead[i];
            movement += this.calculateDistance(prev, curr);
        }
        
        return this.normalizeValue(movement, 0, 0.01);
    }
    
    calculateAutonomicState(metrics) {
        const sympatheticIndicators = 
            metrics.foreheadTension * 0.25 +
            metrics.eyebrowTension * 0.15 +
            metrics.eyeTension * 0.20 +
            metrics.jawTension * 0.20 +
            metrics.asymmetry * 0.10 +
            metrics.microMovements * 0.10;
        
        const parasympatheticIndicators = 
            (1 - metrics.foreheadTension) * 0.20 +
            (1 - metrics.eyeTension) * 0.25 +
            (1 - metrics.jawTension) * 0.25 +
            (1 - metrics.cheekTension) * 0.15 +
            (1 - metrics.mouthTension) * 0.15;
        
        const total = sympatheticIndicators + parasympatheticIndicators;
        const sympatheticRatio = (sympatheticIndicators / total) * 100;
        const parasympatheticRatio = (parasympatheticIndicators / total) * 100;
        
        let diagnosis = "";
        if (sympatheticRatio > 65) {
            diagnosis = "交感神経が優位な状態です。ストレスや緊張が高まっている可能性があります。深呼吸やリラックス法を試してみてください。";
        } else if (parasympatheticRatio > 65) {
            diagnosis = "副交感神経が優位な状態です。リラックスしている良い状態ですが、活動には適度な緊張感も必要です。";
        } else {
            diagnosis = "交感神経と副交感神経のバランスが取れた良い状態です。この状態を維持することで健康的な自律神経の働きが期待できます。";
        }
        
        return {
            sympathetic: Math.round(sympatheticRatio),
            parasympathetic: Math.round(parasympatheticRatio),
            diagnosis: diagnosis,
            rawMetrics: metrics
        };
    }
    
    updateUI(state) {
        document.getElementById('sympathetic-bar').style.width = `${state.sympathetic}%`;
        document.getElementById('sympathetic-value').textContent = `${state.sympathetic}%`;
        
        document.getElementById('parasympathetic-bar').style.width = `${state.parasympathetic}%`;
        document.getElementById('parasympathetic-value').textContent = `${state.parasympathetic}%`;
        
        document.getElementById('diagnosis-content').textContent = state.diagnosis;
    }
    
    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = (p1.z || 0) - (p2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    calculateAverageHeight(landmarks, points) {
        let totalHeight = 0;
        for (const point of points) {
            totalHeight += landmarks[point].y;
        }
        return totalHeight / points.length;
    }
    
    calculateEyeOpenness(landmarks, eyePoints) {
        const top = landmarks[eyePoints[1]];
        const bottom = landmarks[eyePoints[5]];
        return this.calculateDistance(top, bottom);
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

document.addEventListener('DOMContentLoaded', () => {
    new AutonomicNervousSystemAnalyzer();
});