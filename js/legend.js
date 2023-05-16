class Legend {
  constructor(_dispatcher) {
    this.dispatcher = _dispatcher;
    this.initLegend();
  }

  initLegend() {
    const vis = this;

    vis.legend = d3.select("#legend");

    vis.renderLegend();
  }

  renderLegend() {
    const vis = this;

    const legendRows = vis.legend.selectAll(".row").data(industries);

    const legendRowsEnter = legendRows.enter().append("div").attr("class", "row");

    legendRowsEnter
      .append("input")
      .attr("id", (d) => d)
      .attr("type", "checkbox");

    legendRowsEnter
      .append("div")
      .attr("class", "swatch")
      .style("background-color", (d, i) => colourScheme[i]);

    legendRowsEnter
      .append("label")
      .text((d) => d)
      .attr("for", (d) => d);

    legendRows.merge(legendRowsEnter).classed("selected", (d) => selectedIndustries.has(d));

    legendRows
      .merge(legendRowsEnter)
      .selectAll("input")
      .property("checked", (d) => selectedIndustries.has(d))
      .on("change", function (event, d) {
        vis.dispatcher.call("toggleIndustry", event, d);
      });

    legendRows.exit().remove();
  }
}
