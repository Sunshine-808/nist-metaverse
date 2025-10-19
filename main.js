// ==============================
// NIST Dashboard Main Script
// ==============================

// --- Load all data safely ---
async function initGraph() {
  try {
    const [nist_nodes, topics_nodes, families_nodes, keywords_nodes, topics_links, families_links, keywords_links] = await Promise.all([
      d3.json("nist_nodes.json"),
      d3.json("topics_nodes.json"),
      d3.json("families_nodes.json"),
      d3.json("keywords_nodes.json"),
      d3.json("topics_links.json"),
      d3.json("families_links.json"),
      d3.json("keywords_links.json")
    ]);

    const nodes = [...nist_nodes, ...topics_nodes];
    const links = topics_links;
      
    if (!nodes?.length || !links?.length) {
      console.error("⚠️ Data not loaded correctly. Nodes or links array is empty.");
      return;
    }

    console.log(`✅ Data loaded: ${nodes.length} nodes, ${links.length} links`);

    // --- Normalize IDs to strings for consistency ---
    nodes.forEach(n => (n.id = n.id.toString()));
    links.forEach(l => {
      l.source = l.source.toString();
      l.target = l.target.toString();
    });

    buildGraph(nodes, links);

  } catch (err) {
    console.error("❌ Error loading data:", err);
  }
}

initGraph();

// ==============================
// Build the graph visualization
// ==============================
function buildGraph(nodes, links) {

  
  let selectedNode = null;

  // --- SVG setup ---
  const graphDiv = document.getElementById("graph");
  let width = graphDiv.clientWidth //|| 800;
  let height = graphDiv.clientHeight //|| 600;

  const svg = d3.select("#graph").append("svg")
    .attr("width", width)
    .attr("height", height);

  const container = svg.append("g");

  // --- Define zoom separately so we can reuse it in search ---
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => container.attr("transform", event.transform));

  svg.call(zoom);


  // --- Nodes ---
     nodes.forEach(n => {
      n.group = "nist";
      n.displayLabel = n.PubID || n.name || n.id; // Small, ID-like label
    });

    nodes.forEach(n => {
      n.group = "topic";
      // Optionally abbreviate long topics
      n.displayLabel = (n.topics && n.topics.length > 20)
        ? n.topics.slice(0, 20) + "…"   // Truncate for long topic names
        : n.topics || n.name;
    });
   
    
  // Color palette
  const color = d3.scaleOrdinal()
      .domain(["nist", "topic"])
      .range(["#1f77b4", "#ff7f0e"]);  // Blue for NIST, orange for Topics

  // Nodes
  const node = container.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("class", "node")
      .attr("r", d => d.group === "nist" ? 5 : 10)  // Smaller for NIST nodes
      .attr("fill", d => color(d.group))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );


  // --- Labels ---
  const label = container.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("class", "label")
      .text(d => {
        if (d.group === "nist") return d.PubID;                // short identifier
        if (d.group === "topic") return abbreviate(d.topic);   // readable, truncated
        return d.name || d.id;                                 // fallback
      })
      .attr("font-size", d => d.group === "nist" ? 8 : 12)
      .attr("fill", d => d.group === "nist" ? "#555" : "#111")
      .attr("x", 14)
      .attr("y", 4);

  function abbreviate(str, maxLen = 20) {
    if (!str) return "";
    return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
  }
 
  // Assign a 'group' to each link depending on connected node types
    links.forEach(l => {
      const sourceGroup = typeof l.source === "object" ? l.source.group : nodes.find(n => n.id === l.source)?.group;
      const targetGroup = typeof l.target === "object" ? l.target.group : nodes.find(n => n.id === l.target)?.group;

      if (sourceGroup === targetGroup) {
        l.group = sourceGroup; // e.g., "nist" → internal NIST link
      } else {
        l.group = "cross"; // connects two different groups (NIST–Topic)
      }
    });

     const linkColor = d3.scaleOrdinal()
      .domain(["nist", "topic", "cross"])
      .range(["#1f77b4", "#ff7f0e", "#999"]);
   
     // --- Links (with optional curved cross-links) ---
    const link = container.append("g")
      .attr("class", "links")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", d => linkColor(d.group))
      .attr("stroke-width", d => d.group === "cross" ? 2 : 1.2)
      .attr("stroke-opacity", d => d.group === "cross" ? 0.8 : 0.5);

  

  // --- Force simulation ---
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(150).strength(0.5))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(30))
    .on("tick", ticked);

    function ticked() {
      link.attr("d", d => {
        const sx = d.source.x,
          sy = d.source.y,
          tx = d.target.x,
          ty = d.target.y;

    // If cross-link, make it curved using quadratic Bézier
    if (d.group === "cross") {
      const dx = tx - sx;
      const dy = ty - sy;
      const dr = Math.sqrt(dx * dx + dy * dy) * 0.5; // curve radius
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      const curveOffset = 0.2; // adjust for more/less bend
      const cx = mx - dy * curveOffset;
      const cy = my + dx * curveOffset;
      return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
    }

    // otherwise, straight link
    return `M${sx},${sy} L${tx},${ty}`;
  });

  node.attr("cx", d => d.x)
      .attr("cy", d => d.y);

  label.attr("x", d => d.x + 14)
       .attr("y", d => d.y + 4);
}


  // --- Drag functions ---
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x; d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
  }

  // --- Highlight logic ---
  function highlightNode(selected) {
    const connected = new Set();
    links.forEach(l => {
      if (l.source.id === selected.id || l.target.id === selected.id) {
        connected.add(l.source.id);
        connected.add(l.target.id);
      }
    });

    node.classed("highlighted", d => connected.has(d.id))
        .classed("faded", d => !connected.has(d.id));
    link.classed("highlighted", d => d.source.id === selected.id || d.target.id === selected.id)
        .classed("faded", d => !(d.source.id === selected.id || d.target.id === selected.id));
    label.classed("highlighted", d => connected.has(d.id))
         .classed("faded", d => !connected.has(d.id));
  }

  function resetHighlights() {
    node.classed("highlighted", false).classed("faded", false);
    link.classed("highlighted", false).classed("faded", false);
    label.classed("highlighted", false).classed("faded", false);
  }
