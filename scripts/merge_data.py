import json
import os

CUBINGAPP_PATH = '../data/cubingapp_algorithms.json'
SCDB_PATH = '../data/speedcubedb_full.json'
MERGED_PATH = '../data/merged_database.json'

def load_json(path):
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

cubingapp_data = load_json(CUBINGAPP_PATH)
scdb_data = load_json(SCDB_PATH)

merged = {}

def add_case(puzzle, category, case_name, algorithms, source, subgroup=""):
    if puzzle not in merged:
        merged[puzzle] = {}
    if category not in merged[puzzle]:
        merged[puzzle][category] = {}
        
    if case_name not in merged[puzzle][category]:
        merged[puzzle][category][case_name] = {
            'name': case_name,
            'subgroup': subgroup,
            'algorithms': []
        }
        
    existing_algs = [a['alg'] for a in merged[puzzle][category][case_name]['algorithms']]
    
    for alg in algorithms:
        if alg not in existing_algs:
            merged[puzzle][category][case_name]['algorithms'].append({
                'alg': alg,
                'source': source
            })
            existing_algs.append(alg)
    
    if not merged[puzzle][category][case_name]['subgroup'] and subgroup:
        merged[puzzle][category][case_name]['subgroup'] = subgroup

# 1. Process Cubingapp Data (ONLY ROUX)
# User request: "cubingapp的只提供Roux"
if 'roux' in cubingapp_data:
    for s in cubingapp_data['roux']:
        puzzle = s.get('puzzle', '3x3')
        category = s.get('name', 'Unknown')
        cases = s.get('cases', [])
        
        for case in cases:
            c_name = case.get('name', 'Unknown')
            algs = case.get('algorithms', [])
            add_case(puzzle, category, c_name, algs, 'cubingapp')

# 2. Process SpeedCubeDB Data (Everything scraped: 3x3, 2x2, 4x4, 5x5)
# User request: "其余都是speedcubedb上的" (and SQ1/Pyraminx are excluded as per previous instructions)
for puzzle, categories in scdb_data.items():
    for category, cases in categories.items():
        for case in cases:
            c_name = case.get('name', 'Unknown')
            subgroup = case.get('subgroup', '')
            algs = case.get('algorithms', [])
            add_case(puzzle, category, c_name, algs, 'speedcubedb', subgroup)

# Convert dict to list
final_merged = {}
total_puzzles = 0
total_categories = 0
total_cases = 0
total_algs = 0

for puzzle, categories in merged.items():
    final_merged[puzzle] = {}
    total_puzzles += 1
    for category, cases_dict in categories.items():
        case_list = list(cases_dict.values())
        final_merged[puzzle][category] = case_list
        total_categories += 1
        total_cases += len(case_list)
        for c in case_list:
            total_algs += len(c['algorithms'])

with open(MERGED_PATH, 'w', encoding='utf-8') as f:
    json.dump(final_merged, f, indent=2, ensure_ascii=False)

print(f"Merge Complete! Saved to {MERGED_PATH}")
print(f"Stats:")
print(f"  Puzzles: {total_puzzles}")
print(f"  Categories: {total_categories}")
print(f"  Total Cases: {total_cases}")
print(f"  Total Algorithms: {total_algs}")
