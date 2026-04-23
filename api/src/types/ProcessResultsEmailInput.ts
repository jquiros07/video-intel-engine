export type ProcessResultsEmailInput = {
    to: string;
    videoProcessingId: string;
    videoUrl: string;
    status: string;
    resultData: unknown;
};
