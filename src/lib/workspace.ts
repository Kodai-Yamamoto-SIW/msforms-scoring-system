// サーバーサイドデータストレージ（ファイルベース）
import fs from 'fs';
import path from 'path';
import { ScoringWorkspace, WorkspaceSummary, CreateWorkspaceRequest, ParsedFormsData, FormsResponse, QuestionScoringCriteria } from '@/types/forms';
import { validateDataCompatibility, detectDataDifferences } from '@/utils/dataValidation';

const DATA_DIR = path.join(process.cwd(), 'data', 'workspaces');

// ----------------------------
// 低レベル: ファイルロック & 原子的書き込み
// ----------------------------
// 同一プロセス内の同時更新(高速連打や複数タブ)でJSONが壊れることがあったため、
// 以下の対策を行う:
// 1) withFileLock: 書き込み対象ファイルごとに逐次化
// 2) atomicWriteJson: 一時ファイルへ完全書き込み後 rename で置換 (部分書き込み防止)
// 3) バックアップ (直前世代) を .bak に保存 (復旧用)

const fileLocks = new Map<string, Promise<unknown>>();

const withFileLock = async <T>(filePath: string, fn: () => Promise<T>): Promise<T> => {
    const prev = fileLocks.get(filePath) || Promise.resolve();
    let result: T;
    const exec = prev.then(fn).then(r => { result = r; });
    // 直列実行チェーンを更新
    fileLocks.set(filePath, exec.catch(() => {}));
    try {
        await exec; // 実行完了待ち
        return result!;
    } finally {
        // 自分が末尾ならロック解放
        if (fileLocks.get(filePath) === exec.catch(() => {})) {
            fileLocks.delete(filePath);
        }
    }
};

const atomicWriteJson = async (filePath: string, data: unknown) => {
    const tmpPath = filePath + '.tmp';
    const bakPath = filePath + '.bak';
    const json = JSON.stringify(data, null, 2);
    // 既存ファイルをバックアップ (失敗しても続行)
    if (fs.existsSync(filePath)) {
        try { await fs.promises.copyFile(filePath, bakPath); } catch { /* ignore */ }
    }
    await fs.promises.writeFile(tmpPath, json, 'utf-8');
    await fs.promises.rename(tmpPath, filePath); // rename は概ね原子的
};

// データディレクトリの初期化
const ensureDataDir = () => {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
};

// ワークスペースを保存
export const saveWorkspace = async (request: CreateWorkspaceRequest): Promise<ScoringWorkspace> => {
    console.log('saveWorkspace 関数が呼ばれました');
    ensureDataDir();
    console.log('データディレクトリを確認/作成しました:', DATA_DIR);

    const workspace: ScoringWorkspace = {
        id: generateWorkspaceId(),
        name: request.name,
        description: request.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        formsData: request.formsData,
        fileName: request.fileName,
    };

    console.log('作成するワークスペース:', {
        id: workspace.id,
        name: workspace.name,
        fileName: workspace.fileName,
        dataSize: JSON.stringify(workspace.formsData).length
    });

    const filePath = path.join(DATA_DIR, `${workspace.id}.json`);
    console.log('保存先ファイルパス:', filePath);

    try {
        await withFileLock(filePath, async () => {
            await atomicWriteJson(filePath, workspace);
        });
        console.log('ファイル保存完了');

        // 実際にファイルが作成されたか確認
        const exists = fs.existsSync(filePath);
        console.log('ファイル存在確認:', exists);

        return workspace;
    } catch (error) {
        console.error('ファイル保存エラー:', error);
        throw error;
    }
};

// ワークスペース一覧を取得
export const getWorkspaces = async (): Promise<WorkspaceSummary[]> => {
    console.log('getWorkspaces 関数が呼ばれました');
    ensureDataDir();
    console.log('データディレクトリ:', DATA_DIR);

    try {
        const files = await fs.promises.readdir(DATA_DIR);
        console.log('見つかったファイル:', files);
        const workspaceSummaries: WorkspaceSummary[] = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const filePath = path.join(DATA_DIR, file);
                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    const workspace: ScoringWorkspace = JSON.parse(content);

                    workspaceSummaries.push({
                        id: workspace.id,
                        name: workspace.name,
                        description: workspace.description,
                        createdAt: workspace.createdAt,
                        updatedAt: workspace.updatedAt,
                        fileName: workspace.fileName,
                        totalResponses: workspace.formsData.totalResponses,
                        totalQuestions: workspace.formsData.questions.length,
                    });
                } catch (error) {
                    console.error(`ワークスペースファイル ${file} の読み込みに失敗:`, error);
                }
            }
        }

        console.log('読み込んだワークスペース数:', workspaceSummaries.length);
        // 更新日時の降順でソート
        return workspaceSummaries.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    } catch (error) {
        console.error('ワークスペース一覧の取得に失敗:', error);
        return [];
    }
};

