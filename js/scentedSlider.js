class ScentedSlider {
  /**
   * Class constructor with basic chart configuration
   */
  constructor(_config, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      startYearElement: _config.startYearElement,
      endYearElement: _config.endYearElement,
      containerWidth: _config.containerWidth || 300,
      containerHeight: _config.containerHeight || 100,
      margin: _config.margin || { top: 2, right: 15, bottom: 15, left: 15 },
      defaultYearRange: _config.defaultYearRange,
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

    // Initialize scales
    vis.xScale = d3.scaleLinear().range([0, vis.width]);

    vis.yScale = d3.scaleLinear().range([vis.height, 0]);

    // Initialize axes
    vis.xAxis = d3
      .axisBottom(vis.xScale)
      .ticks(5)
      .tickSize(0)
      .tickPadding(5)
      .tickFormat((d) => d);

    // Define size of SVG drawing area
    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

    // Append group element that will contain our actual chart
    // and position it according to the given margin config
    vis.chart = vis.svg
      .append("g")
      .attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // Copy assignment to prevent unwanted side effects
    vis.yearRange = [...vis.config.defaultYearRange];

    // Get references to year input fields
    vis.startYearControl = d3
      .select(vis.config.startYearElement)
      .attr("min", vis.yearRange[0])
      .attr("max", vis.yearRange[1])
      .attr("value", vis.yearRange[0])
      .on("change", (event) => {
        vis.updateYearRange(event.target.value, 0);
        vis.updateBrush();
      });
    vis.endYearControl = d3
      .select(vis.config.endYearElement)
      .attr("min", vis.yearRange[0])
      .attr("max", vis.yearRange[1])
      .attr("value", vis.yearRange[1])
      .on("change", (event) => {
        vis.updateYearRange(event.target.value, 1);
        vis.updateBrush();
      });

    // Create brushing controls and append brush element
    vis.brush = d3
      .brushX()
      .extent([
        [0, 0],
        [vis.width, vis.height],
      ])
      .on("end", (event) => {
        if (event.sourceEvent) {
          // Only initiate update if the brush is triggered from user interaction - prevent infinite
          // loop, since this handler is called even if brushing is triggered programmatically
          if (event.selection === null) {
            vis.yearRange = [...vis.config.defaultYearRange];
          } else {
            vis.yearRange = event.selection.map((x) => Math.round(vis.xScale.invert(x)));
          }
          vis.updateBrush();
        }
      });
    vis.brushElement = vis.chart.append("g").attr("class", "brush").call(vis.brush);

    // Append area generator and area element
    vis.areaGenerator = d3.area();
    vis.areaElement = vis.chart.append("path").attr("class", "area");

    // Append empty x-axis group and move it to the bottom of the chart
    vis.xAxisG = vis.chart
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${vis.height})`);

    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;

    // Compute # unicorns joined per year
    vis.groupedData = d3.rollups(
      vis.data,
      (g) => g.length,
      (d) => d.date_joined.getFullYear()
    );

    // Specify accessor functions
    vis.xValue = (d) => d[0];
    vis.yValue = (d) => d[1];

    // Sort data by year
    vis.groupedData.sort((a, b) => {
      if (vis.xValue(a) === vis.xValue(b)) {
        return 0;
      } else if (vis.xValue(a) < vis.xValue(b)) {
        return -1;
      } else {
        return 1;
      }
    });

    // Set the scale input domains
    vis.xScale.domain(d3.extent(vis.groupedData.map((d) => vis.xValue(d))));
    vis.yScale.domain([0, d3.max(vis.groupedData.map((d) => vis.yValue(d)))]);

    // Update area generator
    // Citation: code snippet adapted from https://observablehq.com/@d3/area-chart
    vis.areaGenerator
      .x((d) => vis.xScale(vis.xValue(d)))
      .y0(vis.yScale(0))
      .y1((d) => vis.yScale(vis.yValue(d)));

    vis.renderVis();
  }

  /**
   * Bind data to visual elements.
   */
  renderVis() {
    let vis = this;

    // Render area
    vis.areaElement.attr("d", vis.areaGenerator(vis.groupedData));

    // Update the axis
    vis.xAxisG.call(vis.xAxis);
  }

  /**
   * Attempt to update vis.yearRange[index] with the (string) value year.
   */
  updateYearRange(year, index) {
    let vis = this;

    // Update year value if valid; otherwise use default value
    if (!year || year < vis.config.defaultYearRange[0] || year > vis.config.defaultYearRange[1]) {
      vis.yearRange[index] = vis.config.defaultYearRange[index];
    } else {
      vis.yearRange[index] = parseInt(year);
    }

    // Swap start/end years if they end up in the wrong order
    if (vis.yearRange[0] > vis.yearRange[1]) {
      const temp = vis.yearRange[0];
      vis.yearRange[0] = vis.yearRange[1];
      vis.yearRange[1] = temp;
    }
  }

  /**
   * Called after setting vis.yearRange; updates all controls and triggers a global filtering event.
   */
  updateBrush() {
    let vis = this;
    const [start, end] = vis.yearRange;

    // Update start/end year input values, and dispatches a global filtering
    d3.select(vis.config.startYearElement).property("value", start);
    d3.select(vis.config.endYearElement).property("value", end);

    // Smoothly snap brush to the exact years
    // Citation: this solution is documented in https://gist.github.com/mbostock/6232537
    if (start === vis.config.defaultYearRange[0] && end === vis.config.defaultYearRange[1]) {
      vis.brushElement.call(vis.brush.clear);
    } else {
      vis.brushElement.transition(50).call(
        vis.brush.move,
        vis.yearRange.map((x) => vis.xScale(x))
      );
    }

    // Trigger global filtering event
    vis.dispatcher.call("updateYearFilter", null, vis.yearRange);
  }
}
