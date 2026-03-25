import React, { useMemo, useRef, useState } from 'react';

const NODE_TYPE_OPTIONS = ['Patient', 'Condition', 'Medication', 'Doctor', 'Appointment', 'LabResult'];

const INITIAL_NODES = [
  { id: 'patient_1', type: 'Patient', label: 'Nguyen Van A', x: 80, y: 90 },
  { id: 'condition_1', type: 'Condition', label: 'Hypertension', x: 360, y: 80 },
  { id: 'medication_1', type: 'Medication', label: 'Amlodipine', x: 360, y: 230 },
];

const INITIAL_EDGES = [
  { id: 'edge_1', from: 'patient_1', to: 'condition_1', relation: 'HAS_CONDITION' },
  { id: 'edge_2', from: 'patient_1', to: 'medication_1', relation: 'TAKES' },
];

const NODE_TYPE_CLASS = {
  Patient: 'neo4j-node--patient',
  Condition: 'neo4j-node--condition',
  Medication: 'neo4j-node--medication',
  Doctor: 'neo4j-node--doctor',
  Appointment: 'neo4j-node--appointment',
  LabResult: 'neo4j-node--lab',
};

const sanitizeToken = (value) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_]/g, '_')
  .replace(/^[^a-zA-Z_]+/, '')
  .toUpperCase();

const sanitizeLabel = (value) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_]/g, '')
  .replace(/^[^a-zA-Z_]+/, '') || 'Entity';

const escapeCypherString = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const buildCypher = (nodes, edges) => {
  const lines = ['// Generated from Neo4j Health Graph Studio'];

  nodes.forEach((node, index) => {
    const varName = `n${index + 1}`;
    const label = sanitizeLabel(node.type);
    lines.push(
      `MERGE (${varName}:${label} {id: '${escapeCypherString(node.id)}'})`,
      `SET ${varName}.name = '${escapeCypherString(node.label)}';`
    );
  });

  edges.forEach((edge) => {
    const fromIndex = nodes.findIndex((node) => node.id === edge.from);
    const toIndex = nodes.findIndex((node) => node.id === edge.to);
    if (fromIndex === -1 || toIndex === -1) return;

    const fromVar = `n${fromIndex + 1}`;
    const toVar = `n${toIndex + 1}`;
    const relation = sanitizeToken(edge.relation || 'RELATED_TO') || 'RELATED_TO';

    lines.push(`MERGE (${fromVar})-[:${relation}]->(${toVar});`);
  });

  return lines.join('\n');
};

