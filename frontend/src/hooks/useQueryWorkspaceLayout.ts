import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export type SectionKey = 'prompt' | 'sql';

interface LayoutState {
    promptExpanded: boolean;
    sqlExpanded: boolean;
    promptHeight: number;
    sqlHeight: number;
}

const LAYOUT_STORAGE_KEY = 'query-workspace-layout-v1';
const MIN_SECTION_HEIGHT = 120;
const MAX_HEIGHT_RATIO = 0.55;
const DEFAULT_PROMPT_HEIGHT = 220;
const DEFAULT_SQL_HEIGHT = 180;

function clampHeight(value: number) {
    if (typeof window === 'undefined') {
        return Math.max(MIN_SECTION_HEIGHT, value);
    }

    const maxHeight = Math.max(MIN_SECTION_HEIGHT, Math.floor(window.innerHeight * MAX_HEIGHT_RATIO));
    return Math.max(MIN_SECTION_HEIGHT, Math.min(maxHeight, value));
}

function getInitialLayout(): LayoutState {
    const isSmallScreen = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

    const fallback: LayoutState = {
        promptExpanded: true,
        sqlExpanded: !isSmallScreen,
        promptHeight: isSmallScreen ? 190 : DEFAULT_PROMPT_HEIGHT,
        sqlHeight: isSmallScreen ? 150 : DEFAULT_SQL_HEIGHT,
    };

    if (typeof window === 'undefined') {
        return fallback;
    }

    try {
        const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (!raw) {
            return fallback;
        }

        const saved = JSON.parse(raw) as Partial<LayoutState>;
        return {
            promptExpanded: saved.promptExpanded ?? fallback.promptExpanded,
            sqlExpanded: saved.sqlExpanded ?? fallback.sqlExpanded,
            promptHeight: Number.isFinite(saved.promptHeight) ? clampHeight(Number(saved.promptHeight)) : fallback.promptHeight,
            sqlHeight: Number.isFinite(saved.sqlHeight) ? clampHeight(Number(saved.sqlHeight)) : fallback.sqlHeight,
        };
    } catch {
        return fallback;
    }
}

export function useQueryWorkspaceLayout() {
    const [initialLayout] = useState<LayoutState>(() => getInitialLayout());
    const [isPromptExpanded, setIsPromptExpanded] = useState(initialLayout.promptExpanded);
    const [isSqlExpanded, setIsSqlExpanded] = useState(initialLayout.sqlExpanded);
    const [promptHeight, setPromptHeight] = useState(initialLayout.promptHeight);
    const [sqlHeight, setSqlHeight] = useState(initialLayout.sqlHeight);
    const dragStateRef = useRef<{ section: SectionKey; startY: number; startHeight: number } | null>(null);

    useEffect(() => {
        const nextState: LayoutState = {
            promptExpanded: isPromptExpanded,
            sqlExpanded: isSqlExpanded,
            promptHeight,
            sqlHeight,
        };

        window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(nextState));
    }, [isPromptExpanded, isSqlExpanded, promptHeight, sqlHeight]);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            if (!dragStateRef.current) {
                return;
            }

            const { section, startY, startHeight } = dragStateRef.current;
            const nextHeight = clampHeight(startHeight + (event.clientY - startY));

            if (section === 'prompt') {
                setPromptHeight(nextHeight);
                return;
            }

            setSqlHeight(nextHeight);
        };

        const handlePointerUp = () => {
            dragStateRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, []);

    const startResize = (section: SectionKey) => (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }

        event.preventDefault();
        dragStateRef.current = {
            section,
            startY: event.clientY,
            startHeight: section === 'prompt' ? promptHeight : sqlHeight,
        };
    };

    return {
        isPromptExpanded,
        setIsPromptExpanded,
        isSqlExpanded,
        setIsSqlExpanded,
        promptHeight,
        sqlHeight,
        startResize,
    };
}
