import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  onRename: (columnId: string, title: string) => void;
  onRenameCommit: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => Promise<void>;
  onDeleteCard: (columnId: string, cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  onRename,
  onRenameCommit,
  onAddCard,
  onDeleteCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[480px] flex-col rounded-3xl border bg-[var(--surface)] p-4 transition",
        isOver
          ? "border-[var(--primary-blue)] bg-blue-50/40 shadow-[0_0_0_3px_rgba(32,157,215,0.15)]"
          : "border-[var(--stroke)] shadow-[0_2px_12px_rgba(3,33,71,0.06)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 w-6 rounded-full bg-[var(--accent-yellow)]" />
        <input
          value={column.title}
          onChange={(event) => onRename(column.id, event.target.value)}
          onBlur={(event) => onRenameCommit(column.id, event.target.value)}
          className="flex-1 bg-transparent font-display text-sm font-semibold text-[var(--navy-dark)] outline-none"
          aria-label="Column title"
        />
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--gray-text)] shadow-sm">
          {cards.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--stroke)] py-8 text-[10px] font-semibold uppercase tracking-widest text-[var(--gray-text)]">
            Drop here
          </div>
        )}
      </div>

      <NewCardForm
        onAdd={(title, details) => onAddCard(column.id, title, details)}
      />
    </section>
  );
};
