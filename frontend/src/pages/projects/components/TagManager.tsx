import { useState } from "react";
import { Plus, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { type Tag } from "@/types/testCase";
import { TagBadge } from "@/components/TagBadge";
import { useTranslation } from "react-i18next";

interface TagManagerProps {
    testCaseId: string;
    projectId: string;
    currentTags: Tag[];
    onTagsChange?: () => void;
}

const getProjectTags = async (projectId: string) => {
    const res = await api.get<Tag[]>(`/tags?projectId=${projectId}`);
    return (res.data as any).data || res.data;
};

const createTag = async (data: { name: string; projectId: string; color: string }) => {
    const res = await api.post('/tags', data);
    return (res.data as any).data || res.data;
};

const addTagsToCase = async (testCaseId: string, tagIds: string[]) => {
    await api.post(`/cases/${testCaseId}/tags`, { tagIds });
};

const removeTagFromCase = async (testCaseId: string, tagId: string) => {
    await api.delete(`/cases/${testCaseId}/tags/${tagId}`);
};

const COLORS = [
    "#EF4444", // red
    "#F59E0B", // amber
    "#10B981", // emerald
    "#3B82F6", // blue
    "#6366F1", // indigo
    "#8B5CF6", // violet
    "#EC4899", // pink
    "#6B7280", // gray
];

export function TagManager({ testCaseId, projectId, currentTags, onTagsChange }: TagManagerProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    const { data: allTags = [] } = useQuery<Tag[]>({
        queryKey: ['tags', projectId],
        queryFn: () => getProjectTags(projectId),
        enabled: open,
    });

    const createMutation = useMutation({
        mutationFn: createTag,
        onSuccess: (newTag) => {
            addMutation.mutate([newTag.id]);
            queryClient.invalidateQueries({ queryKey: ['tags', projectId] });
        }
    });

    const addMutation = useMutation({
        mutationFn: (tagIds: string[]) => addTagsToCase(testCaseId, tagIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['test-cases'] });
            onTagsChange?.();
            setSearchValue("");
        }
    });

    const removeMutation = useMutation({
        mutationFn: (tagId: string) => removeTagFromCase(testCaseId, tagId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['test-cases'] });
            onTagsChange?.();
        }
    });

    const availableTags = allTags.filter(tag =>
        !currentTags.some(ct => ct.id === tag.id)
    ).filter(tag =>
        tag.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    const handleCreateTag = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!searchValue.trim()) return;
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        createMutation.mutate({
            name: searchValue.trim(),
            projectId,
            color: randomColor
        });
    };

    return (
        <div className="flex flex-wrap gap-1 items-center">
            {currentTags.map(tag => (
                <div key={tag.id} className="relative group">
                    <TagBadge name={tag.name} color={tag.color} />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removeMutation.mutate(tag.id);
                        }}
                        className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-[1px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X className="h-2 w-2" />
                    </button>
                </div>
            ))}

            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground">
                        <Plus className="h-3 w-3 mr-1" />
                        {t("tag_manager.tag")}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px]" align="start">
                    <div className="p-2">
                        <div className="flex items-center border rounded px-2">
                            <Search className="h-3 w-3 mr-2 text-muted-foreground" />
                            <input
                                className="flex-1 bg-transparent border-none text-xs h-7 focus:outline-none placeholder:text-muted-foreground"
                                placeholder={t("tag_manager.search_placeholder")}
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DropdownMenuSeparator />
                    <div className="max-h-[200px] overflow-auto">
                        {availableTags.length === 0 && searchValue && (
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={handleCreateTag}>
                                <Plus className="h-3 w-3 mr-2" />
                                {t("tag_manager.create_tag", { value: searchValue })}
                            </DropdownMenuItem>
                        )}
                        {availableTags.map(tag => (
                            <DropdownMenuItem
                                key={tag.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addMutation.mutate([tag.id]);
                                }}
                            >
                                <div
                                    className="w-2 h-2 rounded-full mr-2"
                                    style={{ backgroundColor: tag.color }}
                                />
                                {tag.name}
                            </DropdownMenuItem>
                        ))}
                        {availableTags.length === 0 && !searchValue && (
                            <div className="p-2 text-xs text-muted-foreground text-center">
                                {t("tag_manager.no_tags")}
                            </div>
                        )}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
