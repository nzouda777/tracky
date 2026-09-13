"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useTransition } from "react";

import { Alert, Badge, Button, Card, EmptyState } from "@/components/ui";
import { reorderStagesAction } from "@/lib/actions/stages";
import type { Stage } from "@/lib/db";
import { StageEditForm } from "./stage-edit-form";

/**
 * Reorderable stage list.
 *
 * Order is applied optimistically and then persisted; if the save fails the
 * list is reset from the server copy so the UI never claims an order that was
 * not stored.
 */
export function StageManager({ stages }: { stages: Stage[] }) {
  const [items, setItems] = useState(stages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-sync from the server copy when it changes (after a save, or a
  // revalidation). React's "adjust state during render" pattern, which avoids
  // the extra commit an effect would cause.
  const [serverStages, setServerStages] = useState(stages);
  if (stages !== serverStages) {
    setServerStages(stages);
    setItems(stages);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = [...items];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    setItems(next);
    persist(next);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    persist(next);
  }

  function persist(next: Stage[]) {
    setError(null);
    const formData = new FormData();
    formData.set("order", next.map((item) => item.id).join(","));
    startTransition(async () => {
      const result = await reorderStagesAction({}, formData);
      if (result.error) {
        setError(result.error);
        setItems(stages);
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No stages yet"
          description="Add your first stage below to start tracking orders."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2" aria-busy={isPending}>
            {items.map((stage, index) => (
              <SortableStage
                key={stage.id}
                stage={stage}
                index={index}
                total={items.length}
                isEditing={editingId === stage.id}
                onToggleEdit={() =>
                  setEditingId(editingId === stage.id ? null : stage.id)
                }
                onMove={move}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableStage({
  stage,
  index,
  total,
  isEditing,
  onToggleEdit,
  onMove,
}: {
  stage: Stage;
  index: number;
  total: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border bg-white shadow-sm ${
        isDragging ? "border-ink-400 opacity-80" : "border-ink-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
        <button
          type="button"
          className="cursor-grab rounded-md px-1.5 py-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 active:cursor-grabbing"
          aria-label={`Reorder ${stage.name}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>

        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: stage.color }}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">
            {index + 1}. {stage.name}
          </p>
          <p className="truncate text-xs text-ink-500">
            {stage.description || stage.key}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {stage.isTerminal ? <Badge tone="success">Terminal</Badge> : null}
          {stage.triggersFulfillment ? (
            <Badge tone="info">Triggers fulfillment</Badge>
          ) : null}
          {stage.locksAddressEditing ? (
            <Badge tone="warning">Locks address</Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {/* Keyboard/no-pointer fallback for reordering. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label={`Move ${stage.name} up`}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label={`Move ${stage.name} down`}
          >
            ↓
          </Button>
          <Button variant="secondary" size="sm" onClick={onToggleEdit}>
            {isEditing ? "Close" : "Edit"}
          </Button>
        </div>
      </div>

      {isEditing ? (
        <div className="border-t border-ink-200 px-3 py-4 sm:px-4">
          <StageEditForm stage={stage} onDone={onToggleEdit} />
        </div>
      ) : null}
    </li>
  );
}
