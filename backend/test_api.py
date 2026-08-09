import requests

url = "http://127.0.0.1:5000/predict"

data = {
    "total_sqft": 1200,
    "bath": 2,
    "balcony": 2,
    "bhk": 2,
    "location": "Electronic City"
}

response = requests.post(url, json=data)

print(response.json())