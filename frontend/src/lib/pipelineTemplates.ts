// Pipeline templates: persist a developer-canvas graph (node types, positions,
// configs, and edge connections) to localStorage so a completed pipeline can be
// reused on any other dataset/session.
//
// Deliberately NOT persisted: runtime results (previews, metrics, errors),
// execution state, and column lists — those are session- and dataset-specific.

import type { Node, Edge } from '@xyflow/react';

export interface TemplateNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    config?: Record<string, any>;
  };
}

export interface TemplateEdge {
  id: string;
  source: string;
  target: string;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  createdAt: number;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

const STORAGE_KEY = 'datanova_pipeline_templates_v1';

const makeId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export function listTemplates(): PipelineTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTemplate(name: string, nodes: Node[], edges: Edge[]): PipelineTemplate | null {
  if (typeof window === 'undefined') return null;
  // Strip everything runtime-specific, keep only what defines the pipeline.
  const tplNodes: TemplateNode[] = nodes
    .filter((n) => n.type !== 'FileNode')
    .map((n) => ({
      id: n.id,
      type: n.type as string,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: { config: (n.data as any)?.config || {} },
    }));
  const tplEdges: TemplateEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
  }));
  // Edges touching file_node_1 are kept on purpose: 'file_node_1 -> N' is the
  // pipeline's entry connection and is re-wired to the fresh data source on apply.

  if (tplNodes.length === 0) return null;

  const template: PipelineTemplate = {
    id: makeId(),
    name: name.trim() || `Pipeline ${new Date().toLocaleString()}`,
    createdAt: Date.now(),
    nodes: tplNodes,
    edges: tplEdges,
  };

  try {
    const next = [...listTemplates(), template];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return template;
  } catch {
    return null;
  }
}

export function deleteTemplate(id: string): PipelineTemplate[] {
  if (typeof window === 'undefined') return [];
  const next = listTemplates().filter((t) => t.id !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked — return current list unchanged
  }
  return next;
}

export function renameTemplate(id: string, name: string): PipelineTemplate[] {
  if (typeof window === 'undefined') return [];
  const next = listTemplates().map((t) => (t.id === id ? { ...t, name } : t));
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export { makeId };
