'use client';

import { useState } from 'react';
import { ParsedFormsData } from '@/types/forms';

interface ResponsePreviewProps {
    data: ParsedFormsData;
}

export default function ResponsePreview({ data }: ResponsePreviewProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!data.responses.length) {
        return (
            <div className="text-center p-8 text-gray-500">
                回答データがありません
            </div>
        );
    }

    const currentResponse = data.responses[currentIndex];

    const nextResponse = () => {
        setCurrentIndex((prev) => (prev + 1) % data.responses.length);
    };

    const prevResponse = () => {
        setCurrentIndex((prev) => (prev - 1 + data.responses.length) % data.responses.length);
    };

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '未設定';

        try {
            // YYYY/MM/DD HH:MM:SS 形式の場合
            if (/^\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2}$/.test(dateStr)) {
                const [datePart, timePart] = dateStr.split(' ');
                const [year, month, day] = datePart.split('/');
                const [hour, minute, second] = timePart.split(':');

                const date = new Date(
                    parseInt(year),
                    parseInt(month) - 1, // 月は0ベース
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute),
                    parseInt(second)
                );

                if (!isNaN(date.getTime())) {
                    return date.toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                }
            }

            // その他の形式の場合
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toLocaleString('ja-JP');
            }
        } catch (error) {
            console.warn('日付フォーマットエラー:', error);
        }

        // 変換できない場合は元の文字列を返す
        return dateStr;
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6">
            {/* ナビゲーションヘッダー */}
            <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-medium">
                    回答者: {currentResponse.名前} ({currentIndex + 1} / {data.totalResponses})
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={prevResponse}
                        disabled={data.responses.length <= 1}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ← 前へ
                    </button>
                    <button
                        onClick={nextResponse}
                        disabled={data.responses.length <= 1}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        次へ →
                    </button>
                </div>
            </div>

            {/* 基本情報 */}
            <div className="bg-white border rounded-lg p-6 mb-6">
                <h3 className="text-lg font-medium mb-4">基本情報</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                        <div className="p-2 bg-gray-50 rounded">{currentResponse.ID}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                        <div className="p-2 bg-gray-50 rounded">{currentResponse.名前}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                        <div className="p-2 bg-gray-50 rounded">{currentResponse.メール}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
                        <div className="p-2 bg-gray-50 rounded">{formatDateTime(currentResponse.開始時刻)}</div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">完了時刻</label>
                        <div className="p-2 bg-gray-50 rounded">{formatDateTime(currentResponse.完了時刻)}</div>
                    </div>
                </div>
            </div>

            {/* 回答内容 */}
            <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">回答内容</h3>
                <div className="space-y-6">
                    {data.questions.map((question, index) => (
                        <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                            <div className="mb-2">
                                <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                                    問{index + 1}
                                </span>
                            </div>
                            <div className="mb-3 text-sm font-medium text-gray-700">
                                {question}
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                                <div className="whitespace-pre-wrap text-gray-800">
                                    {currentResponse[question] || '（回答なし）'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
