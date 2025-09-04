'use client';

import { useState, useEffect } from 'react';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ParsedFormsData, ScoringWorkspace, QuestionScoringCriteria } from '@/types/forms';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isCodeContent, detectLanguage } from '@/utils/codeDetection';


interface QuestionViewProps {
    data: ParsedFormsData;
    workspace?: ScoringWorkspace;
    initialIndex?: number;
}

export default function QuestionView({ data, workspace, initialIndex }: QuestionViewProps) {
    // 採点基準の取得
    const scoringCriteria: QuestionScoringCriteria[] | undefined = workspace?.scoringCriteria;

    // 採点入力値を一時的に保持するstate（questionIndex→responseId→criterionId→boolean | null）
    // null = 未採点, true = 満たす, false = 満たさない
    const [scoreInputs, setScoreInputs] = useState<Record<number, Record<number, Record<string, boolean | null>>>>({});

    // サーバー保存済みスコアの読込（workspaceのscoresが届いたら反映）
    useEffect(() => {
        if (workspace?.scores) {
            setScoreInputs(workspace.scores);
        }
    }, [workspace?.scores]);

    // 採点入力変更ハンドラ（三択：未採点/満たす/満たさない）
    const handleScoreChange = async (questionIdx: number, responseId: number, criterionId: string, value: boolean) => {
        let computedValue: boolean | null = null;
        setScoreInputs(prev => {
            const currentValue = prev[questionIdx]?.[responseId]?.[criterionId];
            // 同じ値が選択された場合は未採点状態にリセット
            const newValue = currentValue === value ? null : value;
            computedValue = newValue;
            return {
                ...prev,
                [questionIdx]: {
                    ...(prev[questionIdx] || {}),
                    [responseId]: {
                        ...((prev[questionIdx] || {})[responseId] || {}),
                        [criterionId]: newValue
                    }
                }
            };
        });

        // 変更を即時保存
        try {
            if (workspace?.id) {
                await fetch(`/api/workspaces/${workspace.id}/scores`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questionIndex: questionIdx,
                        responseId,
                        criterionId,
                        value: computedValue,
                    }),
                });
            }
        } catch (e) {
            console.error('スコア保存に失敗しました', e);
        }
    };
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [loopMessage, setLoopMessage] = useState<string | null>(null);
    // 親から初期インデックスが与えられたら反映
    useEffect(() => {
        if (
            typeof initialIndex === 'number' &&
            initialIndex >= 0 &&
            initialIndex < data.questions.length &&
            initialIndex !== currentQuestionIndex
        ) {
            setCurrentQuestionIndex(initialIndex);
        }
        // 注意: currentQuestionIndex を依存に含めると、ボタン操作での変更が初期値で上書きされてしまう
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialIndex, data.questions.length]);

    if (!data.questions.length) {
        return (
            <div className="text-center p-8 text-gray-500">
                問題データがありません
            </div>
        );
    }

    const displayTitles = workspace?.questionTitles && workspace.questionTitles.length === data.questions.length
        ? workspace.questionTitles
        : undefined;
    const currentQuestion = data.questions[currentQuestionIndex];
    const currentDisplayTitle = displayTitles?.[currentQuestionIndex] && displayTitles[currentQuestionIndex].trim() !== ''
        ? displayTitles[currentQuestionIndex]
        : currentQuestion;
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
                <div className="prose max-w-none prose-pre:whitespace-pre-wrap prose-code:before:content-[''] prose-code:after:content-['']">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code({ className, children, ...props }) {
                                const codeString = String(children ?? '');
                                const match = /language-(\w+)/.exec(className || '');
                                const looksBlock = codeString.includes('\n');
                                if (looksBlock) {
                                    const detected = detectLanguage(codeString);
                                    const lang = match?.[1] || (detected === 'text' ? 'javascript' : detected);
                                    return (
                                        <SyntaxHighlighter
                                            language={lang}
                                            style={vscDarkPlus}
                                            customStyle={{ margin: 0, borderRadius: '6px', fontSize: '13px', lineHeight: '1.4' }}
                                            wrapLongLines={true}
                                        >
                                            {codeString.replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    );
                                }
                                return (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                );
                            },
                        }}
                    >
                        {currentDisplayTitle}
                    </ReactMarkdown>
                </div>
            </div>

            {/* 全員の回答一覧 */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-700 mb-4">
                    回答一覧 ({data.totalResponses}件)
                </h3>
                <div className="grid gap-4">
                    {data.responses.map((response, index: number) => {
                        const questionIdx = currentQuestionIndex;
                        const responseId = Number(response.ID);
                        const criteria = scoringCriteria?.[questionIdx]?.criteria || [];
                        return (
                            <div key={response.ID} className="bg-white border rounded-lg p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded-full">
                                        {index + 1}
                                    </span>
                                    <span className="font-medium text-gray-800">
                                        {response.名前}
                                    </span>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500 mb-3">
                                    {renderAnswerContent(String(response[currentQuestion] || ''))}
                                </div>
                                {/* 採点部分：基準がある場合のみ表示 */}
                                {criteria.length > 0 && (
                                    <div className="w-full">
                                        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-gray-100 text-gray-800 text-sm font-medium px-2 py-0.5 rounded">採点</span>
                                                </div>
                                                <div />
                                            </div>

                                            <div className="flex flex-col items-start gap-2">
                                                {criteria.map((criterion) => {
                                                    const currentValue = scoreInputs[questionIdx]?.[responseId]?.[criterion.id] ?? null;
                                                    return (
                                                        <div key={criterion.id} className="flex items-start gap-2 w-full">
                                                            <ButtonGroup variant="outlined" size="medium" disableElevation sx={{ minHeight: 0, minWidth: 0 }}>
                                                                <Tooltip title="満たす" arrow>
                                                                    <Button
                                                                        color={currentValue === true ? 'success' : 'inherit'}
                                                                        variant={currentValue === true ? 'contained' : 'outlined'}
                                                                        onClick={() => handleScoreChange(questionIdx, responseId, criterion.id, true)}
                                                                        sx={{
                                                                            minWidth: 36,
                                                                            minHeight: 36,
                                                                            width: 36,
                                                                            height: 36,
                                                                            p: 0,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                        }}
                                                                    >
                                                                        <CheckIcon fontSize="medium" style={{ margin: 0 }} />
                                                                    </Button>
                                                                </Tooltip>
                                                                <Tooltip title="満たさない" arrow>
                                                                    <Button
                                                                        color={currentValue === false ? 'error' : 'inherit'}
                                                                        variant={currentValue === false ? 'contained' : 'outlined'}
                                                                        onClick={() => handleScoreChange(questionIdx, responseId, criterion.id, false)}
                                                                        sx={{
                                                                            minWidth: 36,
                                                                            minHeight: 36,
                                                                            width: 36,
                                                                            height: 36,
                                                                            p: 0,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                        }}
                                                                    >
                                                                        <CloseIcon fontSize="medium" style={{ margin: 0 }} />
                                                                    </Button>
                                                                </Tooltip>
                                                            </ButtonGroup>
                                                            <span
                                                                className="text-xs text-gray-600 ml-2 whitespace-pre-wrap break-words flex-1"
                                                                title={criterion.description}
                                                            >
                                                                {criterion.description}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
