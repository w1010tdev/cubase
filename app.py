import os
import json
from flask import Flask, jsonify, request, render_template, send_from_directory
from models import db, User, AlgorithmSet, SetItem, Progress

app = Flask(__name__, static_folder='static', template_folder='templates')

# Configuration
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(BASE_DIR, 'cubase.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# In-memory DB cache
mem_db = {}

def load_db():
    global mem_db
    db_path = os.path.join(BASE_DIR, 'data', 'merged_database.json')
    if os.path.exists(db_path):
        with open(db_path, 'r', encoding='utf-8') as f:
            mem_db = json.load(f)
        print("Loaded merged_database.json into memory.")
    else:
        print("Warning: merged_database.json not found.")

def initialize_database():
    with app.app_context():
        db.create_all()
        # Seed a dummy user for demo purposes
        if not User.query.filter_by(username='geek_cuber').first():
            user = User(username='geek_cuber')
            db.session.add(user)
            db.session.commit()
            print("Created default user 'geek_cuber'")

@app.route('/')
def index():
    return render_template('index.html')

# Serve cubejs files from the root cubejs directory
@app.route('/cubejs/<path:filename>')
def serve_cubejs(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'cubejs'), filename)

# API: Get explore tree structure (Puzzle -> Category -> case counts)
@app.route('/api/explore/tree', methods=['GET'])
def get_explore_tree():
    tree = {}
    for puzzle, categories in mem_db.items():
        tree[puzzle] = {}
        for category, cases in categories.items():
            # Return just the count of cases for rendering the menu and category grid
            tree[puzzle][category] = len(cases)
    return jsonify(tree)

# API: Get full details for a specific category
@app.route('/api/explore/category', methods=['GET'])
def get_explore_category():
    puzzle = request.args.get('puzzle')
    category = request.args.get('category')
    
    if not puzzle or not category:
        return jsonify({"error": "Missing puzzle or category"}), 400
        
    if puzzle in mem_db and category in mem_db[puzzle]:
        return jsonify(mem_db[puzzle][category])
    return jsonify([]), 404

# API: Get all explore data (Legacy, keeping for fallback)
@app.route('/api/explore', methods=['GET'])
def get_explore_data():
    return jsonify(mem_db)

# --- Progress & Main Alg APIs ---
@app.route('/api/progress', methods=['POST'])
def save_progress():
    data = request.json
    user = User.query.first()
    
    prog = Progress.query.filter_by(
        user_id=user.id, 
        category=data['category'], 
        case_name=data['case_name']
    ).first()
    
    if not prog:
        prog = Progress(user_id=user.id, category=data['category'], case_name=data['case_name'])
        db.session.add(prog)
        
    if 'proficiency' in data:
        prog.proficiency = data['proficiency']
    if 'main_alg' in data:
        prog.main_alg = data['main_alg']
        
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/progress/all', methods=['GET'])
def get_all_progress():
    user = User.query.first()
    progresses = Progress.query.filter_by(user_id=user.id).all()
    res = {}
    for p in progresses:
        key = f"{p.category}|{p.case_name}"
        res[key] = {
            "proficiency": p.proficiency,
            "main_alg": p.main_alg
        }
    return jsonify(res)

if __name__ == '__main__':
    load_db()
    initialize_database()
    app.run(debug=True, port=5000)
