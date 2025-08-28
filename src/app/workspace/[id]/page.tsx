"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ResponsePreview from "@/components/ResponsePreview";
import QuestionView from "@/components/QuestionView";
import { ParsedFormsData, ScoringWorkspace } from "@/types/forms";

export default function WorkspacePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [formsData, setFormsData] = useState<ParsedFormsData | null>(null);
    const [currentWorkspace, setCurrentWorkspace] = useState<ScoringWorkspace | null>(null);
    const [viewMode, setViewMode] = useState<"question" | "person">("question");

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

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4">
                <header className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Microsoft Forms 採点システム</h1>
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
                        {viewMode === "question" ? <QuestionView data={formsData} workspace={currentWorkspace ?? undefined} /> : <ResponsePreview data={formsData} />}
                    </div>
                )}
            </div>
        </div>
    );
}
