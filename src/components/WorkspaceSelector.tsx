'use client';

import { useState, useEffect } from 'react';
import { WorkspaceSummary } from '@/types/forms';

interface WorkspaceSelectorProps {
    onSelectWorkspace: (workspaceId: string) => void;
    onCreateNew: () => void;
}

export default function WorkspaceSelector({ onSelectWorkspace, onCreateNew }: WorkspaceSelectorProps) {
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadWorkspaces();
    }, []);

    const loadWorkspaces = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/workspaces');
            const data = await response.json();

            if (data.success) {
                setWorkspaces(data.workspaces);
            } else {
                setError('ワークスペースの読み込みに失敗しました');
            }
        } catch (error) {
            console.error('ワークスペース読み込みエラー:', error);
            setError('ワークスペースの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteWorkspace = async (workspaceId: string, workspaceName: string) => {
        if (!confirm(`ワークスペース「${workspaceName}」を削除してもよろしいですか？`)) {
            return;
        }

        try {
            const response = await fetch(`/api/workspaces/${workspaceId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                // ワークスペース一覧を再読み込み
                loadWorkspaces();
            } else {
                setError('ワークスペースの削除に失敗しました');
            }
        } catch (error) {
            console.error('ワークスペース削除エラー:', error);
            setError('ワークスペースの削除に失敗しました');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-96">
                <div className="text-lg">ワークスペースを読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    MS Forms 採点システム
                </h1>
                <p className="text-gray-600">
                    ワークスペースを選択するか、新しいワークスペースを作成してください
                </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-red-800">{error}</div>
                    <button
                        onClick={() => setError(null)}
                        className="mt-2 text-sm text-red-600 underline"
                    >
                        閉じる
                    </button>
                </div>
            )}

            <div className="mb-8">
                <button
                    onClick={onCreateNew}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                    新しいワークスペースを作成
                </button>
            </div>

            {workspaces.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        既存のワークスペース
                    </h2>
                    <div className="grid gap-4">
                        {workspaces.map((workspace) => (
                            <div
                                key={workspace.id}
                                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-medium text-gray-900">
                                                {workspace.name}
                                            </h3>
                                            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                {workspace.fileName}
                                            </span>
                                        </div>
                                        {workspace.description && (
                                            <p className="text-gray-600 mb-2">
                                                {workspace.description}
                                            </p>
                                        )}
                                        <div className="text-sm text-gray-500">
                                            <span>回答者: {workspace.totalResponses}名</span>
                                            <span className="mx-2">•</span>
                                            <span>問題: {workspace.totalQuestions}問</span>
                                            <span className="mx-2">•</span>
                                            <span>作成日: {new Date(workspace.createdAt).toLocaleDateString('ja-JP')}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => onSelectWorkspace(workspace.id)}
                                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                                        >
                                            開く
                                        </button>
                                        <button
                                            onClick={() => handleDeleteWorkspace(workspace.id, workspace.name)}
                                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                                        >
                                            削除
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {workspaces.length === 0 && !loading && (
                <div className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                        まだワークスペースがありません
                    </div>
                    <div className="text-sm text-gray-400">
                        「新しいワークスペースを作成」ボタンから始めてください
                    </div>
                </div>
            )}
        </div>
    );
}
