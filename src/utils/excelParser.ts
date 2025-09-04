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
    const parseWorkbookToFormsData = (workbook: XLSX.WorkBook): ParsedFormsData => {
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

        // ヘッダー行を取得（string化して扱う）
        const headers = (jsonData[0] as (string | number | boolean | null | undefined)[]).map(h => String(h ?? ''));

        // Track Training 形式かの判定
        const isTrackTraining =
            headers.includes('traineeId') ||
            headers.includes('account') ||
            headers.some(h => /^q\d+\/answer$/.test(h));

        if (isTrackTraining) {
            // Track Training のヘッダー -> インデックスマップ
            const idx = (name: string) => headers.indexOf(name);
            const traineeIdIdx = idx('traineeId');
            const startAtIdx = idx('startAt');
            const endAtIdx = idx('endAt');
            const accountIdx = idx('account');
            const traineeNameIdx = idx('traineeName');

            // 利用可能な質問番号を抽出（qN/answer が存在する N）
            const qNumbers = headers
                .map(h => {
                    const m = h.match(/^q(\d+)\/answer$/);
                    return m ? Number(m[1]) : null;
                })
                .filter((n): n is number => n !== null)
                .sort((a, b) => a - b);

            const uniqueQNumbers = Array.from(new Set(qNumbers));
            const questionLabels = uniqueQNumbers.map(n => `q${n}`);

            const responses: FormsResponse[] = [];
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i] as (string | number | boolean | null | undefined)[];
                const traineeIdVal = row[traineeIdIdx];
                if (traineeIdIdx === -1 || traineeIdVal === undefined || traineeIdVal === null || String(traineeIdVal).trim() === '') {
                    // ID が無い行はスキップ
                    continue;
                }

                const resp: FormsResponse = {
                    ID: Number(traineeIdVal),
                    開始時刻: convertExcelDate(startAtIdx >= 0 ? (row[startAtIdx] as string | number | undefined) : ''),
                    完了時刻: convertExcelDate(endAtIdx >= 0 ? (row[endAtIdx] as string | number | undefined) : ''),
                    メール: String(accountIdx >= 0 ? (row[accountIdx] ?? '') : ''),
                    名前: String(traineeNameIdx >= 0 ? (row[traineeNameIdx] ?? '') : ''),
                };

                // 回答: qN/answer -> 'qN'
                uniqueQNumbers.forEach(n => {
                    const colName = `q${n}/answer`;
                    const colIdx = headers.indexOf(colName);
                    resp[`q${n}`] = String(colIdx >= 0 ? (row[colIdx] ?? '') : '');
                });

                responses.push(resp);
            }

            return {
                totalResponses: responses.length,
                questions: questionLabels,
                responses,
            };
        }

        // 既存（Microsoft Forms）形式の処理
        const expectedColumns = ['ID', '開始時刻', '完了時刻', 'メール', '名前'];
        expectedColumns.forEach((col, index) => {
            if (headers[index] !== col) {
                console.warn(`列 ${index} が期待値 "${col}" と異なります: "${headers[index]}"`);
            }
        });

        const questionColumns = headers.slice(5);
        const responses: FormsResponse[] = [];
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as (string | number | boolean | null | undefined)[];
            if (!row[0]) break; // ID 空で終了

            const response: FormsResponse = {
                ID: Number(row[0]),
                開始時刻: convertExcelDate(row[1] as string | number | undefined),
                完了時刻: convertExcelDate(row[2] as string | number | undefined),
                メール: String(row[3] || ''),
                名前: String(row[4] || ''),
            };

            questionColumns.forEach((question, index) => {
                response[question] = String(row[5 + index] || '');
            });

            responses.push(response);
        }

        return {
            totalResponses: responses.length,
            questions: questionColumns,
            responses,
        };
    };

    return new Promise((resolve, reject) => {
        const isCSV = /\.csv$/i.test(file.name) || file.type === 'text/csv';
        const reader = new FileReader();

        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));

        reader.onload = (e) => {
            try {
                if (isCSV) {
                    const text = e.target?.result as string;
                    const workbook = XLSX.read(text, { type: 'string' });
                    resolve(parseWorkbookToFormsData(workbook));
                } else {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    resolve(parseWorkbookToFormsData(workbook));
                }
            } catch (error) {
                reject(error);
            }
        };

        if (isCSV) {
            reader.readAsText(file, 'utf-8');
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
};
