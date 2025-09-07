"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

// 人ごと表示（採点対応）
import PersonView from "@/components/PersonView";
import QuestionView from "@/components/QuestionView";
import ScoreSheetFill from "@/components/ScoreSheetFill";
import { ParsedFormsData, ScoringWorkspace } from "@/types/forms";
import { exportAllAsZip } from "@/utils/exportScores";

export default function WorkspacePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [formsData, setFormsData] = useState<ParsedFormsData | null>(null);
    const [currentWorkspace, setCurrentWorkspace] = useState<ScoringWorkspace | null>(null);
    const [viewMode, setViewMode] = useState<"question" | "person">("question");
    const [questionFocusIndex, setQuestionFocusIndex] = useState<number>(0);
    const [openScoreSheet, setOpenScoreSheet] = useState(false);

    useEffect(() => {
        if (id) {
            fetch(`/api/workspaces/${id}`)
                .then((res) => res.json())
                .then((result) => {
                    if (result.success) {
                        setCurrentWorkspace(result.workspace);
                        setFormsData(result.workspace.formsData);
                    }
                });
        }
    }, [id]);

    // 最新コメントを保持（再レンダー不要のためref）
    const commentsRef = useRef<Record<number, Record<number, string>>>({});

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4">
                <header className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">アンケート採点システム（Forms / Track Training 対応）</h1>
                    {currentWorkspace && <p className="text-gray-600">ワークスペース: {currentWorkspace.name}</p>}
                </header>
                {formsData && (
                    <div>
                        <div className="flex justify-center items-center gap-4 mb-6">
                            <button
                                onClick={() => router.push("/")}
                                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                            >
                                ワークスペース一覧に戻る
                            </button>
                            <button
                                onClick={() => router.push(`/workspace/${id}/scoring-criteria`)}
                                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                            >
                                採点基準設定
                            </button>
                            <button
                                onClick={() => router.push(`/workspace/${id}/question-settings`)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                            >
                                問題文設定
                            </button>
                            {currentWorkspace && (
                                <button
                                    onClick={() => setOpenScoreSheet(true)}
                                    className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                                >
                                    点数シートに記入
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (!currentWorkspace) return;
                                    // 最新コメント(ref) を反映したワークスペースを組み立て（state更新は不要）
                                    const ws: ScoringWorkspace = {
                                        ...currentWorkspace,
                                        comments: ({ ...currentWorkspace.comments, ...commentsRef.current })
                                    } as ScoringWorkspace;
                                    const data = ws.formsData;
                                    // 未設定の最初の問題を探索
                                    let firstNoCriteria = -1;
                                    for (let i = 0; i < data.questions.length; i++) {
                                        const has = ws.scoringCriteria && ws.scoringCriteria[i] && ws.scoringCriteria[i].criteria && ws.scoringCriteria[i].criteria.length > 0;
                                        if (!has) { firstNoCriteria = i; break; }
                                    }
                                    if (firstNoCriteria >= 0) {
                                        // 問題ごと表示へ切り替え＆該当問題へ移動
                                        setViewMode("question");
                                        setQuestionFocusIndex(firstNoCriteria);
                                        const title = (ws.questionTitles && ws.questionTitles[firstNoCriteria]) || data.questions[firstNoCriteria];
                                        const ok = window.confirm(`問題${firstNoCriteria + 1}（${title}）に採点基準が設定されていません。\nそれでもエクスポートを実行しますか？`);
                                        if (!ok) return;
                                    }

                                    // 未採点の項目がある最初の問題を探索（基準はあるが value が未設定）
                                    let firstUngraded = -1;
                                    for (let qi = 0; qi < data.questions.length; qi++) {
                                        const cset = ws.scoringCriteria?.[qi]?.criteria || [];
                                        if (cset.length === 0) continue; // 基準がない問題は対象外
                                        const scoresForQ = ws.scores?.[qi] || {};
                                        // いずれかの受講者・基準で未採点(null または undefined)を検出
                                        let foundUngraded = false;
                                        for (const resp of data.responses) {
                                            const rid = Number(resp.ID);
                                            const perResp = scoresForQ[rid] || {};
                                            for (const criterion of cset) {
                                                const v = perResp[criterion.id];
                                                if (!(typeof v === 'boolean') && v !== false && v !== true) { // 未採点
                                                    foundUngraded = true;
                                                    break;
                                                }
                                            }
                                            if (foundUngraded) break;
                                        }
                                        if (foundUngraded) { firstUngraded = qi; break; }
                                    }
                                    if (firstUngraded >= 0) {
                                        setViewMode("question");
                                        setQuestionFocusIndex(firstUngraded);
                                        const title = (ws.questionTitles && ws.questionTitles[firstUngraded]) || data.questions[firstUngraded];
                                        const ok2 = window.confirm(`問題${firstUngraded + 1}（${title}）に未採点の採点基準があります。\nそれでもエクスポートを実行しますか？`);
                                        if (!ok2) return;
                                    }
                                    exportAllAsZip(ws);
                                }}
                                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                            >
                                採点結果をエクスポート
                            </button>
                            <div className="flex bg-gray-200 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode("question")}
                                    className={`px-4 py-2 rounded-md font-medium transition-colors ${viewMode === "question" ? "bg-green-600 text-white" : "text-gray-600 hover:text-gray-800"}`}
                                >
                                    📝 問題ごと表示
                                </button>
                                <button
                                    onClick={() => setViewMode("person")}
                                    className={`px-4 py-2 rounded-md font-medium transition-colors ${viewMode === "person" ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-800"}`}
                                >
                                    👤 人ごと表示
                                </button>
                            </div>
                        </div>
                        {viewMode === "question" ? (
                            <QuestionView
                                data={formsData}
                                workspace={currentWorkspace ?? undefined}
                                initialIndex={questionFocusIndex}
                                commentsRef={commentsRef}
                            />
                        ) : (
                            <PersonView
                                data={formsData}
                                workspace={currentWorkspace ?? undefined}
                                commentsRef={commentsRef}
                            />
                        )}

                        {openScoreSheet && currentWorkspace && (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                                onClick={() => setOpenScoreSheet(false)}
                                role="dialog"
                                aria-modal="true"
                            >
                                <div
                                    className="w-full max-w-3xl bg-white rounded-lg shadow-xl overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between px-4 py-3 border-b">
                                        <h2 className="text-lg font-semibold">点数シートに記入</h2>
                                        <button
                                            onClick={() => setOpenScoreSheet(false)}
                                            className="px-2 py-1 text-gray-600 hover:text-gray-900"
                                            aria-label="閉じる"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="p-4">
                                        <ScoreSheetFill workspace={currentWorkspace} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
