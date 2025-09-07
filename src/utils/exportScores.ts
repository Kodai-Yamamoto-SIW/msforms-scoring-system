import JSZip from 'jszip';
import { ParsedFormsData, ScoringWorkspace, QuestionScoringCriteria } from '@/types/forms';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

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

// Markdown を安全な HTML に変換（失敗時はエスケープ文字列）
function markdownToSafeHtml(src: string): string {
  if (!src) return '';
  try {
  // marked を直接呼び出し（簡易オプション）
  const raw = marked(src, { gfm: true, breaks: true });
    // dompurify はブラウザ実行前提。SSR 側では window がないのでガード。
    if (typeof window === 'undefined') {
      // サーバー側ビルド時は最低限のサニタイズとしてタグ除去
      return String(raw).replace(/<script.*?>[\s\S]*?<\/script>/gi, '');
    }
    return DOMPurify.sanitize(String(raw), { USE_PROFILES: { html: true } });
  } catch (e) {
    console.warn('Markdown変換失敗: ', e);
    return `<pre>${escapeHtml(src)}</pre>`;
  }
}

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
    const comment = workspace.comments?.[qIndex]?.[Number(response.ID)] || '';
        const displayTitleHtml = markdownToSafeHtml(displayTitle);
        const commentHtml = comment ? markdownToSafeHtml(comment) : '';
        if (!criteria.length) {
            return `
            <section class="problem">
              <h3>問${qIndex + 1}</h3>
              <div class="question markdown-body">${displayTitleHtml}</div>
              <div class="answer-card" aria-labelledby="ans-title-${qIndex}">
                <div class="answer-card-header" id="ans-title-${qIndex}">受講者の回答</div>
                <div class="answer-body"><pre>${escapeHtml(answer)}</pre></div>
              </div>
              <div class="note muted">（この問題の採点基準は設定されていません）</div>
        ${commentHtml ? `<div class="comment"><strong>コメント:</strong><div class="comment-body markdown-body">${commentHtml}</div></div>` : ''}
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
          <div class="question markdown-body">${displayTitleHtml}</div>
          <div class="answer-card" aria-labelledby="ans-title-${qIndex}">
            <div class="answer-card-header" id="ans-title-${qIndex}">受講者の回答</div>
            <div class="answer-body"><pre>${escapeHtml(answer)}</pre></div>
          </div>
          <table class="criteria-table">
            <thead>
              <tr><th>採点基準</th><th>判定</th><th>得点</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="subtotal">小計: <strong>${subtotal}</strong> / ${subMax}</div>
          ${commentHtml ? `<div class="comment"><strong>コメント:</strong><div class="comment-body markdown-body">${commentHtml}</div></div>` : ''}
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
  .question{ font-weight:600; margin-bottom:8px; }
  .answer-card{ margin-top:8px; border:1px solid var(--line); background:#f0f9ff; border-left:4px solid #0284c7; border-radius:8px; box-shadow:0 1px 2px rgba(0,0,0,0.04); }
  .answer-card-header{ font-size:12px; font-weight:600; letter-spacing:.5px; color:#0369a1; text-transform:uppercase; padding:6px 10px; border-bottom:1px solid #e0f2fe; background:#e0f7ff; border-top-left-radius:8px; border-top-right-radius:8px; }
  .answer-body{ padding:10px 12px; font-size:13px; line-height:1.5; white-space:pre-wrap; word-break:break-word; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  .answer-body pre{ margin:0; background:transparent; white-space:pre-wrap; word-break:break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; font-size:13px; line-height:1.4; }
      .criteria-table{ width:100%; border-collapse:collapse; margin-top:12px; }
      .criteria-table th, .criteria-table td{ border:1px solid var(--line); padding:8px; text-align:left; vertical-align:top; }
      .criteria-desc{ width:60%; }
      .criteria-mark{ width:10%; text-align:center; }
      .criteria-score{ width:30%; text-align:right; }
  .subtotal{ text-align:right; margin-top:8px; font-weight:600; }
  .comment{ margin-top:12px; background:#fffbeb; border:1px solid #fcd34d; padding:10px 12px; border-radius:6px; }
  .comment-body{ margin-top:4px; line-height:1.5; }
      .muted{ color:var(--muted); }
      .note{ margin-top:8px; }
      .header{ display:flex; gap:16px; align-items:baseline; flex-wrap:wrap; }
      .badge{ display:inline-block; background:#eef2ff; color:#3730a3; padding:2px 8px; border-radius:999px; font-size:12px; }
      /* markdown 基本スタイル */
      .markdown-body :where(h1,h2,h3,h4,h5){ line-height:1.3; margin:1.2em 0 .5em; }
      .markdown-body h1{ font-size:1.5em; }
      .markdown-body h2{ font-size:1.3em; }
      .markdown-body h3{ font-size:1.15em; }
      .markdown-body p{ margin:.5em 0; line-height:1.6; }
      .markdown-body pre{ background:#1e293b; color:#e2e8f0; padding:10px 12px; border-radius:6px; overflow:auto; font-size:13px; line-height:1.4; }
      .markdown-body code{ background:#f1f5f9; padding:2px 4px; border-radius:4px; font-size:.9em; }
      .markdown-body pre code{ background:transparent; padding:0; }
      .markdown-body ul, .markdown-body ol{ margin:.6em 0 .6em 1.4em; padding:0; }
      .markdown-body blockquote{ margin:.8em 0; padding:.6em .8em; border-left:4px solid #94a3b8; background:#f1f5f9; border-radius:4px; }
      .markdown-body table{ border-collapse:collapse; margin: .8em 0; width:100%; }
      .markdown-body th, .markdown-body td{ border:1px solid #cbd5e1; padding:6px 8px; font-size:13px; }
      .markdown-body a{ color:#2563eb; text-decoration:none; }
      .markdown-body a:hover{ text-decoration:underline; }
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
