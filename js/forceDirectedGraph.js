class ForceDirectedGraph {
  /**
   * Class constructor with initial configuration
   */
  constructor(_config, _companyData, _investmentData, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: 700,
      containerHeight: 650,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      maxInvestorCount: 10,
      arrangementRadius: 180,
      legendHeight: 100,
      legendTitleTopMargin: 5,
      legendTextTopMargin: 30,
      legendContentTopMargin: 40,
    };

    this.companyData = _companyData;
    this.allInvestmentData = _investmentData;
    this.investmentData = _investmentData;
    this.dispatcher = _dispatcher;
    this.preprocessData();
    this.initVis();
  }

  /**
   * One-time initial data preprocessing.
   */
  preprocessData() {
    let vis = this;

    // Remove all companies with ROI === null and all investment entries connected to them
    const toRemove = new Set();
    for (let company of vis.companyData) {
      if (company.roi === null) {
        toRemove.add(company.id);
      }
    }
    vis.companyData = vis.companyData.filter((d) => !toRemove.has(d.id));
    vis.allInvestmentData = vis.allInvestmentData.filter((d) => !toRemove.has(d.company_id));
  }

  /**
   * Compute filtered data based on global industry and year joined filters.
   */
  applyFilters() {
    let vis = this;

    // Keep only companies belonging to the selected industries and year range
    const toKeep = new Set(
      vis.companyData
        .filter(
          (d) =>
            selectedIndustries.has(d.industry) &&
            d.date_joined.getFullYear() >= selectedYearRange[0] &&
            d.date_joined.getFullYear() <= selectedYearRange[1]
        )
        .map((d) => d.id)
    );

    // Keep only investments involving remaining companies
    vis.investmentData = vis.allInvestmentData.filter((d) => toKeep.has(d.company_id));
  }

  /**
   * Append static elements and initialize scales and force simulation
   */
  initVis() {
    let vis = this;

    // Width and height
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // Citation: viewBox initialization learned from https://observablehq.com/@d3/force-directed-graph
    // Create SVG container
    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight)
      .attr("viewBox", [-vis.width / 2, -vis.height / 2, vis.width, vis.height])
      .on("click", function (event) {
        // Clear current selection when SVG backdrop is clicked
        if (!event.defaultPrevented) {
          vis.dispatcher.call("clearSelectedItem", event);
        }
      });

    // Create inner chart area - which is also the component controlled by pan/zoom
    vis.chartArea = vis.svg
      .append("g")
      .attr("transform", `translate(${vis.config.margin.left}, ${vis.config.margin.top})`);

    // Initialize variables used to control log/linear scale of company sizes
    vis.scaleType = "log";
    vis.logTransform = (x) => Math.log10(x);
    vis.linearTransform = (x) => x;

    // Initialize scales
    vis.colourScale = d3.scaleOrdinal().domain(industries).range(colourScheme);

    // Note: using a linear scale to directly encode area
    vis.companyAreaScale = d3.scaleLinear().range([6 ** 2, 18 ** 2]);
    vis.investorAreaScale = d3.scaleLinear().range([25 ** 2, 50 ** 2]);

    // Precompute min and max ROI in the dataset, since company scale is not affected by filtering
    vis.companySizeExtent = d3.extent(vis.companyData.map((d) => d.roi));

    // Create shape generators for nodes
    vis.companySymbolGenerator = d3.symbol().type(d3.symbolCircle);
    vis.investorSymbolGenerator = d3.symbol().type(d3.symbolHexagonAlt);

    // Create forces
    vis.forceNode = d3.forceManyBody().strength((d) => (d.company ? -50 : -200));
    vis.forceLink = d3
      .forceLink()
      .id((d) => d.id)
      .strength(0.75);
    vis.forceRadial = d3.forceRadial(vis.config.arrangementRadius).strength(1);

    // Isolate radial force to investor nodes
    // Citation: code snippet adapted from https://gist.github.com/mbostock/b1f0ee970299756bc12d60aedf53c13b
    function isolate(force, filter) {
      const initialize = force.initialize;
      force.initialize = function (nodes) {
        initialize.call(force, nodes.filter(filter));
      };
      return force;
    }

    // Initialize force simulation
    vis.simulation = d3
      .forceSimulation()
      .force("link", vis.forceLink)
      .force("charge", vis.forceNode)
      .force(
        "radial",
        isolate(vis.forceRadial, (d) => !d.company)
      );

    // Add zoom/pan behaviour
    // Citation: code snippet adapted from https://observablehq.com/@d3/drag-zoom
    vis.svg.call(
      d3
        .zoom()
        .extent([
          [0, 0],
          [vis.width, vis.height],
        ])
        .scaleExtent([1, 1])
        .on("zoom", ({ transform }) => {
          vis.chartArea.attr("transform", transform);
        })
    );

    vis.initLegend();
    vis.updateVis();
  }

  /**
   * Append static elements in the legend and visualization controls.
   */
  initLegend() {
    let vis = this;

    // Add listener for log/linear controls
    d3.select(`${vis.config.parentElement} .scale-control`).on("change", function () {
      vis.scaleType = d3.select(this).property("value");
      vis.updateVis("scale");
    });

    // Add listener to search box
    vis.searchInput = d3.select("#network-search");
    vis.searchFeedback = d3.select("#network-search-feedback");
    vis.searchButton = d3.select("#network-search-button").on("click", () => {
      const searchText = vis.searchInput.property("value");
      vis.searchAndHighlight(searchText.trim());
    });

    // The 3 sections of the legend
    vis.legendSections = [
      { title: "Companies", text: "Size shows return on investment" },
      { title: "Investors", text: "Size shows number of investments" },
      { title: "Links", text: "Show investments" },
    ];

    // Constants used to position the 3 legend sections
    vis.legendSectionStartPos = [0, 250, 500]; // x coordinate at which each section starts
    vis.legendSectionWidth = 200; // content width of each section

    // Values to label in the company size legend
    vis.companySizeLegendValues = [1, 10, 100, 10000];

    // Append separate SVG for legend
    vis.legendSvg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr('class', 'legend-container')
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.legendHeight);

    // Append a group for each legend section
    vis.legendGroups = vis.legendSvg
      .selectAll(".legend-group")
      .data(vis.legendSections)
      .enter()
      .append("g")
      .attr("class", "legend-group")
      .attr("transform", (_, i) => `translate(${vis.legendSectionStartPos[i]}, 0)`);

    // Append legend section titles and descriptive text
    vis.legendGroups
      .append("text")
      .text((d) => d.title)
      .attr("class", "legend-title")
      .attr("transform", `translate(0, ${vis.config.legendTitleTopMargin})`);
    vis.legendGroups
      .append("text")
      .text((d) => d.text)
      .attr("transform", `translate(0, ${vis.config.legendTextTopMargin})`);
  }

  /**
   * Prepare the data and scales before we render it.
   * @param updateType    Source of update. "scale" and "filter" are special values.
   */
  updateVis(updateType) {
    let vis = this;

    // Keep only companies matching global filters, and only investments in those companies
    vis.applyFilters();

    // Compute top N investors in filtered data
    const topInvestors = getTopInvestors(
      vis.companyData,
      vis.investmentData,
      vis.config.maxInvestorCount
    );

    // Only keep companies invested by the top investors
    let filteredCompanies = {};
    for (let investor of topInvestors) {
      for (let company of investor.investedCompanies) {
        filteredCompanies[company.id] = company;
      }
    }
    filteredCompanies = Object.values(filteredCompanies);

    // Only keep links between remaining companies and investors
    const filteredInvestorIds = new Set(topInvestors.map((d) => d.id));
    const filteredLinks = vis.investmentData.filter((d) => filteredInvestorIds.has(d.investor_id));

    // Create node and link objects
    // Note: we must make copies of the objects because force simulation adds its own properties
    vis.investorNodes = topInvestors.map((d) => ({
      ...d,
      company: false,
    }));
    vis.companyNodes = filteredCompanies.map((d) => ({ ...d, company: true }));
    vis.nodes = vis.companyNodes.concat(vis.investorNodes);
    vis.links = filteredLinks.map((d) => ({
      ...d,
      source: d.investor_id,
      target: d.company_id,
    }));

    // Copy the position of any nodes that previously existed. Otherwise, all nodes will restart
    // from the origin and the old layout will be destroyed.
    function mergeWithOldNodes() {
      const oldMap = vis.nodeMap || {};
      for (let i = 0; i < vis.nodes.length; i++) {
        const newNode = vis.nodes[i];
        if (newNode.id in oldMap) {
          const oldNode = oldMap[newNode.id];
          newNode.x = oldNode.x;
          newNode.y = oldNode.y;
        }
      }
      vis.nodeMap = listToMap(vis.nodes);
    }
    mergeWithOldNodes();

    // Update nodes and links in force simulation
    vis.simulation.nodes(vis.nodes);
    vis.simulation.force("link").links(vis.links);

    // Depending on the type of update, restart simulation to have it generate a new layout
    vis.maybeReheatSimulation(updateType);

    // Update scale domains and labelled values in the legend
    const currentTransform = vis.scaleType === "log" ? vis.logTransform : vis.linearTransform;

    vis.companyAreaScale.domain(vis.companySizeExtent.map((d) => currentTransform(d)));
    vis.companySymbolGenerator.size((d) => vis.companyAreaScale(currentTransform(d)));

    vis.investorAreaScale.domain(d3.extent(topInvestors.map((d) => d.investedCompanies.size)));
    vis.investorSymbolGenerator.size((d) => vis.investorAreaScale(d));
    vis.investorSizeLegendValues = vis.investorAreaScale.domain();

    vis.renderVis();
    vis.renderLegend();
  }

  /**
   * Reheats force simulation if source of update is "scale" or "filter"
   * @param updateType    Source of update.
   */
  maybeReheatSimulation(updateType) {
    let vis = this;

    if (updateType === "scale") {
      // Nodes change size: only reheat a little

      vis.simulation.alphaTarget(0.1).restart();
      d3.timeout(() => {
        vis.simulation.alphaTarget(0);
      }, 150);
    } else if (updateType === "filter") {
      // Nodes added/removed: gradually bring simulation to full heat, then let converge to new layout

      vis.simulation.alphaTarget(0.2).restart();
      d3.timeout(() => {
        vis.simulation.alphaTarget(1);
        d3.timeout(() => {
          vis.simulation.alphaTarget(0);
        }, 200);
      }, 100);
    }
  }

  /**
   * Render visual elements to the screen and bind event listeners.
   */
  renderVis() {
    let vis = this;

    // Draw links
    vis.link = vis.chartArea.selectAll("line").data(vis.links).join("line").attr("class", "link");

    // Highlight links connected to the selected node
    const connectedLinks = vis.link
      .filter((d) => d.source.id === selectedItemId || d.target.id === selectedItemId)
      .classed("highlighted", true);

    // Compute ids of one-hop neighbours of the selected node
    const connectedNodes = new Set([
      ...connectedLinks.data().map((d) => d.source.id),
      ...connectedLinks.data().map((d) => d.target.id),
    ]);

    // Draw nodes (both company and investor)
    vis.node = vis.chartArea
      .selectAll("path")
      .data(vis.nodes, (d) => d.id)
      .join("path")
      .attr("d", (d) =>
        d.company
          ? vis.companySymbolGenerator(d.roi)
          : vis.investorSymbolGenerator(d.investedCompanies.size)
      )
      .classed("node", true)
      .classed("investor", (d) => !d.company)
      .classed("company", (d) => d.company)
      .classed("selected", (d) => d.id === selectedItemId)
      .classed("highlighted", (d) => connectedNodes.has(d.id))
      .style("fill", (d) => (d.company ? vis.colourScale(d.industry) : "white"));

    // Add listener for dragging nodes
    // Citation: code snippet adapted from https://observablehq.com/@d3/force-directed-graph
    vis.node.call(
      d3
        .drag()
        .on("start", function (event) {
          if (!event.active) {
            vis.simulation.alphaTarget(0.3).restart();
          }
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        })
        .on("drag", function (event) {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        })
        .on("end", function (event) {
          if (!event.active) {
            vis.simulation.alphaTarget(0);
          }
          event.subject.fx = null;
          event.subject.fy = null;
        })
    );

    // Draw labels on investor nodes
    vis.labels = vis.chartArea
      .selectAll("text")
      .data(vis.investorNodes, (d) => d.id)
      .join("text")
      .attr("class", "node-label")
      .text((d) => d.id)
      .classed("selected", (d) => d.id === selectedItemId);

    // Add tooltip listeners
    vis.node
      .filter((d) => d.company)
      .on("mouseover", (event, d) => {
        vis.dispatcher.call("showCompanyTooltip", event, d, event.pageX, event.pageY);
      })
      .on("mousemove", (event) => {
        vis.dispatcher.call("moveTooltip", event, event.pageX, event.pageY);
      })
      .on("mouseleave", (event) => {
        vis.dispatcher.call("hideTooltip", event);
      });
    vis.node
      .filter((d) => !d.company)
      .on("mouseover", (event, d) => {
        vis.dispatcher.call("showInvestorTooltip", event, d, event.pageX, event.pageY);
      })
      .on("mousemove", (event) => {
        vis.dispatcher.call("moveTooltip", event, event.pageX, event.pageY);
      })
      .on("mouseleave", (event) => {
        vis.dispatcher.call("hideTooltip", event);
      });

    // Handle clicks on nodes - select or deselect the item across views.
    // This will highlight / de-highlight the one-hop neighbours of the selected node.
    vis.node.on("click", function (event, d) {
      // Prevent svg click handler from detecting a background click
      event.preventDefault();

      vis.dispatcher.call("toggleSelectedItem", event, d.id);
    });

    // Update node, link, and label positions according to simulation
    vis.simulation.on("tick", () => {
      vis.node.attr("transform", (d) => `translate(${d.x}, ${d.y})`);

      vis.link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      vis.labels.attr("x", (d) => d.x).attr("y", (d) => d.y);
    });

    // Ensure nodes are drawn in front of links, and labels are drawn in front of nodes
    vis.node.raise();
    vis.labels.raise();
  }

  /**
   * Render legend elements to the screen.
   */
  renderLegend() {
    let vis = this;

    // Y position to center content
    const legendContentHeight = vis.config.legendHeight - vis.config.legendContentTopMargin;
    const contentCenterLine = vis.config.legendContentTopMargin + legendContentHeight / 2;

    // Utility function to space elements evenly along the horizontal axis
    //  i = index of element
    //  n = total number of elements to space
    const spacedPosition = (i, n) => {
      const segmentWidth = vis.legendSectionWidth / n;
      return segmentWidth * 0.5 + segmentWidth * i;
    };

    // Draw legend nodes and labels for company size
    const companyPosition = (i) => spacedPosition(i, vis.companySizeLegendValues.length);
    const companyGroup = vis.legendGroups.filter((d) => d.title === "Companies");
    companyGroup
      .selectAll("path")
      .data(vis.companySizeLegendValues)
      .join("path")
      .attr("class", "company")
      .attr("d", (d) => vis.companySymbolGenerator(d))
      .attr("transform", (d, i) => `translate(${companyPosition(i)}, ${contentCenterLine - 5})`);
    companyGroup
      .selectAll(".legend-node-label")
      .data(vis.companySizeLegendValues)
      .join("text")
      .attr("class", "legend-node-label")
      .attr("transform", (d, i) => `translate(${companyPosition(i)}, ${contentCenterLine + 20})`)
      .text((d) => d3.format(",")(d));

    // Draw legend nodes and labels for investor size
    const investorPosition = (i) => spacedPosition(i, vis.investorSizeLegendValues.length);
    const investorGroup = vis.legendGroups.filter((d) => d.title === "Investors");
    investorGroup
      .selectAll("path")
      .data(vis.investorSizeLegendValues)
      .join("path")
      .attr("class", "investor")
      .attr("d", (d) => vis.investorSymbolGenerator(d))
      .attr("transform", (d, i) => `translate(${investorPosition(i)}, ${contentCenterLine})`);
    investorGroup
      .selectAll(".legend-node-label")
      .data(vis.investorSizeLegendValues)
      .join("text")
      .attr("class", "legend-node-label")
      .attr("transform", (d, i) => `translate(${investorPosition(i)}, ${contentCenterLine})`)
      .text((d) => d);

    // Draw legend for links (join dummy data to prevent appending more elements with each update)
    const dummyDataSingleElement = [0];
    const nodePosition = (i) => spacedPosition(i, 2);
    const linksGroup = vis.legendGroups.filter((d) => d.title === "Links");
    linksGroup
      .selectAll(".link")
      .data(dummyDataSingleElement)
      .join("line")
      .attr("class", "link")
      .attr("x1", nodePosition(0))
      .attr("y1", contentCenterLine)
      .attr("x2", nodePosition(1))
      .attr("y2", contentCenterLine);
    linksGroup
      .selectAll(".investor")
      .data(dummyDataSingleElement)
      .join("path")
      .attr("class", "investor")
      .attr("d", vis.investorSymbolGenerator(vis.investorSizeLegendValues[0]))
      .attr("transform", `translate(${nodePosition(0)}, ${contentCenterLine})`);
    linksGroup
      .selectAll(".company")
      .data(dummyDataSingleElement)
      .join("path")
      .attr("class", "company")
      .attr("d", vis.companySymbolGenerator(vis.companySizeLegendValues[1]))
      .attr("transform", `translate(${nodePosition(1)}, ${contentCenterLine})`);
  }

  /**
   * Run a search for a node whose name includes the given searchText.
   * Selects the first node if found; otherwise, displays error feedback.
   */
  searchAndHighlight(searchText) {
    let vis = this;

    // Utility function to check if a string includes another (case-insensitive)
    const caseInsensitiveIncludes = (str1, str2) => str1.toUpperCase().includes(str2.toUpperCase());

    if (searchText.length === 0) {
      vis.searchFeedback.text("Please enter a company or investor name.");
    } else {
      // Try to find matching node in the current view
      const result = vis.nodes.find((d) =>
        d.company
          ? caseInsensitiveIncludes(d.company_name, searchText)
          : caseInsensitiveIncludes(d.id, searchText)
      );

      // Update feedback text + select node globally if found
      if (result) {
        vis.dispatcher.call("selectItem", null, result.id);
        vis.searchFeedback.text("");
      } else {
        vis.searchFeedback.text(
          "Sorry, we couldn't find a matching company or investor in the current view."
        );
      }
    }
  }
}
