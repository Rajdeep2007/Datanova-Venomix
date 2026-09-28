import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  Connection,
  Edge,
  Node,
  Panel,
  MiniMap
} from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, Map as MapIcon, Trash2 } from 'lucide-react';
import { nodeTypes, ML_MODEL_NODES } from './CanvasNodes';
import { executeCanvasNode, fetchScatterData, fetchBoxPlotData, fetchHeatMapData, fetchDatasetStats } from '@/lib/api';
import OnboardingOverlay from './OnboardingOverlay';
import { listTemplates, saveTemplate, deleteTemplate, type PipelineTemplate } from '@/lib/pipelineTemplates';
import { generatePipelineExport, downloadFile } from '@/lib/canvasCodegen';
import { buildNodeExportUrl } from '@/lib/api';
import { FilePlus2, Save, X, Play, Trash2 as TrashTemplate, Download, FileCode, FileSpreadsheet, Braces } from 'lucide-react';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const getId = () => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export default function DeveloperCanvasWrapper({ sessionId }: { sessionId: string }) {
  return (
    <ReactFlowProvider>
      <DeveloperCanvas sessionId={sessionId} />
    </ReactFlowProvider>
  );
}

/** Styled square button for the custom canvas control bar. */
function ControlButton({
  title,
  onClick,
  children,
  active = false,
  danger = false,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
        danger
          ? 'text-[var(--danger)] hover:bg-[var(--danger)]/10'
          : active
            ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
            : 'text-text-muted hover:bg-surface hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function DeveloperCanvas({ sessionId }: { sessionId: string }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [templates, setTemplates] = useState<PipelineTemplate[]>(() => listTemplates());
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const executionTimeout = useRef<NodeJS.Timeout | null>(null);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  useEffect(() => {
    if (nodes.length === 0 && sessionId) {
      const newNode: Node = {
        id: 'file_node_1',
        type: 'FileNode',
        position: { x: 250, y: 150 },
        data: { sessionId },
      };
      setNodes([newNode]);
      triggerExecution([newNode], edges);
    }
  }, [sessionId, nodes.length, setNodes]);

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      // Read the CURRENT edges via a functional update — a closure over
      // `edges` goes stale when multiple connections happen in quick
      // succession, dropping edges and skipping executions.
      setEdges((currentEdges) => {
        const newEdges = addEdge(params, currentEdges);
        setTimeout(() => {
          setNodes((currentNodes) => {
            triggerExecution(currentNodes, newEdges);
            return currentNodes;
          });
        }, 0);
        return newEdges;
      });
    },
    [setEdges, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleNodeConfigChange = useCallback((nodeId: string, newConfig: any) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              config: { ...(n.data.config || {}), ...newConfig },
            },
          };
        }
        return n;
      })
    );
    setTimeout(() => {
      // IMPORTANT: read edges via a functional update. Node components hold
      // this callback in their `data` from drop time, so a closure over
      // `edges` would be stale (pre-connection) and config changes would
      // never re-execute the graph.
      setEdges((currentEdges) => {
        setNodes((currentNodes) => {
          triggerExecution(currentNodes, currentEdges);
          return currentNodes;
        });
        return currentEdges;
      });
    }, 100);
  }, [setNodes, setEdges]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let initialStyle = undefined;
      if (['ScatterPlotNode', 'BoxPlotNode', 'HeatMapNode', 'ModelCompareNode'].includes(type)) {
        initialStyle = { width: 560, height: 420 };
      } else if (type === 'DataTableNode') {
        initialStyle = { width: 400, height: 300 };
      } else if (type === 'StatsNode') {
        initialStyle = { width: 350, height: 280 };
      } else if (type === 'MLTrainNode') {
        initialStyle = { width: 380, height: 350 };
      } else if (ML_MODEL_NODES.some((m) => m.type === type)) {
        initialStyle = { width: 320, height: 300 };
      }

      const newNode: Node = {
        id: `node_${getId()}`,
        type,
        position,
        style: initialStyle,
        data: {
          onChange: handleNodeConfigChange,
          config: {}
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, handleNodeConfigChange]
  );

  const clearCanvas = useCallback(() => {
    setEdges([]);
    setNodes((nds) => nds.filter((n) => n.type === 'FileNode'));
    fitView({ duration: 400, padding: 0.2 });
  }, [setEdges, setNodes, fitView]);

  // ── Pipeline templates ───────────────────────────────────────────
  const flashTemplateFeedback = (msg: string) => {
    setTemplateFeedback(msg);
    setTimeout(() => setTemplateFeedback(null), 2500);
  };

  const handleSaveTemplate = useCallback(() => {
    const tpl = saveTemplate(templateName, nodes, edges);
    if (tpl) {
      setTemplates(listTemplates());
      setSaveDialogOpen(false);
      setTemplateName('');
      flashTemplateFeedback(`Template "${tpl.name}" saved`);
    } else {
      flashTemplateFeedback('Nothing to save — add pipeline nodes first');
    }
  }, [templateName, nodes, edges]);

  const handleApplyTemplate = useCallback(
    (tpl: PipelineTemplate) => {
      // Rebuild the graph: fresh FileNode for the CURRENT session + template
      // nodes with their saved configs, then execute the whole pipeline.
      const fileNode: Node = {
        id: 'file_node_1',
        type: 'FileNode',
        position: { x: 250, y: 150 },
        data: { sessionId },
      };
      const newNodes: Node[] = [
        fileNode,
        ...tpl.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          style: ['ScatterPlotNode', 'BoxPlotNode', 'HeatMapNode', 'ModelCompareNode'].includes(n.type)
            ? { width: 560, height: 420 }
            : n.type === 'DataTableNode'
              ? { width: 400, height: 300 }
              : n.type === 'StatsNode'
                ? { width: 350, height: 280 }
                : n.type === 'MLTrainNode'
                  ? { width: 380, height: 350 }
                  : ML_MODEL_NODES.some((m) => m.type === n.type)
                    ? { width: 320, height: 300 }
                    : undefined,
          data: { onChange: handleNodeConfigChange, config: n.data.config || {} },
        })),
      ];
      // Edges referencing file_node_1 re-wire automatically since the fresh
      // FileNode reuses the same well-known id.
      const newEdges: Edge[] = tpl.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
      setNodes(newNodes);
      setEdges(newEdges);
      setShowTemplates(false);
      flashTemplateFeedback(`Applied "${tpl.name}" — running pipeline…`);
      setTimeout(() => triggerExecution(newNodes, newEdges), 50);
    },
    [sessionId, setNodes, setEdges, handleNodeConfigChange]
  );

  const handleDeleteTemplate = useCallback((id: string) => {
    setTemplates(deleteTemplate(id));
  }, []);

  // ── Export: download dataset + code generation ──────────────────
  // The "final" dataset is the output of the deepest executed node — i.e.
  // the node with no outgoing edges. Falls back to the FileNode (raw data).
  const getFinalNodeId = useCallback((): string | null => {
    const executable = nodes.filter((n) => n.type !== 'FileNode');
    const hasOutgoing = new Set(edges.map((e) => e.source));
    const terminal = executable.find((n) => !hasOutgoing.has(n.id) && n.data?.preview);
    return terminal?.id ?? 'file_node_1';
  }, [nodes, edges]);

  const handleDownloadCsv = useCallback(() => {
    const nodeId = getFinalNodeId();
    if (!nodeId) return;
    // Browser download straight from the backend CSV endpoint
    const a = document.createElement('a');
    a.href = buildNodeExportUrl(sessionId, nodeId);
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowExportMenu(false);
    flashTemplateFeedback('Dataset download started');
  }, [sessionId, getFinalNodeId]);

  const handleExportCode = useCallback(
    (format: 'python' | 'notebook') => {
      const { python, notebook } = generatePipelineExport(sessionId, nodes, edges);
      if (format === 'python') {
        downloadFile('pipeline.py', python, 'text/x-python');
        flashTemplateFeedback('Python script downloaded');
      } else {
        downloadFile('pipeline.ipynb', JSON.stringify(notebook, null, 2), 'application/x-ipynb+json');
        flashTemplateFeedback('Jupyter notebook downloaded');
      }
      setShowExportMenu(false);
    },
    [sessionId, nodes, edges]
  );

  const triggerExecution = (currentNodes: Node[], currentEdges: Edge[]) => {
    if (executionTimeout.current) {
      clearTimeout(executionTimeout.current);
    }
    executionTimeout.current = setTimeout(() => {
      executeGraph(currentNodes, currentEdges);
    }, 800);
  };

  const setNodeExecuting = (nodeId: string, isExecuting: boolean) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, isExecuting } } : n
    ));
  };

  const executeGraph = async (currentNodes: Node[], currentEdges: Edge[]) => {
    if (!sessionId) return;

    let updatedNodes = [...currentNodes];
    const fileNode = updatedNodes.find(n => n.type === 'FileNode');
    if (!fileNode) return;

    const nodeOutputs: Record<string, string> = {};

    try {
      const fileRes = await executeCanvasNode({
        session_id: sessionId,
        node_type: 'FileNode',
        config: {},
        node_id: fileNode.id,
      });

      nodeOutputs[fileNode.id] = fileRes.node_output_id;

      updatedNodes = updatedNodes.map(n =>
        n.id === fileNode.id ? { ...n, data: { ...n.data, preview: fileRes.preview, error: null } } : n
      );
      setNodes(updatedNodes);

      const queue = [fileNode.id];
      const executed = new Set([fileNode.id]);

      const nodeColumns: Record<string, { name: string; type: string }[]> = {};
      if (fileRes.preview?.columns) {
        nodeColumns[fileNode.id] = fileRes.preview.columns;
      }

      while (queue.length > 0) {
        const currId = queue.shift()!;
        const availableColumns = nodeColumns[currId] || [];

        const childrenEdges = currentEdges.filter(e => e.source === currId);

        for (const edge of childrenEdges) {
          const childId = edge.target;
          if (executed.has(childId)) continue;

          const childNode = updatedNodes.find(n => n.id === childId);
          if (!childNode) continue;

          setNodeExecuting(childId, true);

          try {
            const config = childNode.data.config as any || {};

            // Visualization nodes get special handling
            if (childNode.type === 'ScatterPlotNode') {
              if (config.x_col && config.y_col) {
                const res = await fetchScatterData(sessionId, config.x_col, config.y_col, config.color_col, nodeOutputs[currId]);
                updatedNodes = updatedNodes.map(n =>
                  n.id === childId ? { ...n, data: { ...n.data, preview: { vizData: res }, availableColumns, error: null, isExecuting: false } } : n
                );
              } else {
                updatedNodes = updatedNodes.map(n => n.id === childId ? { ...n, data: { ...n.data, availableColumns, error: null, isExecuting: false } } : n);
              }
              nodeOutputs[childId] = nodeOutputs[currId];
              nodeColumns[childId] = availableColumns;

            } else if (childNode.type === 'BoxPlotNode') {
              if (config.value_col) {
                const res = await fetchBoxPlotData(sessionId, config.value_col, config.group_col, nodeOutputs[currId]);
                updatedNodes = updatedNodes.map(n =>
                  n.id === childId ? { ...n, data: { ...n.data, preview: { vizData: res }, availableColumns, error: null, isExecuting: false } } : n
                );
              } else {
                updatedNodes = updatedNodes.map(n => n.id === childId ? { ...n, data: { ...n.data, availableColumns, error: null, isExecuting: false } } : n);
              }
              nodeOutputs[childId] = nodeOutputs[currId];
              nodeColumns[childId] = availableColumns;

            } else if (childNode.type === 'HeatMapNode') {
              let cols;
              if (config.columns) {
                cols = config.columns.split(',').map((s: string) => s.trim()).filter(Boolean);
              }
              const res = await fetchHeatMapData(sessionId, cols, nodeOutputs[currId]);
              updatedNodes = updatedNodes.map(n =>
                n.id === childId ? { ...n, data: { ...n.data, preview: { vizData: res }, availableColumns, error: null, isExecuting: false } } : n
              );
              nodeOutputs[childId] = nodeOutputs[currId];
              nodeColumns[childId] = availableColumns;

            } else if (childNode.type === 'StatsNode') {
              const res = await fetchDatasetStats(sessionId, nodeOutputs[currId]);
              updatedNodes = updatedNodes.map(n =>
                n.id === childId ? { ...n, data: { ...n.data, preview: { stats: res }, availableColumns, error: null, isExecuting: false } } : n
              );
              nodeOutputs[childId] = nodeOutputs[currId];
              nodeColumns[childId] = availableColumns;

            } else if (childNode.type === 'ModelCompareNode') {
              // ModelCompare aggregates results from ALL connected model/train
              // nodes; execution continues after it, so register its output.
              nodeOutputs[childId] = nodeOutputs[currId];
              nodeColumns[childId] = availableColumns;
              updatedNodes = updatedNodes.map(n =>
                n.id === childId ? { ...n, data: { ...n.data, availableColumns, error: null, isExecuting: false } } : n
              );

            } else if (ML_MODEL_NODES.some((m) => m.type === childNode.type)) {
              // Individual model nodes reuse the MLTrainNode backend handler
              // with a single-model selection.
              const modelMeta = ML_MODEL_NODES.find((m) => m.type === childNode.type)!;
              const res = await executeCanvasNode({
                session_id: sessionId,
                node_type: 'MLTrainNode',
                config: { ...config, models: [modelMeta.model] },
                upstream_node_output_id: nodeOutputs[currId],
                node_id: childId,
              });
              nodeOutputs[childId] = res.node_output_id;
              if (res.preview?.columns) {
                nodeColumns[childId] = res.preview.columns;
              }
              updatedNodes = updatedNodes.map(n =>
                n.id === childId ? { ...n, data: { ...n.data, preview: res.preview, availableColumns, error: null, isExecuting: false } } : n
              );

            } else if (childNode.type === 'RenameColumnNode') {
              // RenameColumn needs special handling - column names change
              const res = await executeCanvasNode({
                session_id: sessionId,
                node_type: childNode.type!,
                config: config,
                upstream_node_output_id: nodeOutputs[currId],
                node_id: childId,
              });
              nodeOutputs[childId] = res.node_output_id;
              if (res.preview?.columns) {
                nodeColumns[childId] = res.preview.columns;
              }
              updatedNodes = updatedNodes.map(n =>
                n.id === childId ? { ...n, data: { ...n.data, preview: res.preview, availableColumns: res.preview?.columns || availableColumns, error: null, isExecuting: false } } : n
              );

            } else if (childNode.type === 'EncodeNode') {
              // Encode can create/remove columns
              const res = await executeCanvasNode({
                session_id: sessionId,
                node_type: childNode.type!,
                config: config,
                upstream_node_output_id: nodeOutputs[currId],
                node_id: childId,
              });
              nodeOutputs[childId] = res.node_output_id;
              if (res.preview?.columns) {
                nodeColumns[childId] = res.preview.columns;
              }
              updatedNodes = updatedNodes.map(n =>
                n.id === childId ? { ...n, data: { ...n.data, preview: res.preview, availableColumns: res.preview?.columns || availableColumns, error: null, isExecuting: false } } : n
              );

            } else {
              // Generic execution for all other nodes
              const res = await executeCanvasNode({
                session_id: sessionId,
                node_type: childNode.type!,
                config: config,
                upstream_node_output_id: nodeOutputs[currId],
                node_id: childId,
              });

              nodeOutputs[childId] = res.node_output_id;
              if (res.preview?.columns) {
                nodeColumns[childId] = res.preview.columns;
              }

              updatedNodes = updatedNodes.map(n =>
                n.id === childId ? { ...n, data: { ...n.data, preview: res.preview, availableColumns, error: null, isExecuting: false } } : n
              );
            }
            setNodes(updatedNodes);

            executed.add(childId);
            queue.push(childId);

          } catch (err: any) {
            const errMsg = err.response?.data?.detail || err.message || 'Execution failed';
            // Keep upstream columns available even on failure so the user can
            // fix the config (e.g. pick a target) without re-dropping the node.
            updatedNodes = updatedNodes.map(n =>
              n.id === childId ? { ...n, data: { ...n.data, error: errMsg, isExecuting: false, availableColumns } } : n
            );
            setNodes(updatedNodes);
          }
        }
      }

      // ── Aggregate model-comparison results ─────────────────────────
      // Each ModelCompareNode collects the trained-model results of EVERY
      // model node connected to it, so multiple models sharing one dataset
      // appear together in a single comparison view (table + one chart).
      const compareNodes = updatedNodes.filter(n => n.type === 'ModelCompareNode');
      if (compareNodes.length > 0) {
        for (const cmp of compareNodes) {
          const upstreamEdges = currentEdges.filter(e => e.target === cmp.id);
          const compareResults: { model: string; source_node_id: string; ml_results: any }[] = [];
          for (const edge of upstreamEdges) {
            const src = updatedNodes.find(n => n.id === edge.source);
            if (!src) continue;
            const isModelSource = src.type === 'MLTrainNode' || ML_MODEL_NODES.some(m => m.type === src.type);
            if (!isModelSource) continue;
            const srcData = src.data as any;
            const ml = srcData?.preview?.ml_results;
            if (!ml || ml.error || !ml.models) continue;
            const wanted: string[] =
              src.type === 'MLTrainNode' && srcData?.config?.models?.length
                ? srcData.config.models
                : Object.keys(ml.models);
            for (const model of wanted) {
              if (ml.models[model]) {
                compareResults.push({ model, source_node_id: src.id, ml_results: ml });
              }
            }
          }
          updatedNodes = updatedNodes.map(n =>
            n.id === cmp.id ? { ...n, data: { ...n.data, compareResults } } : n
          );
        }
        setNodes(updatedNodes);
      }
    } catch (e) {
      console.error("Canvas execution error:", e);
    }
  };

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const SidebarItem = ({ icon, label, nodeType, category, tooltip }: { icon: string; label: string; nodeType: string; category: string; tooltip: string }) => (
    <div
      className="glass-card p-2 text-sm cursor-grab border border-border-subtle hover:border-[var(--warning)] transition-colors relative group"
      onDragStart={(e) => onDragStart(e, nodeType)}
      draggable
    >
      {icon} {label}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-surface border border-border-subtle text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none w-max z-50 transition-opacity">
        {tooltip}
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      {/* Sidebar Palette */}
      <div className="w-64 shrink-0 bg-surface-elevated border-r border-border-subtle p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        {/* Data */}
        <div>
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 border-b border-border-subtle pb-1">Data</h3>
          <div className="flex flex-col gap-1.5">
            <SidebarItem icon="📄" label="File / Session" nodeType="FileNode" category="data" tooltip="Entry point for your uploaded dataset" />
            <SidebarItem icon="📊" label="Data Preview" nodeType="DataTableNode" category="data" tooltip="View rows and columns as a table" />
            <SidebarItem icon="📋" label="Dataset Stats" nodeType="StatsNode" category="data" tooltip="Comprehensive column statistics" />
          </div>
        </div>

        {/* Transforms */}
        <div>
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 border-b border-border-subtle pb-1">Transform</h3>
          <div className="flex flex-col gap-1.5">
            <SidebarItem icon="💉" label="Impute" nodeType="ImputeNode" category="transform" tooltip="Fill missing values (median/mode)" />
            <SidebarItem icon="🗑️" label="Drop Column" nodeType="DropColumnNode" category="transform" tooltip="Remove a column entirely" />
            <SidebarItem icon="✂️" label="Clip Outliers" nodeType="ClipOutliersNode" category="transform" tooltip="Cap extreme values at robust bounds" />
            <SidebarItem icon="🔗" label="Merge Categories" nodeType="MergeCategoriesNode" category="transform" tooltip="Group tiny tail categories into Other" />
            <SidebarItem icon="📈" label="Log Transform" nodeType="LogTransformNode" category="transform" tooltip="Apply log(1+x) to reduce skew" />
          </div>
        </div>

        {/* Advanced Transforms */}
        <div>
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 border-b border-border-subtle pb-1">Advanced</h3>
          <div className="flex flex-col gap-1.5">
            <SidebarItem icon="🔍" label="Filter Rows" nodeType="FilterRowsNode" category="transform" tooltip="Keep rows matching a condition" />
            <SidebarItem icon="↕️" label="Sort Rows" nodeType="SortNode" category="transform" tooltip="Sort by column ascending/descending" />
            <SidebarItem icon="✏️" label="Rename Column" nodeType="RenameColumnNode" category="transform" tooltip="Rename a column" />
            <SidebarItem icon="🔄" label="Type Cast" nodeType="TypeCastNode" category="transform" tooltip="Change column data type" />
            <SidebarItem icon="🔢" label="Encode Categories" nodeType="EncodeNode" category="transform" tooltip="Label or one-hot encode categoricals" />
            <SidebarItem icon="📐" label="Scale / Normalize" nodeType="ScaleNode" category="transform" tooltip="Standard, Min-Max, or Robust scaling" />
            <SidebarItem icon="🎲" label="Sample Rows" nodeType="SampleNode" category="transform" tooltip="Take a random/head/tail sample" />
          </div>
        </div>

        {/* Visualize */}
        <div>
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 border-b border-border-subtle pb-1">Visualize</h3>
          <div className="flex flex-col gap-1.5">
            <SidebarItem icon="📈" label="Scatter Plot" nodeType="ScatterPlotNode" category="visualize" tooltip="Plot relationships between two numeric cols" />
            <SidebarItem icon="📊" label="Box Plot" nodeType="BoxPlotNode" category="visualize" tooltip="View distributions and outliers" />
            <SidebarItem icon="🔥" label="Heat Map" nodeType="HeatMapNode" category="visualize" tooltip="View correlation matrix" />
          </div>
        </div>

        {/* ML */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-2 border-b border-border-subtle pb-1" style={{ color: '#7C3AED' }}>Machine Learning</h3>
          <div className="flex flex-col gap-1.5">
            {ML_MODEL_NODES.map((m) => (
              <div
                key={m.type}
                className="glass-card p-2 text-sm cursor-grab border transition-colors relative group"
                style={{ borderColor: 'rgba(124,58,237,0.3)' }}
                onDragStart={(e) => onDragStart(e, m.type)}
                draggable
              >
                {m.icon} {m.label}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-surface border border-border-subtle text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none w-max z-50 transition-opacity">
                  Train {m.label} on the connected dataset and view its metrics
                </div>
              </div>
            ))}
            <div
              className="glass-card p-2 text-sm cursor-grab border transition-colors relative group"
              style={{ borderColor: 'rgba(124,58,237,0.5)', borderWidth: 2 }}
              onDragStart={(e) => onDragStart(e, 'MLTrainNode')}
              draggable
            >
              🤖 ML Model Trainer
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-surface border border-border-subtle text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none w-max z-50 transition-opacity">
                Train multiple ML models at once (all-in-one)
              </div>
            </div>
            <div
              className="glass-card p-2 text-sm cursor-grab border border-border-subtle transition-colors relative group"
              style={{ borderColor: 'rgba(124,58,237,0.5)', borderWidth: 2 }}
              onDragStart={(e) => onDragStart(e, 'ModelCompareNode')}
              draggable
            >
              📊 Model Comparison
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-surface border border-border-subtle text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none w-max z-50 transition-opacity">
                Compare ALL connected models in one view: table + combined chart + ROC overlay
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        {showOnboarding && (
          <OnboardingOverlay onDismiss={() => setShowOnboarding(false)} />
        )}

        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* ── Export menu ─────────────────────────────────────── */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="h-8 px-3 rounded-full bg-surface-elevated border border-border-subtle shadow-sm flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-colors"
              title="Export dataset or pipeline code"
            >
              <Download size={13} /> Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-surface-elevated border border-border-subtle rounded-lg shadow-lg py-1 flex flex-col">
                <button
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface transition-colors text-left"
                >
                  <FileSpreadsheet size={14} className="text-[var(--success)] shrink-0" />
                  <span>
                    Download dataset (CSV)
                    <span className="block text-[9px] text-text-muted">Final node output</span>
                  </span>
                </button>
                <div className="h-px bg-border-subtle my-1" />
                <button
                  onClick={() => handleExportCode('python')}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface transition-colors text-left"
                >
                  <FileCode size={14} className="text-[var(--accent-primary)] shrink-0" />
                  <span>
                    Python script (.py)
                    <span className="block text-[9px] text-text-muted">Reproducible pandas code</span>
                  </span>
                </button>
                <button
                  onClick={() => handleExportCode('notebook')}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface transition-colors text-left"
                >
                  <Braces size={14} className="text-[var(--warning)] shrink-0" />
                  <span>
                    Jupyter notebook (.ipynb)
                    <span className="block text-[9px] text-text-muted">One cell per pipeline step</span>
                  </span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowOnboarding(true)}
            className="w-8 h-8 rounded-full bg-surface-elevated border border-border-subtle shadow-sm flex items-center justify-center text-text-muted hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-colors"
            title="Help & Walkthrough"
          >
            ?
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges.map(e => ({
            ...e,
            type: 'smoothstep',
            animated: nodes.find(n => n.id === e.target)?.data?.isExecuting ? true : false,
            style: { strokeWidth: 2, stroke: 'var(--accent-primary)' }
          }))}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          className="bg-bg-primary"
        >
          <Background color="var(--border-subtle)" gap={16} />
          {showMiniMap && (
            <MiniMap
              className="bg-surface-elevated border border-border-subtle rounded-lg shadow-sm"
              maskColor="var(--bg-primary)"
              nodeColor="var(--accent-secondary)"
              pannable
              zoomable
            />
          )}

          {/* ── Custom canvas controls (zoom / fit / minimap / clear) ── */}
          <Panel position="bottom-right">
            <div className="flex flex-col gap-1 bg-surface-elevated border border-border-subtle rounded-lg shadow-md p-1">
              <ControlButton title="Zoom in" onClick={() => zoomIn({ duration: 200 })}>
                <ZoomIn size={15} />
              </ControlButton>
              <ControlButton title="Zoom out" onClick={() => zoomOut({ duration: 200 })}>
                <ZoomOut size={15} />
              </ControlButton>
              <ControlButton title="Fit to frame" onClick={() => fitView({ duration: 400, padding: 0.2 })}>
                <Maximize size={15} />
              </ControlButton>
              <ControlButton
                title={showMiniMap ? 'Hide minimap' : 'Show minimap'}
                onClick={() => setShowMiniMap((v) => !v)}
                active={showMiniMap}
              >
                <MapIcon size={15} />
              </ControlButton>
              <div className="h-px bg-border-subtle mx-1 my-0.5" />
              <ControlButton title="Clear canvas (keep data source)" onClick={clearCanvas} danger>
                <Trash2 size={15} />
              </ControlButton>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* ── Templates sidebar (right) ──────────────────────────── */}
      <div
        className={`shrink-0 bg-surface-elevated border-l border-border-subtle flex flex-col transition-all duration-200 overflow-hidden ${
          showTemplates ? 'w-64 p-3' : 'w-11 p-1.5'
        }`}
      >
        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          title={showTemplates ? 'Hide templates' : 'Show pipeline templates'}
          className="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-[var(--accent-primary)] hover:bg-surface transition-colors shrink-0"
        >
          <FilePlus2 size={16} />
        </button>

        {showTemplates && (
          <div className="flex flex-col gap-2 mt-2 flex-1 min-h-0">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle pb-1 shrink-0">
              Pipeline Templates
            </h3>
            <button
              type="button"
              onClick={() => setSaveDialogOpen(true)}
              className="shrink-0 flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-2 rounded-lg bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/25 transition-colors"
            >
              <Save size={13} /> Save current pipeline
            </button>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-1.5">
              {templates.length === 0 ? (
                <div className="text-[10px] text-text-muted italic p-2 border border-dashed border-border-subtle rounded">
                  No templates yet. Build a pipeline, then save it as a template to reuse on any dataset.
                </div>
              ) : (
                templates.map((tpl) => (
                  <div key={tpl.id} className="glass-card p-2 border border-border-subtle">
                    <div className="text-[11px] font-semibold text-text-primary break-words leading-tight">{tpl.name}</div>
                    <div className="text-[9px] text-text-muted mt-0.5">
                      {tpl.nodes.length} nodes · {new Date(tpl.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        title="Load this pipeline onto the canvas and run it"
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold px-1.5 py-1 rounded bg-[var(--success)]/10 border border-[var(--success)]/40 text-[var(--success)] hover:bg-[var(--success)]/20 transition-colors"
                      >
                        <Play size={10} /> Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        title="Delete template"
                        className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-white hover:bg-[var(--danger)] transition-colors"
                      >
                        <TrashTemplate size={11} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Save-template dialog ─────────────────────────────────── */}
      {saveDialogOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSaveDialogOpen(false)}
        >
          <div
            className="glass-card w-full max-w-md p-5 border border-border-subtle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-text-primary">Save Pipeline Template</h3>
              <button
                type="button"
                onClick={() => setSaveDialogOpen(false)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] text-text-muted mb-3">
              Saves the pipeline layout, connections and node settings on this device
              ({nodes.filter((n) => n.type !== 'FileNode').length} nodes). Runtime data and results are not saved.
            </p>
            <input
              autoFocus
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
              placeholder="Template name (e.g. Clean + Train RF)"
              className="w-full text-xs px-3 py-2 rounded-lg bg-surface border border-border-subtle outline-none focus:border-[var(--accent-primary)] mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveDialogOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Template feedback toast ──────────────────────────────── */}
      {templateFeedback && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-card px-4 py-2 border border-[var(--accent-primary)]/50 text-xs font-semibold text-text-primary shadow-lg">
          {templateFeedback}
        </div>
      )}
    </div>
  );
}
