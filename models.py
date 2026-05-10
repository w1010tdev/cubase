from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)

class AlgorithmSet(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    items = db.relationship('SetItem', backref='set', lazy=True, cascade="all, delete-orphan")

class SetItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    set_id = db.Column(db.Integer, db.ForeignKey('algorithm_set.id'), nullable=False)
    category = db.Column(db.String(100), nullable=False) # e.g. "3x3" > "CMLL"
    case_name = db.Column(db.String(100), nullable=False) # e.g. "O Adjacent"
    alg = db.Column(db.String(255), nullable=False)
    order_index = db.Column(db.Integer, default=0)

class Progress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    case_name = db.Column(db.String(100), nullable=False)
    proficiency = db.Column(db.Integer, default=0) # 0: new, 1: red(hard), 2: yellow(ok), 3: green(ez)
    best_time = db.Column(db.Float, nullable=True)
    last_reviewed = db.Column(db.DateTime, default=datetime.utcnow)
    main_alg = db.Column(db.String(255), nullable=True) # User's preferred alg for this case
