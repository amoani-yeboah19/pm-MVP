import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group rounded-2xl border border-transparent bg-white px-4 py-3.5",
        "shadow-[0_2px_8px_rgba(3,33,71,0.06)] transition-all duration-150",
        "hover:border-[var(--stroke)] hover:shadow-[0_4px_16px_rgba(3,33,71,0.10)]",
        isDragging && "opacity-50 shadow-[0_12px_32px_rgba(3,33,71,0.15)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-semibold leading-5 text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1.5 text-xs leading-5 text-[var(--gray-text)]">
              {card.details}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="shrink-0 rounded-lg p-1 text-[var(--gray-text)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--surface)] hover:text-red-400"
          aria-label={`Delete ${card.title}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </article>
  );
};
