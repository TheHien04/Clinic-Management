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
    rebuildCypher(nextNodes, nextEdges);
  };

  const onNodeMouseDown = (event, nodeId) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const node = nodeLookup[nodeId];
    setDragging({
      nodeId,
      offsetX: event.clientX - (canvasRect.left + node.x),
      offsetY: event.clientY - (canvasRect.top + node.y),
    });
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
          {edges.map((edge) => {
            const fromNode = nodeLookup[edge.from];
            const toNode = nodeLookup[edge.to];
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x + 62;
            const y1 = fromNode.y + 30;
            const x2 = toNode.x + 62;
            const y2 = toNode.y + 30;

            return (
              <g key={edge.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} className="neo4j-edge-line" />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} className="neo4j-edge-label">
                  {edge.relation}
                </text>
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            className="neo4j-node"
            style={{ left: node.x, top: node.y }}
            onMouseDown={(event) => onNodeMouseDown(event, node.id)}
          >
            <div className="neo4j-node-type">{node.type}</div>
            <div className="neo4j-node-label">{node.label}</div>
            <button type="button" className="neo4j-node-remove" onClick={() => removeNode(node.id)}>x</button>
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
