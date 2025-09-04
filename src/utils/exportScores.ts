import JSZip from 'jszip';
import { ParsedFormsData, ScoringWorkspace, QuestionScoringCriteria } from '@/types/forms';

// 学籍番号をメールから抽出: 先頭英字+数字（数字部分が学籍番号）
export const extractStudentId = (email: string): string => {
    const m = email.match(/^[A-Za-z]+([0-9]+)/);
    return m ? m[1] : '';
};

const escapeHtml = (s: string) =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

// 単一受講者のHTML生成
export function buildStudentHtml(
    workspace: ScoringWorkspace,
    data: ParsedFormsData,
    scoring: ScoringWorkspace['scores'] | undefined,
    criteriaDef: QuestionScoringCriteria[] | undefined,
    studentIndex: number
): { fileName: string; html: string; folderName: string } {
    const response = data.responses[studentIndex];
    const name = String(response.名前 || '');
    const email = String(response.メール || '');
    const studentId = extractStudentId(email);
    const projectName = workspace.name || 'プロジェクト';

    // 表示用タイトル（なければ元の問題文）
    const titles = workspace.questionTitles && workspace.questionTitles.length === data.questions.length
        ? workspace.questionTitles
        : data.questions;

    let totalMax = 0;
    let totalScore = 0;

    const problemBlocks: string[] = data.questions.map((questionKey, qIndex) => {
        const displayTitle = titles[qIndex] || questionKey;
        const answer = String(response[questionKey] || '');
        const criteria = criteriaDef?.[qIndex]?.criteria || [];
        if (!criteria.length) {
            return `
            <section class="problem">
              <h3>問${qIndex + 1}</h3>
              <div class="question">${escapeHtml(displayTitle)}</div>
              <div class="answer"><pre>${escapeHtml(answer)}</pre></div>
              <div class="note muted">（この問題の採点基準は設定されていません）</div>
            </section>`;
        }

        // 小計を計算
        let subtotal = 0;
        let subMax = 0;
        const rows = criteria.map((c) => {
            const value = scoring?.[qIndex]?.[Number(response.ID)]?.[c.id] ?? null;
            const given = value === true ? c.maxScore : 0;
            subtotal += given;
            subMax += c.maxScore;
            return `
            <tr>
              <td class="criteria-desc">${escapeHtml(c.description)}</td>
              <td class="criteria-mark">${value === true ? '〇' : value === false ? '×' : '-'}</td>
              <td class="criteria-score">${given} / ${c.maxScore}</td>
            </tr>`;
        }).join('\n');

        totalScore += subtotal;
        totalMax += subMax;

        return `
        <section class="problem">
          <h3>問${qIndex + 1}</h3>
          <div class="question">${escapeHtml(displayTitle)}</div>
          <div class="answer"><pre>${escapeHtml(answer)}</pre></div>
          <table class="criteria-table">
            <thead>
              <tr><th>採点基準</th><th>判定</th><th>得点</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="subtotal">小計: <strong>${subtotal}</strong> / ${subMax}</div>
        </section>`;
    });

    const css = `
      :root { --fg:#222; --muted:#666; --brand:#2563eb; --bg:#fff; --line:#e5e7eb; }
      *{ box-sizing:border-box; }
      body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, Helvetica, Arial, sans-serif; color:var(--fg); background:var(--bg); margin:0; }
      .container{ max-width:920px; margin:40px auto; padding:0 16px; }
      h1{ font-size:28px; margin:0 0 4px; }
      .summary{ color:var(--muted); margin-bottom:20px; }
      .total{ background:#f8fafc; border:1px solid var(--line); padding:12px 16px; border-radius:8px; margin:16px 0 24px; }
      .problem{ border:1px solid var(--line); border-radius:8px; padding:16px; margin:16px 0; }
      .problem h3{ margin:0 0 8px; color:var(--brand); }
      .question{ font-weight:600; margin-bottom:8px; white-space:pre-wrap; }
      .answer{ background:#f9fafb; border-left:4px solid var(--brand); padding:12px; border-radius:6px; overflow:auto; }
      .answer pre{ margin:0; white-space:pre-wrap; word-break:break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size:13px; }
      .criteria-table{ width:100%; border-collapse:collapse; margin-top:12px; }
      .criteria-table th, .criteria-table td{ border:1px solid var(--line); padding:8px; text-align:left; vertical-align:top; }
      .criteria-desc{ width:60%; }
      .criteria-mark{ width:10%; text-align:center; }
      .criteria-score{ width:30%; text-align:right; }
      .subtotal{ text-align:right; margin-top:8px; font-weight:600; }
      .muted{ color:var(--muted); }
      .note{ margin-top:8px; }
      .header{ display:flex; gap:16px; align-items:baseline; flex-wrap:wrap; }
      .badge{ display:inline-block; background:#eef2ff; color:#3730a3; padding:2px 8px; border-radius:999px; font-size:12px; }
    `;

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(projectName)} 採点結果 ${escapeHtml(studentId)} ${escapeHtml(name)}</title>
  <style>${css}</style>
 </head>
 <body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(projectName)} 採点結果</h1>
      <span class="badge">${escapeHtml(studentId)} ${escapeHtml(name)}</span>
    </div>
    <div class="summary">合計: <strong>${totalScore}</strong> / ${totalMax}</div>
    <div>
      ${problemBlocks.join('\n')}
    </div>
  </div>
 </body>
</html>`;

    const safeProject = projectName.replace(/[\\/:*?"<>|]/g, ' ').trim();
    const safeName = name.replace(/[\\/:*?"<>|]/g, ' ').trim();
    const safeId = studentId.replace(/[\\/:*?"<>|]/g, ' ').trim();

    const folderName = `${safeId} ${safeName}`.trim();
    const fileName = `${safeProject} 採点結果 ${safeId} ${safeName}.html`.trim();

    return { fileName, html, folderName };
}

// すべての受講者のHTMLをZIPでダウンロード
export async function exportAllAsZip(workspace: ScoringWorkspace) {
    const data = workspace.formsData;
    const zip = new JSZip();

    for (let i = 0; i < data.responses.length; i++) {
        const { fileName, html, folderName } = buildStudentHtml(
            workspace,
            data,
            workspace.scores,
            workspace.scoringCriteria,
            i
        );
        zip.folder(folderName)?.file(fileName, html);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeProject = (workspace.name || 'プロジェクト').replace(/[\\/:*?"<>|]/g, ' ').trim();
    a.download = `${safeProject} 採点結果一式.zip`;
    a.click();
    URL.revokeObjectURL(url);
}
