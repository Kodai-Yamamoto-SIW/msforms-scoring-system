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

// TrackTraining 用: 問題文内の ${ ... } を穴埋めプレースホルダへ変換
function transformFillInBlanks(markdown: string, enabled: boolean): string {
  if (!enabled || !markdown) return markdown;
  let counter = 0;
  // 直接HTMLを埋め込むとサニタイズでエスケープされるためトークン化
  return markdown.replace(/\$\{[^}]*\}/g, () => `[[BLANK:${++counter}]]`);
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
    const isTrackTraining = !!(workspace.autoCorrectMask || data.autoCorrectMask);

    const problemBlocks: string[] = data.questions.map((questionKey, qIndex) => {
        const displayTitle = titles[qIndex] || questionKey;
        const answer = String(response[questionKey] || '');
        const criteria = criteriaDef?.[qIndex]?.criteria || [];
        const comment = workspace.comments?.[qIndex]?.[Number(response.ID)] || '';
        const processedTitle = transformFillInBlanks(displayTitle, isTrackTraining);
        let displayTitleHtml = markdownToSafeHtml(processedTitle);
        if (isTrackTraining) {
            displayTitleHtml = displayTitleHtml.replace(/\[\[BLANK:(\d+)\]\]/g, (_m, num) => `<span class="blank-slot" data-blank="${num}"><span class="blank-index">${num}</span></span>`);
        }
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
                <div class="problem-body blocks">
                  <h3 class="visually-hidden">問${qIndex + 1}</h3>
                  <div class="section-block problem-block">
                    <div class="section-label">問題文</div>
                    <div class="markdown-body question-text">${displayTitleHtml}</div>
                  </div>
                  <div class="section-block answer-block" aria-labelledby="ans-title-${qIndex}">
                    <div class="section-label" id="ans-title-${qIndex}">受講者の回答</div>
                    <pre class="answer-pre">${escapeHtml(answer)}</pre>
                  </div>
                  ${commentHtml ? `<div class="section-block comment-block has-comment"><div class="section-label">コメント</div><div class="markdown-body comment-body">${commentHtml}</div></div>` : ''}
                  <div class="note muted not-set">（この問題の採点基準は設定されていません）</div>
                </div>
              </details>
            </section>`;
        }

        // 小計計算
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
            <div class="problem-body blocks">
              <h3 class="visually-hidden">問${qIndex + 1}</h3>
              <div class="section-block problem-block">
                <div class="section-label">問題文</div>
                <div class="markdown-body question-text">${displayTitleHtml}</div>
              </div>
              <div class="section-block answer-block" aria-labelledby="ans-title-${qIndex}">
                <div class="section-label" id="ans-title-${qIndex}">受講者の回答</div>
                <pre class="answer-pre">${escapeHtml(answer)}</pre>
              </div>
              <div class="section-block criteria-block">
                <div class="section-label">採点基準</div>
                <table class="criteria-table">
                  <thead>
                    <tr><th>基準</th><th>判定</th><th>得点</th></tr>
                  </thead>
                  <tbody>
                    ${rows}
                  </tbody>
                </table>
                <div class="subtotal">小計: <strong>${subtotal}</strong> / ${subMax}</div>
              </div>
              ${commentHtml ? `<div class="section-block comment-block has-comment"><div class="section-label">コメント</div><div class="markdown-body comment-body">${commentHtml}</div></div>` : ''}
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
  /* セクションブロック共通 */
  .blocks{ display:flex; flex-direction:column; gap:14px; }
  .section-block{ border:1px solid #e2e8f0; border-radius:10px; background:#ffffff; padding:14px 16px 16px; position:relative; }
  .section-block.problem-block{ border-left:5px solid #2563eb; }
  .section-block.answer-block{ border-left:5px solid #0891b2; background:#f0f9ff; }
  .section-block.criteria-block{ border-left:5px solid #475569; }
  .section-block.comment-block{ border-left:5px solid #ea580c; background:linear-gradient(135deg,#fff7ed,#fffbeb); border:1px solid #fdba74; box-shadow:0 2px 6px -1px rgba(234,88,12,0.25),0 0 0 1px rgba(251,191,36,0.35) inset; }
  .section-block.comment-block .section-label{ color:#9a3412; }
  .section-block.comment-block .section-label:before{ content:"💬"; font-size:14px; }
  .section-block.comment-block.has-comment:after{ content:""; position:absolute; top:10px; right:12px; width:10px; height:10px; background:#ef4444; border-radius:50%; box-shadow:0 0 0 0 rgba(239,68,68,.6); animation:comment-pulse 1.8s ease-in-out infinite; }
  @keyframes comment-pulse { 0%{ transform:scale(.85); box-shadow:0 0 0 0 rgba(239,68,68,.55);} 60%{ transform:scale(1); box-shadow:0 0 0 10px rgba(239,68,68,0);} 100%{ box-shadow:0 0 0 0 rgba(239,68,68,0);} }
  .section-block.comment-block .comment-body{ font-size:13px; line-height:1.55; }
  .section-label{ font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#475569; margin-bottom:6px; display:inline-flex; align-items:center; gap:4px; }
  .section-block.answer-block .section-label{ color:#0369a1; }
  .section-block.problem-block .section-label{ color:#1d4ed8; }
  .section-block.criteria-block .section-label{ color:#334155; }
  .section-block.comment-block .section-label{ color:#b45309; }
  .question-text{ font-weight:600; }
  .answer-pre{ margin:0; white-space:pre-wrap; word-break:break-word; font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace; font-size:13px; line-height:1.4; background:#ffffff; padding:10px 12px; border:1px solid #e2e8f0; border-radius:6px; }
  .section-block.comment-block .comment-body{ margin:0; }
  .not-set{ font-size:12px; margin-top:4px; }
  /* 穴埋めプレースホルダ（TrackTraining）: コンパクト下線型 */
  .blank-slot{ position:relative; display:inline-block; min-width:5.2em; margin:0 5px 0 6px; vertical-align:baseline; padding-top:0.54em; }
  .blank-slot:after{ content:""; position:absolute; left:0; right:0; bottom:-0.48em; height:2px; background:linear-gradient(90deg,#2563eb,#60a5fa); border-radius:1px; }
  .problem-block .blank-slot:after{ background:linear-gradient(90deg,#1d4ed8,#93c5fd); }
  .blank-index{ position:absolute; left:0; top:-0.46em; font-size:8.2px; line-height:1; background:#1d4ed8; color:#fff; padding:1px 4px 2px; border-radius:999px; font-weight:600; font-family:ui-monospace,monospace; box-shadow:0 0 0 2px #ffffff; letter-spacing:.45px; }
  .blank-slot:hover:after{ height:3px; }
  .blank-slot:focus-within:after{ outline:2px solid #bfdbfe; }
  /* インデックスが重なっても文字列との間隔を確保 */
  .blank-slot + .blank-slot{ margin-left:10px; }
  /* 採点基準（省スペース & 低コントラスト化） */
  .criteria-table{ width:100%; border-collapse:separate; border-spacing:0; margin-top:10px; font-size:12.5px; line-height:1.35; background:#fff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
  .criteria-table thead th{ background:#f1f5f9; font-weight:600; padding:6px 8px; text-align:left; border-bottom:1px solid #e2e8f0; color:#334155; font-size:12px; }
  .criteria-table tbody td{ padding:5px 8px 4px; vertical-align:top; border-bottom:1px solid #f0f3f6; }
  .criteria-table tbody tr:last-child td{ border-bottom:none; }
  .criteria-desc{ width:58%; color:#1e293b; }
  .criteria-mark{ width:10%; text-align:center; font-weight:600; letter-spacing:.1em; }
  .criteria-score{ width:32%; text-align:right; color:#334155; font-variant-numeric:tabular-nums; }
  .criteria-table tbody tr:hover td{ background:#f8fafc; }
  .criteria-table td{ transition:background .15s ease; }
  /* 判定記号色付け（文字そのものを利用） */
  .criteria-mark{ color:#475569; font-size:13px; }
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
