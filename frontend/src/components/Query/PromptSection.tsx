import { ChevronDown, ChevronRight, GripHorizontal, Loader2, Send } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { PromptHistoryPanel } from './PromptHistoryPanel';
import type { LlmProvider, PromptHistoryItem, PromptHistoryPosition } from './types';

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    deepseek: 'DeepSeek',
    openrouter: 'OpenRouter',
};

interface PromptSectionProps {
    isExpanded: boolean;
    height: number;
    isDryRun: boolean;
    question: string;
    llmProviders: LlmProvider[];
    provider: string;
    model: string;
    maxRows: number;
    timeout: number;
    isGenerating: boolean;
    selectedDataSourceId: string;
    isPromptHistoryOpen: boolean;
    isPromptHistoryLoading: boolean;
    promptHistoryQuery: string;
    filteredPromptHistory: PromptHistoryItem[];
    promptHistoryPosition: PromptHistoryPosition;
    promptHistoryRef: RefObject<HTMLDivElement | null>;
    promptHistoryButtonRef: RefObject<HTMLButtonElement | null>;
    promptHistoryPanelRef: RefObject<HTMLDivElement | null>;
    onToggle: () => void;
    onDryRunChange: (value: boolean) => void;
    onQuestionChange: (value: string) => void;
    onProviderChange: (value: string) => void;
    onModelChange: (value: string) => void;
    onMaxRowsChange: (value: number) => void;
    onTimeoutChange: (value: number) => void;
    onPromptHistoryToggle: () => void;
    onPromptHistoryQueryChange: (value: string) => void;
    onPromptHistorySelect: (item: PromptHistoryItem) => void;
    onAsk: () => void;
    onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function PromptSection({
    isExpanded,
    height,
    isDryRun,
    question,
    llmProviders,
    provider,
    model,
    maxRows,
    timeout,
    isGenerating,
    selectedDataSourceId,
    isPromptHistoryOpen,
    isPromptHistoryLoading,
    promptHistoryQuery,
    filteredPromptHistory,
    promptHistoryPosition,
    promptHistoryRef,
    promptHistoryButtonRef,
    promptHistoryPanelRef,
    onToggle,
    onDryRunChange,
    onQuestionChange,
    onProviderChange,
    onModelChange,
    onMaxRowsChange,
    onTimeoutChange,
    onPromptHistoryToggle,
    onPromptHistoryQueryChange,
    onPromptHistorySelect,
    onAsk,
    onResizeStart,
}: PromptSectionProps) {
    return (
        <>
            <div className="flex-shrink-0 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={isExpanded}
                        aria-controls="query-prompt-section"
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-700"
                    >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>Prompt section</span>
                    </button>

                    <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                            type="checkbox"
                            checked={isDryRun}
                            onChange={(event) => onDryRunChange(event.target.checked)}
                            className="rounded"
                        />
                        Dry run (no execute)
                    </label>
                </div>

                {isExpanded && (
                    <div id="query-prompt-section" className="overflow-auto" style={{ height }}>
                        <div className="mx-auto max-w-6xl p-4">
                            {isDryRun && (
                                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                    Dry run skips live database validation and execution. You will get generated SQL, citations, and confidence only.
                                </div>
                            )}

                            <textarea
                                className="mb-3 w-full resize-none rounded-md border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                rows={3}
                                placeholder="Enter your question here..."
                                value={question}
                                onChange={(event) => onQuestionChange(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                                        event.preventDefault();
                                        onAsk();
                                    }
                                }}
                            />

                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium text-gray-600">Provider:</label>
                                    <select
                                        value={provider}
                                        onChange={(event) => {
                                            const selectedProvider = event.target.value;
                                            onProviderChange(selectedProvider);
                                            const providerConfig = llmProviders.find((entry) => entry.provider === selectedProvider);
                                            if (providerConfig) {
                                                onModelChange(providerConfig.default_model);
                                            }
                                        }}
                                        className="rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        {llmProviders.length === 0 && (
                                            <option value="">No providers configured</option>
                                        )}
                                        {llmProviders.map((entry) => (
                                            <option key={entry.provider} value={entry.provider}>
                                                {entry.display_name || PROVIDER_DISPLAY_NAMES[entry.provider] || entry.provider}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium text-gray-600">Model:</label>
                                    <input
                                        type="text"
                                        value={model}
                                        onChange={(event) => onModelChange(event.target.value)}
                                        className="w-36 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="e.g. gpt-5.2"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium text-gray-600">Max Rows:</label>
                                    <input
                                        type="number"
                                        value={maxRows}
                                        onChange={(event) => onMaxRowsChange(Number(event.target.value))}
                                        className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium text-gray-600">Timeout:</label>
                                    <input
                                        type="number"
                                        value={timeout}
                                        onChange={(event) => onTimeoutChange(Number(event.target.value))}
                                        className="w-16 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <span className="text-xs text-gray-500">s</span>
                                </div>

                                <div ref={promptHistoryRef} className="relative ml-auto">
                                    <button
                                        ref={promptHistoryButtonRef}
                                        type="button"
                                        onClick={onPromptHistoryToggle}
                                        className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Prompt History
                                    </button>

                                    <PromptHistoryPanel
                                        isOpen={isPromptHistoryOpen}
                                        isLoading={isPromptHistoryLoading}
                                        items={filteredPromptHistory}
                                        query={promptHistoryQuery}
                                        position={promptHistoryPosition}
                                        panelRef={promptHistoryPanelRef}
                                        onQueryChange={onPromptHistoryQueryChange}
                                        onSelectItem={onPromptHistorySelect}
                                    />
                                </div>

                                <button
                                    onClick={onAsk}
                                    disabled={isGenerating || !question.trim() || !selectedDataSourceId}
                                    className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    {isDryRun ? 'Preview' : 'Ask'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isExpanded && (
                <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize prompt section"
                    onPointerDown={onResizeStart}
                    className="flex h-2 flex-shrink-0 touch-none items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 cursor-row-resize"
                >
                    <GripHorizontal size={14} className="text-gray-400" />
                </div>
            )}
        </>
    );
}
