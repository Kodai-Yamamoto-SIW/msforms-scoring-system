"use client";

import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { ScoringWorkspace } from "@/types/forms";
import { extractStudentId } from "@/utils/exportScores";
import { useDropzone, type FileRejection } from "react-dropzone";

interface Props {
    workspace: ScoringWorkspace;
}

export default function ScoreSheetFill({ workspace }: Props) {
    const [resultMsg, setResultMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const computeTotalsByStudentId = useCallback((): Record<string, number> => {
        const map: Record<string, number> = {};
        const data = workspace.formsData;
        for (const resp of data.responses) {
            const email = String(resp.メール || "");
            const sid = extractStudentId(email);
            if (!sid) continue;
            const rid = Number(resp.ID);
            let total = 0;
            for (let qi = 0; qi < data.questions.length; qi++) {
                const criteria = workspace.scoringCriteria?.[qi]?.criteria || [];
                if (!criteria.length) continue;
                const perQ = workspace.scores?.[qi]?.[rid] || {};
                for (const c of criteria) {
                    const v = perQ[c.id];
                    if (v === true) total += c.maxScore;
                }
            }
            map[sid] = total;
        }
        return map;
    }, [workspace]);

    const processCsvFile = useCallback(async (file: File) => {
        setError(null);
        setResultMsg(null);
        setProcessing(true);
        try {
            const text = await file.text();
            const wb = XLSX.read(text, { type: "string" });
            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json<string[] | number[]>(ws, { header: 1 }) as (string | number)[][];
            if (!rows.length) throw new Error("CSVが空です");

            // ヘッダー行の列位置を取得
            const header = rows[0].map((v) => String(v));
            const idxStudent = header.findIndex((h) => h.trim() === "学籍番号");
            const idxName = header.findIndex((h) => h.trim() === "氏名");
            const idxScore = header.findIndex((h) => h.trim() === "点数");
            if (idxStudent === -1 || idxName === -1 || idxScore === -1) {
                throw new Error("ヘッダーに『学籍番号』『氏名』『点数』が見つかりません");
            }

            const totals = computeTotalsByStudentId();
            let updated = 0;
            let missing = 0;

            const out: (string | number)[][] = rows.map((r) => [...r]);
            for (let i = 1; i < out.length; i++) {
                const row = out[i];
                if (!row || row.length === 0) continue;
                const sid = String(row[idxStudent] ?? "").trim();
                if (!sid) continue;
                if (sid in totals) {
                    row[idxScore] = totals[sid];
                    updated++;
                } else {
                    // 一致なし: 点数列は空欄にする
                    row[idxScore] = "";
                    missing++;
                }
            }

            // 出力CSVを生成
            const outWs = XLSX.utils.aoa_to_sheet(out);
            const csvText = XLSX.utils.sheet_to_csv(outWs);
            const bom = "\ufeff";
            const blob = new Blob([bom + csvText], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const baseName = file.name.replace(/\.csv$/i, "");
            a.download = `${baseName} 記入済.csv`;
            a.click();
            URL.revokeObjectURL(url);

            setResultMsg(`点数を記入しました: 更新 ${updated} 行 / 未一致 ${missing} 行`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setProcessing(false);
        }
    }, [computeTotalsByStudentId]);

    const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
        if (fileRejections && fileRejections.length > 0) {
            const reason = fileRejections[0].errors?.[0]?.message || "CSVの読み込みに失敗しました";
            setError(reason);
            return;
        }
        if (!acceptedFiles || acceptedFiles.length === 0) return;
        if (acceptedFiles.length > 1) {
            setError("CSVは1ファイルのみ選択してください");
            return;
        }
        await processCsvFile(acceptedFiles[0]);
    }, [processCsvFile]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "text/csv": [".csv"], "application/vnd.ms-excel": [".csv"] },
        multiple: false,
        disabled: processing,
        // クリックでもファイル選択を許可
        noClick: false,
    });

    return (
        <div className="w-full max-w-3xl mx-auto p-4 bg-white border rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">点数シートに反映</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
                所定のテンプレート（学籍番号, 氏名, 点数）CSVを選択すると、点数列に合計点を記入したCSVをダウンロードします。
                一致する学籍番号が見つからない場合（未回答者など）は点数列は空欄のまま残します。
            </p>
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-md p-6 text-center mb-3 transition-colors ${isDragActive ? "border-teal-600 bg-teal-50" : "border-gray-300 hover:border-gray-400"
                    } ${processing ? "opacity-60 pointer-events-none" : ""}`}
            >
                <input {...getInputProps()} />
                {isDragActive ? (
                    <p className="text-sm text-teal-700">ここにCSVをドロップしてアップロード</p>
                ) : (
                    <p className="text-sm text-gray-700">
                        CSVをここにドラッグ＆ドロップするか、この領域をクリックして選択
                    </p>
                )}
            </div>
            {processing && <div className="text-sm text-blue-700">処理中...</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
            {resultMsg && <div className="text-sm text-green-700">{resultMsg}</div>}
        </div>
    );
}
