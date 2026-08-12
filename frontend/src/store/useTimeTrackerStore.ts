import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveTimer {
    workItemId: string;
    projectId: string;
    title: string;
    key: string;
    startedAt: string; // ISO string
}

interface TimeTrackerState {
    activeTimer: ActiveTimer | null;
    startTimer: (workItemId: string, projectId: string, title: string, key: string) => void;
    stopTimer: () => ActiveTimer | null;
    cancelTimer: () => void;
}

export const useTimeTrackerStore = create<TimeTrackerState>()(
    persist(
        (set, get) => ({
            activeTimer: null,
            startTimer: (workItemId, projectId, title, key) => {
                set({
                    activeTimer: {
                        workItemId,
                        projectId,
                        title,
                        key,
                        startedAt: new Date().toISOString()
                    }
                });
            },
            stopTimer: () => {
                const timer = get().activeTimer;
                set({ activeTimer: null });
                return timer;
            },
            cancelTimer: () => set({ activeTimer: null })
        }),
        {
            name: 'nexa-time-tracker',
        }
    )
);
