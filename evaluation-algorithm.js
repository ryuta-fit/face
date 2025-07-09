// 自律神経評価アルゴリズム
// このファイルは評価ロジックのみを含み、UIやカメラ処理は含まない

class AutonomicEvaluationAlgorithm {
    constructor() {
        // 各指標の重み付け設定
        this.weights = {
            sympathetic: {
                foreheadTension: 0.15,    // 前頭部の緊張
                eyebrowTension: 0.40,     // 眉間の緊張（最重要）
                eyeTension: 0.20,         // 目の緊張
                jawTension: 0.10,         // 顎の緊張
                asymmetry: 0.10,          // 顔の非対称性
                highBlinkRate: 0.05       // 瞬き率の異常
            },
            parasympathetic: {
                relaxedForehead: 0.20,    // 前頭部のリラックス
                relaxedEyes: 0.25,        // 目のリラックス
                relaxedJaw: 0.25,         // 顎のリラックス
                relaxedCheeks: 0.15,      // 頬のリラックス
                normalBlinkRate: 0.15     // 正常な瞬き率
            }
        };

        // 正規化パラメータ
        this.normalizationParams = {
            forehead: { min: 0.3, max: 0.7 },
            eyebrow: { min: 0.3, max: 0.7 },
            eye: { min: 0, max: 1 },
            cheek: { min: 0.3, max: 0.7 },
            mouth: { min: 0, max: 1 },
            jaw: { min: 0, max: 1 },
            asymmetry: { min: 0, max: 1 },
            blinkRate: { min: 10, max: 25 }  // 1分あたりの瞬き回数
        };

        // 閾値設定
        this.thresholds = {
            sympatheticDominant: 65,      // 交感神経優位の閾値
            parasympatheticDominant: 65,  // 副交感神経優位の閾値
            highEyeTension: 0.7,          // 目の緊張が高い
            highJawTension: 0.7,          // 顎の緊張が高い
            lowConfidence: 0.3,           // 信頼度が低い
            mediumConfidence: 0.7         // 信頼度が中程度
        };
    }

    /**
     * 顔面筋の状態から自律神経状態を評価
     * @param {Object} muscleMetrics - 各筋肉の緊張度メトリクス
     * @returns {Object} 評価結果
     */
    evaluateAutonomicState(muscleMetrics) {
        // 交感神経スコアの計算
        const sympatheticScore = this.calculateSympathetic(muscleMetrics);
        
        // 副交感神経スコアの計算
        const parasympatheticScore = this.calculateParasympathetic(muscleMetrics);
        
        // スコアの正規化（合計100%になるように）
        const total = sympatheticScore + parasympatheticScore;
        const sympatheticRatio = total > 0 ? (sympatheticScore / total) * 100 : 50;
        const parasympatheticRatio = total > 0 ? (parasympatheticScore / total) * 100 : 50;
        
        // 信頼度の計算
        const confidence = this.calculateConfidence(muscleMetrics);
        
        // 診断メッセージの生成
        const diagnosis = this.generateDiagnosis(
            sympatheticRatio, 
            parasympatheticRatio, 
            muscleMetrics, 
            confidence
        );
        
        return {
            sympathetic: Math.round(sympatheticRatio),
            parasympathetic: Math.round(parasympatheticRatio),
            diagnosis: diagnosis,
            confidence: confidence,
            rawMetrics: muscleMetrics,
            dominantSystem: this.determineDominantSystem(sympatheticRatio, parasympatheticRatio)
        };
    }

    /**
     * 交感神経スコアの計算
     */
    calculateSympathetic(metrics) {
        const weights = this.weights.sympathetic;
        
        return (
            metrics.foreheadTension * weights.foreheadTension +
            metrics.eyebrowTension * weights.eyebrowTension +
            metrics.eyeTension * weights.eyeTension +
            metrics.jawTension * weights.jawTension +
            metrics.asymmetry * weights.asymmetry +
            Math.abs(metrics.blinkRate - 0.5) * weights.highBlinkRate
        );
    }

    /**
     * 副交感神経スコアの計算
     */
    calculateParasympathetic(metrics) {
        const weights = this.weights.parasympathetic;
        
        return (
            (1 - metrics.foreheadTension) * weights.relaxedForehead +
            (1 - metrics.eyeTension) * weights.relaxedEyes +
            (1 - metrics.jawTension) * weights.relaxedJaw +
            (1 - metrics.cheekTension) * weights.relaxedCheeks +
            (1 - Math.abs(metrics.blinkRate - 0.5)) * weights.normalBlinkRate
        );
    }

