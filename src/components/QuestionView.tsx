'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ParsedFormsData } from '@/types/forms';
import { isCodeContent, detectLanguage } from '@/utils/codeDetection';

interface QuestionViewProps {
    data: ParsedFormsData;
}

export default function QuestionView({ data }: QuestionViewProps) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [loopMessage, setLoopMessage] = useState<string | null>(null);

    if (!data.questions.length) {
        return (
            <div className="text-center p-8 text-gray-500">
                問題データがありません
            </div>
        );
    }

    const currentQuestion = data.questions[currentQuestionIndex];
    const isFirst = currentQuestionIndex === 0;
    const isLast = currentQuestionIndex === data.questions.length - 1;

    const showLoopMessage = (message: string) => {
        setLoopMessage(message);
        setTimeout(() => setLoopMessage(null), 2000);
    };

    const nextQuestion = () => {
        const nextIndex = (currentQuestionIndex + 1) % data.questions.length;
        if (currentQuestionIndex === data.questions.length - 1) {
            showLoopMessage('最後から最初の問題に戻りました');
        }
        setCurrentQuestionIndex(nextIndex);
    };

    const prevQuestion = () => {
        const prevIndex = (currentQuestionIndex - 1 + data.questions.length) % data.questions.length;
        if (currentQuestionIndex === 0) {
            showLoopMessage('最初から最後の問題に移動しました');
        }
        setCurrentQuestionIndex(prevIndex);
    };

    // 回答内容をレンダリングする関数（ResponsePreviewと同様）
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
                            fontSize: '13px',
                            lineHeight: '1.4'
                        }}
                        wrapLongLines={true}
                    >
                        {content}
                    </SyntaxHighlighter>
                    <span className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 bg-opacity-70 px-2 py-1 rounded opacity-60 group-hover:opacity-100 transition-opacity">
                        {language === 'text' ? 'code' : language}
                    </span>
                </div>
            );
        }

        return (
            <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                {content}
            </div>
        );
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-4">
            {/* 問題ナビゲーション */}
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
                            問{currentQuestionIndex + 1}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-sm text-gray-500">
                                {currentQuestionIndex + 1} / {data.questions.length}
                            </div>
                            {/* プログレスバー */}
                            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-600 transition-all duration-300 ease-out"
                                    style={{ width: `${((currentQuestionIndex + 1) / data.questions.length) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={prevQuestion}
                            disabled={data.questions.length <= 1}
                            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            title={isFirst ? '最後の問題に移動' : '前の問題に移動'}
                        >
                            {isFirst ? '← 末尾へ' : '← 前の問題'}
                        </button>
                        <button
                            onClick={nextQuestion}
                            disabled={data.questions.length <= 1}
                            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            title={isLast ? '最初の問題に移動' : '次の問題に移動'}
                        >
                            {isLast ? '最初へ →' : '次の問題 →'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 問題文 */}
            <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    問{currentQuestionIndex + 1}
                </h2>
                <div className="text-gray-800 font-medium text-lg leading-relaxed">
                    {currentQuestion}
                </div>
            </div>

            {/* 全員の回答一覧 */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-700 mb-4">
                    回答一覧 ({data.totalResponses}件)
                </h3>
                <div className="grid gap-4">
                    {data.responses.map((response, index) => (
                        <div key={response.ID} className="bg-white border rounded-lg p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded-full">
                                        {index + 1}
                                    </span>
                                    <span className="font-medium text-gray-800">
                                        {response.名前}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        ID: {response.ID}
                                    </span>
                                </div>
                                {/* 将来的な採点機能のためのスペース */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">未採点</span>
                                </div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                                {renderAnswerContent(String(response[currentQuestion] || ''))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
