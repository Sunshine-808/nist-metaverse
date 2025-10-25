// ==============================================
// 🌐 NIST Dashboard Main Script (Accessible v2)
// ==============================================
// Easier to read, colorblind-safe, and dyslexia-friendly

// --------------------------------------------------
// 🚀 Load all data safely and build the visualization
// --------------------------------------------------
async function initGraph() {
  try {
    const [nist_nodes, topics_nodes, families_nodes, keywords_nodes,
           topics_links, families_links, keywords_links] = await Promise.all([
      d3.json("nist_nodes.json"),
      d3.json("topics_nodes.json"),
      d3.json("families_nodes.json"),
      d3.json("keywords_nodes.json"),
      d3.json("topics_links.json"),
      d3.json("families_links.json"),
      d3.json("keywords_links.json")
    ]);

    // 🧩 Tag nodes with groups and readable labels
    function tagNodes(nodes, group, labelField) {
      return nodes.map(n => ({
        ...n,
        group,
        displayLabel: n[labelField] || n.name || n.id
      }));
    }

    const nodes = [
      ...tagNodes(nist_nodes, "nist", "PubID"),
      ...tagNodes(topics_nodes, "topic", "topics"),
      ...tagNodes(families_nodes, "family", "families"),
      ...tagNodes(keywords_nodes, "keyword", "keywords")
    ];

    // 🔗 Tag links by source group type
    function tagLinks(links, group) {
      return links.map(l => ({
        ...l,
        group,
        source: l.source.toString(),
        target: l.target.toString()
      }));
    }

    const links = [
      ...tagLinks(topics_links, "topic"),
      ...tagLinks(families_links, "family"),
      ...tagLinks(keywords_links, "keyword")
    ];

    // ✅ Safety check
    if (!nodes?.length || !links?.length) {
      console.error("⚠️ Data not loaded correctly.");
      return;
    }

    console.log(`✅ Loaded ${nodes.length} nodes, ${links.length} links`);

    // Normalize IDs
    nodes.forEach(n => n.id = n.id.toString());
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

// --------------------------------------------------
// 🎨 Build the Graph Visualization
// --------------------------------------------------
function buildGraph(nodes, links) {
  let selectedNode = null;

  // 🖼️ SVG Canvas Setup
  const graphDiv = document.getElementById("graph");
  const width = graphDiv.clientWidth;
  const height = graphDiv.clientHeight;

  const svg = d3.select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const container = svg.append("g");

  // 🧭 Zoom Setup
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => container.attr("transform", event.transform));

  svg.call(zoom);

  // 🌈 Color palette — colorblind friendly
  const color = d3.scaleOrdinal()
    .domain(["nist", "topic", "family", "keyword"])
    .range(["#1f77b4", "#ff7f0e", "#2ca02c", "#9467bd"]);

  // 🔵 Links (paths for flexibility)
  const link = container.append("g")
    .attr("class", "links")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("stroke", d => color(d.group))
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 1.5)
    .attr("fill", "none");

  // 🟠 Nodes (circles)
  const node = container.append("g")
    .attr("class", "nodes")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", d => d.group === "nist" ? 5 : 8)
    .attr("fill", d => color(d.group))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended)
    );

  // 🏷️ Labels (readable, concise)
  const label = container.append("g")
    .attr("class", "labels")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("font-size", d => d.group === "nist" ? 8 : 10)
    .attr("fill", "#333")
    .text(d => d.displayLabel);

  // ⚛️ Force Simulation
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(140))
    .force("charge", d3.forceManyBody().strength(-280))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(25))
    .on("tick", ticked);

  // 🌀 Update positions on each tick
  function ticked() {
    link.attr("d", d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);

    node.attr("cx", d => d.x)
        .attr("cy", d => d.y);

    label.attr("x", d => d.x + 10)
         .attr("y", d => d.y + 4);
  }

  // 🖱️ Drag Functions
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // ✨ Highlight Logic
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

    link.classed("highlighted", d => connected.has(d.source.id) || connected.has(d.target.id))
        .classed("faded", d => !(connected.has(d.source.id) || connected.has(d.target.id)));
  }

  // 🔄 Reset Highlights
  function resetHighlights() {
    node.classed("highlighted", false).classed("faded", false);
    link.classed("highlighted", false).classed("faded", false);
  }

  // 🖱️ Node Click Handling (simplified)
  node.on("click", (event, d) => {
    event.stopPropagation();
    selectedNode = d;
    highlightNode(d);
    showNodeDetails(d);
  });

  // Background click → reset
  svg.on("click", () => {
    if (selectedNode) {
      resetHighlights();
      selectedNode = null;
    }
  });
}

// --------------------------------------------------
// 📘 Simple Node Detail Display (right panel)
// --------------------------------------------------
function showNodeDetails(d) {
  const panel = d3.select("#nodeDetails");
  panel.html(`
    <div class="node-data">
      <h2>${d.displayLabel}</h2>
      <p><strong>Group:</strong> ${d.group}</p>
      <p><strong>ID:</strong> ${d.id}</p>
      ${d.Abstract ? `<p><strong>Abstract:</strong> ${d.Abstract}</p>` : ""}
    </div>
  `);
}
