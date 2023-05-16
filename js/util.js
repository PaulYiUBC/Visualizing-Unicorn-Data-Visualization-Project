/**
 * Utility functions
 */

// Convert a list of objects to a map from an object's ID to the object.
function listToMap(list, idAttr = "id") {
  const map = {};
  for (let item of list) {
    map[item[idAttr]] = item;
  }
  return map;
}

// Derive dataset of investors from dataset of companies and investments.
// Used by heatmap and force-directed graph.
// If investmentData contains companies that are not present in companyData, they will be ignored.
function getTopInvestors(companyData, investmentData, returnCount = 10) {
  const companyMap = listToMap(companyData);
  const validInvestments = investmentData.filter((d) => d.company_id in companyMap);

  // Build a list of all investors
  const investorData = {};
  for (let investment of validInvestments) {
    if (!(investment.investor_id in investorData)) {
      investorData[investment.investor_id] = {
        id: investment.investor_id,
        investedCompanies: new Set(),
      };
    }
    investorData[investment.investor_id].investedCompanies.add(companyMap[investment.company_id]);
  }

  // Sort investors in descending order of # investments and take top returnCount
  return Object.values(investorData)
    .sort((i1, i2) => {
      if (i1.investedCompanies.size === i2.investedCompanies.size) {
        return 0;
      } else if (i1.investedCompanies.size > i2.investedCompanies.size) {
        return -1;
      } else {
        return 1;
      }
    })
    .slice(0, returnCount);
}
