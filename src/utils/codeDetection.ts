// ソースコード自動判定とシンタックスハイライト用ユーティリティ

// ソースコードかどうかを判定するパターン
const codePatterns = [
    // JavaScript/TypeScript
    /(?:function|const|let|var|class|interface|import|export|=>|console\.log)\s*[\(\{]/,
    /(?:if|for|while|switch|return|throw|try|catch)\s*[\(\{]/,
    /(?:public|private|protected|static|async|await)\s+/,

    // Python
    /(?:def|class|import|from|if|elif|else|for|while|try|except|with|as)\s+/,
    /print\s*\(|input\s*\(/,

    // Java/C#/C++
    /(?:public|private|protected|static|final|abstract|virtual|override)\s+(?:class|interface|void|int|string|bool)/,
    /System\.out\.println|Console\.WriteLine|cout\s*<<|cin\s*>>/,

    // C
    /#include\s*<|printf\s*\(|scanf\s*\(/,

    // HTML
    /<\/?(?:html|head|body|div|span|p|h[1-6]|ul|ol|li|table|tr|td|form|input|button)\b[^>]*>/i,

    // CSS
    /[\.\#]\w+\s*\{|\w+\s*:\s*[^;]+;/,

    // SQL
    /(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+/i,

    // JSON
    /^\s*[\{\[][\s\S]*[\}\]]\s*$/,

    // 一般的なコード構造
    /[\{\}]\s*$|^\s*[\{\}]/m, // ブロックの開始・終了
    /[;]\s*$|^\s*[;]/m,      // セミコロン終端
    /[\[\]]\s*$|^\s*[\[\]]/m, // 配列記法
    /=>\s*[\{\(]|[\}\)]\s*=>/,  // アロー関数
];

// プログラミング言語を検出
export const detectLanguage = (code: string): string => {
    const text = code.trim();

    // JavaScript/TypeScript
    if (/(?:function|const|let|var|=>|console\.log|npm|yarn|node)/.test(text) ||
        /(?:import|export|require)\s*[\(\{]/.test(text) ||
        /interface\s+\w+|type\s+\w+\s*=/.test(text)) {
        return text.includes('interface') || text.includes('type ') ? 'typescript' : 'javascript';
    }

    // Python
    if (/(?:def|class|import|from|print\s*\(|if\s+\w+:)/.test(text) ||
        /(?:elif|else|for|while|try|except)\s*:/.test(text)) {
        return 'python';
    }

    // Java
    if (/(?:public\s+class|System\.out\.println|package\s+\w+)/.test(text) ||
        /(?:public|private|protected)\s+(?:static\s+)?(?:void|int|String|boolean)/.test(text)) {
        return 'java';
    }

    // C#
    if (/(?:Console\.WriteLine|using\s+System|namespace\s+\w+)/.test(text) ||
        /(?:public|private|protected)\s+(?:static\s+)?(?:void|int|string|bool)/.test(text)) {
        return 'csharp';
    }

    // C/C++
    if (/#include\s*<|printf\s*\(|cout\s*<<|cin\s*>>/.test(text) ||
        /(?:int|char|float|double)\s+main\s*\(/.test(text)) {
        return text.includes('cout') || text.includes('cin') ? 'cpp' : 'c';
    }

    // HTML
    if (/<\/?(?:html|head|body|div|span|p|h[1-6])\b[^>]*>/i.test(text)) {
        return 'html';
    }

    // CSS
    if (/[\.\#]\w+\s*\{|\w+\s*:\s*[^;]+;/.test(text) ||
        /@media|@keyframes|@import/.test(text)) {
        return 'css';
    }

    // SQL
    if (/(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+/i.test(text)) {
        return 'sql';
    }

    // JSON
    if (/^\s*[\{\[][\s\S]*[\}\]]\s*$/.test(text)) {
        try {
            JSON.parse(text);
            return 'json';
        } catch {
            // JSONパースに失敗した場合は続行
        }
    }

    // XML
    if (/<\?xml|<\w+[^>]*>[\s\S]*<\/\w+>/.test(text)) {
        return 'xml';
    }

    return 'text';
};

// ソースコードかどうかを判定
export const isCodeContent = (text: string): boolean => {
    if (!text || text.trim().length < 10) return false;

    const normalizedText = text.trim();

    // 明らかにコードではないパターン
    if (/^[ひらがなカタカナ漢字\s]+$/.test(normalizedText)) return false;
    if (/^[a-zA-Z\s\.,!?]+$/.test(normalizedText) && !/[{}();=]/.test(normalizedText)) return false;

    // コードパターンの検出
    return codePatterns.some(pattern => pattern.test(normalizedText));
};
