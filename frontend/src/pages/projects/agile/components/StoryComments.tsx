import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentService } from '@/services/comment.service';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { FileAttachment } from '@/components/FileAttachment';
import type { UploadedFile } from '@/components/FileAttachment';
import { getImageUrl } from '@/services/upload.service';
import { ImagePreview } from '@/components/ImagePreview';

interface StoryCommentsProps {
    storyId: string;
}

export function StoryComments({ storyId }: StoryCommentsProps) {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const [content, setContent] = useState('');
    const [commentAttachments, setCommentAttachments] = useState<UploadedFile[]>([]);

    const { data: comments, isLoading } = useQuery({
        queryKey: ['comments', 'story', storyId],
        queryFn: () => commentService.getByWorkItemId(storyId),
        enabled: !!storyId
    });

    const createMutation = useMutation({
        mutationFn: (commentContent: string) => {
            let fullContent = commentContent;
            if (commentAttachments.length > 0) {
                const images = commentAttachments.map(a =>
                    `![${a.filename}](${getImageUrl(a.url)})`
                ).join('\n');
                fullContent += `\n${images}`;
            }
            return commentService.create({
                content: fullContent,
                workItemId: storyId
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments', 'story', storyId] });
            setContent('');
            setCommentAttachments([]);
            toast.success(t('story_comments.toast.add_success'));
        },
        onError: () => toast.error(t('story_comments.toast.add_error'))
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        createMutation.mutate(content);
    };

    if (isLoading) return <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>;

    return (
        <section className="flex flex-col h-full max-h-[400px]">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4" />
                {t('story_comments.title', { count: comments?.length || 0 })}
            </h3>

            <ScrollArea className="flex-1 pr-4 -mr-4 mb-4">
                <div className="space-y-4">
                    {comments && comments.length > 0 ? (
                        comments.map((comment: any) => (
                            <div key={comment.id} className="flex gap-3">
                                <Avatar className="h-8 w-8 mt-1">
                                    <AvatarImage src={comment.author.avatar} />
                                    <AvatarFallback className="text-xs">
                                        {comment.author.firstName[0]}{comment.author.lastName[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">
                                            {comment.author.firstName} {comment.author.lastName}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(comment.createdAt), {
                                                addSuffix: true,
                                                locale: i18n.language?.startsWith('tr') ? tr : enUS
                                            })}
                                        </span>
                                    </div>
                                    <div className="text-sm text-foreground bg-muted/40 p-3 rounded-md">
                                        {comment.content.split('\n').map((line: string, i: number) => {
                                            const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
                                            if (imgMatch) {
                                                return <ImagePreview key={i} src={imgMatch[2]} alt={imgMatch[1]} className="rounded-md max-w-full max-h-48 mt-2 border" />;
                                            }
                                            return <span key={i}>{line}{i < comment.content.split('\n').length - 1 && <br />}</span>;
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground italic py-4 text-center">
                            {t('story_comments.empty')}
                        </p>
                    )}
                </div>
            </ScrollArea>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-auto pt-2 border-t">
                <div className="flex gap-2">
                    <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={t('story_comments.placeholder')}
                        className="min-h-[80px] resize-none text-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (content.trim()) createMutation.mutate(content);
                            }
                        }}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        className="h-[80px] w-[80px] shrink-0"
                        disabled={!content.trim() || createMutation.isPending}
                    >
                        {createMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                        <span className="sr-only">{t('common.send', 'Gönder')}</span>
                    </Button>
                </div>
                <FileAttachment
                    files={commentAttachments}
                    onUpload={(file) => setCommentAttachments(prev => [...prev, file])}
                    onRemove={(id) => setCommentAttachments(prev => prev.filter(f => f.id !== id))}
                    maxFiles={3}
                    compact
                />
            </form>
        </section>
    );
}
