// ==============================================
// 🌐 NIST Dashboard Main Script (Accessible v2)
// ==============================================
// Easier to read, colorblind-safe, and dyslexia-friendly

// --------------------------------------------------
// 🚀 Load all data safely and build the visualization
// --------------------------------------------------
let nodes = [];
let links = [];


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
      
   // const MAX_NODES = 500;
   // const MAX_LINKS = 1000;
      
   // const sampleNodes = nodes.slice(0, MAX_NODES);
   // const sampleLinks = links.slice(0, MAX_LINKS);
      
    // Ensure links only connect valid sampled nodes
  /*  const nodeIds = new Set(sampleNodes.map(n => n.id));
    const filteredLinks = sampleLinks.filter(l =>
      nodeIds.has(l.source) && nodeIds.has(l.target)
    );
  */

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

  // 🖼️ SVG setup
  const graphDiv = document.getElementById("graph");
  const width = graphDiv.clientWidth;
  const height = graphDiv.clientHeight;

  const svg = d3.select("#graph").append("svg")
    .attr("width", width)
    .attr("height", height);

  const container = svg.append("g");

  // 🔍 Zoom
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => container.attr("transform", event.transform));
  svg.call(zoom);

  // 🌈 Colors
  const color = d3.scaleOrdinal()
    .domain(["nist", "topic", "family", "keyword"])
    .range(["#1f77b4", "#ff7f0e", "#2ca02c", "#9467bd"]);

  // 🔗 Links
  const link = container.append("g")
    .attr("class", "links")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("stroke", d => color(d.group))
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 1.5)
    .attr("fill", "none");

  // 🟢 Nodes
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

  // 🏷 Labels
  const label = container.append("g")
    .attr("class", "labels")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("font-size", d => d.group === "nist" ? 8 : 10)
    .attr("fill", "#333")
    .text(d => d.displayLabel);

  // ⚛️ Simulation
  const simulation = d3.forceSimulation(nodes)
    .alphaDecay(0.05)
    .velocityDecay(0.6)
    .force("link", d3.forceLink(links).id(d => d.id).distance(140))
    .force("charge", d3.forceManyBody().strength(-280))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .on("tick", ticked);

  function ticked() {
    link.attr("d", d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
    node.attr("cx", d => d.x).attr("cy", d => d.y);
    label.attr("x", d => d.x + 10).attr("y", d => d.y + 4);
  }

  // 🖱 Drag
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

  // ✨ Highlight
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
  function resetHighlights() {
    node.classed("highlighted", false).classed("faded", false);
    link.classed("highlighted", false).classed("faded", false);
  }

  // --- Side panel logic ---
  function showNodeDetails(d) {
    d3.select("#abstract").html(`
      <div class="node-data">
        <h2>${d.PubID || d.topics || d.id}</h2>
        ${d.Title ? `<p><strong>Title:</strong> ${d.Title}</p>` : ""}
        ${d.Abstract ? `<p><strong>Abstract:</strong> ${d.Abstract}</p>` : ""}
        ${d.Authors ? `<p><strong>Authors:</strong> ${d.Authors}</p>` : ""}
        ${d.DOI ? `<p><strong>DOI:</strong> ${d.DOI}</p>` : ""}
      </div>
    `);
  }

  function showAssociatedPapers(relatedNodes) {
    const panel = d3.select("#associatedPapers");
    if (!relatedNodes || !relatedNodes.length) {
      panel.html("<h2>Associated Papers</h2><p>No related papers found.</p>");
      return;
    }

    // Sort alphabetically
    relatedNodes.sort((a, b) => (a.PubID || a.id).localeCompare(b.PubID || b.id));

    const html = relatedNodes.map(p => `
      <div class="paper-item" data-id="${p.id}" tabindex="0" role="button">
        <strong>${p.PubID || p.id}</strong>
        ${p.Title ? `<p>${p.Title}</p>` : ""}
      </div>
    `).join("");

    panel.html(`<h2>Associated Papers</h2>${html}`);

    d3.selectAll(".paper-item").on("click keydown", (event) => {
      if (event.type === "click" || event.key === "Enter") {
        const paperId = d3.select(event.currentTarget).attr("data-id");
        const nodeData = nodes.find(n => n.id === paperId);
        if (nodeData) showNodeDetails(nodeData);
      }
    });
  }

  // 🖱 Node click
  node.on("click", (event, d) => {
    event.stopPropagation();
    selectedNode = d;
    highlightNode(d);

    if (d.group === "nist") {
      showNodeDetails(d);
      showAssociatedPapers([d]);
    } else {
      const relatedNistNodes = links
        .filter(l => l.source.id === d.id || l.target.id === d.id)
        .map(l => (l.source.id === d.id ? l.target : l.source))
        .filter(n => n.group === "nist");
      showAssociatedPapers(relatedNistNodes);
      d3.select("#abstract").html("<h2>Abstract</h2><p>Click a paper to view details.</p>");
    }
  });

  // Background click resets
  svg.on("click", () => {
    if (selectedNode) {
      resetHighlights();
      selectedNode = null;
      d3.select("#associatedPapers").html("<h2>Associated Papers</h2>");
      d3.select("#abstract").html("<h2>Abstract</h2>");
    }
  });

  // --- Search functionality (fixed) ---
  const searchInput = document.getElementById("nodeSearch");
  if (searchInput) {
    searchInput.addEventListener("keyup", (event) => {
      const query = event.target.value.trim().toLowerCase();
      if (!query) return;

      const matchedNode = nodes.find(n =>
        (n.PubID || "").toLowerCase().includes(query) ||
        (n.topics || "").toLowerCase().includes(query) ||
        (n.families || "").toLowerCase().includes(query) ||
        (n.keywords || "").toLowerCase().includes(query)
      );

      if (!matchedNode) {
        console.log(`No match for "${query}"`);
        return;
      }

      resetHighlights();
      selectedNode = matchedNode;
      highlightNode(matchedNode);

      if (matchedNode.group === "nist") {
        showNodeDetails(matchedNode);
        showAssociatedPapers([matchedNode]);
      } else {
        const relatedNistNodes = links
          .filter(l => l.source.id === matchedNode.id || l.target.id === matchedNode.id)
          .map(l => (l.source.id === matchedNode.id ? l.target : l.source))
          .filter(n => n.group === "nist");
        showAssociatedPapers(relatedNistNodes);
      }

      // Center graph on matched node
      const transform = d3.zoomIdentity.translate(width / 2 - matchedNode.x, height / 2 - matchedNode.y);
      svg.transition().duration(750).call(zoom.transform, transform);
    });
  }
}




