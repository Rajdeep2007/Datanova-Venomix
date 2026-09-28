import os
from dotenv import load_dotenv
import requests
load_dotenv()
api_key = os.environ.get('GOOGLE_API_KEY')
print(f'Using key: {api_key[:5]}...')
response = requests.get(f'https://generativelanguage.googleapis.com/v1beta/models?key={api_key}')
models = response.json().get('models', [])
for m in models:
    if 'generateContent' in m.get('supportedGenerationMethods', []):
        print(m['name'])
