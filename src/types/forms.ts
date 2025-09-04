// Microsoft Formsから出力されたExcelデータの型定義

export interface FormsResponse {
    ID: number;
    開始時刻: string;
    完了時刻: string;
    メール: string;
    名前: string;
    [key: string]: string | number; // 問題文の列（動的）
}

export interface FormsData {
    headers: string[];
    responses: FormsResponse[];
    questionColumns: string[]; // 問題文の列名のリスト
}

export interface ParsedFormsData {
    totalResponses: number;
    questions: string[];
    responses: FormsResponse[];
    // Track Training: 自動採点で正答だった回答のマスク（questionIndex -> responseId -> true）
    autoCorrectMask?: Record<number, Record<number, boolean>>;
}

// 採点基準の型定義
export interface ScoringCriterion {
    id: string;
    description: string; // 採点基準の説明
    maxScore: number; // 最大得点
}

export interface QuestionScoringCriteria {
    questionIndex: number; // 問題のインデックス
    questionText: string; // 問題文
    criteria: ScoringCriterion[]; // 採点基準のリスト
}

// 採点ワークスペース関連の型定義
export interface ScoringWorkspace {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    formsData: ParsedFormsData;
    fileName: string; // 元のExcelファイル名
    scoringCriteria?: QuestionScoringCriteria[]; // 採点基準
    // 採点結果（questionIndex -> responseId -> criterionId -> boolean | null）
    scores?: Record<number, Record<number, Record<string, boolean | null>>>;
    // 表示用の問題タイトル（インデックス対応）。未設定や空文字の場合は formsData.questions の値を表示に使用
    questionTitles?: string[];
    // Track Training 由来: 自動採点で正答と判定された回答のマスク（questionIndex -> responseId -> true）
    autoCorrectMask?: Record<number, Record<number, boolean>>;
}

export interface CreateWorkspaceRequest {
    name: string;
    description?: string;
    fileName: string;
    formsData: ParsedFormsData;
}

export interface UpdateWorkspaceRequest {
    name?: string;
    description?: string;
}

export interface ReimportDataRequest {
    newData: ParsedFormsData;
    fileName: string;
}

export interface DataValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface DataDiffResult {
    added: FormsResponse[];
    removed: FormsResponse[];
    updated: FormsResponse[];
}

export interface WorkspaceSummary {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    fileName: string;
    totalResponses: number;
    totalQuestions: number;
}