export default function Neo4jHealthGraphStudio() {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [edges, setEdges] = useState(INITIAL_EDGES);
  const [nodeType, setNodeType] = useState('Patient');
  const [nodeLabel, setNodeLabel] = useState('');
  const [edgeFrom, setEdgeFrom] = useState(INITIAL_NODES[0]?.id || '');
  const [edgeTo, setEdgeTo] = useState(INITIAL_NODES[1]?.id || '');
  const [edgeRelation, setEdgeRelation] = useState('RELATED_TO');
  const [cypherText, setCypherText] = useState(() => buildCypher(INITIAL_NODES, INITIAL_EDGES));
  const [dragging, setDragging] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(INITIAL_NODES[0]?.id || '');

  const canvasRef = useRef(null);
  const nodeCounterRef = useRef(INITIAL_NODES.length + 1);

  const nodeLookup = useMemo(() => {
    const map = {};
    nodes.forEach((node) => {
      map[node.id] = node;
    });
    return map;
  }, [nodes]);

  const rebuildCypher = (nextNodes, nextEdges) => {
    setCypherText(buildCypher(nextNodes, nextEdges));
  };

  const addNode = () => {
    const label = nodeLabel.trim() || `${nodeType} ${nodeCounterRef.current}`;
    const id = `${nodeType.toLowerCase()}_${nodeCounterRef.current}`;
    nodeCounterRef.current += 1;

    const nextNodes = [
      ...nodes,
      {
        id,
        type: nodeType,
        label,
        x: 70 + (nodes.length % 4) * 140,
        y: 70 + (nodes.length % 3) * 110,
      },
    ];

    setNodes(nextNodes);
    if (!edgeFrom) setEdgeFrom(id);
    if (!edgeTo) setEdgeTo(id);
    setNodeLabel('');
    rebuildCypher(nextNodes, edges);
  };

  const addEdge = () => {
    if (!edgeFrom || !edgeTo || edgeFrom === edgeTo) return;

    const relation = edgeRelation.trim() || 'RELATED_TO';
    const id = `edge_${Date.now()}`;
    const nextEdges = [...edges, { id, from: edgeFrom, to: edgeTo, relation }];

    setEdges(nextEdges);
    rebuildCypher(nodes, nextEdges);
  };

  const resetGraph = () => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setEdgeFrom(INITIAL_NODES[0].id);
    setEdgeTo(INITIAL_NODES[1].id);
    setEdgeRelation('RELATED_TO');
    nodeCounterRef.current = INITIAL_NODES.length + 1;
    rebuildCypher(INITIAL_NODES, INITIAL_EDGES);
  };

  const removeNode = (nodeId) => {
    const nextNodes = nodes.filter((node) => node.id !== nodeId);
    const nextEdges = edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
    setNodes(nextNodes);
    setEdges(nextEdges);

    if (edgeFrom === nodeId) setEdgeFrom(nextNodes[0]?.id || '');
    if (edgeTo === nodeId) setEdgeTo(nextNodes[1]?.id || nextNodes[0]?.id || '');
    if (selectedNodeId === nodeId) setSelectedNodeId(nextNodes[0]?.id || '');
    rebuildCypher(nextNodes, nextEdges);
  };

  const onNodeMouseDown = (event, nodeId) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const node = nodeLookup[nodeId];
    setSelectedNodeId(nodeId);
    setDragging({
      nodeId,
      offsetX: event.clientX - (canvasRect.left + node.x),
      offsetY: event.clientY - (canvasRect.top + node.y),
    });
  };

  const buildEdgeGeometry = (fromNode, toNode) => {
    const centerOffsetX = 62;
    const centerOffsetY = 30;
    const rawX1 = fromNode.x + centerOffsetX;
    const rawY1 = fromNode.y + centerOffsetY;
    const rawX2 = toNode.x + centerOffsetX;
    const rawY2 = toNode.y + centerOffsetY;
    const dx = rawX2 - rawX1;
    const dy = rawY2 - rawY1;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const nodeRadius = 36;
    const arrowOffset = 12;

    const x1 = rawX1 + nx * nodeRadius;
    const y1 = rawY1 + ny * nodeRadius;
    const x2 = rawX2 - nx * (nodeRadius + arrowOffset);
    const y2 = rawY2 - ny * (nodeRadius + arrowOffset);

    return {
      x1,
      y1,
      x2,
      y2,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2 - 8,
    };
  };

  const onCanvasMouseMove = (event) => {
    if (!dragging) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = event.clientX - canvasRect.left - dragging.offsetX;
    const y = event.clientY - canvasRect.top - dragging.offsetY;

    setNodes((prev) => prev.map((node) => {
      if (node.id !== dragging.nodeId) return node;
      return {
        ...node,
        x: Math.max(0, Math.min(x, canvasRect.width - 130)),
        y: Math.max(0, Math.min(y, canvasRect.height - 66)),
      };
    }));
  };

  const onMouseUp = () => {
    if (!dragging) return;
    setDragging(null);
  };

  const copyCypher = async () => {
    try {
      await navigator.clipboard.writeText(cypherText);
    } catch {
      // Ignore clipboard failures; user can copy manually.
    }
  };

  return (
    <section className="innovation-card innovation-card-full">
      <h3>Neo4j Health Graph Studio</h3>
      <p>Drag nodes to model patient journeys, connect clinical relations, then export Cypher for Neo4j Browser.</p>
      <div className="neo4j-summary-bar" role="status" aria-label="Graph summary">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} relations</span>
        <span>{selectedNodeId ? `Selected: ${nodeLookup[selectedNodeId]?.label || selectedNodeId}` : 'No selection'}</span>
      </div>

      <div className="neo4j-legend" aria-label="Node type legend">
        <span className="neo4j-legend-chip neo4j-legend-chip--patient">Patient</span>
        <span className="neo4j-legend-chip neo4j-legend-chip--condition">Condition</span>
        <span className="neo4j-legend-chip neo4j-legend-chip--medication">Medication</span>
        <span className="neo4j-legend-chip neo4j-legend-chip--doctor">Doctor</span>
        <span className="neo4j-legend-chip neo4j-legend-chip--appointment">Appointment</span>
        <span className="neo4j-legend-chip neo4j-legend-chip--lab">LabResult</span>
      </div>

      <div className="neo4j-studio-toolbar">
        <select value={nodeType} onChange={(event) => setNodeType(event.target.value)}>
          {NODE_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <input
          value={nodeLabel}
          onChange={(event) => setNodeLabel(event.target.value)}
          placeholder="Node label"
        />
        <button type="button" onClick={addNode}>Add Node</button>
        <button type="button" onClick={resetGraph}>Reset</button>
      </div>

      <div className="neo4j-studio-toolbar">
        <select value={edgeFrom} onChange={(event) => setEdgeFrom(event.target.value)}>
          {nodes.map((node) => (
            <option key={`from-${node.id}`} value={node.id}>{node.label}</option>
          ))}
        </select>
        <select value={edgeTo} onChange={(event) => setEdgeTo(event.target.value)}>
          {nodes.map((node) => (
            <option key={`to-${node.id}`} value={node.id}>{node.label}</option>
          ))}
        </select>
        <input
          value={edgeRelation}
          onChange={(event) => setEdgeRelation(event.target.value)}
          placeholder="Relation, e.g. HAS_CONDITION"
        />
        <button type="button" onClick={addEdge}>Connect</button>
      </div>

      <div
        className="neo4j-canvas"
        ref={canvasRef}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg className="neo4j-canvas-svg" aria-hidden="true">
          <defs>
            <marker id="neo4j-arrow" markerWidth="8" markerHeight="8" refX="5.5" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L8,4 L0,8 Z" className="neo4j-edge-arrow" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const fromNode = nodeLookup[edge.from];
            const toNode = nodeLookup[edge.to];
            if (!fromNode || !toNode) return null;
            const geometry = buildEdgeGeometry(fromNode, toNode);

            return (
              <g key={edge.id}>
                <line
                  x1={geometry.x1}
                  y1={geometry.y1}
                  x2={geometry.x2}
                  y2={geometry.y2}
                  className="neo4j-edge-line"
                  markerEnd="url(#neo4j-arrow)"
                />
                <text x={geometry.labelX} y={geometry.labelY} className="neo4j-edge-label">
                  {edge.relation}
                </text>
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            className={[
              'neo4j-node',
              NODE_TYPE_CLASS[node.type] || '',
              selectedNodeId === node.id ? 'neo4j-node--selected' : '',
            ].filter(Boolean).join(' ')}
            style={{ left: node.x, top: node.y }}
            onMouseDown={(event) => onNodeMouseDown(event, node.id)}
            onClick={() => setSelectedNodeId(node.id)}
          >
            <div className="neo4j-node-type">{node.type}</div>
            <div className="neo4j-node-label">{node.label}</div>
            <button
              type="button"
              className="neo4j-node-remove"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                removeNode(node.id);
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>

      <label className="neo4j-cypher-label" htmlFor="neo4j-cypher-output">Cypher Output</label>
      <textarea
        id="neo4j-cypher-output"
        className="neo4j-cypher-output"
        rows={10}
        value={cypherText}
        onChange={(event) => setCypherText(event.target.value)}
      />
      <div className="innovation-inline-actions">
        <button type="button" onClick={() => rebuildCypher(nodes, edges)}>Regenerate Cypher</button>
        <button type="button" onClick={copyCypher}>Copy Cypher</button>
      </div>
    </section>
  );
}
