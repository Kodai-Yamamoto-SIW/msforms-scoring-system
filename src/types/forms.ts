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
}

export interface CreateWorkspaceRequest {
    name: string;
    description?: string;
    fileName: string;
    formsData: ParsedFormsData;
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
