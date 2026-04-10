import { Loader2 } from 'lucide-react';
import type { RunResponse, TabType } from './types';

interface ResultSectionProps {
    activeTab: TabType;
    queryResult: RunResponse | null;
    isRunning: boolean;
    isDryRun: boolean;
    onTabChange: (tab: TabType) => void;
}

function formatCellValue(value: unknown) {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
}

function renderCitationList<T extends { id: string }>(
    title: string,
    items: T[] | undefined,
    renderItem: (item: T) => string,
) {
    return (
        <div>
            <div className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">{title}</div>
            {!items || items.length === 0 ? (
                <div className="text-sm text-gray-400">None</div>
            ) : (
                <div className="space-y-2">
                    {items.map((item) => (
                        <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                            {renderItem(item)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ResultSection({ activeTab, queryResult, isRunning, isDryRun, onTabChange }: ResultSectionProps) {
    return (
        <div className="flex min-h-[220px] flex-1 flex-col overflow-hidden bg-white">
            <div className="flex items-center overflow-x-auto border-b border-gray-200 px-4">
                <div className="mr-4 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap">Result section</div>
                <div className="flex gap-4">
                    {(['results', 'metadata', 'citations', 'query-plan'] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => onTabChange(tab)}
                            className={`border-b-2 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                                activeTab === tab
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            {tab === 'results' && 'Results'}
                            {tab === 'metadata' && 'Metadata'}
                            {tab === 'citations' && 'Citations'}
                            {tab === 'query-plan' && 'Query Plan'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {activeTab === 'results' && (
                    <div className="p-0">
                        {queryResult?.preview && !isRunning && (
                            <div className="m-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                Preview only. SQL was generated from your saved schema context, but it was not executed against the source database.
                            </div>
                        )}

                        {!queryResult && !isRunning && (
                            <div className="flex h-full flex-col items-center justify-center p-8 text-gray-400">
                                <p>No results yet. {isDryRun ? 'Preview SQL to inspect the generated response.' : 'Run a query to see results.'}</p>
                            </div>
                        )}

                        {isRunning && (
                            <div className="flex h-full items-center justify-center text-gray-400">
                                <Loader2 className="mr-2 animate-spin" size={20} />
                                {isDryRun ? 'Generating preview...' : 'Executing query...'}
                            </div>
                        )}

                        {queryResult && !queryResult.preview && (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="sticky top-0 bg-gray-50">
                                    <tr>
                                        <th className="border-r border-gray-200 bg-gray-100 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                        {queryResult.columns.map((column) => (
                                            <th
                                                key={column}
                                                className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase whitespace-nowrap"
                                            >
                                                {column}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {queryResult.rows.map((row, rowIndex) => (
                                        <tr key={`${queryResult.attempt_id}-${rowIndex}`} className="hover:bg-gray-50">
                                            <td className="border-r border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-400">{rowIndex + 1}</td>
                                            {queryResult.columns.map((column) => (
                                                <td key={`${column}-${rowIndex}`} className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                                                    {formatCellValue(row[column])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'metadata' && (
                    <div className="p-6">
                        {queryResult ? (
                            <div className="space-y-4">
                                <div>
                                    <div className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">Execution Info</div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between border-b border-gray-100 py-2">
                                            <span className="text-gray-600">Mode:</span>
                                            <span className="font-medium">{queryResult.preview ? 'Dry run preview' : 'Executed'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 py-2">
                                            <span className="text-gray-600">Attempt ID:</span>
                                            <span className="font-mono text-xs font-medium">{queryResult.attempt_id}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 py-2">
                                            <span className="text-gray-600">Row Count:</span>
                                            <span className="font-medium">{queryResult.preview ? 'Not executed' : queryResult.row_count}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 py-2">
                                            <span className="text-gray-600">Rows Returned:</span>
                                            <span className="font-medium">{queryResult.preview ? 'Not executed' : queryResult.rows.length}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 py-2">
                                            <span className="text-gray-600">Execution Duration:</span>
                                            <span className="font-medium">{queryResult.preview ? 'Not executed' : `${queryResult.duration_ms} ms`}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 py-2">
                                            <span className="text-gray-600">Confidence:</span>
                                            <span className="font-medium">{queryResult.confidence ? `${(queryResult.confidence * 100).toFixed(1)}%` : 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 py-2">
                                            <span className="text-gray-600">Provider:</span>
                                            <span className="font-medium">{queryResult.provider?.name || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-100 py-2">
                                            <span className="text-gray-600">Model:</span>
                                            <span className="font-medium">{queryResult.provider?.model || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center text-gray-400">No metadata available</div>
                        )}
                    </div>
                )}

                {activeTab === 'citations' && (
                    <div className="space-y-6 p-6">
                        {renderCitationList('Schema Objects', queryResult?.citations?.schema_objects, (item) => (
                            `${item.schema_name}.${item.object_name} (${item.object_type})`
                        ))}
                        {renderCitationList('Semantic Entities', queryResult?.citations?.semantic_entities, (item) => (
                            `${item.business_name} -> ${item.target_ref}`
                        ))}
                        {renderCitationList('Metric Definitions', queryResult?.citations?.metric_definitions, (item) => (
                            `${item.business_name} (${item.semantic_entity_id})`
                        ))}
                        {renderCitationList('Join Policies', queryResult?.citations?.join_policies, (item) => (
                            `${item.left_ref} ${item.join_type} ${item.right_ref}`
                        ))}
                        {renderCitationList('RAG Documents', queryResult?.citations?.rag_documents, (item) => (
                            `${item.doc_type}:${item.ref_id} score=${item.score.toFixed(3)}`
                        ))}
                    </div>
                )}

                {activeTab === 'query-plan' && (
                    <div className="p-6">
                        <div className="py-8 text-center text-gray-400">Query plan visualization coming soon...</div>
                    </div>
                )}
            </div>
        </div>
    );
}
