'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseFormsExcel } from '@/utils/excelParser';
import { ParsedFormsData } from '@/types/forms';

interface FileUploadProps {
    onDataParsed: (data: ParsedFormsData) => void;
}

export default function FileUpload({ onDataParsed }: FileUploadProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await parseFormsExcel(file);
            onDataParsed(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ファイルの処理に失敗しました');
        } finally {
            setIsLoading(false);
        }
    }, [onDataParsed]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        multiple: false
    });

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
                                {isDragActive ? 'ファイルをドロップしてください' : 'Microsoft Forms の Excel ファイルをアップロード'}
                            </div>
                            <div className="text-sm text-gray-500">
                                .xlsx または .xls ファイルをドラッグ&ドロップするか、クリックしてファイルを選択
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
