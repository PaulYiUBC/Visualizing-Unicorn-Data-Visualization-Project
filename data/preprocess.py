import csv
import re


def clean_valuation(valuation_str: str):
    """
    Process the Valuation column: remove "$"s at the start and convert billions of dollars to dollars
    """
    number_part = valuation_str[1:]
    one_billion = 1000000000
    try:
        return int(float(number_part) * one_billion)
    except ValueError:
        return None


def clean_year(year_str: str):
    """
    Process the Founded Year column: convert all non-number values to blank cells
    """
    try:
        return int(year_str)
    except ValueError:
        return None


def clean_total_raised(total_raised_str: str):
    """
    Process the Total Raised column: remove "$"s at the start and convert various units (e.g. "50M", "2.3B") to dollars
    """
    if total_raised_str is None or len(total_raised_str) == 0:
        return None

    units = {
        "K": 1000,
        "M": 1000000,
        "B": 1000000000,
    }
    number_part = total_raised_str[1:-1]
    unit_part = total_raised_str[-1]
    try:
        return int(float(number_part) * units[unit_part])
    except ValueError:
        return None


def compute_roi(valuation: int, total_raised: int):
    """
    Calculate the Return on Investment (ROI) column from the Valuation and Total Raised columns
    """
    return valuation / total_raised if total_raised is not None and total_raised > 0 else None


def clean_investor_name(name: str):
    """
    Process the Investor column: merge duplicate/misspelled/etc investor names according to manual cleaning
    """
    to_replace = {
        "BDC Venture Capital": "BDC Capital",
        "Bond": "BOND",
        "CVS Health Partners": "CVS Health",
        "Dila Capital": "DILA Capital",
        "Emergence Capital Partners": "Emergence Capital",
        "China Everbright Investment Management": "China Everbright Limited",
        "FTX Venture": "FTX Ventures",
        "Georgian": "Georgian Partners",
        "Longfor Capitalm": "Longfor Capital",
        "Matrix Partmers": "Matrix Partners",
    }

    return to_replace[name] if name in to_replace else name


if __name__ == "__main__":
    with open("Unicorn_Companies.csv", mode="r") as csv_in,\
            open("Unicorn_Companies_clean.csv", mode="w") as csv_out_main,\
            open("Unicorn_Companies_investments.csv", mode="w") as csv_out_network:

        reader = csv.reader(csv_in, delimiter=',', quotechar='"')
        writer_main = csv.writer(csv_out_main, delimiter=',', quotechar='"')
        writer_network = csv.writer(csv_out_network, delimiter=',', quotechar='"')

        # Skip header row
        next(reader)

        # Write headers
        writer_main.writerow(["id", "company_name", "valuation", "date_joined", "country", "city", "industry",
                              "founded_year", "total_raised", "website", "description", "roi"])
        writer_network.writerow(["investor_id", "company_id"])

        company_id = 1
        for row in reader:
            row_out = [
                company_id,                         # Artificial unique ID; since companies have duplicate names
                row[0],                             # Company name
                clean_valuation(row[1]),            # Valuation
                row[2],                             # Date Joined
                row[3],                             # Country
                row[4],                             # City
                row[5],                             # Industry
                clean_year(row[7]),                 # Founded Year
                clean_total_raised(row[8]),         # Total Raised
                row[10],                            # Website URL
                row[11]                             # Description
            ]

            # Derive Return on Investment (ROI) column
            row_out.append(compute_roi(row_out[2], row_out[8]))

            # Write cleaned company data to main file
            writer_main.writerow(row_out)

            if row[6] is not None:
                # Write investment relationships to network file
                investors = [s.strip() for s in re.split(",+", row[6])]
                for investor in investors:
                    writer_network.writerow([
                        clean_investor_name(investor),  # Investor name
                        company_id,                     # Company ID
                    ])

            company_id += 1
