import type { MaterialSymbol } from '$lib/types';
import type { HTMLAttributes } from 'svelte/elements';

export interface TabItem<ValueType> {
    label: string
    value: ValueType
    icon?: MaterialSymbol
}

export interface TabsProperties<ValueType> extends HTMLAttributes<HTMLDivElement> {
    ref?: HTMLDivElement | null
    items: TabItem<ValueType>[]
    value?: ValueType
    aria_label?: string
    on_tab_select?: (value: ValueType) => void
}
