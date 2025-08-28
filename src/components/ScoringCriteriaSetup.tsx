'use client';

import { useState, useEffect } from 'react';
import { ScoringWorkspace, QuestionScoringCriteria, ScoringCriterion } from '@/types/forms';

interface ScoringCriteriaSetupProps {
    workspace: ScoringWorkspace;
    onSave: (criteria: QuestionScoringCriteria[]) => void;
    onCancel: () => void;
}

export default function ScoringCriteriaSetup({ workspace, onSave, onCancel }: ScoringCriteriaSetupProps) {
    const [criteriaList, setCriteriaList] = useState<QuestionScoringCriteria[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // 既存の採点基準がある場合は読み込み、なければ初期化
        if (workspace.scoringCriteria) {
            setCriteriaList(workspace.scoringCriteria);
        } else {
            // 各問題に対して初期の採点基準を作成
            const initialCriteria: QuestionScoringCriteria[] = workspace.formsData.questions.map((question, index) => ({
                questionIndex: index,
                questionText: question,
                criteria: [
                    {
                        id: generateCriterionId(),
                        description: '',
                        maxScore: 1
                    }
                ]
            }));
            setCriteriaList(initialCriteria);
        }
    }, [workspace]);

    const generateCriterionId = (): string => {
        return `criterion_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    };

    const addCriterion = (questionIndex: number) => {
        setCriteriaList(prev =>
            prev.map(questionCriteria =>
                questionCriteria.questionIndex === questionIndex
                    ? {
                        ...questionCriteria,
                        criteria: [
                            ...questionCriteria.criteria,
                            {
                                id: generateCriterionId(),
                                description: '',
                                maxScore: 1
                            }
                        ]
                    }
                    : questionCriteria
            )
        );
    };

    const removeCriterion = (questionIndex: number, criterionId: string) => {
        setCriteriaList(prev =>
            prev.map(questionCriteria =>
                questionCriteria.questionIndex === questionIndex
                    ? {
                        ...questionCriteria,
                        criteria: questionCriteria.criteria.filter(c => c.id !== criterionId)
                    }
                    : questionCriteria
            )
        );
    };

    const updateCriterion = (questionIndex: number, criterionId: string, updates: Partial<ScoringCriterion>) => {
        setCriteriaList(prev =>
            prev.map(questionCriteria =>
                questionCriteria.questionIndex === questionIndex
                    ? {
                        ...questionCriteria,
                        criteria: questionCriteria.criteria.map(c =>
                            c.id === criterionId ? { ...c, ...updates } : c
                        )
                    }
                    : questionCriteria
            )
        );
    };

    const handleSave = async () => {
        // バリデーション
        for (const questionCriteria of criteriaList) {
            if (questionCriteria.criteria.length === 0) {
                alert(`問題 ${questionCriteria.questionIndex + 1} に採点基準が設定されていません`);
                return;
            }

            for (const criterion of questionCriteria.criteria) {
                if (!criterion.description.trim()) {
                    alert(`問題 ${questionCriteria.questionIndex + 1} に空の採点基準があります`);
                    return;
                }
                if (criterion.maxScore <= 0) {
                    alert(`問題 ${questionCriteria.questionIndex + 1} の採点基準で無効な配点が設定されています`);
                    return;
                }
            }
        }

        setIsSaving(true);
        onSave(criteriaList);
    };

    const getTotalMaxScore = (questionCriteria: QuestionScoringCriteria): number => {
        return questionCriteria.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);
    };

    // 全問題の合計点を計算
    const getGrandTotalScore = (): number => {
        return criteriaList.reduce((total, questionCriteria) => {
            return total + getTotalMaxScore(questionCriteria);
        }, 0);
    };

    return (
        <div className="max-w-6xl mx-auto">
            {/* 固定ヘッダー - 改善されたデザイン */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-200 mb-6">
                <div className="px-6 py-4">
                    <div className="flex justify-between items-center">
                        {/* 左側: タイトルとワークスペース名 */}
                        <div className="flex-1">
                            <div className="flex items-baseline gap-4">
                                <h1 className="text-2xl font-bold text-gray-900">
                                    採点基準の設定
                                </h1>
                                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {workspace.name}
                                </span>
                            </div>
                        </div>

                        {/* 右側: 合計点と操作ボタン */}
                        <div className="flex items-center gap-6">

                            {/* 全体合計点表示 - よりコンパクトに & タイトルと間隔を広げる */}
                            <div className="text-right ml-4">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">総配点</div>
                                <div className="text-xl font-bold text-indigo-600">{getGrandTotalScore()}<span className="text-sm text-gray-500 ml-1">点</span></div>
                            </div>

                            {/* 操作ボタン - 横並びに */}
                            <div className="flex gap-3">
                                <button
                                    onClick={onCancel}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full inline-block mr-2"></div>
                                            保存中
                                        </>
                                    ) : (
                                        '保存'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* メインコンテンツ */}
            <div className="px-6">

                <div className="space-y-8">
                    {criteriaList.map((questionCriteria) => (
                        <div key={questionCriteria.questionIndex} className="border border-gray-200 rounded-lg p-6 bg-white">
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                    問題 {questionCriteria.questionIndex + 1}
                                </h2>
                                <div className="bg-gray-50 p-3 rounded text-gray-700 mb-2">
                                    {questionCriteria.questionText}
                                </div>
                                <div className="text-sm text-gray-500">
                                    満点: {getTotalMaxScore(questionCriteria)}点
                                </div>
                            </div>

                            <div className="space-y-3">
                                {questionCriteria.criteria.map((criterion, criterionIndex) => (
                                    <div key={criterion.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                採点基準 {criterionIndex + 1}
                                            </label>
                                            <textarea
                                                value={criterion.description}
                                                onChange={(e) => updateCriterion(questionCriteria.questionIndex, criterion.id, { description: e.target.value })}
                                                placeholder="採点基準の説明を入力..."
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                rows={2}
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                配点
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={criterion.maxScore}
                                                onChange={(e) => updateCriterion(questionCriteria.questionIndex, criterion.id, { maxScore: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        {questionCriteria.criteria.length > 1 && (
                                            <button
                                                onClick={() => removeCriterion(questionCriteria.questionIndex, criterion.id)}
                                                className="text-red-600 hover:text-red-800 mt-6"
                                                title="採点基準を削除"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4">
                                <button
                                    onClick={() => addCriterion(questionCriteria.questionIndex)}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                    + 採点基準を追加
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
