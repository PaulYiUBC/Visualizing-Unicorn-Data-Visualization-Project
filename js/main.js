// References to filtering controls
let legend, slider;

// References to visualization objects
let scatterplot, heatmap, networkVis, stackedAreaChart, choroplethMap;

// Global company data for filtering
let companyData;

// Global vis configurations
const globalConfig = {
  tooltipElement: "#tooltip",
  tooltipPadding: 10,
};

// Global industries array
// Citation: colour scheme derived from brewerPlus
//           (https://david-barnett.github.io/microViz/reference/distinct_palette.html)
const industryColours = {
  ["Fintech"]: "#e15b97",
  ["Internet software & services"]: "#83d5af",
  ["E-commerce & direct-to-consumer"]: "#e8825a",
  ["Artificial intelligence"]: "#718fcc",
  ["Health"]: "#d5ae68",
  ["Supply chain, logistics, & delivery"]: "#7f4a88",
  ["Cybersecurity"]: "#6d8a42",
  ["Data management & analytics"]: "#cba1d5",
  ["Mobile & telecommunications"]: "#8f5441",
  ["Hardware"]: "#7cb3cb",
  ["Auto & transportation"]: "#7a7475",
  ["Edtech"]: "#d3c4a8",
  ["Consumer & retail"]: "#c17e7f",
  ["Travel"]: "#f1f17f",
  ["Other"]: "#c5c4c3",
};

const industries = Object.keys(industryColours);
const colourScheme = Object.values(industryColours);

// Global filters
const selectedIndustries = new Set(industries);
let selectedYearRange;

// Global dispatcher
const dispatcher = d3.dispatch(
  "toggleIndustry",
  "updateYearFilter",
  "showCompanyTooltip",
  "showInvestorTooltip",
  "showHeatmapTooltip",
  "showMapTooltip",
  "moveTooltip",
  "hideTooltip",
  "toggleSelectedItem",
  "selectItem",
  "clearSelectedItem"
);

// ID of currently selected item
let selectedItemId = null;

Promise.all([
  d3.csv("data/Unicorn_Companies_clean.csv"),
  d3.csv("data/Unicorn_Companies_investments.csv"),
  d3.json("data/geo-world.json"),
]).then(([_companyData, investmentData, geoData]) => {
  _companyData.forEach((d) => {
    // Convert numeric/date columns
    d.date_joined = new Date(d.date_joined);
    d.founded_year = +d.founded_year;
    d.valuation = +d.valuation;
    d.valuationBillions = d.valuation / 1000000000;
    d.total_raised = d.total_raised === "" ? null : +d.total_raised;
    d.roi = d.roi === "" ? null : +d.roi;

    // Merge non-included industries with the "Other" category
    d.industry = industries.includes(d.industry) ? d.industry : "Other";
  });

  // Store full dataset before any filtering
  companyData = _companyData;

  // Set min and max year range in the dataset
  selectedYearRange = d3.extent(companyData.map((d) => d.date_joined.getFullYear()));

  // Create visualizations
  scatterplot = new Scatterplot(
    {
      parentElement: "#scatterplot",
    },
    companyData,
    dispatcher
  );

  heatmap = new Heatmap(
    {
      parentElement: "#heatmap",
    },
    companyData,
    investmentData,
    dispatcher
  );

  networkVis = new ForceDirectedGraph(
    {
      parentElement: "#network-vis",
    },
    companyData,
    investmentData,
    dispatcher
  );

  slider = new ScentedSlider(
    {
      parentElement: "#slider",
      startYearElement: "#start-year",
      endYearElement: "#end-year",
      defaultYearRange: selectedYearRange,
    },
    companyData,
    dispatcher
  );

  legend = new Legend(dispatcher);

  stackedAreaChart = new StackedAreaChart(
    {
      parentElement: "#stacked-area-vis",
    },
    companyData,
    dispatcher
  );

  //keep getting error here; syntax and load resource errors
   choroplethMap = new ChoroplethMap(
      {
        parentElement: "#choropleth-map",
      },
      geoData,
      companyData,
      dispatcher
  );
  // geoMap = new GeoMap(
  //     {
  //       parentElement: "#geo-map",
  //     },
  //     geoData,
  //     companyData,
  //     dispatcher
  // );

});

// Update visualizations that react to company filters
function filterCompaniesAndRedraw() {
  // Clear selected item when filters change
  selectedItemId = null;

  // Compute filtered data
  const filteredCompanies = companyData.filter(
    (d) =>
      selectedIndustries.has(d.industry) &&
      d.date_joined.getFullYear() >= selectedYearRange[0] &&
      d.date_joined.getFullYear() <= selectedYearRange[1]
  );

  // Update visualizations with new data
  scatterplot.data = filteredCompanies;
  scatterplot.updateVis();

  heatmap.companyData = filteredCompanies;
  heatmap.updateVis();

  networkVis.updateVis("filter");
}

