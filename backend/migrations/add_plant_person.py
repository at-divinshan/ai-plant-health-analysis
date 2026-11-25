"""Run explicitly from backend: .venv/bin/python migrations/add_plant_person.py.
Adds only the nullable ownership link; existing records stay unassigned.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import inspect, text
from database import get_engine


def migrate():
    with get_engine().connect() as connection:
        inspector = inspect(connection)
        columns = {column['name']: column for column in inspector.get_columns('plants')}
        if 'person_id' not in columns:
            connection.execute(text('ALTER TABLE plants ADD COLUMN person_id INT NULL, '
                'ADD INDEX ix_plants_person_id (person_id), '
                'ADD CONSTRAINT fk_plants_person FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL'))
            connection.commit()
            print('Added nullable plants.person_id; existing records preserved.')
        else:
            links = inspector.get_foreign_keys('plants')
            if not columns['person_id']['nullable'] or not any(
                link['constrained_columns'] == ['person_id'] and link['referred_table'] == 'people'
                and link['referred_columns'] == ['id'] and link.get('options', {}).get('ondelete') == 'SET NULL'
                for link in links):
                raise RuntimeError('Existing person_id differs from the expected schema; manual inspection required.')
            print('Person assignment migration already applied.')


if __name__ == '__main__':
    migrate()
