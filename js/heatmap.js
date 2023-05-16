class Heatmap {
  /**
   * Class constructor with initial configuration
   */
  constructor(_config, _companyData, _investmentData, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: 600,
      containerHeight: 450,
      maxInvestorCount: 10,
      margin: { top: 60, right: 20, bottom: 100, left: 150 },
      legendWidth: 160,
      legendBarHeight: 10,
    };
    this.companyData = _companyData;
    this.investmentData = _investmentData;
    this.dispatcher = _dispatcher;
    this.initVis();
  }

  /**
   * We create the SVG area, initialize scales/axes, and append static elements
   */
  initVis() {
    let vis = this;

    // Calculate inner chart size. Margin specifies the space around the actual chart.
    vis.config.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.config.height =
      vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // Define size of SVG drawing area
    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

    // Append group element that will contain our actual chart
    // and position it according to the given margin config
    vis.chartArea = vis.svg
      .append("g")
      .attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    vis.chart = vis.chartArea.append("g");

    // Initialize scales
    vis.colorScale = d3.scaleSequential().interpolator(d3.interpolateGreens);

    vis.xScale = d3.scaleBand().range([0, vis.config.width]).paddingInner(0.2);

    vis.yScale = d3.scaleBand().range([0, vis.config.height]).paddingInner(0.2);

    // Initialize x-axis
    vis.xAxis = d3.axisBottom(vis.xScale).ticks(6).tickSize(0).tickPadding(10);

    // Append empty x-axis group and move it to the bottom of the chart
    vis.xAxisG = vis.chartArea
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${vis.config.height})`);

    // Legend
    vis.legend = vis.svg
      .append("g")
      .attr(
        "transform",
        `translate(${
          vis.config.containerWidth - vis.config.legendWidth - vis.config.margin.right
        },0)`
      );

    vis.legendColorGradient = vis.legend
      .append("defs")
      .append("linearGradient")
      .attr("id", "linear-gradient");

    vis.legendColorRamp = vis.legend
      .append("rect")
      .attr("width", vis.config.legendWidth)
      .attr("height", vis.config.legendBarHeight)
      .attr("fill", "url(#linear-gradient)");

    vis.xLegendScale = d3.scaleLinear().range([0, vis.config.legendWidth]);

    vis.xLegendAxis = d3
      .axisBottom(vis.xLegendScale)
      .tickSize(vis.config.legendBarHeight + 3)
      .tickFormat(d3.format("d"));

    vis.xLegendAxisG = vis.legend.append("g").attr("class", "axis x-axis legend-axis");

    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    const vis = this;

    vis.investorData = getTopInvestors(
      vis.companyData,
      vis.investmentData,
      vis.config.maxInvestorCount
    );

    vis.investorData.forEach((investor) => {
      investor.industryCounts = vis.getIndustryCounts(investor.investedCompanies);
    });

    // Specify accessor functions
    vis.xValue = (d) => d.industry;
    vis.colorValue = (d) => d.count;

    // investor name
    vis.yValue = (d) => d.id;

    // Set the scale input domains
    vis.xScale.domain(industries);
    vis.yScale.domain(vis.investorData.map(vis.yValue));
    vis.colorScale.domain([1, 15]);

    vis.renderVis();
    vis.renderLegend();
  }

  /**
   * Bind data to visual elements.
   */
  renderVis() {
    const vis = this;

    // 1. Level: rows
    const row = vis.chart.selectAll(".h-row").data(vis.investorData, (d) => d.id);

    // Enter
    const rowEnter = row
      .enter()
      .append("g")
      .attr("class", "h-row")
      .text((d) => d.id);

    // Enter + update
    rowEnter
      .merge(row)
      .transition()
      .duration(1000)
      .attr("transform", (d) => `translate(0,${vis.yScale(vis.yValue(d))})`);

    // Exit
    row.exit().remove();

    // Append row label (y-axis)
    rowEnter
      .append("text")
      .attr("class", "h-label")
      .attr("text-anchor", "end")
      .attr("dy", "0.85em")
      .attr("x", -8)
      .text(vis.yValue);

    // 2. Level: columns

    // 2a) Actual cells
    const cell = row
      .merge(rowEnter)
      .selectAll(".h-cell")
      .data((d) => d.industryCounts);

    // Enter
    const cellEnter = cell.enter().append("rect").attr("class", "h-cell");

    // Enter + update
    cellEnter
      .merge(cell)
      .attr("height", vis.yScale.bandwidth())
      .attr("width", "25")
      .attr("x", (d) => vis.xScale(vis.xValue(d)))
      .attr("fill", (d) => {
        if (d.count === 0 || d.count === null) {
          return "#fff";
        } else {
          return vis.colorScale(vis.colorValue(d));
        }
      })
      .text((d) => d.industry)
      .on("mouseover", (event, d) => {
        vis.dispatcher.call("showHeatmapTooltip", event, d, event.pageX, event.pageY);
      })
      .on("mousemove", (event) => {
        vis.dispatcher.call("moveTooltip", event, event.pageX, event.pageY);
      })
      .on("mouseleave", (event) => {
        vis.dispatcher.call("hideTooltip", event);
      });

    // Update axis
    vis.xAxisG
      .call(vis.xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("transform", "rotate(-25)");
  }

  /**
   * Update colour legend
   */
  renderLegend() {
    const vis = this;

    // Add stops to the gradient
    // Learn more about gradients: https://www.visualcinnamon.com/2016/05/smooth-color-legend-d3-svg-gradient
    vis.legendColorGradient
      .selectAll("stop")
      .data(vis.colorScale.range())
      .join("stop")
      .attr("offset", (d, i) => i / (vis.colorScale.range().length - 1))
      .attr("stop-color", (d) => d);

    // Set x-scale and reuse colour-scale because they share the same domain
    // Round values using `nice()` to make them easier to read.
    vis.xLegendScale.domain(vis.colorScale.domain()).nice();
    const extent = vis.xLegendScale.domain();

    // Manually calculate tick values
    vis.xLegendAxis.tickValues([extent[0], extent[1] / 3, (extent[1] / 3) * 2, extent[1]]);

    // Update legend axis
    vis.xLegendAxisG.call(vis.xLegendAxis);
  }

  // Process a list of companies into a list of industries and counts
  getIndustryCounts(companies) {
    const counts = {};
    for (let industry of industries) {
      counts[industry] = { industry, count: 0 };
    }
    for (let company of companies) {
      counts[company.industry].count++;
    }
    return Object.values(counts);
  }
}
