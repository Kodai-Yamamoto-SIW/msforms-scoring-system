'use client';

import { useState, useEffect } from 'react';
import { WorkspaceSummary } from '@/types/forms';
import FileReimportButton from './FileReimportButton';

interface WorkspaceSelectorProps {
    onSelectWorkspace: (workspaceId: string) => void;
    onCreateNew: () => void;
}

export default function WorkspaceSelector({ onSelectWorkspace, onCreateNew }: WorkspaceSelectorProps) {
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
    const [editingWorkspace, setEditingWorkspace] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', description: '' });
    const [reimportingWorkspace, setReimportingWorkspace] = useState<string | null>(null);
    const [reimportError, setReimportError] = useState<string | null>(null);

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

    const toggleWorkspaceDetails = (workspaceId: string) => {
        setExpandedWorkspaces(prev => {
            const newSet = new Set(prev);
            if (newSet.has(workspaceId)) {
                newSet.delete(workspaceId);
            } else {
                newSet.add(workspaceId);
            }
            return newSet;
        });
    };

    const startEditWorkspace = (workspace: WorkspaceSummary) => {
        setEditingWorkspace(workspace.id);
        setEditForm({
            name: workspace.name,
            description: workspace.description || ''
        });
    };

    const cancelEdit = () => {
        setEditingWorkspace(null);
        setEditForm({ name: '', description: '' });
    };

    const saveEdit = async () => {
        if (!editingWorkspace || !editForm.name.trim()) {
            setError('ワークスペース名は必須です');
            return;
        }

        try {
            const response = await fetch(`/api/workspaces/${editingWorkspace}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: editForm.name.trim(),
                    description: editForm.description.trim() || undefined,
                }),
            });

            if (response.ok) {
                cancelEdit();
                loadWorkspaces(); // ワークスペース一覧を再読み込み
            } else {
                const result = await response.json();
                setError(result.error || 'ワークスペースの更新に失敗しました');
            }
        } catch (error) {
            console.error('ワークスペース更新エラー:', error);
            setError('ワークスペースの更新に失敗しました');
        }
    };

    const handleFileReimport = async (workspaceId: string, file: File) => {
        setReimportingWorkspace(workspaceId);
        setReimportError(null);

        try {
            // ファイルを解析
            const { parseFormsExcel } = await import('@/utils/excelParser');
            const newData = await parseFormsExcel(file);

            // 再インポートAPIを呼び出し
            const response = await fetch(`/api/workspaces/${workspaceId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    newData: newData,
                    fileName: file.name,
                }),
            });

            const result = await response.json();

            if (result.success) {
                alert(`データの再インポートが完了しました\n${JSON.stringify(result.details, null, 2)}`);
                loadWorkspaces(); // ワークスペース一覧を再読み込み
            } else {
                let errorMessage = result.error || 'データの再インポートに失敗しました';
                if (result.details && Array.isArray(result.details)) {
                    errorMessage += '\n\n詳細:\n' + result.details.join('\n');
                }
                setReimportError(errorMessage);
            }
        } catch (error) {
            console.error('ファイル再インポートエラー:', error);
            setReimportError('ファイルの処理に失敗しました');
        } finally {
            setReimportingWorkspace(null);
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
                    アンケート採点システム（Forms / Track Training 対応）
                </h1>
                <p className="text-gray-600">
                    ワークスペースを選択するか、新しいワークスペースを作成してください（Microsoft Forms または Track Training のデータを読み込めます）
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

            {reimportError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-red-800 font-medium">再インポートエラー</div>
                    <div className="text-red-600 text-sm mt-1 whitespace-pre-line">{reimportError}</div>
                    <button
                        onClick={() => setReimportError(null)}
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
                                        {editingWorkspace === workspace.id ? (
                                            // 編集モード
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        ワークスペース名 *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editForm.name}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        説明（任意）
                                                    </label>
                                                    <textarea
                                                        value={editForm.description}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                        rows={2}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={saveEdit}
                                                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                                                    >
                                                        保存
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                                                    >
                                                        キャンセル
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            // 表示モード
                                            <>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-lg font-medium text-gray-900">
                                                        {workspace.name}
                                                    </h3>
                                                    <button
                                                        onClick={() => toggleWorkspaceDetails(workspace.id)}
                                                        className="text-gray-400 hover:text-gray-600 text-sm"
                                                        title="詳細を表示/非表示"
                                                    >
                                                        {expandedWorkspaces.has(workspace.id) ? '▼' : '▶'}
                                                    </button>
                                                </div>
                                                {workspace.description && (
                                                    <p className="text-gray-600 mb-2">
                                                        {workspace.description}
                                                    </p>
                                                )}
                                                {expandedWorkspaces.has(workspace.id) && (
                                                    <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded mt-2">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <span>📊 回答者: {workspace.totalResponses}名</span>
                                                            <span>📝 問題: {workspace.totalQuestions}問</span>
                                                            <span>📅 作成日: {new Date(workspace.createdAt).toLocaleDateString('ja-JP')}</span>
                                                            <span className="text-gray-400">📁 ファイル: {workspace.fileName}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {editingWorkspace !== workspace.id && (
                                        <div className="flex gap-2 ml-4">
                                            <button
                                                onClick={() => onSelectWorkspace(workspace.id)}
                                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                                            >
                                                開く
                                            </button>
                                            <button
                                                onClick={() => startEditWorkspace(workspace)}
                                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                                            >
                                                編集
                                            </button>
                                            <FileReimportButton
                                                workspaceId={workspace.id}
                                                workspaceName={workspace.name}
                                                onReimport={handleFileReimport}
                                                isLoading={reimportingWorkspace === workspace.id}
                                            />
                                            <button
                                                onClick={() => handleDeleteWorkspace(workspace.id, workspace.name)}
                                                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                                            >
                                                削除
                                            </button>
                                        </div>
                                    )}
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
