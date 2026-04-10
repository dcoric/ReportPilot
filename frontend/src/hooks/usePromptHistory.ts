import { useCallback, useEffect, useRef, useState } from 'react';
import { client } from '../lib/api/client';
import type { PromptHistoryItem, PromptHistoryPosition } from '../components/Query/types';

const DEFAULT_POSITION: PromptHistoryPosition = {
    top: 0,
    left: 0,
    width: 620,
    panelMaxHeight: 420,
};

export function usePromptHistory(selectedDataSourceId: string) {
    const [promptHistory, setPromptHistory] = useState<PromptHistoryItem[]>([]);
    const [isPromptHistoryOpen, setIsPromptHistoryOpen] = useState(false);
    const [isPromptHistoryLoading, setIsPromptHistoryLoading] = useState(false);
    const [promptHistoryQuery, setPromptHistoryQuery] = useState('');
    const [promptHistoryPosition, setPromptHistoryPosition] = useState<PromptHistoryPosition>(DEFAULT_POSITION);
    const promptHistoryRef = useRef<HTMLDivElement | null>(null);
    const promptHistoryButtonRef = useRef<HTMLButtonElement | null>(null);
    const promptHistoryPanelRef = useRef<HTMLDivElement | null>(null);

    const fetchPromptHistory = useCallback(async (showLoading = true) => {
        if (!selectedDataSourceId) {
            setPromptHistory([]);
            return;
        }

        if (showLoading) {
            setIsPromptHistoryLoading(true);
        }

        try {
            const { data } = await client.GET('/v1/query/prompts/history', {
                params: {
                    query: {
                        data_source_id: selectedDataSourceId,
                        limit: 100,
                    },
                },
            });

            setPromptHistory(data?.items || []);
        } catch (error) {
            console.error(error);
            setPromptHistory([]);
        } finally {
            if (showLoading) {
                setIsPromptHistoryLoading(false);
            }
        }
    }, [selectedDataSourceId]);

    useEffect(() => {
        if (!selectedDataSourceId) {
            setPromptHistory([]);
            setIsPromptHistoryOpen(false);
            return;
        }

        void fetchPromptHistory(false);
    }, [fetchPromptHistory, selectedDataSourceId]);

    useEffect(() => {
        if (!isPromptHistoryOpen || !selectedDataSourceId) {
            return;
        }

        void fetchPromptHistory(true);
    }, [fetchPromptHistory, isPromptHistoryOpen, selectedDataSourceId]);

    useEffect(() => {
        if (!isPromptHistoryOpen) {
            return;
        }

        const onDocumentClick = (event: MouseEvent) => {
            const target = event.target as Node | null;
            const clickedButtonArea = promptHistoryRef.current && target && promptHistoryRef.current.contains(target);
            const clickedPanelArea = promptHistoryPanelRef.current && target && promptHistoryPanelRef.current.contains(target);
            if (!clickedButtonArea && !clickedPanelArea) {
                setIsPromptHistoryOpen(false);
            }
        };

        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsPromptHistoryOpen(false);
            }
        };

        window.addEventListener('mousedown', onDocumentClick);
        window.addEventListener('keydown', onEscape);

        return () => {
            window.removeEventListener('mousedown', onDocumentClick);
            window.removeEventListener('keydown', onEscape);
        };
    }, [isPromptHistoryOpen]);

    useEffect(() => {
        if (!isPromptHistoryOpen) {
            return;
        }

        const updatePosition = () => {
            const button = promptHistoryButtonRef.current;
            if (!button) {
                return;
            }

            const rect = button.getBoundingClientRect();
            const viewportPadding = 16;
            const desiredWidth = Math.min(620, window.innerWidth - viewportPadding * 2);
            const left = Math.max(viewportPadding, Math.min(rect.right - desiredWidth, window.innerWidth - desiredWidth - viewportPadding));

            const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
            const spaceAbove = rect.top - viewportPadding;
            const showBelow = spaceBelow >= 260 || spaceBelow >= spaceAbove;
            const availableHeight = Math.max(120, Math.floor((showBelow ? spaceBelow : spaceAbove) - 8));
            const panelMaxHeight = Math.min(520, availableHeight);
            const top = showBelow
                ? rect.bottom + 8
                : Math.max(viewportPadding, rect.top - panelMaxHeight - 8);

            setPromptHistoryPosition({ top, left, width: desiredWidth, panelMaxHeight });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isPromptHistoryOpen]);

    const filteredPromptHistory = promptHistoryQuery.trim()
        ? promptHistory.filter((item) => item.question.toLowerCase().includes(promptHistoryQuery.trim().toLowerCase()))
        : promptHistory;

    return {
        promptHistory,
        filteredPromptHistory,
        isPromptHistoryOpen,
        setIsPromptHistoryOpen,
        isPromptHistoryLoading,
        promptHistoryQuery,
        setPromptHistoryQuery,
        promptHistoryPosition,
        promptHistoryRef,
        promptHistoryButtonRef,
        promptHistoryPanelRef,
        fetchPromptHistory,
    };
}
