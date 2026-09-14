# %% [markdown]
# # **Onemap Workshop**

# %%
temp_token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxNzU5NywiZm9yZXZlciI6ZmFsc2UsImlzcyI6Ik9uZU1hcCIsImlhdCI6MTc4ODg5NjgzOSwibmJmIjoxNzg4ODk2ODM5LCJleHAiOjE3ODkxNTYwMzksImp0aSI6IjE3YTg4MzhmLTZiNTctNGJiMC05M2ZiLWM1ZDZiNzNhZDY2NSJ9.mTH9-xAFnVUWoifoTfnlfMHkGaBvwvea29cQ9N3UY__px1VR7gejCuEjBT7XFpI9HgDRqB_21OwCkZTa-DkNuW_sZrgYV_kYhs_uayI8A_65E-qWcvNvEmvPwGREO6FtHX2KFXb0Xbuh7EX45m-YOTstj6eD-lRjbYam6E0wsPW6uOt478zOfe1QVSiMl6Ofy6RTVo7oqvDxmeU90T__sPmD6fq0he0EYrFuhDt_A1NYlPlDIf0wAHzwUMhADonAImY_muEF2QdQyfdSphzQDKK6NqlphWubefMbmpQ3XNtlvEew9sd9CcPr4HxrpNBH-Ig79Wn8nVovBwrMlTBwyw"

# %% [markdown]
# ### **🔍 Search API call**
# 
# 

# %% [markdown]
# 
# ```
# # OneMap Search API
# # Endpoint: https://www.onemap.gov.sg/api/common/elastic/search
# #
# # Parameters:
# # -----------
# # searchVal : str (Required)
# #     Keywords entered by users to filter the results
# #     Example: Postal code, address, street name
# #
# # returnGeom : str (Required)
# #     Whether to return geometry values
# #     Values: 'Y' or 'N'
# #
# # getAddrDetails : str (Required)
# #     Whether to return address details
# #     Values: 'Y' or 'N'
# #
# # pageNum : int (Optional)
# #     Page number for paginated results
# #     Default: 1
# #
# # Example Usage:
# # -------------
# # Search for postal code 200640 with geometry and address details
# ```

# %%
import requests
import json

search_value="orchard road",
return_geom="Y"
get_addr_details="Y"
page_num=1

base_url = "https://www.onemap.gov.sg/api/common/elastic/search"
# Query parameters
params = {
    "searchVal": search_value,
    "returnGeom": return_geom,
    "getAddrDetails": get_addr_details,
    "pageNum": page_num
}
# Headers
headers = {
    "Authorization": f"{temp_token}"
}

try:
    response = requests.get(base_url, params=params, headers=headers, timeout=10)
    print(json.dumps(response.json(), indent=2))

except requests.exceptions.RequestException as e:
    print(f"Error making request: {e}")


# %% [markdown]
# ### **🗺 Reverse Geocode API call**
# 
# 

# %% [markdown]
# ```
# # OneMap Reverse Geocode API
# # Endpoint: https://www.onemap.gov.sg/api/public/revgeocode
# #
# # Parameters:
# # -----------
# # location : str (Required)
# #     Latitude and longitude coordinates in WGS84 format
# #     Example: "1.3521,103.8198"
# #
# # buffer : str (Optional)
# #     Distance in meters to search within from location point
# #     Values: 0-500
# #     Default: None
# #     Note: Rounds up all buildings in a circumference from a point
# #
# # addressType : str (Optional)
# #     Filter property types within the buffer/radius
# #     Values: 'HDB' or 'All'
# #     Default: 'All'
# #     Note: If HDB is selected, results will only show HDB buildings
# #
# # otherFeatures : str (Optional)
# #     Include additional location features like reservoirs, playgrounds, jetties
# #     Values: 'Y' or 'N'
# #     Default: 'N'
# #
# # Example Usage:
# # -------------
# # Search for locations within 200m of coordinates (1.3521,103.8198):
# # location="1.3521,103.8198"
# # buffer="200"
# # addressType="All"
# # otherFeatures="Y"
# ```
# 
# 
# 

# %%
import requests
import json

buffer=2,
addressType="hdb"
otherFeatures="Y"
location="1.3254295,103.9005321"