    /**
     * 信頼度の計算
     */
    calculateConfidence(metrics) {
        let confidence = 1.0;
        
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
        
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * 優位な自律神経系の判定
     */
    determineDominantSystem(sympatheticRatio, parasympatheticRatio) {
        if (sympatheticRatio > this.thresholds.sympatheticDominant) {
            return 'sympathetic';
        } else if (parasympatheticRatio > this.thresholds.parasympatheticDominant) {
            return 'parasympathetic';
        } else {
            return 'balanced';
        }
    }

    /**
     * 診断メッセージの生成
     */
    generateDiagnosis(sympatheticRatio, parasympatheticRatio, metrics, confidence) {
        let diagnosis = "";
        
        // 信頼度が低い場合
        if (confidence < this.thresholds.lowConfidence) {
            return "データが不十分です。もう少し時間をおいて測定してください。";
        }
        
        // 主診断
        if (sympatheticRatio > this.thresholds.sympatheticDominant) {
            diagnosis = "交感神経が優位な状態です。ストレスや緊張が高まっている可能性があります。深呼吸やリラックス法を試してみてください。";
        } else if (parasympatheticRatio > this.thresholds.parasympatheticDominant) {
            diagnosis = "副交感神経が優位な状態です。リラックスしている良い状態ですが、活動には適度な緊張感も必要です。";
        } else {
            diagnosis = "交感神経と副交感神経のバランスが取れた良い状態です。この状態を維持することで健康的な自律神経の働きが期待できます。";
        }
        
        // 個別の症状に対するアドバイス
        const additionalAdvice = this.generateAdditionalAdvice(metrics);
        if (additionalAdvice.length > 0) {
            diagnosis += "\n\n" + additionalAdvice.join("\n\n");
        }
        
        return diagnosis;
    }

    /**
     * 追加のアドバイス生成
     */
    generateAdditionalAdvice(metrics) {
        const advice = [];
        
        if (metrics.eyeTension > this.thresholds.highEyeTension) {
            advice.push("目の緊張が高いようです。定期的に遠くを見て目を休めましょう。");
        }
        
        if (metrics.jawTension > this.thresholds.highJawTension) {
            advice.push("顎に力が入っているようです。意識的に顎の力を抜いてみてください。");
        }
        
        if (metrics.asymmetry > 0.7) {
            advice.push("顔の左右のバランスに偏りがあるようです。姿勢や噛み癖をチェックしてみてください。");
        }
        
        if (metrics.blinkRate < 0.3 || metrics.blinkRate > 0.7) {
            advice.push("瞬きの回数が通常と異なるようです。目の疲れや緊張状態をチェックしてください。");
        }
        
        return advice;
    }

    /**
     * 重み付けの更新（カスタマイズ用）
     */
    updateWeights(newWeights) {
        this.weights = { ...this.weights, ...newWeights };
    }

    /**
     * 閾値の更新（カスタマイズ用）
     */
    updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
    }

    /**
     * 評価結果の統計情報を計算
     */
    calculateStatistics(evaluationHistory) {
        if (!evaluationHistory || evaluationHistory.length === 0) {
            return null;
        }

        const sympatheticValues = evaluationHistory.map(e => e.sympathetic);
        const parasympatheticValues = evaluationHistory.map(e => e.parasympathetic);

        return {
            sympathetic: {
                mean: this.calculateMean(sympatheticValues),
                std: this.calculateStandardDeviation(sympatheticValues),
                trend: this.calculateTrend(sympatheticValues)
            },
            parasympathetic: {
                mean: this.calculateMean(parasympatheticValues),
                std: this.calculateStandardDeviation(parasympatheticValues),
                trend: this.calculateTrend(parasympatheticValues)
            }
        };
    }

    // 統計計算のヘルパー関数
    calculateMean(values) {
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    calculateStandardDeviation(values) {
        const mean = this.calculateMean(values);
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    calculateTrend(values) {
        if (values.length < 2) return 'stable';
        
        const recentAvg = this.calculateMean(values.slice(-5));
        const olderAvg = this.calculateMean(values.slice(0, 5));
        const difference = recentAvg - olderAvg;
        
        if (difference > 5) return 'increasing';
        if (difference < -5) return 'decreasing';
        return 'stable';
    }
}

// エクスポート（ブラウザ環境用）
if (typeof window !== 'undefined') {
    window.AutonomicEvaluationAlgorithm = AutonomicEvaluationAlgorithm;
}

// Node.js環境用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutonomicEvaluationAlgorithm;
}