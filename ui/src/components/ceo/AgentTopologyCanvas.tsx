import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DndContext, useDraggable, type DragEndEvent } from "@dnd-kit/core";
import type { Agent } from "@paperclipai/shared";
import { GripVertical, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import {
  buildTopology,
  reconcileTopologyPositions,
  type TopologyPosition,
} from "./command-center-model";

const NODE_WIDTH = 224;
const NODE_HEIGHT = 104;
const CANVAS_PADDING = 48;

function layoutStorageKey(companyId: string) {
  return `ceo-agent:topology-layout:${companyId}`;
}

function adapterLabel(adapterType: string): string {
  const label = adapterType.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function savedPositions(companyId: string, fallback: Map<string, TopologyPosition>) {
  try {
    const saved = window.localStorage.getItem(layoutStorageKey(companyId));
    if (!saved) return new Map(fallback);
    const parsed = JSON.parse(saved) as Record<string, TopologyPosition>;
    return new Map([...fallback.entries()].map(([id, position]) => {
      const candidate = parsed[id];
      return [id, Number.isFinite(candidate?.x) && Number.isFinite(candidate?.y) ? candidate : position];
    }));
  } catch {
    return new Map(fallback);
  }
}

function TopologyNode({
  node,
  position,
}: {
  node: ReturnType<typeof buildTopology>["nodes"][number];
  position: TopologyPosition;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: node.id });
  const style: CSSProperties = {
    left: position.x,
    top: position.y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "absolute w-56 rounded-lg border border-border bg-card p-3 shadow-sm",
        isDragging && "z-10 border-primary",
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{node.agent.name}</p>
          <p className="truncate text-xs text-muted-foreground">{node.agent.title ?? node.agent.role}</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{node.agent.status}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span className="truncate" title={adapterLabel(node.agent.adapterType)}>{adapterLabel(node.agent.adapterType)}</span>
        <span className="truncate text-right" title={node.profile ?? "Unmapped"}>
          {node.profile ? `Hermes: ${node.profile}` : "Unmapped"}
        </span>
      </div>
    </article>
  );
}

export function AgentTopologyCanvas({
  companyId,
  agents,
  error = false,
}: {
  companyId: string;
  agents?: Agent[];
  error?: boolean;
}) {
  const liveAgents = agents ?? [];
  const topology = useMemo(() => buildTopology(liveAgents), [liveAgents]);
  const topologyKey = [
    topology.nodes.map((node) => node.id).join(","),
    topology.edges.map((edge) => `${edge.from}>${edge.to}`).join(","),
  ].join("|");
  const defaultPositions = useMemo(
    () => new Map(topology.nodes.map((node) => [node.id, node.position])),
    // The layout only changes when node IDs or reporting edges change. Agent
    // status/name refetches must not reset a founder's unsaved arrangement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topologyKey],
  );
  const [positions, setPositions] = useState(() => savedPositions(companyId, defaultPositions));
  const [layoutMessage, setLayoutMessage] = useState("");
  const agentsLoaded = agents !== undefined;
  const activeCompanyId = useRef(companyId);
  const hydratedCompanyId = useRef<string | null>(agentsLoaded ? companyId : null);

  useEffect(() => {
    if (activeCompanyId.current !== companyId) {
      activeCompanyId.current = companyId;
      if (!agentsLoaded) {
        hydratedCompanyId.current = null;
        setPositions(new Map(defaultPositions));
        return;
      }
      hydratedCompanyId.current = companyId;
      setPositions(savedPositions(companyId, defaultPositions));
      return;
    }
    if (!agentsLoaded) {
      return;
    }
    if (hydratedCompanyId.current !== companyId) {
      hydratedCompanyId.current = companyId;
      setPositions(savedPositions(companyId, defaultPositions));
      return;
    }
    setPositions((current) => reconcileTopologyPositions(current, defaultPositions));
  }, [agentsLoaded, companyId, defaultPositions]);

  const canvasSize = useMemo(() => {
    const placedNodes = topology.nodes.map((node) => positions.get(node.id) ?? node.position);
    return {
      width: Math.max(640, ...placedNodes.map((position) => position.x + NODE_WIDTH + CANVAS_PADDING)),
      height: Math.max(420, ...placedNodes.map((position) => position.y + NODE_HEIGHT + CANVAS_PADDING)),
    };
  }, [positions, topology.nodes]);

  const positionFor = (id: string) => positions.get(id) ?? defaultPositions.get(id)!;

  function handleDragEnd(event: DragEndEvent) {
    const id = String(event.active.id);
    setLayoutMessage("");
    setPositions((current) => {
      const start = current.get(id) ?? defaultPositions.get(id);
      if (!start) return current;
      const next = new Map(current);
      next.set(id, {
        x: Math.max(CANVAS_PADDING, start.x + event.delta.x),
        y: Math.max(CANVAS_PADDING, start.y + event.delta.y),
      });
      return next;
    });
  }

  function saveLayout() {
    try {
      const serializable = Object.fromEntries(positions);
      window.localStorage.setItem(layoutStorageKey(companyId), JSON.stringify(serializable));
      setLayoutMessage("Layout saved on this browser.");
    } catch {
      setLayoutMessage("Layout could not be saved on this browser.");
    }
  }

  function resetLayout() {
    try {
      window.localStorage.removeItem(layoutStorageKey(companyId));
    } catch {
      // Reset still succeeds in memory when browser storage is unavailable.
    }
    setPositions(new Map(defaultPositions));
    setLayoutMessage("Layout reset.");
  }

  if (error) {
    return (
      <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="topology-title">
        <h2 id="topology-title" className="text-sm font-semibold text-foreground">Agent topology</h2>
        <p className="mt-2 text-sm text-destructive">Agent topology could not be loaded.</p>
        <Link to="/agents" className="mt-2 inline-block text-xs font-medium text-ceo-accent hover:underline">
          Open Agents to retry
        </Link>
      </section>
    );
  }

  if (agents === undefined) {
    return (
      <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="topology-title">
        <h2 id="topology-title" className="text-sm font-semibold text-foreground">Agent topology</h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading live agent topology.</p>
      </section>
    );
  }

  if (agents.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="topology-title">
        <h2 id="topology-title" className="text-sm font-semibold text-foreground">Agent topology</h2>
        <p className="mt-2 text-sm text-muted-foreground">No agents are connected to this company yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card" aria-labelledby="topology-title">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="topology-title" className="text-sm font-semibold text-foreground">Agent topology</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Reporting lines use live organization data. Arrangement is local to this browser.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={resetLayout} data-testid="topology-reset-layout">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset
          </Button>
          <Button type="button" size="sm" onClick={saveLayout} data-testid="topology-save-layout">
            <Save className="h-3.5 w-3.5" aria-hidden />
            Save layout
          </Button>
        </div>
        <p className="sr-only" aria-live="polite">{layoutMessage}</p>
      </div>
      <div className="overflow-x-auto">
        <DndContext onDragEnd={handleDragEnd}>
          <div className="relative" style={{ width: canvasSize.width, height: canvasSize.height }}>
            <svg className="pointer-events-none absolute inset-0" width={canvasSize.width} height={canvasSize.height} aria-hidden>
              {topology.edges.map((edge) => {
                const report = positionFor(edge.from);
                const manager = positionFor(edge.to);
                const startX = manager.x + NODE_WIDTH / 2;
                const startY = manager.y + NODE_HEIGHT;
                const endX = report.x + NODE_WIDTH / 2;
                const endY = report.y;
                return (
                  <path
                    key={edge.id}
                    data-testid="topology-wire"
                    d={`M ${startX} ${startY} C ${startX} ${startY + 26}, ${endX} ${endY - 26}, ${endX} ${endY}`}
                    fill="none"
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
            {topology.nodes.map((node) => (
              <TopologyNode key={node.id} node={node} position={positionFor(node.id)} />
            ))}
          </div>
        </DndContext>
      </div>
    </section>
  );
}