base_url = "https://www.onemap.gov.sg/api/public/revgeocode"
# Query parameters
params = {
    "buffer": buffer,
    "addressType": addressType,
    "otherFeatures": otherFeatures,
    "location": location
}
# Headers
headers = {
    "Authorization": f"Bearer {temp_token}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(base_url, params=params, headers=headers, timeout=10)
    print(json.dumps(response.json(), indent=2))

except requests.exceptions.RequestException as e:
    print(f"Error making request: {e}")


# %% [markdown]
# ### **🚙 Routing API call**
# 
# 

# %% [markdown]
# ```
# # OneMap Reverse Geocode API
# # Endpoint: https://www.onemap.gov.sg/api/public/revgeocode
# #
# # Parameters:
# # -----------
# # location : str (Required)
# #     Latitude and longitude coordinates in WGS84 format
# #     Example: "1.3521,103.8198"
# #
# # buffer : str (Optional)
# #     Distance in meters to search within from location point
# #     Values: 0-500
# #     Default: None
# #     Note: Rounds up all buildings in a circumference from a point
# #
# # addressType : str (Optional)
# #     Filter property types within the buffer/radius
# #     Values: 'HDB' or 'All'
# #     Default: 'All'
# #     Note: If HDB is selected, results will only show HDB buildings
# #
# # otherFeatures : str (Optional)
# #     Include additional location features like reservoirs, playgrounds, jetties
# #     Values: 'Y' or 'N'
# #     Default: 'N'
# #
# # Example Usage:
# # -------------
# # Search for locations within 200m of coordinates (1.3521,103.8198):
# # location="1.3521,103.8198"
# # buffer="200"
# # addressType="All"
# # otherFeatures="Y"
# ```
# 
# 
# 

# %%
import requests
import json

start="1.31951800264427,103.842154838338" # Revenue House
end="1.33315281585758,103.742286332403" # Jurong MRT
routeType="pt"
date="05-29-2025"
time="07:35:00"
mode="TRANSIT"
maxWalkDistance=1000
numItineraries=3
base_url = "https://www.onemap.gov.sg/api/public/routingsvc/route"

response = ""
# Query parameters
params = {
    "start": start,
    "end": end,
    "routeType": routeType,
    "date": date,
    "time": time,
    "mode": mode,
    "maxWalkDistance": maxWalkDistance,
    "numItineraries": numItineraries
}
# Headers
headers = {
    "Authorization": f"Bearer {temp_token}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(base_url, params=params, headers=headers, timeout=10)
    print(json.dumps(response.json(), indent=2))

    # We should mention about this: decoding legGeometry.points

except requests.exceptions.RequestException as e:
    print(f"Error making request: {e}")


# %% [markdown]
# **Decode the polyline**

# %%
# If you prefer to use library
#import polyline


# Decode polyline, manual implementation
def decode_polyline(polyline_str):
    """Decodes a polyline string into a list of coordinates."""
    index = 0
    lat = 0
    lng = 0
    coordinates = []
    length = len(polyline_str)

    while index < length:
        # For latitude
        shift = result = 0
        while True:
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if not byte >= 0x20:
                break
        lat_change = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += lat_change

        # For longitude
        shift = result = 0
        while True:
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if not byte >= 0x20:
                break
        lng_change = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += lng_change

        coordinates.append([lat / 1e5, lng / 1e5])

    return coordinates

itineraries = response.json()['plan']['itineraries']
legGeometry = itineraries[0]['legs'][0]['legGeometry']['points']
print ("Encoded polyline", legGeometry)

decoded_geometry = decode_polyline(legGeometry)
print ("Decoded polyline")
print(json.dumps(decoded_geometry, indent=2))

# %% [markdown]
# ### **📈 Thematic Layers API**
# 
# 
# 

# %% [markdown]
# ```
# # OneMap Thematic Layer API
# # Endpoint: https://www.onemap.gov.sg/api/public/themesvc/getAllThemesInfo
# #
# # Parameters:
# # -----------
# # moreInfo : Y, N (Required)
# #     Latitude and longitude coordinates in WGS84 format
# #     Example: "Y"
# ```
# 
# 
# 

# %%
import requests
import json

moreInfo="Y"
base_url = "https://www.onemap.gov.sg/api/public/themesvc/getAllThemesInfo"
# Query parameters
params = {
    "moreInfo": moreInfo
}
# Headers
headers = {
    "Authorization": f"Bearer {temp_token}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(base_url, params=params, headers=headers, timeout=10)
    print(json.dumps(response.json(), indent=2))

    # We should mention about this: decoding legGeometry.points

except requests.exceptions.RequestException as e:
    print(f"Error making request: {e}")


# %% [markdown]
# ```
# # OneMap Thematic Layer API
# # Endpoint: https://www.onemap.gov.sg/api/public/themesvc/retrieveTheme
# #
# # Parameters:
# # -----------
# # queryName : string
# #     Enables users to retrieve theme information. Themes' query names can be retrieved using Get All Themes Info service.
# #     Example: "dengue_cluster"
# ```
# 
# 
# 

# %%
import requests
import json

# queryName="dengue_cluster"
queryName="communityclubpassionwave"
# queryName="childcare"
# queryName="studentcare"

base_url = "https://www.onemap.gov.sg/api/public/themesvc/retrieveTheme"
# Query parameters
params = {
    "queryName": queryName
}
# Headers
headers = {
    "Authorization": f"Bearer {temp_token}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(base_url, params=params, headers=headers, timeout=10)
    print(json.dumps(response.json(), indent=2))

    # We should mention about this: decoding legGeometry.points

except requests.exceptions.RequestException as e:
    print(f"Error making request: {e}")


# %% [markdown]
# 
# 
# ```
# curl -X POST \                     
#   https://www.onemap.gov.sg/api/auth/post/getToken \
#   -H 'Content-Type: application/json' \
#   -d '{
#         "email": "username@domain.com",
#         "password": "passwordhere"
#       }'
# ```
# 
# 


