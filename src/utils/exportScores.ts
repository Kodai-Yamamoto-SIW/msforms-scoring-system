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
            const subtotalText = '-';
            return `
            <section class="problem">
              <details class="problem-details">
                <summary>
                  <div class="problem-summary-bar">
                    <span class="problem-label">問${qIndex + 1}</span>
                    <span class="problem-subtotal">小計: <strong>${subtotalText}</strong></span>
                    <span class="toggle-indicator" aria-hidden="true"></span>
                  </div>
                </summary>
                <div class="problem-body">
                  <h3 class="visually-hidden">問${qIndex + 1}</h3>
                  <div class="question markdown-body">${displayTitleHtml}</div>
                  <div class="answer-card" aria-labelledby="ans-title-${qIndex}">
                    <div class="answer-card-header" id="ans-title-${qIndex}">受講者の回答</div>
                    <div class="answer-body"><pre>${escapeHtml(answer)}</pre></div>
                  </div>
                  <div class="note muted">（この問題の採点基準は設定されていません）</div>
                  ${commentHtml ? `<div class="comment"><strong>コメント:</strong><div class="comment-body markdown-body">${commentHtml}</div></div>` : ''}
                </div>
              </details>
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
          <details class="problem-details">
            <summary>
              <div class="problem-summary-bar">
                <span class="problem-label">問${qIndex + 1}</span>
                <span class="problem-subtotal">小計: <strong>${subtotal}</strong> / ${subMax}</span>
                <span class="toggle-indicator" aria-hidden="true"></span>
              </div>
            </summary>
            <div class="problem-body">
              <h3 class="visually-hidden">問${qIndex + 1}</h3>
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
            </div>
          </details>
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
      .total-score{ position:relative; border:1px solid var(--line); background:linear-gradient(135deg,#f0f9ff,#fff); padding:20px 24px 18px; border-radius:16px; margin:24px 0 32px; box-shadow:0 4px 10px -2px rgba(0,0,0,.05),0 2px 4px -1px rgba(0,0,0,.04); display:flex; align-items:center; gap:32px; flex-wrap:wrap; }
      .total-score:after{ content:""; position:absolute; inset:0; pointer-events:none; border-radius:16px; background:radial-gradient(circle at 85% 20%, rgba(56,189,248,0.18), transparent 60%); }
      .total-score-label{ font-size:14px; letter-spacing:.15em; font-weight:700; color:#0369a1; text-transform:uppercase; }
      .total-score-main{ display:flex; align-items:baseline; gap:10px; font-weight:600; }
      .score-value{ font-size:56px; font-weight:700; line-height:1; color:#0f172a; font-variant-numeric:tabular-nums; }
      .score-sep{ font-size:32px; color:#334155; opacity:.6; }
      .score-max{ font-size:32px; font-weight:500; color:#475569; font-variant-numeric:tabular-nums; }
      .total-score-percent{ margin-left:auto; font-size:20px; font-weight:600; color:#0d9488; background:#ccfbf1; padding:6px 14px; border-radius:999px; box-shadow:0 1px 2px rgba(0,0,0,.08) inset; }
      @media (max-width:640px){
        .total-score{ gap:18px; padding:18px 18px 16px; }
        .score-value{ font-size:42px; }
        .score-max{ font-size:26px; }
        .score-sep{ font-size:26px; }
        .total-score-percent{ font-size:16px; }
      }
  .problem{ margin:12px 0; }
  .problem-details{ border:1px solid var(--line); border-radius:10px; background:#fff; overflow:hidden; }
  .problem-details[open]{ box-shadow:0 4px 10px -2px rgba(0,0,0,.05); }
  .problem-details summary{ cursor:pointer; list-style:none; }
  .problem-details summary::-webkit-details-marker{ display:none; }
  .problem-summary-bar{ display:flex; align-items:center; gap:16px; padding:10px 16px; background:#f1f5f9; position:relative; }
  .problem-details[open] .problem-summary-bar{ background:#e2e8f0; }
  .problem-label{ font-size:15px; font-weight:600; color:#1e293b; }
  .problem-subtotal{ margin-left:auto; font-size:14px; font-weight:500; color:#0f172a; }
  .toggle-indicator{ width:14px; height:14px; margin-left:8px; position:relative; }
  .toggle-indicator:before, .toggle-indicator:after{ content:""; position:absolute; inset:0; margin:auto; width:10px; height:2px; background:#334155; border-radius:2px; transition:.25s; }
  .toggle-indicator:after{ transform:rotate(90deg); }
  .problem-details[open] .toggle-indicator:after{ transform:rotate(0deg); opacity:0; }
  .problem-body{ padding:16px 20px 20px; border-top:1px solid var(--line); }
  .problem h3{ margin:0 0 8px; color:var(--brand); }
  .question{ font-weight:600; margin-bottom:8px; }
  .visually-hidden{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
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
  .badge{ display:inline-flex; align-items:center; gap:6px; background:linear-gradient(145deg,#eef2ff,#e0e7ff); color:#1e3a8a; padding:6px 14px; border-radius:999px; font-size:14px; font-weight:600; letter-spacing:.5px; box-shadow:0 1px 2px rgba(0,0,0,.08),0 0 0 1px #c7d2fe inset; }
  .badge:before{ content:"👤"; font-size:14px; opacity:.75; }
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

    const percent = totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(1) : '--';
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
    <div class="total-score" role="group" aria-label="総合得点">
      <div class="total-score-label">総合得点</div>
      <div class="total-score-main">
        <span class="score-value">${totalScore}</span>
        <span class="score-sep">/</span>
        <span class="score-max">${totalMax}</span>
      </div>
      <div class="total-score-percent">${percent === '--' ? '' : percent + '% 達成'}</div>
    </div>
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
