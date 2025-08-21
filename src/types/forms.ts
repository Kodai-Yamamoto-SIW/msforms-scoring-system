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
