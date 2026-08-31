/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Share2,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  Sliders,
  Calendar,
  Sparkles,
  Search,
} from 'lucide-react';
import { DecryptedEntry, GraphNode, GraphEdge, GraphNodeType } from '../types';

interface KnowledgeGraphTabProps {
  entries: DecryptedEntry[];
}

const CATEGORY_COLORS: Record<GraphNodeType, { bg: string; stroke: string; label: string; text: string }> = {
  Mood: { bg: '#f59e0b', stroke: '#d97706', label: 'Mood', text: 'text-amber-400' },
  Project: { bg: '#06b6d4', stroke: '#0891b2', label: 'Project', text: 'text-cyan-400' },
  Habit: { bg: '#10b981', stroke: '#059669', label: 'Habit', text: 'text-emerald-400' },
  Person: { bg: '#a855f7', stroke: '#9333ea', label: 'Person', text: 'text-purple-400' },
  Skill: { bg: '#6366f1', stroke: '#4f46e5', label: 'Skill', text: 'text-indigo-400' },
  Tech: { bg: '#f43f5e', stroke: '#e11d48', label: 'Tech', text: 'text-rose-400' },
};

export const KnowledgeGraphTab: React.FC<KnowledgeGraphTabProps> = ({ entries }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const [activeCategoryFilters, setActiveCategoryFilters] = useState<Set<GraphNodeType>>(
    new Set(['Mood', 'Project', 'Habit', 'Person', 'Skill', 'Tech'])
  );

  // Physics Simulation Settings
  const [chargeStrength, setChargeStrength] = useState(-180);
  const [linkDistance, setLinkDistance] = useState(70);

  // Aggregation of decrypted graph nodes and edges across all entries
  const { aggregatedNodes, aggregatedEdges } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeKeySet = new Set<string>();
    const edgesList: GraphEdge[] = [];

    for (const entry of entries) {
      if (!entry.aiInsight) continue;

      // Collect Nodes
      for (const node of entry.aiInsight.graph_nodes || []) {
        const normId = (node.id || node.label).toLowerCase().replace(/[^a-z0-9]/g, '-');
        if (nodeMap.has(normId)) {
          const existing = nodeMap.get(normId)!;
          existing.frequency = (existing.frequency || 1) + 1;
          if (!existing.entryIds?.includes(entry.id)) {
            existing.entryIds?.push(entry.id);
          }
        } else {
          nodeMap.set(normId, {
            ...node,
            id: normId,
            frequency: 1,
            val: 6,
            entryIds: [entry.id],
          });
        }
      }

      // Collect Edges
      for (const edge of entry.aiInsight.graph_edges || []) {
        const s = (typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-');
        const t = (typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-');

        if (s && t && s !== t) {
          const key = `${s}->${t}:${edge.relationship}`;
          if (!edgeKeySet.has(key)) {
            edgeKeySet.add(key);
            edgesList.push({
              source: s,
              target: t,
              relationship: edge.relationship || 'relates_to',
            });
          }
        }
      }
    }

    return {
      aggregatedNodes: Array.from(nodeMap.values()),
      aggregatedEdges: edgesList,
    };
  }, [entries]);

  // Filtered nodes and edges based on active categories
  const filteredData = useMemo(() => {
    const visibleNodes = aggregatedNodes.filter((n) => activeCategoryFilters.has(n.type));
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

    const visibleEdges = aggregatedEdges.filter((e) => {
      const sId = typeof e.source === 'object' ? (e.source as any).id : e.source;
      const tId = typeof e.target === 'object' ? (e.target as any).id : e.target;
      return visibleNodeIds.has(sId) && visibleNodeIds.has(tId);
    });

    return {
      nodes: visibleNodes.map((n) => ({ ...n })),
      edges: visibleEdges.map((e) => ({ ...e })),
    };
  }, [aggregatedNodes, aggregatedEdges, activeCategoryFilters]);

  // D3 Force Simulation on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // Handle high DPI
    const dpi = window.devicePixelRatio || 1;
    canvas.width = width * dpi;
    canvas.height = height * dpi;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpi, dpi);

    let transform = d3.zoomIdentity;

    const simulation = d3
      .forceSimulation<any>(filteredData.nodes)
      .force(
        'link',
        d3
          .forceLink<any, any>(filteredData.edges)
          .id((d: any) => d.id)
          .distance(linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => (d.frequency ? d.frequency * 3 + 18 : 20)))
      .alphaDecay(0.025);

    const render = () => {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // Draw Edges
      filteredData.edges.forEach((edge: any) => {
        if (!edge.source.x || !edge.target.x) return;

        const isHighlighted =
          highlightedNodeId &&
          (edge.source.id === highlightedNodeId || edge.target.id === highlightedNodeId);

        ctx.beginPath();
        ctx.moveTo(edge.source.x, edge.source.y);
        ctx.lineTo(edge.target.x, edge.target.y);
        ctx.strokeStyle = isHighlighted ? 'rgba(6, 182, 212, 0.8)' : 'rgba(115, 115, 115, 0.25)';
        ctx.lineWidth = isHighlighted ? 2.5 : 1.2;
        ctx.stroke();

        // Edge Relationship Label if zoomed in
        if (transform.k > 0.8 && edge.relationship) {
          const midX = (edge.source.x + edge.target.x) / 2;
          const midY = (edge.source.y + edge.target.y) / 2;
          ctx.font = '9px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = 'rgba(163, 163, 163, 0.7)';
          ctx.textAlign = 'center';
          ctx.fillText(edge.relationship, midX, midY - 3);
        }
      });

      // Draw Nodes
      filteredData.nodes.forEach((node: any) => {
        if (!node.x) return;
        const color = CATEGORY_COLORS[node.type as GraphNodeType] || {
          bg: '#06b6d4',
          stroke: '#0891b2',
        };
        const radius = Math.min(26, Math.max(12, 10 + (node.frequency || 1) * 3));
        const isSelected = selectedNode?.id === node.id;
        const isMatch =
          nodeSearchQuery.trim() &&
          node.label.toLowerCase().includes(nodeSearchQuery.toLowerCase());
        const isHovered = highlightedNodeId === node.id;

        // Outer Glow
        if (isSelected || isMatch || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected
            ? 'rgba(6, 182, 212, 0.35)'
            : isMatch
            ? 'rgba(245, 158, 11, 0.4)'
            : 'rgba(255, 255, 255, 0.2)';
          ctx.fill();
        }

        // Main Node Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color.bg;
        ctx.fill();
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.strokeStyle = isSelected ? '#ffffff' : color.stroke;
        ctx.stroke();

        // Node Label
        ctx.font = `600 ${Math.max(10, Math.min(13, radius * 0.75))}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, node.x, node.y + radius + 4);

        // Subtitle badge
        ctx.font = '9px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(212, 212, 212, 0.7)';
        ctx.fillText(`[${node.type}]`, node.x, node.y + radius + 17);
      });

      ctx.restore();
    };

    simulation.on('tick', render);

    // Zoom & Pan Behavior
    const zoomBehavior = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        transform = event.transform;
        render();
      });

    const d3Canvas = d3.select(canvas);
    d3Canvas.call(zoomBehavior as any);

    // Find node under cursor
    const findNodeAtPosition = (x: number, y: number) => {
      const transformedX = (x - transform.x) / transform.k;
      const transformedY = (y - transform.y) / transform.k;

      for (let i = filteredData.nodes.length - 1; i >= 0; i--) {
        const n = filteredData.nodes[i] as any;
        const radius = Math.min(26, Math.max(12, 10 + (n.frequency || 1) * 3)) + 4;
        const dx = transformedX - n.x;
        const dy = transformedY - n.y;
        if (dx * dx + dy * dy <= radius * radius) {
          return n;
        }
      }
      return null;
    };

    // Canvas Mouse Interaction
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = findNodeAtPosition(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        canvas.style.cursor = 'pointer';
        setHighlightedNodeId(node.id);
      } else {
        canvas.style.cursor = 'default';
        setHighlightedNodeId(null);
      }
      render();
    };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = findNodeAtPosition(e.clientX - rect.left, e.clientY - rect.top);
      setSelectedNode(node || null);
      render();
    };

    return () => {
      simulation.stop();
    };
  }, [filteredData, chargeStrength, linkDistance, selectedNode, nodeSearchQuery]);

  const toggleCategoryFilter = (cat: GraphNodeType) => {
    setActiveCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // Find linked entries for selected node
  const linkedEntries = useMemo(() => {
    if (!selectedNode) return [];
    return entries.filter((e) =>
      (e.aiInsight?.graph_nodes || []).some(
        (n) => (n.id || n.label).toLowerCase().replace(/[^a-z0-9]/g, '-') === selectedNode.id
      )
    );
  }, [selectedNode, entries]);

  // Find connected neighbor nodes
  const connectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    const neighbors: Array<{ node: GraphNode; rel: string }> = [];

    for (const edge of aggregatedEdges) {
      const sId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
      const tId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;

      if (sId === selectedNode.id) {
        const targetNode = aggregatedNodes.find((n) => n.id === tId);
        if (targetNode) neighbors.push({ node: targetNode, rel: `→ ${edge.relationship}` });
      } else if (tId === selectedNode.id) {
        const sourceNode = aggregatedNodes.find((n) => n.id === sId);
        if (sourceNode) neighbors.push({ node: sourceNode, rel: `← ${edge.relationship}` });
      }
    }
    return neighbors;
  }, [selectedNode, aggregatedEdges, aggregatedNodes]);

  return (
    <div className="space-y-6">
      {/* Controls & Filter Bar */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-cyan-400" />
              Interactive Knowledge Network
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Force-directed visualization of extracted cognitive entities and interconnected dependencies.
            </p>
          </div>

          {/* Node Search Bar */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              value={nodeSearchQuery}
              onChange={(e) => setNodeSearchQuery(e.target.value)}
              placeholder="Filter node label..."
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Category Color Toggles */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-800/80">
          <span className="text-[11px] text-neutral-400 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-neutral-400" />
            Categories:
          </span>
          {(Object.keys(CATEGORY_COLORS) as GraphNodeType[]).map((cat) => {
            const isActive = activeCategoryFilters.has(cat);
            const color = CATEGORY_COLORS[cat];
            return (
              <button
                key={cat}
                onClick={() => toggleCategoryFilter(cat)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                  isActive
                    ? 'bg-neutral-800 text-neutral-100 border-neutral-600 shadow-sm'
                    : 'bg-neutral-950/60 text-neutral-500 border-neutral-850 opacity-40'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color.bg }}
                />
                <span>{color.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Canvas & Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas Visualizer Stage */}
        <div
          ref={containerRef}
          className="lg:col-span-2 relative bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden h-[540px] shadow-2xl flex items-center justify-center"
        >
          <canvas id="knowledge-graph-canvas" ref={canvasRef} className="w-full h-full block" />

          {/* Quick Stats Overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900/90 backdrop-blur-md border border-neutral-800 text-[11px] text-neutral-300 pointer-events-none shadow-md">
            <span>
              <strong className="text-cyan-400">{filteredData.nodes.length}</strong> Nodes
            </span>
            <span className="text-neutral-600">•</span>
            <span>
              <strong className="text-cyan-400">{filteredData.edges.length}</strong> Connections
            </span>
          </div>

          {/* Canvas Instructions */}
          <div className="absolute bottom-3 left-3 text-[10px] text-neutral-500 bg-neutral-900/80 px-2.5 py-1 rounded-md border border-neutral-800/80 pointer-events-none">
            Click node to inspect • Drag node to move • Scroll to zoom
          </div>
        </div>

        {/* Node Inspector Drawer */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl h-[540px] overflow-y-auto space-y-5">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="pb-3 border-b border-neutral-800">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded border"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[selectedNode.type]?.bg}20`,
                      color: CATEGORY_COLORS[selectedNode.type]?.bg,
                      borderColor: `${CATEGORY_COLORS[selectedNode.type]?.bg}40`,
                    }}
                  >
                    {selectedNode.type}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    {selectedNode.frequency || 1} mentions
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1.5">{selectedNode.label}</h3>
              </div>

              {/* Connected Relationships */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Connected Entities ({connectedNeighbors.length}):
                </h4>
                {connectedNeighbors.length === 0 ? (
                  <p className="text-xs text-neutral-500">No explicit direct links extracted.</p>
                ) : (
                  <div className="space-y-1.5">
                    {connectedNeighbors.map((conn, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedNode(conn.node)}
                        className="p-2 rounded-lg bg-neutral-950/80 border border-neutral-800 hover:border-cyan-800 flex items-center justify-between text-xs cursor-pointer transition"
                      >
                        <span className="font-medium text-neutral-200">{conn.node.label}</span>
                        <span className="text-[10px] text-cyan-400 font-mono">{conn.rel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Reflections */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Extracted from Reflections ({linkedEntries.length}):
                </h4>
                <div className="space-y-2">
                  {linkedEntries.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 text-xs space-y-1"
                    >
                      <div className="flex items-center gap-1.5 text-neutral-400 text-[10px]">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        <span>{e.formattedDate}</span>
                      </div>
                      <p className="text-neutral-300 line-clamp-3 leading-relaxed">
                        {e.plaintext}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-3">
                <Info className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-neutral-200">Entity Inspector</h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-relaxed">
                Click any node on the interactive knowledge canvas to inspect its semantic dependencies, cross-reflections, and frequency.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
