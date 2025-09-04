'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ParsedFormsData } from '@/types/forms';
import { isCodeContent, detectLanguage } from '@/utils/codeDetection';

interface ResponsePreviewProps {
    data: ParsedFormsData;
    // 任意: 表示用の問題タイトル
    questionTitles?: string[];
}

export default function ResponsePreview({ data, questionTitles }: ResponsePreviewProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showBasicInfo, setShowBasicInfo] = useState(false);
    const [loopMessage, setLoopMessage] = useState<string | null>(null);

    if (!data.responses.length) {
        return (
            <div className="text-center p-8 text-gray-500">
                回答データがありません
            </div>
        );
    }

    const currentResponse = data.responses[currentIndex];
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === data.responses.length - 1;

    const showLoopMessage = (message: string) => {
        setLoopMessage(message);
        setTimeout(() => setLoopMessage(null), 2000);
    };

    const nextResponse = () => {
        const nextIndex = (currentIndex + 1) % data.responses.length;
        if (currentIndex === data.responses.length - 1) {
            showLoopMessage('最後から最初の回答者に戻りました');
        }
        setCurrentIndex(nextIndex);
    };

    const prevResponse = () => {
        const prevIndex = (currentIndex - 1 + data.responses.length) % data.responses.length;
        if (currentIndex === 0) {
            showLoopMessage('最初から最後の回答者に移動しました');
        }
        setCurrentIndex(prevIndex);
    };

    // 回答内容をレンダリングする関数
    const renderAnswerContent = (content: string) => {
        if (!content) {
            return <span className="text-gray-400 italic">（回答なし）</span>;
        }

        if (isCodeContent(content)) {
            const language = detectLanguage(content);
            return (
                <div className="relative group">
                    <SyntaxHighlighter
                        language={language === 'text' ? 'javascript' : language}
                        style={vscDarkPlus}
                        customStyle={{
                            margin: 0,
                            borderRadius: '6px',
                            fontSize: '14px',
                            lineHeight: '1.5'
                        }}
                        wrapLongLines={true}
                    >
                        {content}
                    </SyntaxHighlighter>
                    {/* 右上に小さく控えめに表示 */}
                    <span className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 bg-opacity-70 px-2 py-1 rounded opacity-60 group-hover:opacity-100 transition-opacity">
                        {language === 'text' ? 'code' : language}
                    </span>
                </div>
            );
        }

        return (
            <div className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
                {content}
            </div>
        );
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
        <div className="w-full max-w-6xl mx-auto p-4">
            {/* 回答者ナビゲーション - コンパクトで目立つ */}
            <div className="sticky top-0 bg-white border rounded-lg shadow-sm p-4 mb-6 z-10">
                {/* ループメッセージ */}
                {loopMessage && (
                    <div className="mb-3 p-2 bg-yellow-100 border border-yellow-300 rounded-md text-yellow-800 text-sm text-center">
                        {loopMessage}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="text-xl font-bold text-gray-800">
                            {currentResponse.名前}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-sm text-gray-500">
                                {currentIndex + 1} / {data.totalResponses}
                            </div>
                            {/* プログレスバー */}
                            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-300 ease-out"
                                    style={{ width: `${((currentIndex + 1) / data.totalResponses) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowBasicInfo(!showBasicInfo)}
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                            {showBasicInfo ? '詳細を隠す' : '詳細を表示'}
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={prevResponse}
                            disabled={data.responses.length <= 1}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            title={isFirst ? '最後の回答者に移動' : '前の回答者に移動'}
                        >
                            {isFirst ? '← 末尾へ' : '← 前'}
                        </button>
                        <button
                            onClick={nextResponse}
                            disabled={data.responses.length <= 1}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            title={isLast ? '最初の回答者に移動' : '次の回答者に移動'}
                        >
                            {isLast ? '最初へ →' : '次 →'}
                        </button>
                    </div>
                </div>

                {/* 基本情報 - 折りたたみ可能でコンパクト */}
                {showBasicInfo && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">ID:</span> {currentResponse.ID}
                            </div>
                            <div>
                                <span className="text-gray-500">メール:</span> {currentResponse.メール}
                            </div>
                            <div>
                                <span className="text-gray-500">開始:</span> {formatDateTime(currentResponse.開始時刻)}
                            </div>
                            <div>
                                <span className="text-gray-500">完了:</span> {formatDateTime(currentResponse.完了時刻)}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 回答内容 - メインコンテンツとして大きく表示 */}
            <div className="space-y-8">
                {data.questions.map((question, index) => (
                    <div key={index} className="bg-white border rounded-lg p-6 shadow-sm">
                        <div className="mb-4">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="bg-blue-600 text-white text-lg font-bold px-4 py-2 rounded-md">
                                    問{index + 1}
                                </span>
                            </div>
                            <div className="text-gray-800 font-medium text-lg leading-relaxed">
                                {questionTitles && questionTitles[index] && questionTitles[index].trim() !== '' ? questionTitles[index] : question}
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                            {renderAnswerContent(String(currentResponse[question] || ''))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
