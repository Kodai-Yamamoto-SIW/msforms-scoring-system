'use client';

import React, { useState, useEffect, MutableRefObject } from 'react';
import { ParsedFormsData, ScoringWorkspace, QuestionScoringCriteria } from '@/types/forms';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isCodeContent, detectLanguage } from '@/utils/codeDetection';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

interface PersonViewProps {
    data: ParsedFormsData;
    workspace?: ScoringWorkspace;
    commentsRef?: MutableRefObject<Record<number, Record<number, string>>>; // questionIndex -> responseId -> comment
}

interface ScoreCellProps {
    criterionId: string;
    questionIdx: number;
    responseId: number;
    description: string;
    value: boolean | null;
    onScoreChange: (questionIdx: number, responseId: number, criterionId: string, value: boolean) => void;
}

const ScoreCell: React.FC<ScoreCellProps> = ({ criterionId, questionIdx, responseId, description, value, onScoreChange }) => (
    <div className="flex items-start gap-2 w-full">
        <ButtonGroup variant="outlined" size="medium" disableElevation sx={{ minHeight: 0, minWidth: 0 }}>
            <Button
                color={value === true ? 'success' : 'inherit'}
                aria-label="基準を満たす"
                variant={value === true ? 'contained' : 'outlined'}
                onClick={() => onScoreChange(questionIdx, responseId, criterionId, true)}
                sx={{ minWidth: 36, minHeight: 36, width: 36, height: 36, p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
                <CheckIcon fontSize="medium" style={{ margin: 0 }} />
            </Button>
            <Button
                color={value === false ? 'error' : 'inherit'}
                aria-label="基準を満たさない"
                variant={value === false ? 'contained' : 'outlined'}
                onClick={() => onScoreChange(questionIdx, responseId, criterionId, false)}
                sx={{ minWidth: 36, minHeight: 36, width: 36, height: 36, p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
                <CloseIcon fontSize="medium" style={{ margin: 0 }} />
            </Button>
        </ButtonGroup>
        <span className="text-xs text-gray-600 ml-2 whitespace-pre-wrap break-words flex-1" title={description}>{description}</span>
    </div>
);

export default function PersonView({ data, workspace, commentsRef }: PersonViewProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loopMessage, setLoopMessage] = useState<string | null>(null);
    const [showBasicInfo, setShowBasicInfo] = useState(false);
    const scoringCriteria: QuestionScoringCriteria[] | undefined = workspace?.scoringCriteria;
    const [scoreInputs, setScoreInputs] = useState<Record<number, Record<number, Record<string, boolean | null>>>>({});

    useEffect(() => {
        if (workspace?.scores) setScoreInputs(workspace.scores);
        if (workspace?.comments && commentsRef) commentsRef.current = workspace.comments;
    }, [workspace?.scores, workspace?.comments, commentsRef]);

    if (!data.responses.length) return <div className="text-center p-8 text-gray-500">回答データがありません</div>;

    const currentResponse = data.responses[currentIndex];
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === data.responses.length - 1;
    const loop = (m: string) => { setLoopMessage(m); setTimeout(() => setLoopMessage(null), 2000); };
    const next = () => { const n = (currentIndex + 1) % data.responses.length; if (currentIndex === data.responses.length - 1) loop('最後から最初の回答者に戻りました'); setCurrentIndex(n); };
    const prev = () => { const p = (currentIndex - 1 + data.responses.length) % data.responses.length; if (currentIndex === 0) loop('最初から最後の回答者に移動しました'); setCurrentIndex(p); };

    const handleScoreChange = async (questionIdx: number, responseId: number, criterionId: string, value: boolean) => {
        let computed: boolean | null = null;
        setScoreInputs(prev => {
            const cur = prev[questionIdx]?.[responseId]?.[criterionId];
            const newVal = cur === value ? null : value;
            computed = newVal;
            return { ...prev, [questionIdx]: { ...(prev[questionIdx] || {}), [responseId]: { ...((prev[questionIdx] || {})[responseId] || {}), [criterionId]: newVal } } };
        });
        try {
            if (workspace?.id) {
                await fetch(`/api/workspaces/${workspace.id}/scores`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ questionIndex: questionIdx, responseId, criterionId, value: computed })
                });
            }
        } catch (e) { console.error('スコア保存に失敗しました', e); }
    };

    const renderAnswerContent = (content: string) => {
        if (!content) return <span className="text-gray-400 italic">（回答なし）</span>;
        if (isCodeContent(content)) {
            const language = detectLanguage(content);
            return (
                <div className="relative group">
                    <SyntaxHighlighter language={language === 'text' ? 'javascript' : language} style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '6px', fontSize: '13px', lineHeight: '1.4' }} wrapLongLines>{content}</SyntaxHighlighter>
                    <span className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800/70 px-2 py-1 rounded opacity-60 group-hover:opacity-100 transition-opacity">{language === 'text' ? 'code' : language}</span>
                </div>
            );
        }
        return <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{content}</div>;
    };

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '未設定';
        try {
            if (/^\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2}$/.test(dateStr)) {
                const [d, t] = dateStr.split(' '); const [y, m, da] = d.split('/'); const [hh, mm, ss] = t.split(':');
                const dt = new Date(Number(y), Number(m) - 1, Number(da), Number(hh), Number(mm), Number(ss));
                if (!isNaN(dt.getTime())) return dt.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
            const dt2 = new Date(dateStr); if (!isNaN(dt2.getTime())) return dt2.toLocaleString('ja-JP');
        } catch { }
        return dateStr;
    };

    const displayTitles = workspace?.questionTitles && workspace.questionTitles.length === data.questions.length ? workspace.questionTitles : undefined;
    const responseId = Number(currentResponse.ID);

    // 合計点 / 満点計算（人ごと）
    const totalMaxScore = (scoringCriteria || []).reduce((sum, qc) => sum + qc.criteria.reduce((s, c) => s + c.maxScore, 0), 0);
    const currentTotalScore = (scoringCriteria || []).reduce((sum, qc) => {
        const perQuestion = qc.criteria.reduce((s, c) => {
            const v = scoreInputs[qc.questionIndex]?.[responseId]?.[c.id];
            return s + (v === true ? c.maxScore : 0);
        }, 0);
        return sum + perQuestion;
    }, 0);
    const percent = totalMaxScore > 0 ? Math.round((currentTotalScore / totalMaxScore) * 100) : 0;

    return (
        <div className="w-full max-w-6xl mx-auto p-4">
            <div className="sticky top-0 bg-white border rounded-lg shadow-sm p-4 mb-6 z-10">
                {loopMessage && <div className="mb-3 p-2 bg-yellow-100 border border-yellow-300 rounded-md text-yellow-800 text-sm text-center">{loopMessage}</div>}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="text-xl font-bold text-gray-800">{currentResponse.名前}</div>
                        <div className="flex items-center gap-3">
                            <div className="text-sm text-gray-500">{currentIndex + 1} / {data.totalResponses}</div>
                            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${((currentIndex + 1) / data.totalResponses) * 100}%` }} /></div>
                        </div>
                        {totalMaxScore > 0 ? (
                            <div className="flex items-center gap-2 ml-2">
                                <span className="text-sm font-medium text-gray-700">
                                    合計: <span className="text-blue-600">{currentTotalScore}</span> / {totalMaxScore} 点
                                </span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                    {percent}%
                                </span>
                            </div>
                        ) : (
                            <span className="text-xs text-gray-400 ml-2">採点基準未設定</span>
                        )}
                        <button onClick={() => setShowBasicInfo(!showBasicInfo)} className="text-sm text-blue-600 hover:text-blue-800 underline">{showBasicInfo ? '詳細を隠す' : '詳細を表示'}</button>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={prev} disabled={data.responses.length <= 1} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium" title={isFirst ? '最後の回答者に移動' : '前の回答者に移動'}>{isFirst ? '← 末尾へ' : '← 前'}</button>
                        <button onClick={next} disabled={data.responses.length <= 1} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium" title={isLast ? '最初の回答者に移動' : '次の回答者に移動'}>{isLast ? '最初へ →' : '次 →'}</button>
                    </div>
                </div>
                {showBasicInfo && (
                    <div className="mt-4 pt-4 border-t border-gray-200 text-sm grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><span className="text-gray-500">ID:</span> {currentResponse.ID}</div>
                        <div><span className="text-gray-500">メール:</span> {currentResponse.メール}</div>
                        <div><span className="text-gray-500">開始:</span> {formatDateTime(currentResponse.開始時刻)}</div>
                        <div><span className="text-gray-500">完了:</span> {formatDateTime(currentResponse.完了時刻)}</div>
                    </div>
                )}
            </div>
            <div className="space-y-8">
                {data.questions.map((question, qIndex) => {
                    const criteria = scoringCriteria?.[qIndex]?.criteria || [];
                    const displayTitle = displayTitles?.[qIndex] && displayTitles[qIndex].trim() !== '' ? displayTitles[qIndex] : question;
                    return (
                        <div key={qIndex} className="bg-white border rounded-lg p-6 shadow-sm">
                            <div className="mb-4">
                                <div className="flex items-center gap-3 mb-3"><span className="bg-blue-600 text-white text-lg font-bold px-4 py-2 rounded-md">問{qIndex + 1}</span></div>
                                <div className="prose max-w-none prose-pre:whitespace-pre-wrap prose-code:before:content-[''] prose-code:after:content-[''] mb-4">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                        code({ className, children, ...props }) {
                                            const codeString = String(children ?? '');
                                            const match = /language-(\w+)/.exec(className || '');
                                            const looksBlock = codeString.includes('\n');
                                            if (looksBlock) {
                                                const detected = detectLanguage(codeString);
                                                const lang = match?.[1] || (detected === 'text' ? 'javascript' : detected);
                                                return <SyntaxHighlighter language={lang} style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '6px', fontSize: '13px', lineHeight: '1.4' }} wrapLongLines>{codeString.replace(/\n$/, '')}</SyntaxHighlighter>;
                                            }
                                            return <code className={className} {...props}>{children}</code>;
                                        }
                                    }}>{displayTitle}</ReactMarkdown>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">{renderAnswerContent(String(currentResponse[question] || ''))}</div>
                            </div>
                            {criteria.length > 0 && (
                                <div className="mt-4 border-t pt-4">
                                    <div className="flex items-center gap-2 mb-2"><span className="bg-gray-100 text-gray-800 text-sm font-medium px-2 py-0.5 rounded">採点</span><span className="text-xs text-gray-500">（クリックでON/OFF / 同じボタン再クリックで未採点）</span></div>
                                    <div className="flex flex-col gap-2 mb-4">{criteria.map(c => (
                                        <ScoreCell key={c.id} criterionId={c.id} questionIdx={qIndex} responseId={responseId} description={c.description} value={scoreInputs[qIndex]?.[responseId]?.[c.id] ?? null} onScoreChange={handleScoreChange} />
                                    ))}</div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">コメント</label>
                                        <textarea
                                            className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={1}
                                            style={{ overflow: 'hidden', resize: 'none' }}
                                            key={`comment-${qIndex}-${responseId}`}
                                            defaultValue={commentsRef?.current?.[qIndex]?.[responseId] || ''}
                                            placeholder="この回答へのフィードバックを入力..."
                                            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                                            onInput={(e) => { const ta = e.currentTarget; ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }}
                                            onChange={(e) => { if (!commentsRef) return; const v = e.target.value; const cur = commentsRef.current; if (!cur[qIndex]) cur[qIndex] = {}; cur[qIndex][responseId] = v; }}
                                            onBlur={async (e) => { if (!workspace?.id) return; const v = e.target.value; try { await fetch(`/api/workspaces/${workspace.id}/comments`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionIndex: qIndex, responseId, comment: v }) }); } catch (err) { console.error('コメント保存に失敗', err); } }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
