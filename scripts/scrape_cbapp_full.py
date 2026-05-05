"""
=============================================================================
Script: scrape_cbapp_full.py
Description: 
    This script extracts, parses, and normalizes algorithm data from the local 
    cubingapp repository (specifically from `cubingapp/alg-codegen/algs/*.json`).
    Instead of making HTTP requests, it relies on the static data configuration 
    files used by the cubingapp.com frontend.

Usage:
    1. Ensure the `cubingapp` repository is cloned or downloaded. By default, 
       the script expects it at `../cubingapp/alg-codegen/algs`.
    2. Run: `python scrape_cbapp_full.py`
    3. The processed and categorized JSON will be saved to 
       `../data/cubingapp_algorithms.json`.

Classification Logic:
    The script automatically categorizes the parsed files into three groups 
    to match the user's preferred structural layout:
    - roux: 'CMLL', 'OH-CMLL', 'LSE-EO', 'LSE-EOLR'
    - cfop: 'F2L', 'OLL', 'PLL', '2-Look-CMLL', '2-Look-OLL', '2-Look-PLL', 
            'COLL', 'OLLCP', 'Winter-Variation', 'ZBLL'
    - other: Pyraminx, SQ1, 2x2, 4x4, etc.
=============================================================================
"""

import json
import os

# Define Paths
ALGS_DIR = '../cubingapp/alg-codegen/algs'
OUTPUT_FILE = '../data/cubingapp_algorithms.json'

# Categorization Mappings
ROUX_SETS = ['CMLL', 'OH-CMLL', 'LSE-EO', 'LSE-EOLR']
CFOP_SETS = ['F2L', 'OLL', 'PLL', '2-Look-CMLL', '2-Look-OLL', '2-Look-PLL', 
             'COLL', 'OLLCP', 'Winter-Variation', 'ZBLL']

def process_cubingapp_algs():
    if not os.path.exists(ALGS_DIR):
        print(f"Error: Directory '{ALGS_DIR}' not found.")
        print("Please ensure the cubingapp repository is available in the expected location.")
        return

    result = {
        'roux': [],
        'cfop': [],
        'other': []
    }

    # Iterate through all json configuration files
    for filename in os.listdir(ALGS_DIR):
        if not filename.endswith('.json'):
            continue
        
        filepath = os.path.join(ALGS_DIR, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"Error reading {filename}: {e}")
                continue
        
        # Determine basic metadata
        set_name = filename.replace('.json', '')
        puzzle = data.get('puzzle', '3x3')
        cases = data.get('cases', [])
        
        processed_cases = []
        for case in cases:
            c_name = case.get('name', 'Unknown')
            
            # Extract algorithms (Handle both 'algs' and 'algorithms' keys used by cubingapp)
            algs = case.get('algs', [])
            if not algs and 'algorithms' in case:
                algs = case.get('algorithms', [])
            
            # Normalize algorithm objects to flat strings
            str_algs = []
            for alg in algs:
                if isinstance(alg, dict):
                    str_algs.append(alg.get('alg', ''))
                else:
                    str_algs.append(alg)
            
            processed_cases.append({
                'name': c_name,
                'algorithms': [a for a in str_algs if a]
            })
            
        dataset = {
            'name': set_name,
            'puzzle': puzzle,
            'cases': processed_cases
        }
        
        # Categorize the dataset
        if set_name in ROUX_SETS:
            result['roux'].append(dataset)
        elif set_name in CFOP_SETS:
            result['cfop'].append(dataset)
        else:
            result['other'].append(dataset)

    # Ensure output directory exists and write the JSON
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully processed {len(os.listdir(ALGS_DIR))} JSON formula sets.")
    print(f"Standardized data saved to: {OUTPUT_FILE}")

if __name__ == '__main__':
    process_cubingapp_algs()
