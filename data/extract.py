import requests
from bs4 import BeautifulSoup
from warnings import warn
import csv

"""
This script extracts a dataset of unicorn companies from a local copy of the page
https://www.cbinsights.com/research-unicorn-companies downloaded and manually cleaned on April 4, 2023.
"""


def scrape_main(html: str):
    """
    Builds the dataset of unicorn companies from the main page (with the table of unicorn companies).
    Returns an array of rows, where each row is an array of fields corresponding to a unicorn.
    """
    soup = BeautifulSoup(html, 'html.parser')
    tbody = soup.find("table").find("tbody")

    # Extract rows of the main table, including links to individual company pages
    results = []
    company_page_links = []
    for row in tbody.find_all("tr"):
        values = [cell.text.strip() for cell in row.find_all("td")]
        link = row.find("a")["href"]

        results.append(values)
        company_page_links.append(link)

    # Many links to company pages are incorrect, so we manually correct them here
    links_replace = {
        "Hopin": "https://www.cbinsights.com/company/hopin-2",
        "Scale AI": "https://www.cbinsights.com/company/scale-ai",
        "Ola Cabs": "https://www.cbinsights.com/company/ola-cabs",
        "CRED": "https://www.cbinsights.com/company/cred-3",
        "Better.com": "https://www.cbinsights.com/company/bettercom",
        "Moon Active": "https://www.cbinsights.com/company/moon-active",
        "Monzo": "https://www.cbinsights.com/company/monzo",
        "Vuori": "https://www.cbinsights.com/company/vuori",
        "Articulate": "https://www.cbinsights.com/company/articulate-1",
        "Indigo Ag": "https://www.cbinsights.com/company/indigo-ag",
        "Retool": "https://www.cbinsights.com/company/retool",
        "Sky Mavis": "https://www.cbinsights.com/company/sky-mavis",
        "Remote": "https://www.cbinsights.com/company/remote-1",
        "Vercel": "https://www.cbinsights.com/company/vercel",
        "Paxos": "https://www.cbinsights.com/company/paxos",
        "BitSight Technologies": "https://www.cbinsights.com/company/bitsight-technologies",
        "G7 Networks": "https://www.cbinsights.com/company/g7-networks",
        "ReCharge": "https://www.cbinsights.com/company/recharge-2",
        "Ethos": "https://www.cbinsights.com/company/ethos-technologies",
        "21.co": "https://www.cbinsights.com/company/21e6",
        "MX": "https://www.cbinsights.com/company/mx",
        "Multiverse": "https://www.cbinsights.com/company/multiverse-4",
        "Wave": "https://www.cbinsights.com/company/wave-11",
        "Vanta": "https://www.cbinsights.com/investor/vanta",
        "bolttech": "https://www.cbinsights.com/investor/bolttech-1",
        "Boba": "https://www.cbinsights.com/company/boba-1",
        "Yidian Zixun": "https://www.cbinsights.com/company/yidian-zixun",
        "Coda": "https://www.cbinsights.com/company/coda-project",
        "GupShup": "https://www.cbinsights.com/company/gupshup",
        "Panther Labs": "https://www.cbinsights.com/company/panther-labs",
        "Neon": "https://www.cbinsights.com/company/neon-pagamentos",
        "Island": "https://www.cbinsights.com/company/island-2",
        "Fair": "https://www.cbinsights.com/company/fair-4",
        "Public": "https://www.cbinsights.com/company/publicdotcom",
        "Pilot.com": "https://www.cbinsights.com/company/pilotcom",
        "Elemy": "https://www.cbinsights.com/company/elemy-1",
        "Zego": "https://www.cbinsights.com/company/zego-3",
        "People.ai": "https://www.cbinsights.com/company/peopleai",
        "REEF Technology": "https://www.cbinsights.com/company/reef-technology",
        "Printful": "https://www.cbinsights.com/company/printful-1",
        "Thirty Madison": "https://www.cbinsights.com/company/thirty-madison-1",
        "Pantheon": "https://www.cbinsights.com/company/pantheon-systems",
        "Mammoth Biosciences": "https://www.cbinsights.com/company/mammoth-biosciences",
        "Orchard": "https://www.cbinsights.com/company/orchard-2",
        "PandaDoc": "https://www.cbinsights.com/company/quote-roller",
        "Heyday": "https://www.cbinsights.com/company/heyday-3",
        "Watershed": "https://www.cbinsights.com/company/watershed-climate",
        "Open": "https://www.cbinsights.com/company/bank-open",
    }

    # Some companies do not have CB Insights pages, so we manually fill in the rows via an Internet search
    manual_fields = {
        # Citation: https://www.builtinsf.com/2022/01/19/lattice-raises-175m-3b-valuation-hiring-HR-software-unicorn
        "Lattice": [
            "2013",
            "$329.3M",
            None,
            "https://lattice.com/",
            "The Lattice platform offers enterprise teams a comprehensive view of their performance management, "
            "employee engagement, development and growth metrics. The platform’s real-time analytical tools provide "
            "HR leaders with a live look at employee attitudes in relation to company-wide initiatives and policies. "
        ],
        # Citation: https://www.crunchbase.com/organization/ecoflow-tech
        "EcoFlow": [
            "2017",
            "$114.4M",
            None,
            "https://www.ecoflow.com/",
            "EcoFlow provides designs, develops and manufactures eco-friendly and affordable portable power stations "
            "for personal and professional use.",
        ],
        # Citation: https://www.failory.com/startups/china-unicorns
        "Keep": [
            "2014",
            "$614.49M",
            None,
            "https://www.gotokeep.com/",
            "Keep is a mobile fitness community that offers free training programs and personalized advice for "
            "individuals of varying experience levels.",
        ],
    }

    # Retrieve company pages one at a time and either populate fields from pages or manual replacement
    for i in range(len(company_page_links)):
        fields = results[i]
        company_name = fields[0]

        # There are two companies named Fabric, and one has a bad URL, so replace it here
        if company_name == "Fabric" and fields[4] == "New York":
            link = "https://www.cbinsights.com/company/fabric-3"
        else:
            link = None if company_name in manual_fields else (
                links_replace[company_name] if company_name in links_replace else company_page_links[i]
            )

        if link is None:
            # Retrieve manually populated fields
            remaining_fields = manual_fields[company_name]
        else:
            # Retrieve fields from company page
            remaining_fields = read_subpage(link)

        fields.extend(remaining_fields)
        print(f"{i + 1}: {fields}")

    return results


