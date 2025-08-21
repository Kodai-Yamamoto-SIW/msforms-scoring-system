import { ParsedFormsData, FormsResponse, DataValidationResult, DataDiffResult } from '@/types/forms';

/**
 * 新しいデータが既存データと互換性があるかを検証
 */
export const validateDataCompatibility = (
    existingData: ParsedFormsData,
    newData: ParsedFormsData
): DataValidationResult => {
    const errors: string[] = [];

    // 問題数の検証
    if (existingData.questions.length !== newData.questions.length) {
        errors.push(
            `問題数が異なります。既存: ${existingData.questions.length}問、新規: ${newData.questions.length}問`
        );
    }

    // 問題文の検証（順序も含めて完全一致を要求）
    const maxLength = Math.max(existingData.questions.length, newData.questions.length);
    for (let i = 0; i < maxLength; i++) {
        const existingQuestion = existingData.questions[i];
        const newQuestion = newData.questions[i];

        if (!existingQuestion && newQuestion) {
            errors.push(`問題${i + 1}: 新しいデータに追加の問題があります - "${newQuestion}"`);
        } else if (existingQuestion && !newQuestion) {
            errors.push(`問題${i + 1}: 既存の問題が新しいデータにありません - "${existingQuestion}"`);
        } else if (existingQuestion && newQuestion && existingQuestion !== newQuestion) {
            errors.push(
                `問題${i + 1}: 問題文が異なります\n` +
                `既存: "${existingQuestion}"\n` +
                `新規: "${newQuestion}"`
            );
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * 既存データと新データの差分を検出
 */
export const detectDataDifferences = (
    existingData: ParsedFormsData,
    newData: ParsedFormsData
): DataDiffResult => {
    const existingResponsesMap = new Map<string, FormsResponse>();
    const newResponsesMap = new Map<string, FormsResponse>();

    // 既存データをメールでマップ化
    existingData.responses.forEach(response => {
        const email = String(response.メール);
        existingResponsesMap.set(email, response);
    });

    // 新データをメールでマップ化
    newData.responses.forEach(response => {
        const email = String(response.メール);
        newResponsesMap.set(email, response);
    });

    const added: FormsResponse[] = [];
    const removed: FormsResponse[] = [];
    const updated: FormsResponse[] = [];

    // 新規追加された回答を検出
    newData.responses.forEach(newResponse => {
        const email = String(newResponse.メール);
        if (!existingResponsesMap.has(email)) {
            added.push(newResponse);
        }
    });

    // 削除された回答を検出
    existingData.responses.forEach(existingResponse => {
        const email = String(existingResponse.メール);
        if (!newResponsesMap.has(email)) {
            removed.push(existingResponse);
        }
    });

    // 更新された回答を検出
    newData.responses.forEach(newResponse => {
        const email = String(newResponse.メール);
        const existingResponse = existingResponsesMap.get(email);
        if (existingResponse) {
            // 回答内容が変更されているかチェック
            const isUpdated = !areResponsesEqual(existingResponse, newResponse, existingData.questions);
            if (isUpdated) {
                updated.push(newResponse);
            }
        }
    });

    return { added, removed, updated };
};

/**
 * 2つの回答が完全に同一かどうかを判定
 */
const areResponsesEqual = (response1: FormsResponse, response2: FormsResponse, questions: string[]): boolean => {
    // 基本情報の比較
    if (
        String(response1.メール) !== String(response2.メール) ||
        String(response1.名前) !== String(response2.名前) ||
        response1.完了時刻 !== response2.完了時刻
    ) {
        return false;
    }

    // 回答内容の比較（問題文の列のみ）
    for (const question of questions) {
        const answer1 = response1[question];
        const answer2 = response2[question];

        if (answer1 !== answer2) {
            return false;
        }
    }

    return true;
};

/**
 * データ差分の統計情報を生成
 */
export const generateDiffSummary = (diff: DataDiffResult): string => {
    const summary: string[] = [];

    if (diff.added.length > 0) {
        summary.push(`新規追加: ${diff.added.length}件`);
    }

    if (diff.updated.length > 0) {
        summary.push(`更新: ${diff.updated.length}件`);
    }

    if (diff.removed.length > 0) {
        summary.push(`削除: ${diff.removed.length}件`);
    }

    if (summary.length === 0) {
        return '変更なし';
    }

    return summary.join(', ');
};
