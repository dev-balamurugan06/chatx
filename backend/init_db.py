import time
from pathlib import Path

import mysql.connector

from db import connect_db


SCHEMA_PATH = Path(__file__).resolve().parent.parent / "database" / "schema.sql"


def initialize_database():
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    statements = [statement.strip() for statement in schema.split(";") if statement.strip()]

    connection = None
    for attempt in range(30):
        try:
            connection = connect_db()
            break
        except mysql.connector.Error as error:
            if attempt == 29:
                raise
            print(f"Waiting for MySQL ({error.__class__.__name__}); retry {attempt + 1}/30.")
            time.sleep(2)

    cursor = connection.cursor()
    try:
        for statement in statements:
            upper_statement = statement.upper()
            if upper_statement.startswith("CREATE DATABASE ") or upper_statement.startswith("USE "):
                continue
            cursor.execute(statement)
        connection.commit()
        print("MySQL schema is ready.")
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    initialize_database()
