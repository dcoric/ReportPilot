import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FolderClosed, Plus } from 'lucide-react';



interface SidebarProps {
    selectedDataSourceId: string;
    onSelectDataSource: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = () => {
    const [isSavedReportsExpanded, setIsSavedReportsExpanded] = useState(true);

    return (
        <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
            {/* Connections Section */}
            <div className="flex-1 overflow-y-auto py-2">

                {/* Saved Reports Section */}
                <div className="px-3 mb-1">
                    <button
                        onClick={() => setIsSavedReportsExpanded(!isSavedReportsExpanded)}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider w-full hover:text-gray-700"
                    >
                        {isSavedReportsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Saved Reports
                    </button>
                </div>

                {isSavedReportsExpanded && (
                    <div className="space-y-0.5 px-2">
                        {/* Example folders - replace with actual data */}
                        <div className="ml-3">
                            <div className="flex items-center gap-2 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded cursor-pointer">
                                <FolderClosed size={14} className="text-gray-400" />
                                <span>Finance</span>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded cursor-pointer">
                                <FolderClosed size={14} className="text-gray-400" />
                                <span>Marketing</span>
                            </div>
                            <div className="px-3 py-2 text-sm text-gray-400 italic">Coming soon...</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 space-y-2">
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                    <Plus size={14} />
                    New Folder
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    <Plus size={14} />
                    Save Current Report
                </button>
            </div>
        </div>
    );
};