// 特定のワークスペースを取得
export const getWorkspace = async (id: string): Promise<ScoringWorkspace | null> => {
    ensureDataDir();

    try {
        const filePath = path.join(DATA_DIR, `${id}.json`);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`ワークスペース ${id} の取得に失敗:`, error);
        return null;
    }
};

// ワークスペースを削除
export const deleteWorkspace = async (id: string): Promise<boolean> => {
    ensureDataDir();

    try {
        const filePath = path.join(DATA_DIR, `${id}.json`);
        await fs.promises.unlink(filePath);
        return true;
    } catch (error) {
        console.error(`ワークスペース ${id} の削除に失敗:`, error);
        return false;
    }
};

// ワークスペースを更新
export const updateWorkspace = async (id: string, updates: { name?: string; description?: string }): Promise<ScoringWorkspace | null> => {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, `${id}.json`);
    return withFileLock(filePath, async () => {
        try {
            const existingWorkspace = await getWorkspace(id);
            if (!existingWorkspace) return null;
            const updatedWorkspace: ScoringWorkspace = {
                ...existingWorkspace,
                ...updates,
                updatedAt: new Date().toISOString(),
            };
            await atomicWriteJson(filePath, updatedWorkspace);
            console.log('ワークスペース更新完了:', updatedWorkspace.id);
            return updatedWorkspace;
        } catch (error) {
            console.error(`ワークスペース ${id} の更新に失敗:`, error);
            return null;
        }
    });
};

// ワークスペースのデータを再インポート
export const reimportWorkspaceData = async (
    id: string,
    newData: ParsedFormsData,
    fileName: string
): Promise<{
    success: boolean;
    error?: string;
    details?: {
        added?: number;
        updated?: number;
        removed?: number;
        totalResponses?: number;
    } | string[];
}> => {
    ensureDataDir();

    try {
        console.log('ワークスペースデータ再インポート開始:', id);

        // 既存のワークスペースを取得
        const existingWorkspace = await getWorkspace(id);
        if (!existingWorkspace) {
            return { success: false, error: 'ワークスペースが見つかりません' };
        }

        console.log('既存データの問題数:', existingWorkspace.formsData.questions.length);
        console.log('新規データの問題数:', newData.questions.length);

        // データの互換性を検証
        const validation = validateDataCompatibility(existingWorkspace.formsData, newData);
        if (!validation.isValid) {
            return {
                success: false,
                error: 'データの互換性エラー',
                details: validation.errors
            };
        }

        // データの差分を検出
        const diff = detectDataDifferences(existingWorkspace.formsData, newData);
        console.log('データ差分:', {
            added: diff.added.length,
            updated: diff.updated.length,
            removed: diff.removed.length
        });

        // 新しいレスポンスリストを構築
        const responseMap = new Map<string, FormsResponse>();

        // 既存の回答をマップに追加（削除されないもののみ）
        existingWorkspace.formsData.responses.forEach(response => {
            const email = String(response.メール);
            const isRemoved = diff.removed.some(r => String(r.メール) === email);
            if (!isRemoved) {
                responseMap.set(email, response);
            }
        });

        // 更新された回答で上書き
        diff.updated.forEach(response => {
            const email = String(response.メール);
            responseMap.set(email, response);
        });

        // 新規追加された回答を追加
        diff.added.forEach(response => {
            const email = String(response.メール);
            responseMap.set(email, response);
        });

        // 最終的なレスポンス配列を構築
        const updatedResponses = Array.from(responseMap.values());

        // 更新されたワークスペースを作成
        const updatedWorkspace: ScoringWorkspace = {
            ...existingWorkspace,
            formsData: {
                ...newData,
                responses: updatedResponses,
                totalResponses: updatedResponses.length
            },
            fileName: fileName,
            updatedAt: new Date().toISOString(),
        };

        // ファイルに保存
        const filePath = path.join(DATA_DIR, `${id}.json`);
        await withFileLock(filePath, async () => {
            await atomicWriteJson(filePath, updatedWorkspace);
        });
        console.log('ワークスペースデータ再インポート完了:', id);

        return {
            success: true,
            details: {
                added: diff.added.length,
                updated: diff.updated.length,
                removed: diff.removed.length,
                totalResponses: updatedResponses.length
            }
        };
    } catch (error) {
        console.error(`ワークスペース ${id} のデータ再インポートに失敗:`, error);
        return { success: false, error: 'データの再インポートに失敗しました' };
    }
};