// Select an item (company or investor) by ID in the scatterplot and network vis
dispatcher.on("selectItem", (id) => select(id));

function select(id) {
  selectedItemId = id;
  scatterplot.updateVis();
  networkVis.updateVis();
  choroplethMap.updateVis()
}

// Clear the current selections in the scatterplot and network vis
dispatcher.on("clearSelectedItem", clearSelection);

function clearSelection() {
  selectedItemId = null;
  scatterplot.updateVis();
  networkVis.updateVis();
  choroplethMap.updateVis();
}

// Toggle the currently selected item in the scatterplot and network vis
dispatcher.on("toggleSelectedItem", (id) => {
  if (selectedItemId === id) {
    clearSelection();
  } else {
    select(id);
  }
});

// Handle changes to the global industry filter
dispatcher.on("toggleIndustry", (industry) => {
  if (selectedIndustries.has(industry)) {
    selectedIndustries.delete(industry);
  } else {
    selectedIndustries.add(industry);
  }

  stackedAreaChart.updateVis(selectedIndustries);
  choroplethMap.updateVis(selectedIndustries);
  legend.renderLegend();

  filterCompaniesAndRedraw();
});

// Handle changes to the global year joined filter
dispatcher.on("updateYearFilter", (yearRange) => {
  selectedYearRange = yearRange;
  stackedAreaChart.updateVis();
  choroplethMap.updateVis(selectedIndustries);
  filterCompaniesAndRedraw();
});

// Handlers for populating, repositioning, and closing tooltip
dispatcher.on("showCompanyTooltip", (d, pageX, pageY) => {
  const formatter = d3.format(".2~f");
  const valuation = formatter(d.valuationBillions);
  const roi = formatter(d.roi);

  // Helper function to extract the first sentence from a string (company description)
  // Citation: regex is copied from https://stackoverflow.com/a/3788288
  const firstSentenceRegex = /^(.*?)[.?!]\s/;
  const firstSentence = (text) => {
    const match = text.match(firstSentenceRegex);
    return match ? match[0] : text;
  };

  // Helper function to remove the protocol from a URL
  // Citation: regex is copied from https://stackoverflow.com/a/8206299
  const urlBody = (url) => {
    return url.replace(/(^\w+:|^)\/\//, "");
  };

  d3
    .select(globalConfig.tooltipElement)
    .style("display", "block")
    .style("left", pageX + globalConfig.tooltipPadding + "px")
    .style("top", pageY + globalConfig.tooltipPadding + "px").html(`
      <div class="tooltip-title">
        ${d.company_name}
        (<a href="${d.website}">${urlBody(d.website)}</a>)
      </div>
      <p>${firstSentence(d.description)}</p>
      <ul>
        <li>Valuation: $${valuation} billion</li>
        <li>Return on Investment: ${roi}</li>
        <li>Origin: ${d.city}, ${d.country}</li>
        <li>Industry: ${d.industry}</li>
      </ul>
    `);
});

dispatcher.on("showInvestorTooltip", (d, pageX, pageY) => {
  d3
    .select(globalConfig.tooltipElement)
    .style("display", "block")
    .style("left", pageX + globalConfig.tooltipPadding + "px")
    .style("top", pageY + globalConfig.tooltipPadding + "px").html(`
      <div class="tooltip-title">${d.id}</div>
      <div>${d.investedCompanies.size} investments in filtered companies</div>
    `);
});

dispatcher.on("showHeatmapTooltip", (d, pageX, pageY) => {
  d3
    .select(globalConfig.tooltipElement)
    .style("display", "block")
    .style("left", pageX + globalConfig.tooltipPadding + "px")
    .style("top", pageY + globalConfig.tooltipPadding + "px").html(`
      <div class="tooltip-title">${d.industry}</div>
      <div>Company count: ${d.count}</div>
    `);
});

dispatcher.on("showMapTooltip", (d, pageX, pageY) => {
  d3.select(globalConfig.tooltipElement)
      .style("display", "block")
      .style("left", pageX + globalConfig.tooltipPadding + "px")
      .style("top", pageY + globalConfig.tooltipPadding + "px").html(`
      <div class="tooltip-title">${d[d.type]}</div>
      <ul>
      <li># of Unicorns: ${d.count}</li>
      <li>Total Valuation: ${d3.format("$~s")(d.totalValuation)}</li>
      <li>Leading Industry: ${d.leadingIndustry}</li>
    </ul>
      `);
});


dispatcher.on("moveTooltip", (pageX, pageY) => {
  d3.select(globalConfig.tooltipElement)
    .style("left", pageX + globalConfig.tooltipPadding + "px")
    .style("top", pageY + globalConfig.tooltipPadding + "px");
});

dispatcher.on("hideTooltip", () => {
  d3.select(globalConfig.tooltipElement).style("display", "none");
});