// --- Click handling ---
node.on("click", (event, d) => {
  event.stopPropagation();

  // --- If same node is clicked twice, reset ---
  if (selectedNode && selectedNode.id === d.id) {
    resetPanels();
    resetHighlights();
    selectedNode = null;
    return;
  }

  selectedNode = d;

  // --- Highlight node and connected links ---
  highlightNode(d);

  // --- Conditional logic based on node type ---
  if (d.group === "nist") {
    // NIST node: show its details (right panel) + itself in middle panel
    showNodeDetails(d);
    showAssociatedPapers([d]);
  } else if (d.group === "topic") {
    // Topic node: list all related NIST nodes in middle, leave right blank
    const relatedNistNodes = links
      .filter(l => l.source.id === d.id || l.target.id === d.id)
      .map(l => (l.source.id === d.id ? l.target : l.source))
      .filter(n => n.group === "nist");

    showAssociatedPapers(relatedNistNodes);
    clearNodeDetails();
  }
});

// --- Reset when clicking on background ---
svg.on("click", () => {
  if (selectedNode) {
    resetPanels();
    resetHighlights();
    selectedNode = null;
  }
});

// --- Reset panels ---
function resetPanels() {
  d3.select("#associatedPapers").html("<h2>Associated Papers</h2><p>Click a node to view details.</p>");
  d3.select("#nodeDetails").html("<h2>Abstract</h2><p>Click a node to view details.</p>");
}

// --- Show Node Details (right panel) ---
function showNodeDetails(d) {
  const nodeData = nodes.find(n => n.id === d.id) || d;
  d3.select("#abstract").html(`
    <div class="node-data">
      <h2>${nodeData.PubID}</h2>
      <p><strong>Title:</strong> ${nodeData.Title}</p>
      <p><strong>Abstract:</strong> ${nodeData.Abstract || "N/A"}</p>
      <p><strong>Authors:</strong> ${nodeData.Authors || "N/A"}</p>  
      <p><strong>Editors</strong> ${nodeData.overview || "N/A"}</p>
      <p><strong>DOI:</strong> ${nodeData.DOI || "N/A"}</p>
      <p><strong>Curren tURL:</strong> ${nodeData.CurrentURL || "N/A"}</p>
    </div>
  `);
}

