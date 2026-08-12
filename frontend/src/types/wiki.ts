import type { JsonValue } from './json';

export interface WikiSpace {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    projectId: string;
    _count?: {
        pages: number;
    };
    createdAt: string;
    updatedAt: string;
}

export interface WikiPage {
    id: string;
    key?: string;
    title: string;
    content?: JsonValue;
    spaceId: string;
    parentId?: string;
    children?: WikiPage[]; // For tree structure
    authorId: string;
    author?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSpaceDTO {
    name: string;
    description?: string;
    icon?: string;
}

export interface CreatePageDTO {
    spaceId: string;
    title: string;
    content?: JsonValue;
    parentId?: string;
}

export interface UpdatePageDTO {
    title?: string;
    content?: JsonValue;
}
