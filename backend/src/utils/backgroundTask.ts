type BackgroundTaskFactory<T = unknown> = () => Promise<T>;

export const runInBackground = <T>(
    taskFactory: BackgroundTaskFactory<T>,
    onError: (error: unknown) => void
) => {
    void Promise.resolve()
        .then(taskFactory)
        .catch(onError);
};
