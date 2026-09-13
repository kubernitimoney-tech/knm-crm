#!/bin/sh
set -e
pip install -r requirements/local.txt
python manage.py migrate
python manage.py seed_permissions
python manage.py seed_loan_workflow
python manage.py seed_document_types
python manage.py seed_sample_data
