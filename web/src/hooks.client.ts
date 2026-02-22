/** Global client-side error handler */
export function handleError({ error, event }: { error: unknown; event: any }) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Unhandled client error:", error);

    return {
        message,
    };
}
