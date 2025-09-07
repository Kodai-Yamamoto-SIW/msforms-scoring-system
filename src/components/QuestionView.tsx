'use client';

import React, { useState, useEffect, MutableRefObject, memo } from 'react';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
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
    commentsRef?: MutableRefObject<Record<number, Record<number, string>>>; // 親が最新を参照するためのref
}

// 行コンポーネント（メモ化）
import { FormsResponse } from '@/types/forms';

interface AnswerRowProps {
    index: number;
    response: FormsResponse;
    questionIdx: number;
    criteria: QuestionScoringCriteria['criteria'];
    scoreInputs: Record<number, Record<number, Record<string, boolean | null>>>;
    onScoreChange: (questionIdx: number, responseId: number, criterionId: string, value: boolean) => void;
    commentsRef?: MutableRefObject<Record<number, Record<number, string>>>;
    workspaceId?: string;
    renderAnswerContent: (content: string) => React.ReactElement;
    questionKey: string; // key用に不変値
}

const AnswerRow = memo(function AnswerRow ({
    index,
    response,
    questionIdx,
    criteria,
    scoreInputs,
    onScoreChange,
    commentsRef,
    workspaceId,
    renderAnswerContent,
    questionKey,
}: AnswerRowProps) {
    const responseId = Number(response.ID);
    return (
        <div className="bg-white border rounded-lg p-4 shadow-sm" key={response.ID}>
            <div className="flex items-center gap-3 mb-3">
                <span className="bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded-full">
                    {index + 1}
                </span>
                <span className="font-medium text-gray-800">
                    {response.名前}
                </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500 mb-3">
                {renderAnswerContent(String(response[questionKey] || ''))}
            </div>
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
                            {criteria.map((criterion) => (
                                <ScoreCell
                                    key={criterion.id}
                                    criterionId={criterion.id}
                                    questionIdx={questionIdx}
                                    responseId={responseId}
                                    description={criterion.description}
                                    value={scoreInputs[questionIdx]?.[responseId]?.[criterion.id] ?? null}
                                    onScoreChange={onScoreChange}
                                />
                            ))}
                            <div className="w-full mt-4">
                                <label className="block text-xs font-medium text-gray-600 mb-1">コメント</label>
                                <textarea
                                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    rows={1}
                                    style={{ overflow: 'hidden', resize: 'none' }}
                                    defaultValue={commentsRef?.current?.[questionIdx]?.[responseId] || ''}
                                    /* 質問切替時のみ再マウントして defaultValue を反映（コメント入力中は保持）*/
                                    key={`c-${questionIdx}-${responseId}`}
                                    placeholder="この回答へのフィードバックや指摘を入力..."
                                    ref={(el) => {
                                        if (el) {
                                            // 初期マウント時に高さ調整
                                            el.style.height = 'auto';
                                            el.style.height = `${el.scrollHeight}px`;
                                        }
                                    }}
                                    onInput={(e) => {
                                        const ta = e.currentTarget;
                                        // 入力ごとに高さ再計算
                                        ta.style.height = 'auto';
                                        ta.style.height = `${ta.scrollHeight}px`;
                                    }}
                                    onChange={(e) => {
                                        if (!commentsRef) return;
                                        const value = e.target.value;
                                        const cur = commentsRef.current;
                                        if (!cur[questionIdx]) cur[questionIdx] = {};
                                        cur[questionIdx][responseId] = value;
                                    }}
                                    onBlur={async (e) => {
                                        if (!workspaceId) return;
                                        const value = e.target.value;
                                        try {
                                            await fetch(`/api/workspaces/${workspaceId}/comments`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    questionIndex: questionIdx,
                                                    responseId,
                                                    comment: value,
                                                }),
                                            });
                                        } catch (err) {
                                            console.error('コメント保存に失敗', err);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    // スコアオブジェクトとコメント値が変わっていなければ再レンダー回避
    const pid = Number(prev.response.ID);
    const nid = Number(next.response.ID);
    if (pid !== nid) return false;
    // 質問が切り替わった場合は再レンダー（表示する回答内容/コメント初期値が変化するため）
    if (prev.questionIdx !== next.questionIdx) return false;
    if (prev.questionKey !== next.questionKey) return false;
    const prevScore = prev.scoreInputs[prev.questionIdx]?.[pid];
    const nextScore = next.scoreInputs[next.questionIdx]?.[nid];
    if (prevScore !== nextScore) return false; // 参照変化時のみ再レンダー
    // コメントは ref ミュータブル更新なのでここでは比較しない（変更で再レンダー不要）
    return true;
});

// 個別スコアセル（更に細かいメモ化で同一行内の不要再レンダー抑制）
interface ScoreCellProps {
    criterionId: string;
    questionIdx: number;
    responseId: number;
    description: string;
    value: boolean | null;
    onScoreChange: (questionIdx: number, responseId: number, criterionId: string, value: boolean) => void;
}

const ScoreCell = memo(function ScoreCell({ criterionId, questionIdx, responseId, description, value, onScoreChange }: ScoreCellProps) {
    return (
        <div className="flex items-start gap-2 w-full">
            <ButtonGroup variant="outlined" size="medium" disableElevation sx={{ minHeight: 0, minWidth: 0 }}>
                <Button
                    color={value === true ? 'success' : 'inherit'}
                    aria-label="基準を満たす"
                    variant={value === true ? 'contained' : 'outlined'}
                    onClick={() => onScoreChange(questionIdx, responseId, criterionId, true)}
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
                <Button
                    color={value === false ? 'error' : 'inherit'}
                    aria-label="基準を満たさない"
                    variant={value === false ? 'contained' : 'outlined'}
                    onClick={() => onScoreChange(questionIdx, responseId, criterionId, false)}
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
            </ButtonGroup>
            <span
                className="text-xs text-gray-600 ml-2 whitespace-pre-wrap break-words flex-1"
                title={description}
            >
                {description}
            </span>
        </div>
    );
}, (prev, next) => prev.value === next.value && prev.description === next.description);

export default function QuestionView({ data, workspace, initialIndex, commentsRef }: QuestionViewProps) {
    // 採点基準の取得
    const scoringCriteria: QuestionScoringCriteria[] | undefined = workspace?.scoringCriteria;

    // 採点入力値を一時的に保持するstate（questionIndex→responseId→criterionId→boolean | null）
    // null = 未採点, true = 満たす, false = 満たさない
    const [scoreInputs, setScoreInputs] = useState<Record<number, Record<number, Record<string, boolean | null>>>>({});

    // コメントは再レンダーを避けたいので state を使わず ref で親管理

    // サーバー保存済みスコア/コメント読込（workspaceのscores, commentsが届いたら反映）
    useEffect(() => {
        if (workspace?.scores) {
            setScoreInputs(workspace.scores);
        }
        if (workspace?.comments && commentsRef) {
            commentsRef.current = workspace.comments;
        }
    }, [workspace?.scores, workspace?.comments, commentsRef]);

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
                    {data.responses.map((response, index: number) => (
                        <AnswerRow
                            key={response.ID}
                            index={index}
                            response={response}
                            questionIdx={currentQuestionIndex}
                            criteria={scoringCriteria?.[currentQuestionIndex]?.criteria || []}
                            scoreInputs={scoreInputs}
                            onScoreChange={handleScoreChange}
                            commentsRef={commentsRef}
                            workspaceId={workspace?.id}
                            renderAnswerContent={renderAnswerContent}
                            questionKey={currentQuestion}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