def read_subpage(url: str):
    """
    Attempts to extract fields from a CB Insights company page (e.g. https://www.cbinsights.com/company/bytedance)
    If the request fails, returns an array of the same size with all empty values.
    """

    # Get page contents
    response = requests.get(url)
    if response.status_code != 200:
        warn(f"Warning: page not found for url {url}")
        return [None, None, None, None, None]

    soup = BeautifulSoup(response.text, 'html.parser')

    # Extract values in the Overview section
    overview_section = soup.find(attrs={"data-test": "overview-kpi"})

    def get_overview_value(val_name):
        if overview_section is None:
            return None
        title = overview_section.find("h2", string=val_name)
        return title.parent.span.text if title is not None else None

    founded_year = get_overview_value("Founded Year")
    total_raised = get_overview_value("Total Raised")
    financial_stage = get_overview_value("Stage")

    # Extract values in the About section
    description_para = soup.find(attrs={"data-test": "description"}).text

    website_parent = soup.find(class_="Header_companyBasicInfo__oWTSL") or \
                     soup.find(class_="Header_basic_info__AJ16J")
    website_link = website_parent.a["href"] if website_parent is not None else None

    return [founded_year, total_raised, financial_stage, website_link, description_para]


if __name__ == '__main__':
    with open("The Complete List Of Unicorn Companies.html", mode="r") as html_file, \
            open("Unicorn_Companies.csv", mode="w") as csv_out:
        contents = html_file.read()
        rows = scrape_main(contents)

        writer = csv.writer(csv_out, delimiter=',', quotechar='"')

        # Write headers
        writer.writerow(
            ["Company", "Valuation", "Date Joined", "Country", "City", "Industry", "Select Investors", "Founded Year",
             "Total Raised", "Financial Stage", "Website", "Description"])

        # Write CSV rows
        writer.writerows(rows)
