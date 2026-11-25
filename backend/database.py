"""Lazy MySQL connection; never create, drop, or migrate existing tables."""
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException
from sqlalchemy import URL, create_engine, event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

load_dotenv(Path(__file__).with_name(".env"))


@lru_cache
def get_engine():
    required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    if any(os.getenv(key) is None for key in required):
        raise HTTPException(503, "Database configuration is incomplete on the server.")
    try:
        port = int(os.getenv("DB_PORT", "3306"))
    except ValueError:
        raise HTTPException(503, "Database configuration is invalid on the server.")
    url = URL.create("mysql+pymysql", username=os.environ["DB_USER"],
                     password=os.environ["DB_PASSWORD"], host=os.environ["DB_HOST"],
                     port=port, database=os.environ["DB_NAME"], query={"charset": "utf8mb4"})
    engine = create_engine(url, pool_pre_ping=True, pool_recycle=1800,
                           connect_args={"connect_timeout": 8, "read_timeout": 15, "write_timeout": 15})

    @event.listens_for(engine, "connect")
    def use_utc(connection, _):
        with connection.cursor() as cursor:
            cursor.execute("SET time_zone = '+00:00'")

    return engine


def get_db():
    try:
        # Keep the connection bound through commit for MySQL advisory locks.
        with get_engine().connect() as connection:
            with Session(bind=connection, expire_on_commit=False) as session:
                yield session
    except SQLAlchemyError:
        # Never return SQL, connection URLs, parameters, or credentials to clients.
        raise HTTPException(503, "The database is unavailable. Please try again.") from None
