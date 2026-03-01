/**
 * SSE (Server-Sent Events) client for streaming responses.
 * Extracts inline SSE parsing from the chat page for reusability and testability.
 */

export interface SseCallbacks {
    on_chunk: (chunk: string) => void
    on_done?: () => void
    on_error?: (error: string) => void
}

/**
 * Read an SSE stream from a Response and dispatch events via callbacks.
 * Returns when the stream closes.
 */
export async function read_sse_stream(response: Response, callbacks: SseCallbacks): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data_str = line.slice(6);
                try {
                    const data = JSON.parse(data_str);
                    if (data.done) {
                        callbacks.on_done?.();
                    }
                    else if (data.error) {
                        callbacks.on_error?.(data.error);
                    }
                    else if (data.chunk) {
                        callbacks.on_chunk(data.chunk);
                    }
                }
                catch {
                    // Non-JSON data, treat as raw chunk
                    callbacks.on_chunk(data_str);
                }
            }
        }
    }
    finally {
        reader.releaseLock();
    }
}