// ワークスペースの採点基準を更新
export const updateScoringCriteria = async (id: string, criteria: QuestionScoringCriteria[]): Promise<ScoringWorkspace | null> => {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, `${id}.json`);
    return withFileLock(filePath, async () => {
        try {
            console.log('採点基準更新開始:', id);
            const existingWorkspace = await getWorkspace(id);
            if (!existingWorkspace) return null;

            const existingCriteria = existingWorkspace.scoringCriteria;
            const scores: ScoringWorkspace['scores'] = existingWorkspace.scores ? { ...existingWorkspace.scores } : {};
            const autoMask = existingWorkspace.formsData.autoCorrectMask || {};
            const existingIdsByQ: Record<number, Set<string>> = {};
            if (existingCriteria) {
                for (const qc of existingCriteria) {
                    existingIdsByQ[qc.questionIndex] = new Set(qc.criteria.map(c => c.id));
                }
            }
            for (const qc of criteria) {
                const qIndex = qc.questionIndex;
                const existingIds = existingIdsByQ[qIndex] || new Set<string>();
                for (const c of qc.criteria) {
                    const isNew = !existingIds.has(c.id);
                    if (!isNew) continue;
                    for (const resp of existingWorkspace.formsData.responses) {
                        const rid = Number(resp.ID);
                        const isAutoCorrect = Boolean(autoMask[qIndex]?.[rid]);
                        if (!scores![qIndex]) scores![qIndex] = {};
                        if (!scores![qIndex]![rid]) scores![qIndex]![rid] = {};
                        if (typeof scores![qIndex]![rid]![c.id] === 'undefined' || scores![qIndex]![rid]![c.id] === null) {
                            scores![qIndex]![rid]![c.id] = isAutoCorrect ? true : null;
                        }
                    }
                }
            }
            const updatedWorkspace: ScoringWorkspace = {
                ...existingWorkspace,
                scoringCriteria: criteria,
                scores,
                updatedAt: new Date().toISOString(),
            };
            await atomicWriteJson(filePath, updatedWorkspace);
            console.log('採点基準更新完了:', id);
            return updatedWorkspace;
        } catch (error) {
            console.error(`ワークスペース ${id} の採点基準更新に失敗:`, error);
            return null;
        }
    });
};

// 採点結果を更新（部分更新: 指定された経路のみ上書き）
export const upsertScores = async (
    id: string,
    updates: { questionIndex: number; responseId: number; criterionId: string; value: boolean | null }
): Promise<ScoringWorkspace | null> => {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, `${id}.json`);
    return withFileLock(filePath, async () => {
        try {
            console.log('採点結果更新開始:', id, updates);
            const existingWorkspace = await getWorkspace(id);
            if (!existingWorkspace) return null;
            const scores = existingWorkspace.scores || {};
            const { questionIndex, responseId, criterionId, value } = updates;
            const updatedScores: ScoringWorkspace['scores'] = { ...scores };
            if (!updatedScores![questionIndex]) updatedScores![questionIndex] = {};
            if (!updatedScores![questionIndex]![responseId]) updatedScores![questionIndex]![responseId] = {};
            updatedScores![questionIndex]![responseId]![criterionId] = value;
            const updatedWorkspace: ScoringWorkspace = {
                ...existingWorkspace,
                scores: updatedScores,
                updatedAt: new Date().toISOString(),
            };
            await atomicWriteJson(filePath, updatedWorkspace);
            console.log('採点結果更新完了:', id);
            return updatedWorkspace;
        } catch (error) {
            console.error('採点結果更新エラー:', error);
            return null;
        }
    });
};

// コメントを更新（questionIndex, responseId 単位で1つの自由記述）
export const upsertComment = async (
    id: string,
    updates: { questionIndex: number; responseId: number; comment: string }
): Promise<ScoringWorkspace | null> => {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, `${id}.json`);
    return withFileLock(filePath, async () => {
        try {
            console.log('コメント更新開始:', id, updates);
            const existingWorkspace = await getWorkspace(id);
            if (!existingWorkspace) return null;
            const comments = existingWorkspace.comments || {};
            const { questionIndex, responseId, comment } = updates;
            const updatedComments: ScoringWorkspace['comments'] = { ...comments };
            if (!updatedComments[questionIndex]) updatedComments[questionIndex] = {};
            updatedComments[questionIndex]![responseId] = comment;
            const updatedWorkspace: ScoringWorkspace = {
                ...existingWorkspace,
                comments: updatedComments,
                updatedAt: new Date().toISOString(),
            };
            await atomicWriteJson(filePath, updatedWorkspace);
            console.log('コメント更新完了:', id);
            return updatedWorkspace;
        } catch (error) {
            console.error('コメント更新エラー:', error);
            return null;
        }
    });
};

// ワークスペースIDを生成
const generateWorkspaceId = (): string => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `ws_${timestamp}_${randomStr}`;
};

// 表示用の問題タイトルを更新（配列長は questions と一致させる）
export const updateQuestionTitles = async (id: string, titles: string[]): Promise<ScoringWorkspace | null> => {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, `${id}.json`);
    return withFileLock(filePath, async () => {
        try {
            const existingWorkspace = await getWorkspace(id);
            if (!existingWorkspace) return null;
            const questionCount = existingWorkspace.formsData.questions.length;
            const normalized = Array.from({ length: questionCount }, (_, i) => (titles[i] ?? ''));
            const updatedWorkspace: ScoringWorkspace = {
                ...existingWorkspace,
                questionTitles: normalized,
                updatedAt: new Date().toISOString(),
            };
            await atomicWriteJson(filePath, updatedWorkspace);
            return updatedWorkspace;
        } catch (error) {
            console.error('質問タイトル更新エラー:', error);
            return null;
        }
    });
};
