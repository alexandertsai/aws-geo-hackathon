/* Nearby amenities are opt-in; the selected walk is never changed. */
let nearbyMarkers=[],nearbyRequest=0,nearbyData=null;
const nearbyState={anchor:null,back:null,label:''};
function clearNearbyMarkers(){nearbyRequest++;nearbyMarkers.forEach(marker=>marker.remove());nearbyMarkers=[];}
function openNearby(back){
  const walking=seniorState.step==='walk';
  nearbyState.anchor=walking?[...routes.best.s.segs[seniorState.part].coords[0]]:[origin.lng,origin.lat];
  nearbyState.back=back;nearbyState.label=walking?'Near this part of your walk':'Near your starting point';
  seniorShell('nearby','Nearby places',`<p>${nearbyState.label}</p><div class="nearby-types"><button class="senior-button" id="nearbyATM" aria-pressed="false">🏧 ATMs</button><button class="senior-button" id="nearbyCommunity" aria-pressed="false">🏠 Community centres</button></div><div id="nearbyResults" aria-live="polite"><p class="fine">Choose what you need.</p></div>`,`Listings: OpenStreetMap. Availability may change.`,back);
  document.getElementById('nearbyATM').onclick=()=>showNearbyType('atm');
  document.getElementById('nearbyCommunity').onclick=()=>showNearbyType('community');
  map.easeTo({center:nearbyState.anchor,zoom:16,pitch:0,padding:innerWidth<=700?{left:0,right:0,top:0,bottom:innerHeight*.59}:{left:470,right:0,top:0,bottom:0}});
}
function nearestPlaces(places,kind,anchor){
  return places.filter(p=>p.kind===kind&&!['private','no','members'].includes(p.access)).map(p=>({...p,metres:distance(anchor,[p.lng,p.lat])})).filter(p=>p.metres<=1000).sort((a,b)=>a.metres-b.metres).slice(0,3);
}
async function showNearbyType(kind){
  clearNearbyMarkers();const request=nearbyRequest;
  document.getElementById('nearbyATM').setAttribute('aria-pressed',String(kind==='atm'));
  document.getElementById('nearbyCommunity').setAttribute('aria-pressed',String(kind==='community'));
  const box=document.getElementById('nearbyResults');box.innerHTML='<p class="fine">Finding nearby places…</p>';
  try{
    if(!nearbyData){const response=await fetch('data/nearby.json');if(!response.ok)throw new Error('Unavailable');nearbyData=await response.json();}
    if(request!==nearbyRequest||seniorState.step!=='nearby')return;
    const places=nearestPlaces(nearbyData.places,kind,nearbyState.anchor);
    box.innerHTML=places.length?places.map((p,i)=>`<article class="nearby-place"><h2>${i+1}. ${escapeHTML(p.name)}</h2>${p.address?`<p>${escapeHTML(p.address)}</p>`:''}<p class="fine">About ${fmtM(p.metres)} away · straight-line distance</p><button class="senior-button" data-place-map="${i}">Show on map</button><button class="senior-button" data-place-go="${i}">Directions in Google Maps ↗</button></article>`).join(''):'<p>No mapped places within 1 km. Try the other category.</p>';
    box.insertAdjacentHTML('beforeend',`<p class="fine"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> · Updated ${escapeHTML(nearbyData.updated)}</p>`);
    places.forEach((p,i)=>{
      const el=document.createElement('button');el.className='nearby-marker';el.type='button';el.textContent=String(i+1);el.setAttribute('aria-label',p.name);
      el.onclick=()=>focusNearby(p,i);
      nearbyMarkers.push(new maplibregl.Marker({element:el}).setLngLat([p.lng,p.lat]).addTo(map));
    });
    box.querySelectorAll('[data-place-map]').forEach(button=>button.onclick=()=>focusNearby(places[+button.dataset.placeMap],+button.dataset.placeMap));
    box.querySelectorAll('[data-place-go]').forEach(button=>button.onclick=()=>{
      const p=places[+button.dataset.placeGo];
      const params=new URLSearchParams({api:'1',destination:`${p.lat},${p.lng}`,travelmode:'walking'});
      document.getElementById('googleGo').href=`https://www.google.com/maps/dir/?${params}`;document.getElementById('mapsDialog').showModal();
    });
    if(places.length){
      const points=[nearbyState.anchor,...places.map(p=>[p.lng,p.lat])],bounds=points.reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds(points[0],points[0]));
      map.fitBounds(bounds,{padding:innerWidth<=700?{left:35,right:50,top:40,bottom:innerHeight*.59+40}:{left:510,right:70,top:60,bottom:70},pitch:0,maxZoom:17});
    }
  }catch(error){if(request===nearbyRequest)box.innerHTML='<p>Nearby places couldn’t load.</p><button class="senior-button" id="retryNearby">Try again</button>';const retry=document.getElementById('retryNearby');if(retry)retry.onclick=()=>showNearbyType(kind);}
}
function focusNearby(place,index){
  nearbyMarkers.forEach((marker,i)=>marker.getElement().classList.toggle('selected',i===index));
  map.easeTo({center:[place.lng,place.lat],zoom:17.5,pitch:0,padding:innerWidth<=700?{left:0,right:0,top:0,bottom:innerHeight*.59}:{left:470,right:0,top:0,bottom:0}});
  toast(`${index+1}. ${place.name}`);
}
