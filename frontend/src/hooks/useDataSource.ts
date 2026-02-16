import { useState, useEffect, useCallback } from 'react';
import { client } from '../lib/api/client';
import type { components } from '../lib/api/types';

type DataSource = components['schemas']['DataSourceListResponse']['items'][number];

const SESSION_KEY = 'selectedDataSourceId';

export function useDataSource() {
    const [dataSources, setDataSources] = useState<DataSource[]>([]);
    const [selectedDataSourceId, setSelectedDataSourceIdRaw] = useState<string>(
        () => sessionStorage.getItem(SESSION_KEY) ?? ''
    );

    const setSelectedDataSourceId = useCallback((id: string) => {
        setSelectedDataSourceIdRaw(id);
        sessionStorage.setItem(SESSION_KEY, id);
    }, []);

    useEffect(() => {
        const fetchDataSources = async () => {
            const { data } = await client.GET('/v1/data-sources');
            if (data?.items) {
                setDataSources(data.items);
                const stored = sessionStorage.getItem(SESSION_KEY);
                const valid = stored && data.items.some(ds => ds.id === stored);
                if (!valid && data.items.length > 0) {
                    setSelectedDataSourceId(data.items[0].id);
                }
            }
        };
        fetchDataSources();
    }, [setSelectedDataSourceId]);

    return { dataSources, selectedDataSourceId, setSelectedDataSourceId };
}
