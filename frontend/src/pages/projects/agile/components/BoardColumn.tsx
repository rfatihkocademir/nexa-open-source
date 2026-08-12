import { Droppable } from "@hello-pangea/dnd";
import { BoardCard } from "./BoardCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Story, StoryStatus } from "@/types/agile";

interface BoardColumnData {
    id: StoryStatus;
    title: string;
    items: Story[];
}

interface BoardColumnProps {
    column: BoardColumnData;
    onItemClick?: (itemId: string) => void;
}

export function BoardColumn({ column, onItemClick }: BoardColumnProps) {
    return (
        <div className="flex flex-col w-80 min-w-80 bg-muted/50 rounded-lg border h-full max-h-full">
            <div className="p-3 font-semibold border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {column.title}
                </div>
                <span className="text-muted-foreground text-xs font-normal bg-background px-2 py-0.5 rounded-full border">
                    {column.items.length}
                </span>
            </div>

            <Droppable droppableId={column.id}>
                {(provided) => (
                    <ScrollArea className="flex-1 p-2">
                        <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="flex flex-col gap-2 min-h-[100px]"
                        >
                            {column.items.map((item, index: number) => (
                                <BoardCard key={item.id} item={item} index={index} onItemClick={onItemClick} />
                            ))}
                            {provided.placeholder}
                        </div>
                    </ScrollArea>
                )}
            </Droppable>
        </div>
    );
}
