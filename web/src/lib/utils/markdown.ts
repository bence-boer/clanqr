import type { HLJSApi } from 'highlight.js';
import type { Marked } from 'marked';

let initialized = false;
let init_promise: Promise<void> | null = null;
let hljs_instance: HLJSApi;
let marked_instance: Marked;
let purify_instance: typeof import('dompurify').default;

async function ensure_initialized(): Promise<void> {
    if (initialized) return;
    if (init_promise) return init_promise;

    init_promise = (async () => {
        const [hljs_mod, marked_mod, purify_mod] = await Promise.all([
            import('highlight.js/lib/core'),
            import('marked'),
            import('dompurify')
        ]);

        hljs_instance = hljs_mod.default;

        const languages = await Promise.all([
            import('highlight.js/lib/languages/javascript'),
            import('highlight.js/lib/languages/typescript'),
            import('highlight.js/lib/languages/python'),
            import('highlight.js/lib/languages/bash'),
            import('highlight.js/lib/languages/json'),
            import('highlight.js/lib/languages/css'),
            import('highlight.js/lib/languages/xml'),
            import('highlight.js/lib/languages/markdown'),
            import('highlight.js/lib/languages/yaml'),
            import('highlight.js/lib/languages/sql'),
            import('highlight.js/lib/languages/diff')
        ]);

        const lang_entries: [string, typeof languages[number]][] = [
            ['javascript', languages[0]], ['js', languages[0]],
            ['typescript', languages[1]], ['ts', languages[1]],
            ['python', languages[2]],
            ['bash', languages[3]], ['sh', languages[3]],
            ['json', languages[4]],
            ['css', languages[5]],
            ['html', languages[6]], ['xml', languages[6]],
            ['markdown', languages[7]],
            ['yaml', languages[8]],
            ['sql', languages[9]],
            ['diff', languages[10]]
        ];
        for (const [name, mod] of lang_entries) {
            hljs_instance.registerLanguage(name, mod.default);
        }

        purify_instance = purify_mod.default;

        marked_instance = new marked_mod.Marked({
            renderer: {
                code({ text, lang }) {
                    const language = lang && hljs_instance.getLanguage(lang) ? lang : 'plaintext';
                    let highlighted: string;
                    try {
                        highlighted = language === 'plaintext'
                            ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                            : hljs_instance.highlight(text, { language }).value;
                    }
                    catch {
                        highlighted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    }
                    const escaped_text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    return `<div class="code-block-wrapper"><button class="copy-code-btn" data-code="${escaped_text}">Copy</button><pre><code class="hljs language-${language}">${highlighted}</code></pre></div>`;
                }
            }
        });

        initialized = true;
    })();

    return init_promise;
}

export async function render_markdown(content: string): Promise<string> {
    await ensure_initialized();
    const raw_html = marked_instance.parse(content, { async: false }) as string;
    return purify_instance.sanitize(raw_html, {
        ADD_TAGS: ['button'],
        ADD_ATTR: ['data-code']
    });
}

export function init_code_copy_handlers(container: HTMLElement) {
    container.querySelectorAll<HTMLButtonElement>('.copy-code-btn').forEach((btn) => {
        btn.onclick = () => {
            const code = btn.dataset.code?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') ?? '';
            navigator.clipboard.writeText(code).then(() => {
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.textContent = 'Copy';
                }, 2000);
            }).catch(() => {
            });
        };
    });
}
