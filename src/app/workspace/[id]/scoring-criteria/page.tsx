"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScoringCriteriaSetup from "@/components/ScoringCriteriaSetup";
import { ScoringWorkspace, QuestionScoringCriteria } from "@/types/forms";

export default function ScoringCriteriaPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [currentWorkspace, setCurrentWorkspace] = useState<ScoringWorkspace | null>(null);

    useEffect(() => {
        if (id) {
            fetch(`/api/workspaces/${id}`)
                .then((res) => res.json())
                .then((result) => {
                    if (result.success) {
                        setCurrentWorkspace(result.workspace);
                    }
                });
        }
    }, [id]);

    const handleSaveScoringCriteria = async (criteria: QuestionScoringCriteria[]) => {
        if (!currentWorkspace) return;
        try {
            const response = await fetch(`/api/workspaces/${currentWorkspace.id}/scoring-criteria`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ criteria }),
            });
            if (response.ok) {
                const result = await response.json();
                setCurrentWorkspace(result.workspace);
                alert("採点基準を保存しました");
                router.push(`/workspace/${id}`);
            } else {
                alert("採点基準の保存に失敗しました");
            }
        } catch {
            alert("採点基準の保存に失敗しました");
        }
    };

    if (!currentWorkspace) {
        return <div className="p-8 text-center text-gray-500">ワークスペース情報を取得中...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4">
                <ScoringCriteriaSetup
                    workspace={currentWorkspace}
                    onSave={handleSaveScoringCriteria}
                    onCancel={() => router.push(`/workspace/${id}`)}
                />
            </div>
        </div>
    );
}
