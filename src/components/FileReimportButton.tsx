'use client';

import { useRef } from 'react';

interface FileReimportButtonProps {
    workspaceId: string;
    workspaceName: string;
    onReimport: (workspaceId: string, file: File) => void;
    isLoading: boolean;
    disabled?: boolean;
}

export default function FileReimportButton({
    workspaceId,
    workspaceName,
    onReimport,
    isLoading,
    disabled = false
}: FileReimportButtonProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // ファイル形式をチェック
            const validExtensions = ['.xlsx', '.xls'];
            const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

            if (!validExtensions.includes(fileExtension)) {
                alert('Excel ファイル (.xlsx または .xls) を選択してください');
                return;
            }

            // 確認ダイアログ
            const confirmMessage = `ワークスペース「${workspaceName}」のデータを再インポートしますか？\n\n` +
                `ファイル: ${file.name}\n\n` +
                `※ 問題文が異なる場合はエラーになります`;

            if (confirm(confirmMessage)) {
                onReimport(workspaceId, file);
            }
        }

        // ファイル入力をリセット（同じファイルでも再選択できるように）
        if (event.target) {
            event.target.value = '';
        }
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
            <button
                onClick={handleButtonClick}
                disabled={disabled || isLoading}
                className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                title="Excelファイルを再インポート"
            >
                {isLoading ? (
                    <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block mr-1"></div>
                        再インポート中...
                    </>
                ) : (
                    '再インポート'
                )}
            </button>
        </>
    );
}
