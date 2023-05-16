import pprint
import csv

"""
Script used in the process of manually correcting investors referred to by different names.

The script, when run, prints all investors in the investments dataset that have words in common
(case-insensitive). Common words like "ventures" and "capital" are removed for cleaner results.

You can then scan through the results and check if any investors sharing a word look like they
could be the same company, and search them to confirm.
"""

if __name__ == "__main__":
    with open("Unicorn_Companies_investments.csv", mode="r") as csv_in:
        reader = csv.reader(csv_in, delimiter=',', quotechar='"')

        # Skip header row
        next(reader)

        word_frequencies = {}
        for row in reader:
            investor_name = row[0]
            words = [s.lower() for s in investor_name.split(" ")]
            for word in words:
                if word in word_frequencies:
                    word_frequencies[word].add(investor_name)
                else:
                    word_frequencies[word] = {investor_name}

        # List of common words to remove (tested)
        common_words = {"&", "ventures", "venture", "the", "technologies", "technology", "strategic", "partners",
                        "management", "investors", "investments", "investment", "invest", "holdings", "holding",
                        "growth", "group", "fund", "equity", "bank", "corporation", "company", "collective", "capital",
                        "advisors", "asia", "asset", "associates", "china", "co.", "financial", "global", "india",
                        "industry", "innovation", "international", "israel", "japan", "of", "world", "and"}

        # Print all words that appear in more than 1 investor name
        word_frequencies = {k: v for (k, v) in word_frequencies.items() if len(v) > 1 and k not in common_words}
        pprint.pprint(word_frequencies)
