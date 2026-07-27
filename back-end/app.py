"""Flask application factory - JSON API only (it renders no HTML).
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

import db
from errors import ApiError
from routes.assessment import bp as assessment_bp
from routes.auth import bp as auth_bp
from routes.reviews import bp as reviews_bp
from routes.settings import bp as settings_bp
from routes.subjects import bp as subjects_bp
from routes.topics import bp as topics_bp
from routes.user import bp as user_bp

'''config from the environment'''
def create_app(config: dict | None = None) -> Flask:
    load_dotenv()
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-insecure-change-me"),
        DATABASE_PATH=os.environ.get("DATABASE_PATH", "navigator.db"),
    )
    """CORS for the split-origin front-end"""
    if config:
        app.config.update(config)
    CORS(app, resources={r"/api/*": {"origins": os.environ.get("CORS_ORIGIN", "*")}}); 

    """Resources blueprint"""
    app.register_blueprint(auth_bp);
    app.register_blueprint(user_bp)
    app.register_blueprint(subjects_bp)
    app.register_blueprint(topics_bp)
    app.register_blueprint(reviews_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(assessment_bp)

    app.teardown_appcontext(db.close_db)
    """JSON error handlers"""
    @app.errorhandler(ApiError) 
   
    def _handle_api_error(err: ApiError):
        return jsonify(error=err.message), err.status

    @app.errorhandler(404)
    def _handle_404(_err):
        return jsonify(error="Not found."), 404

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
