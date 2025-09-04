"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ParsedFormsData, ScoringWorkspace } from "@/types/forms";

export default function QuestionSettingsPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [workspace, setWorkspace] = useState<ScoringWorkspace | null>(null);
    const [formsData, setFormsData] = useState<ParsedFormsData | null>(null);
    const [titles, setTitles] = useState<string[]>([]);
    const [initialTitles, setInitialTitles] = useState<string[] | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        (async () => {
            const res = await fetch(`/api/workspaces/${id}`);
            const json = await res.json();
            if (json?.success && json.workspace) {
                const ws: ScoringWorkspace = json.workspace;
                setWorkspace(ws);
                setFormsData(ws.formsData);
                const base = ws.questionTitles && ws.questionTitles.length === ws.formsData.questions.length
                    ? ws.questionTitles
                    : Array.from({ length: ws.formsData.questions.length }, () => "");
                setTitles(base);
                setInitialTitles(base);
            }
        })();
    }, [id]);

    const rows = useMemo(() => {
        if (!formsData) return [];
        return formsData.questions.map((q, i) => ({ index: i, original: q, title: titles[i] ?? "" }));
    }, [formsData, titles]);

    const handleChange = (i: number, val: string) => {
        setTitles(prev => {
            const next = [...prev];
            next[i] = val;
            return next;
        });
    };

    const handleSave = async () => {
        if (!id || !formsData) return;
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const normalized = Array.from({ length: formsData.questions.length }, (_, i) => titles[i] ?? "");
            const res = await fetch(`/api/workspaces/${id}/questions`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ titles: normalized }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || "保存に失敗しました");
            }
            // 保存後は前のページ（ワークスペース詳細）に戻る
            router.push(`/workspace/${id}`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "エラーが発生しました";
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    const normalizedCurrent = useMemo(() => {
        if (!formsData) return [] as string[];
        return Array.from({ length: formsData.questions.length }, (_, i) => titles[i] ?? "");
    }, [titles, formsData]);

    const normalizedInitial = useMemo(() => {
        if (!formsData) return [] as string[];
        const base = initialTitles ?? Array.from({ length: formsData.questions.length }, () => "");
        return Array.from({ length: formsData.questions.length }, (_, i) => base[i] ?? "");
    }, [initialTitles, formsData]);

    const hasChanges = useMemo(() => {
        if (!formsData) return false;
        return JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedInitial);
    }, [normalizedCurrent, normalizedInitial, formsData]);

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">問題文設定</h1>
                    {workspace && (
                        <p className="text-gray-600 mt-1">ワークスペース: {workspace.name}</p>
                    )}
                </header>

                <div className="flex gap-3 mb-6">
                    <button
                        onClick={() => {
                            if (hasChanges) {
                                const go = window.confirm("保存されていません。保存せずに戻りますか？");
                                if (!go) return;
                            }
                            router.push(`/workspace/${id}`);
                        }}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        戻る
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !formsData}
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {saving ? "保存中…" : "保存"}
                    </button>
                    {message && <span className="text-green-700 self-center">{message}</span>}
                    {error && <span className="text-red-600 self-center">{error}</span>}
                </div>

                {!formsData ? (
                    <div className="text-gray-500">読込中…</div>
                ) : (
                    <div className="bg-white border rounded-lg shadow-sm">
                        <div className="grid grid-cols-12 px-4 py-3 text-sm font-medium text-gray-600 border-b bg-gray-50">
                            <div className="col-span-1">#</div>
                            <div className="col-span-5">元の問題文（列名）</div>
                            <div className="col-span-6">表示名（任意）</div>
                        </div>
                        <div>
                            {rows.map(r => (
                                <div key={r.index} className="grid grid-cols-12 gap-3 px-4 py-3 border-b last:border-b-0 items-center">
                                    <div className="col-span-1 text-gray-700">{r.index + 1}</div>
                                    <div className="col-span-5 text-gray-800 text-sm break-words">{r.original}</div>
                                    <div className="col-span-6">
                                        <textarea
                                            className="w-full border rounded-md px-3 py-2 text-gray-800 resize-y break-all"
                                            placeholder="例）FizzBuzz の実装"
                                            rows={2}
                                            value={r.title}
                                            onChange={(e) => handleChange(r.index, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
