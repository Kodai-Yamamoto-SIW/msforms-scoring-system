// 外部Markdown関連ライブラリの型解決補助（ビルド環境差異で認識されない場合のフォールバック）
// marked は型を同梱しているが moduleResolution=bundler 環境で認識されないケースへの保険。
declare module 'marked' {
  export interface MarkedOptions {
    gfm?: boolean;
    breaks?: boolean;
  }
  export function marked(src: string, options?: MarkedOptions): string;
  export function parse(src: string): string;
  export function setOptions(opts: MarkedOptions): void;
}

// dompurify 簡易宣言（実行時はブラウザで sanitize を使用）
declare module 'dompurify' {
  interface SanitizeConfig {
    USE_PROFILES?: { html?: boolean };
  }
  interface DOMPurifyI {
    sanitize(dirty: string, config?: SanitizeConfig): string;
  }
  const DOMPurify: DOMPurifyI;
  export default DOMPurify;
}
