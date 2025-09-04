'use client';

import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { parseFormsExcel } from '@/utils/excelParser';
import { ParsedFormsData } from '@/types/forms';

interface FileUploadProps {
    onWorkspaceCreated: (workspaceId: string, isTrackTraining: boolean) => void;
}

export default function FileUpload({ onWorkspaceCreated }: FileUploadProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceDescription, setWorkspaceDescription] = useState('');
    const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedFormsData | null>(null);
    const [fileName, setFileName] = useState('');

    const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
        setError(null);

        // 拒否されたファイルがある場合はエラー表示
        if (fileRejections && fileRejections.length > 0) {
            const names = fileRejections.map(fr => fr.file.name).join(', ');
            const reasons = Array.from(new Set(fileRejections.flatMap(fr => fr.errors.map(e => e.code)))).join(', ');
            setError(
                `対応していないファイル形式です: ${names}\n` +
                `サポートされている形式: .xlsx, .xls, .csv\n` +
                (reasons ? `詳細: ${reasons}` : '')
            );
            return;
        }

        const file = acceptedFiles[0];
        if (!file) {
            setError('ファイルを受け付けられませんでした。対応形式: .xlsx, .xls, .csv');
            return;
        }

        setIsLoading(true);

        try {
            const data = await parseFormsExcel(file);
            setParsedData(data);
            setFileName(file.name);

            // ファイル名から拡張子と末尾の回答者数表示を削除してワークスペース名を生成
            let cleanName = file.name.replace(/\.[^/.]+$/, ''); // 拡張子を削除
            cleanName = cleanName.replace(/\(\d+-\d+\)$/, ''); // 末尾の (数字-数字) パターンを削除
            cleanName = cleanName.trim(); // 前後の空白を削除

            setWorkspaceName(cleanName);
            setShowWorkspaceForm(true);
            console.log('ファイルの解析が完了しました:', file.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ファイルの処理に失敗しました');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleCreateWorkspace = async () => {
        if (!parsedData || !workspaceName.trim()) {
            setError('ワークスペース名を入力してください');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const workspaceData = {
                name: workspaceName.trim(),
                description: workspaceDescription.trim() || undefined,
                formsData: parsedData,
                fileName: fileName
            };

            console.log('送信するデータ:', workspaceData);

            const response = await fetch('/api/workspaces', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(workspaceData),
            });

            console.log('レスポンスステータス:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('APIエラー:', errorText);
                setError(`サーバーエラー: ${response.status} - ${errorText}`);
                return;
            }

            const result = await response.json();
            console.log('レスポンス結果:', result);

            if (result.success) {
                const isTrackTraining = !!parsedData && parsedData.questions.length > 0 && parsedData.questions.every(q => /^q\d+$/.test(q));
                onWorkspaceCreated(result.workspace.id, isTrackTraining);
            } else {
                setError(result.error || 'ワークスペースの作成に失敗しました');
            }
        } catch (err) {
            console.error('ワークスペース作成エラー:', err);
            setError(`ワークスペースの作成に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv']
        },
        multiple: false
    });

    if (showWorkspaceForm && parsedData) {
        return (
            <div className="w-full max-w-2xl mx-auto p-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        ワークスペースを作成
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="workspaceName" className="block text-sm font-medium text-gray-700 mb-1">
                                ワークスペース名 *
                            </label>
                            <input
                                type="text"
                                id="workspaceName"
                                value={workspaceName}
                                onChange={(e) => setWorkspaceName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="ワークスペース名を入力"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="workspaceDescription" className="block text-sm font-medium text-gray-700 mb-1">
                                説明（任意）
                            </label>
                            <textarea
                                id="workspaceDescription"
                                value={workspaceDescription}
                                onChange={(e) => setWorkspaceDescription(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="ワークスペースの説明を入力"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                            <div><strong>ファイル:</strong> {fileName}</div>
                            <div><strong>回答者数:</strong> {parsedData.totalResponses}名</div>
                            <div><strong>問題数:</strong> {parsedData.questions.length}問</div>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="text-red-700 font-medium">エラー</div>
                            <div className="text-red-600 text-sm mt-1">{error}</div>
                        </div>
                    )}

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={handleCreateWorkspace}
                            disabled={isLoading || !workspaceName.trim()}
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2"></div>
                                    作成中...
                                </>
                            ) : (
                                'ワークスペースを作成'
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setShowWorkspaceForm(false);
                                setParsedData(null);
                                setWorkspaceName('');
                                setWorkspaceDescription('');
                                setError(null);
                            }}
                            disabled={isLoading}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto p-6">
            <div
                {...getRootProps()}
                className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 hover:bg-blue-50'}
        `}
            >
                <input {...getInputProps()} disabled={isLoading} />
                <div className="flex flex-col items-center gap-4">
                    <div className="text-4xl">📄</div>
                    {isLoading ? (
                        <div className="text-blue-600">
                            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                            ファイルを処理中...
                        </div>
                    ) : (
                        <>
                            <div className="text-lg font-medium text-gray-700">
                                {isDragActive ? 'ファイルをドロップしてください' : 'Forms / Track Training の Excel/CSV ファイルをアップロード'}
                            </div>
                            <div className="text-sm text-gray-500">
                                .xlsx / .xls / .csv をドラッグ&ドロップするか、クリックしてファイルを選択
                            </div>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-red-700 font-medium">エラー</div>
                    <div className="text-red-600 text-sm mt-1">{error}</div>
                </div>
            )}
        </div>
    );
}
