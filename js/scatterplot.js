class Scatterplot {
  /**
   * Class constructor with basic chart configuration
   */
  constructor(_config, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 500,
      containerHeight: _config.containerHeight || 500,
      margin: _config.margin || { top: 50, right: 20, bottom: 20, left: 35 },
    };
    this.data = _data;
    this.dispatcher = _dispatcher;
    this.initVis();
  }

  /**
   * We initialize scales/axes and append static elements, such as axis titles.
   */
  initVis() {
    let vis = this;

    // Calculate inner chart size. Margin specifies the space around the actual chart.
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // Initialize color scales
    vis.colourScale = d3.scaleOrdinal().domain(industries).range(colourScheme);

    // Define size of SVG drawing area
    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight)
      .on("click", function (event) {
        // Clear current selection when SVG backdrop is clicked
        if (!event.defaultPrevented) {
          vis.dispatcher.call("clearSelectedItem", event);
        }
      });

    // Append group element that will contain our actual chart
    // and position it according to the given margin config
    vis.chart = vis.svg
      .append("g")
      .attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // Append empty x-axis group and move it to the bottom of the chart
    vis.xAxisG = vis.chart
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${vis.height})`);

    // Append y-axis group
    vis.yAxisG = vis.chart.append("g").attr("class", "axis y-axis");

    // Append both axis titles
    vis.chart
      .append("text")
      .attr("class", "axis-title")
      .attr("y", vis.height - 15)
      .attr("x", vis.width + 10)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("ROI");

    vis.svg
      .append("text")
      .attr("class", "axis-title")
      .attr("x", 0)
      .attr("y", 0)
      .attr("dy", "2.5em")
      .text("Valuation($B)");

    // Add listener for log/linear controls
    d3.select(`${vis.config.parentElement} .scale-control`).on("change", function () {
      vis.config.scaleOption = d3.select(this).property("value");
      vis.updateVis();
    });

    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;

    // Initialize scale
    vis.xScale = d3.scaleLog().range([0, vis.width]);
    vis.yScale = d3.scaleLog().range([vis.height, 0]);

    // rescale by linear scale if the option is selected by user
    if (vis.config.scaleOption === "linear") {
      vis.xScale = d3.scaleLinear().range([0, vis.width]);
      vis.yScale = d3.scaleLinear().range([vis.height, 0]);
    }

    // Initialize axes
    vis.xAxis = d3
      .axisBottom(vis.xScale)
      .ticks(3)
      .tickSizeOuter(0)
      .tickSize(-vis.height)
      .tickPadding(10)
      .tickFormat((d) => d);

    vis.yAxis = d3
      .axisLeft(vis.yScale)
      .ticks(5)
      .tickSizeOuter(0)
      .tickSize(-vis.width)
      .tickPadding(10)
      .tickFormat((d) => d);

    // filter out companies that don't have ROI
    vis.validData = vis.data.filter((d) => d.roi !== null);

    // Descending order by roi and slice top 30
    vis.validData.sort((a, b) => b.roi - a.roi);
    vis.validData = vis.validData.slice(0, 30);

    // Specify accessor functions
    vis.colorValue = (d) => d.industry;
    vis.xValue = (d) => d.roi;
    vis.yValue = (d) => d.valuationBillions;

    // Set the scale input domains
    vis.xScale
      .domain([d3.min(vis.validData, vis.xValue), d3.max(vis.validData, vis.xValue)])
      .nice();
    vis.yScale
      .domain([d3.min(vis.validData, vis.yValue), d3.max(vis.validData, vis.yValue)])
      .nice();
    vis.renderVis();
  }

  /**
   * Bind data to visual elements.
   */
  renderVis() {
    let vis = this;

    // Add circles
    vis.circles = vis.chart
      .selectAll(".point")
      .data(vis.validData, (d) => d.id)
      .join("circle")
      .attr("class", "point")
      .attr("r", 6)
      .attr("fill", (d) => vis.colourScale(d.industry))
      .classed("selected", (d) => d.id === selectedItemId);

    vis.circles
      .transition()
      .duration(1000)
      .attr("cx", (d) => vis.xScale(vis.xValue(d)))
      .attr("cy", (d) => vis.yScale(vis.yValue(d)));

    // Tooltip event listeners
    vis.circles
      .on("mouseover", (event, d) => {
        vis.dispatcher.call("showCompanyTooltip", event, d, event.pageX, event.pageY);
      })
      .on("mousemove", (event) => {
        vis.dispatcher.call("moveTooltip", event, event.pageX, event.pageY);
      })
      .on("mouseleave", (event) => {
        vis.dispatcher.call("hideTooltip", event);
      });

    // Handle clicks on points - select or deselect the company across views
    vis.circles.on("click", function (event, d) {
      // Prevent svg click handler from detecting a background click
      event.preventDefault();

      vis.dispatcher.call("toggleSelectedItem", event, d.id);
    });

    // Update the axes/gridlines
    // We use the second .call() to remove the axis and just show gridlines
    vis.xAxisG.call(vis.xAxis).call((g) => g.select(".domain").remove());

    vis.yAxisG.call(vis.yAxis).call((g) => g.select(".domain").remove());
  }
}
