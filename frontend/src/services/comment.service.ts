import { api } from './api';

export interface Comment {
    id: string;
    content: string;
    workItemId?: string;
    storyId?: string;
    taskId?: string;
    bugId?: string;
    authorId: string;
    author: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatar?: string;
    };
    createdAt: string;
}

export const commentService = {
    create: async (data: { content: string; workItemId?: string; storyId?: string; taskId?: string; bugId?: string }) => {
        const response = await api.post<Comment>('/comments', data);
        return response as unknown as Comment;
    },

    getByWorkItemId: async (workItemId: string) => {
        const response = await api.get<Comment[]>(`/comments/workitem/${workItemId}`);
        return response as unknown as Comment[];
    },

    getByStoryId: async (storyId: string) => {
        return commentService.getByWorkItemId(storyId);
    },
};
