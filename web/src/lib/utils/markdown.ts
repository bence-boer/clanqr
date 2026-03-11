import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { Marked } from 'marked';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('diff', diff);

const marked_instance = new Marked({
    renderer: {
        code({ text, lang }) {
            const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
            let highlighted: string;
            try {
                highlighted = language === 'plaintext'
                    ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    : hljs.highlight(text, { language }).value;
            } catch {
                highlighted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
            const escaped_text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            return `<div class="code-block-wrapper"><button class="copy-code-btn" data-code="${escaped_text}">Copy</button><pre><code class="hljs language-${language}">${highlighted}</code></pre></div>`;
        }
    }
});

export function render_markdown(content: string): string {
    const raw_html = marked_instance.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw_html, {
        ADD_TAGS: ['button'],
        ADD_ATTR: ['data-code'],
    });
}

export function init_code_copy_handlers(container: HTMLElement) {
    container.querySelectorAll<HTMLButtonElement>('.copy-code-btn').forEach((btn) => {
        btn.onclick = () => {
            const code = btn.dataset.code?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') ?? '';
            navigator.clipboard.writeText(code).then(() => {
                btn.textContent = 'Copied!';
                setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
            });
        };
    });
}
