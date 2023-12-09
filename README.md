# installs all of the necessary dependencies for the project
pip install -r requirements.txt 

# requirements we are using (development)
pipreqs ./ --encoding=utf8 --ignore .venv --force
