import * as XLSX from 'xlsx';
import { FormsResponse, ParsedFormsData } from '@/types/forms';

// Excel日付の変換関数
const convertExcelDate = (value: string | number | undefined): string => {
    if (!value) return '';

    // 既に文字列形式の場合
    if (typeof value === 'string') {
        // YYYY/MM/DD HH:MM:SS 形式の場合はそのまま返す
        if (/^\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2}$/.test(value)) {
            return value;
        }
        return value;
    }

    // 数値（Excelシリアル日付）の場合
    if (typeof value === 'number') {
        try {
            // xlsxライブラリのSSF（SpreadSheet Format）を使用して日付変換
            const date = XLSX.SSF.parse_date_code(value);
            if (date) {
                const year = date.y;
                const month = String(date.m).padStart(2, '0');
                const day = String(date.d).padStart(2, '0');
                const hour = String(date.H || 0).padStart(2, '0');
                const minute = String(date.M || 0).padStart(2, '0');
                const second = String(date.S || 0).padStart(2, '0');
                return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
            }
        } catch (error) {
            console.warn('日付変換エラー:', error);
        }
    }

    return String(value);
};

export const parseFormsExcel = (file: File): Promise<ParsedFormsData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                // 最初のシートを取得
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // シートをJSONに変換（日付情報を保持）
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    raw: false,
                    dateNF: 'yyyy/mm/dd hh:mm:ss'
                });

                if (jsonData.length < 2) {
                    throw new Error('データが不十分です');
                }

                // ヘッダー行を取得
                const headers = jsonData[0] as string[];

                // 基本列のインデックスを確認
                const expectedColumns = ['ID', '開始時刻', '完了時刻', 'メール', '名前'];
                expectedColumns.forEach((col, index) => {
                    if (headers[index] !== col) {
                        console.warn(`列 ${index} が期待値 "${col}" と異なります: "${headers[index]}"`);
                    }
                });

                // 問題文の列を特定（5列目以降）
                const questionColumns = headers.slice(5);

                // データ行を処理
                const responses: FormsResponse[] = [];

                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i] as (string | number)[];

                    // ID列が空の場合は終了
                    if (!row[0]) break;

                    const response: FormsResponse = {
                        ID: Number(row[0]),
                        開始時刻: convertExcelDate(row[1]),
                        完了時刻: convertExcelDate(row[2]),
                        メール: String(row[3] || ''),
                        名前: String(row[4] || ''),
                    };

                    // 問題の回答を追加
                    questionColumns.forEach((question, index) => {
                        response[question] = String(row[5 + index] || '');
                    });

                    responses.push(response);
                }

                const result: ParsedFormsData = {
                    totalResponses: responses.length,
                    questions: questionColumns,
                    responses: responses
                };

                resolve(result);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('ファイルの読み込みに失敗しました'));
        };

        reader.readAsArrayBuffer(file);
    });
};
