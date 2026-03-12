export function save_scroll(el: HTMLElement | null): number {
    return el?.scrollTop ?? 0;
}

export function restore_scroll(el: HTMLElement | null, pos: number) {
    if (el) requestAnimationFrame(() => {
        el.scrollTop = pos;
    });
}