// --- Show Associated Papers (middle panel) ---
function showAssociatedPapers(papers) {
  if (!papers.length) {
    d3.select("#associatedPapers").html("<h2>Associated Papers</h2><p>No related papers found.</p>");
    return;
  }

  const html = papers.map(p => `
    <div class="paper-item" data-id="${p.id}">
      <strong>${p.name}</strong>
      ${p.PubID ? `<p>PubID: ${p.PubID}</p>` : ""}
    </div>
  `).join("");

  d3.select("#associatedPapers").html(`<h2>Associated Papers</h2>${html}`);

  // --- When clicking a paper in middle panel, show its details on the right ---
  d3.selectAll(".paper-item").on("click", (event, item) => {
    const paperId = d3.select(event.currentTarget).attr("data-id");
    const nodeData = nodes.find(n => n.id === paperId);
    if (nodeData) showNodeDetails(nodeData);
  });
}

// --- Clear right panel ---
function clearNodeDetails() {
  d3.select("#nodeDetails").html("<h2>Abstract</h2><p>Click a paper to view details.</p>");
}

// --- Format Definition Helper ---
function formatDefinition(defText) {
  if (!defText || typeof defText !== "string") return "<p>N/A</p>";
  const [intro, ...rest] = defText.split(/(?=\d+\))/);
  const listItems = rest.map(p => `<li>${p.replace(/^\d+\)\s*/, "").trim()}</li>`).join("");
  return `${intro ? `<p>${intro.trim()}</p>` : ""}${listItems ? `<ol>${listItems}</ol>` : ""}`;
}



 // ==============================
// Search Functionality (updated)
// ==============================
const searchInput = document.getElementById("nodeSearch");

if (searchInput) {
  searchInput.addEventListener("keyup", (event) => {
    const query = event.target.value.trim().toLowerCase();
    if (!query) return;

    // Find a node by multiple possible fields
    const family = (n.family || "").toString().toLowerCase();
    const keyword = (n.keyword || "").toString().toLowerCase();
    return pubId.includes(query) || topic.includes(query) || family.includes(query) || keyword.includes(query);

    if (!matchedNode) {
      // friendly not-found feedback (no blocking alert)
      console.log(`No matching node found for "${query}".`);
      return;
    }

    // clear previous state, highlight and select the node
    resetHighlights();
    selectedNode = matchedNode;
    highlightNode(matchedNode);

    // Populate panels depending on node type
    if (matchedNode.group === "nist") {
      showNodeDetails(matchedNode);          // right panel: metadata & abstract
      showAssociatedPapers([matchedNode]);   // middle: single paper
    } else if (matchedNode.group === "topic") {
      // find related NIST nodes via the links array
      const relatedNistNodes = links
        .filter(l => l.source.id === matchedNode.id || l.target.id === matchedNode.id)
        .map(l => (l.source.id === matchedNode.id ? l.target : l.source))
        .filter(n => n.group === "nist");

      showAssociatedPapers(relatedNistNodes); // middle: list of papers
      clearNodeDetails();                      // right: empty until paper clicked
    } else {
      // default behavior
      showNodeDetails(matchedNode);
      showAssociatedPapers([]);
    }

    // Smoothly center the graph on the matched node (uses your existing zoom)
    // Note: `zoom` should already be defined earlier as the d3.zoom() used on svg.
    try {
      const transform = d3.zoomIdentity.translate(width / 2 - matchedNode.x, height / 2 - matchedNode.y);
      svg.transition()
        .duration(750)
        .call(zoom.transform, transform);
    } catch (err) {
      // If centering fails (e.g., simulation hasn't assigned x/y yet), just log it.
      console.warn("Could not center on node yet (maybe simulation not ticked).", err);
    }
  });
}


}

