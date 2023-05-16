class StackedAreaChart {
  /**
   * Class constructor with basic configuration
   */
  constructor(_config, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 600,
      containerHeight: _config.containerHeight || 400,
      margin: _config.margin || { top: 25, right: 20, bottom: 20, left: 35 },
      tooltipPadding: 10,
    };
    //

    // process the cleaned data from - April 5th branch
    this.allData = _data;

    //sug
    // note: keep a copy of all the data
    this.dispatcher = _dispatcher;
    this.initVis();
  }

  /**
   * Compute filtered data based on global industry and year joined filters.
   */
  applyFilters() {
    let vis = this;
    // Keep only companies belonging to the selected industries and year range

    vis.data = vis.allData
            .filter(
                (d) =>
                    selectedIndustries.has(d.industry) &&
                    d.date_joined.getFullYear() >= selectedYearRange[0] &&
                    d.date_joined.getFullYear() <= selectedYearRange[1]
            );
           // .map((d) => d.id)
   // );
    //everything is being filtered out

    // Keep only investments involving companies that remain
  //  vis.investmentData = vis.allInvestmentData.filter((d) => toKeep.has(d.company_id));
   // vis.data = vis.data.filter((d) => toKeep.has(d.id));
  }


  /**
   * We initialize scales/axes and append static elements, such as axis titles.
   */
  initVis() {
    let vis = this;

    // Calculate inner chart size. Margin specifies the space around the actual chart.
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    const container = d3.select(vis.config.parentElement).classed("chart-wrapper", true);

    //set colour scale for chart
    vis.color = d3.scaleOrdinal().domain(industries).range(colourScheme);

    // TO DO create a legend for stacked area graph
    // vis.legend(container);

    // Define size of SVG drawing area
    // vis.svg = d3 // error
    vis.svg = container
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

    // Append group element that will contain our actual chart
    // and position it according to the given margin config
    vis.chartArea = vis.svg
      .append("g")
      .attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    //initialize scales and scale function year value to x coordinate
    vis.xScale = d3
      .scaleTime()
      //.domain(d3.extent(vis.data, (d) => d.date))
      .range([0, vis.width]);

    //scale function year value to y coordinate
    vis.yScale = d3.scaleLinear().range([vis.height, 0]);

    //append y axis
    vis.yAxis = vis.chartArea.append("g").attr("class", "y-axis");
    //append x axis
    vis.xAxis = vis.chartArea
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(${0},${vis.height})`);

    //render axes
    vis.renderXAxis();
    vis.updateVis();
  }

  updateVis(selectedIndustries) {
    let vis = this;

    // Keep only companies matching global filters such as year
    vis.applyFilters();
    this.data = this.dataProcess(vis.data);



    vis.xScale
        .domain(d3.extent(vis.data, (d) => d.date));

    vis.renderData = d3
      .stack()
      .keys(industries.filter((f) => (selectedIndustries ? selectedIndustries.has(f) : true)))
      .value((d, key) => d[key]?.length ?? 0)(vis.data);

    // set the scale input domains
    let yDomain = d3.extent(vis.renderData.flat().flat());
    if (yDomain.every((d) => d !== undefined)) {
      vis.yScale.domain(yDomain);
    }
    vis.renderYAxis();
    vis.renderXAxis();
    vis.renderVis();
  }

  renderVis() {
    let vis = this;

    const area = vis.chartArea.selectAll("path.area").data(vis.renderData, (d) => d.key);
    const areaEnter = area.enter().append("path").attr("class", "area");
    const areaUpdate = area.merge(areaEnter);
    area.exit().remove();

    areaEnter.attr("fill", (d) => vis.color(d.key));

    areaUpdate.attr(
      "d",
      d3
        .area()
        .x((d) => vis.xScale(d.data.date))
        .y0((d) => vis.yScale(d[0]))
        .y1((d) => vis.yScale(d[1]))
    );
  }

  renderXAxis() {
    const vis = this;

    //create x-axis function
    const axis = d3.axisBottom(vis.xScale);

    //apply axis to group element vix.xAxis
    vis.xAxis.call(axis);

    //remove the default domain line
    vis.xAxis.select(".domain").remove();
  }
  renderYAxis() {
    const vis = this;

    //create y-axis function
    const axis = d3.axisLeft(vis.yScale).tickSize(-vis.width);

    //apply axis to group element vis.yAxis
    vis.yAxis.call(axis);

    vis.yAxis.select(".domain").remove();

    vis.yAxis
      .selectAll("text.label")
      .data([""])
      .join("text")
      .attr("class", "label")
      .attr("dominant-baseline", "auto")
      .attr("x", 5)
      .attr("y", -10)
      .text("# Companies");
  }

  legend(container) {
    const vis = this;
    const wrapper = container.append("div").attr("class", "legend");

    const item = wrapper.selectAll("span.legend-item").data(vis.color.domain(), (d) => d);
    const itemEnter = item.enter().append("span").attr("class", "legend-item");

    itemEnter
      .append("span")
      .attr("class", "symbol")
      .style("background-color", (d) => vis.color(d));

    itemEnter
      .append("span")
      .attr("class", "label")
      .text((d) => d);
  }

  // data processing to reduce array elements to company, year, and industry
  dataProcess(raw) {
    const data = d3
      .rollups(
        raw,
        (v) => {
          const date = v[0].date_joined;

          // reduce the filtered array to industry and data jointed
          return raw
            .filter((d) => d.date_joined.getTime() <= date.getTime())
            .reduce(
              (previous, current) => {
                if (previous[current.industry] === undefined || previous[current.industry] == null) {
            previous[current.industry] = [];
                }
                previous[current.industry].push(current);
                return previous;
              },
              { date }
            );
        },
        (d) => d.date_joined.getTime()
      )
      .map((d) => d[1]);

    //sort unicorns by ascending order based on date
    data.sort((a, b) => a.date.getTime() - b.date.getTime());

    return data;
  }
}


