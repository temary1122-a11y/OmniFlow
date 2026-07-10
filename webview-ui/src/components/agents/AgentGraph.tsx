import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Handle, Position } from 'reactflow';
import type { Node, Edge, NodeProps, NodeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import { useOmniStore } from '@/store/omniStore';
import { AGENT_META, getAgentMeta, getStatusColor } from '@/utils/agentConfig';
import { cn } from '@/utils/cn';
import type { AgentRole, AgentStatus } from '@/types';

/**
 * AgentGraph
 * ---------------------------------------------------------------------------
 * Interactive dependency graph rendered with React Flow. Node positions come
 * straight from the store's `agentGraph` (x/y). Borders/accents are colored
 * by agent status. Renders a placeholder when the graph is empty.
 */

interface AgentNodeData {
  role: AgentRole;
  status: AgentStatus;
  label: string;
}

function hexA(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const AgentNode: React.FC<NodeProps<AgentNodeData>> = ({ data }) => {
  const meta = getAgentMeta(data.role);
  const statusColor = getStatusColor(data.status);
  const isWorking = data.status === 'working';
  const setSelectedAgent = useOmniStore((s) => s.setSelectedAgent);
  const setShowAgentDetail = useOmniStore((s) => s.setShowAgentDetail);

  const handleClick = () => {
    setSelectedAgent(data.role);
    setShowAgentDetail(true);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{ width: 110, cursor: 'pointer' }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      {isWorking && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            background: meta.color,
            opacity: 0.25,
            animation: 'omni-ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite',
          }}
        />
      )}
      <div
        className={cn('omni-agent-node')}
        style={{
          position: 'relative',
          borderRadius: 12,
          border: `2px solid ${statusColor}`,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          background: hexA(meta.color, 0.1),
          boxShadow: isWorking ? `0 0 16px ${hexA(meta.color, 0.25)}` : 'none',
          transition: 'all 300ms ease',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1, color: meta.color }}>{meta.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', color: meta.color }}>
          {data.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 9999,
              background: statusColor,
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 9, textTransform: 'capitalize', color: statusColor }}>{data.status}</span>
        </div>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = { agentNode: AgentNode };

export function AgentGraph() {
  const agentGraph = useOmniStore((s) => s.agentGraph);
  const agentStatuses = useOmniStore((s) => s.agentStatuses);

  const isEmpty = !agentGraph.nodes || agentGraph.nodes.length === 0;

  const flowNodes: Node<AgentNodeData>[] = useMemo(
    () =>
      agentGraph.nodes.map((n) => ({
        id: n.id,
        type: 'agentNode',
        position: { x: n.x, y: n.y },
        data: {
          role: n.role,
          status: agentStatuses[n.role] ?? n.status,
          label: n.label,
        },
      })),
    [agentGraph.nodes, agentStatuses],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      agentGraph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: e.animated ?? (agentStatuses[e.source as AgentRole] === 'working' || agentStatuses[e.target as AgentRole] === 'working'),
        style: {
          stroke: hexA(AGENT_META[e.source as AgentRole]?.color ?? '#6b7280', 0.5),
          strokeWidth: 1.5,
        },
      })),
    [agentGraph.edges, agentStatuses],
  );

  if (isEmpty) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 220,
          gap: 10,
          color: 'var(--vscode-descriptionForeground, #8b949e)',
          fontSize: 12,
          textAlign: 'center',
          padding: 20,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            background: 'rgba(124,106,247,0.12)',
            border: '1px solid rgba(124,106,247,0.35)',
            color: '#7c6af7',
            boxShadow: '0 0 24px rgba(124,106,247,0.2)',
          }}
        >
          ⬡
        </div>
        <div style={{ fontWeight: 600, color: 'var(--vscode-foreground, #e6e6e6)' }}>Agent mesh idle</div>
        <div>Start a task — nodes spawn as agents activate and consult each other in real time.</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', minHeight: 240 }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background color="#30363d" gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={{ background: 'var(--vscode-widget-background, #161b22)', border: '1px solid var(--vscode-panel-border, #30363d)', borderRadius: 8 }}
        />
        <MiniMap
          nodeColor={(n) => hexA(AGENT_META[(n.data as AgentNodeData)?.role as AgentRole]?.color ?? '#6b7280', 0.8)}
          style={{
            background: 'var(--vscode-editor-background, #0d1117)',
            border: '1px solid var(--vscode-panel-border, #30363d)',
            borderRadius: 8,
            width: 100,
            height: 70,
          }}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>
    </div>
  );
}
