class ChoroplethMap {
  /**
   * Class constructor with basic configuration
   */
  constructor(_config,  _geoData, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 800,
      containerHeight: _config.containerHeight || 400,
      margin: _config.margin || {top: 0, right: 0, bottom: 0, left: 0},
      tooltipPadding: 10,
    };
    //
    // TODO Preprocess data into clear city, country variables
    this.geoData = _geoData;

    //handing data filtering error
    this.data = _data;

    //From applyfilters
    this.allData = _data;

    this.dispatcher = _dispatcher;

    this.initVis();
  }


  // TO DO:
  // create data filtering (must do) - done
  // complete tool tip (must do) - done
  // set css style file (stretch) - Yeram covered it
  // connect to global filtering (must do) - done
  // try to connect bidirectional link to another vis (stretch?)


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
  }
    // .map((d) => d.id)
    // );
    //everything is being filtered out

    // Keep only investments involving companies that remain
    //  vis.investmentData = vis.allInvestmentData.filter((d) => toKeep.has(d.company_id));
    // vis.data = vis.data.filter((d) => toKeep.has(d.id));
  //}

  /**
   * We initialize scales/axes and append static elements, such as axis titles.
   */
  initVis() {
    let vis = this;

    // Calculate inner chart size. Margin specifies the space around the actual chart.
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // Define size of SVG drawing area
    vis.svg = d3
        .select(vis.config.parentElement)
        .append("svg")
        .attr("width", vis.config.containerWidth)
        .attr("height", vis.config.containerHeight)
        //this code block from scatterplot and network viz
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

    // Defines the scale and translate of the projection so that the geometry fits within the SVG area
    vis.projection = d3
        .geoMercator()
        // set centre to further North
        .center([0, 25])
        // scale to fit size of svg group
        .scale([vis.width / (2 * Math.PI)])
        // center within svg group
        .translate([vis.width / 2, vis.height / 2]);

    vis.geoPath = d3.geoPath().projection(vis.projection);

    //vis.symbolScale = d3.scaleSqrt().range([4, 25]);


    //add colour styling
    const countExt = d3.extent(vis.getFilteredData(), (d) => d[1].count);
    const colorScale = d3.scaleSqrt().domain(countExt).nice().range([0, 1]);
    vis.color = (value) => d3.interpolateReds(colorScale(value));

    vis.updateVis();
  }

  //error in main related to empty array
  updateVis(filters) {
    let vis = this;

    vis.applyFilters();
    //this.data = this.getFilteredData(vis.data);


    //vis.symbolScale.domain(d3.extent(vis.data, (d) => d.visitors));
    const data = vis.getFilteredData(filters);

    vis.geoData.features.forEach(
        (feature) => (feature.properties.data = data.get(feature.id))
    );

    //vis.data.forEach((d) => {
    //d.showLabel = d.name == "Chichen Itza" || d.name == "Great Wall";
    // });


    vis.renderVis();
  }

  // TA notes on trying to tackle-complete bidirectional map linkage
//separate method
//separate country
//map company id to country id
// highlight country in map
  //deselect method**
    //deselect everything
    //if country has charged
    //select desired country id


  renderVis() {
    const vis = this;

    const country = vis.chart
        .selectAll("path.country")
        .data(vis.geoData.features, (d) => d.id);
    const countryEnter = country
        .enter()
        .append("path")
        .attr("class", "country")
        .classed("selected", (d) => d.id === selectedItemId);
    const countryUpdate = country.merge(countryEnter);
    country.exit().remove();

    countryEnter.attr("d", vis.geoPath);

    countryUpdate.attr("stroke", "white")
        .style("fill", (d) => d.properties.data ? vis.color(d.properties.data.count) : "lightgray");

    //tooltip for choropleth viz
    countryUpdate.on("mouseover", (event, d) => {
      if (d.properties.data)
        vis.dispatcher.call("showMapTooltip", event,
            {
              type: "country",
              ...d.properties.data,
            }, event.pageX, event.pageY);
    })

        .on("mousemove", (event, d) => {
          if (d.properties.data)
            vis.dispatcher.call("moveTooltip", event, event.pageX, event.pageY);
        })

        .on("mouseleave", (event, d) => {
          if (d.properties.data) vis.dispatcher.call("hideTooltip", event);
        });


    //code block from network and scattered plot viz
    // Handle clicks on nodes - select or deselect the item across views.
    // This will highlight / de-highlight the one-hop neighbours of the selected node.
    country.on("click", function (event, d) {
      // Prevent svg click handler from detecting a background click
      event.preventDefault();

      vis.dispatcher.call("toggleSelectedItem", event, d.id);
    });
  }


    //Process and filter data
  getFilteredData(filters = {}) {
    const vis = this;
    const {dateRange, selectedIndustries} = filters;

    const isEarlierThan = (a, b) => a.getTime() <= b.getTime();

    const isInDateRange = (d) =>
        dateRange ? isEarlierThan(dateRange[0], d.date_joined) && isEarlierThan(d.date_joined, dateRange[1]) : true;

    const isInSelectedIndustries = (d) =>
        selectedIndustries ? selectedIndustries.has(d.industry) : true;

    const dataSelected = vis.data.filter((d) => isInDateRange(d) && isInSelectedIndustries(d));

    // need to rollup sorted array
    return d3.rollup(
        dataSelected,
        (data) => {
          const industries = d3.rollups (data, (v) => d3.sum(v, (d) => d.valuation), (d) => d.industry);

          const leadingIndustry = d3.greatest(industries, (d) => d[1])[0];

          return {
            country_code: data[0].country_code,
            country: data[0].country,
            count: data.length,
            totalValuation: d3.sum(data, (d) => d.valuation),
            leadingIndustry,
            data,
          };
        },
        (d) => d.country_code
    );
  }

}


