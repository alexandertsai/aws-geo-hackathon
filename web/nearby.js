let nearbyMarkers=[],nearbyRequest=0,nearbyData=null;
const nearbyState={anchor:null,back:null,label:''};
function clearNearbyMarkers(){nearbyRequest++;nearbyMarkers.forEach(marker=>marker.remove());nearbyMarkers=[];}
function openNearby(back){
  const walking=seniorState.step==='walk';
  nearbyState.anchor=walking?[...routes.best.s.segs[seniorState.part].coords[0]]:[origin.lng,origin.lat];
  nearbyState.back=back;nearbyState.label=walking?'Near this part of your walk':'Near your starting point';
  clearWalk();
  seniorShell('nearby','ATMs and CCs',`<p>${nearbyState.label}</p><div class="nearby-types"><button class="senior-button" id="nearbyATM" aria-pressed="false">ATMs</button><button class="senior-button" id="nearbyCommunity" aria-pressed="false">Community centres</button></div><div id="nearbyResults" aria-live="polite"><p class="fine">Choose what you need.</p></div>`,`Listings: OpenStreetMap. Availability may change.`,()=>restoreNearbyWalk(back));
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
    box.innerHTML=places.length?places.map((p,i)=>`<article class="nearby-place"><h2>${i+1}. ${escapeHTML(p.name)}</h2>${p.address?`<p>${escapeHTML(p.address)}</p>`:''}<p class="fine">About ${fmtM(p.metres)} away · straight-line distance</p><button class="senior-button" data-place-route="${i}">Show walking route</button><button class="senior-button" data-place-go="${i}">Directions in Google Maps ↗</button></article>`).join(''):'<p>No mapped places within 1 km. Try the other category.</p>';
    box.insertAdjacentHTML('beforeend',`<p class="fine"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> · Updated ${escapeHTML(nearbyData.updated)}</p>`);
    places.forEach((p,i)=>{
      const el=document.createElement('button');el.className='nearby-marker';el.type='button';el.textContent=String(i+1);el.setAttribute('aria-label',p.name);
      el.onclick=()=>focusNearby(p,i);
      nearbyMarkers.push(new maplibregl.Marker({element:el}).setLngLat([p.lng,p.lat]).addTo(map));
    });
    box.querySelectorAll('[data-place-route]').forEach(button=>button.onclick=()=>showNearbyRoute(places[+button.dataset.placeRoute],kind));
    box.querySelectorAll('[data-place-go]').forEach(button=>button.onclick=()=>{
      const p=places[+button.dataset.placeGo];
      const params=new URLSearchParams({api:'1',origin:`${nearbyState.anchor[1]},${nearbyState.anchor[0]}`,destination:`${p.lat},${p.lng}`,travelmode:'walking'});
      document.getElementById('googleGo').href=`https://www.google.com/maps/dir/?${params}`;document.getElementById('mapsDialog').showModal();
    });
    if(places.length){
      const points=[nearbyState.anchor,...places.map(p=>[p.lng,p.lat])],bounds=points.reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds(points[0],points[0]));
      map.fitBounds(bounds,{padding:innerWidth<=700?{left:35,right:50,top:40,bottom:innerHeight*.59+40}:{left:510,right:70,top:60,bottom:70},pitch:0,maxZoom:17});
    }
  }catch(error){if(request===nearbyRequest)box.innerHTML='<p>ATMs and CCs couldn’t load.</p><button class="senior-button" id="retryNearby">Try again</button>';const retry=document.getElementById('retryNearby');if(retry)retry.onclick=()=>showNearbyType(kind);}
}
function focusNearby(place,index){
  nearbyMarkers.forEach((marker,i)=>marker.getElement().classList.toggle('selected',i===index));
  map.easeTo({center:[place.lng,place.lat],zoom:17.5,pitch:0,padding:innerWidth<=700?{left:0,right:0,top:0,bottom:innerHeight*.59}:{left:470,right:0,top:0,bottom:0}});
  toast(`${index+1}. ${place.name}`);
}

function showNearbyRoute(place,kind){
  const anchor=[...nearbyState.anchor],back=nearbyState.back,label=nearbyState.label;
  const src=nearestNode(...anchor),dst=nearestNode(place.lng,place.lat);
  const connected=inArea(place.lng,place.lat)&&distance(anchor,G.nodes[src])<=120&&distance([place.lng,place.lat],G.nodes[dst])<=120;
  const r=connected?dijkstra(src,dst,'best'):null;
  const s=r&&r.eds.length?summarize(r):null;
  const returnToPlaces=()=>{
    clearWalk();
    openNearby(back);
    nearbyState.anchor=anchor;nearbyState.label=label;
    document.querySelector('.senior-body > p').textContent=label;
    showNearbyType(kind);
  };
  const directions=s?`<div class="trip-metrics"><div><strong>${minutes(s.len)} min</strong><span>mapped walking time</span></div><div><strong>${fmtM(s.len)}</strong><span>mapped path</span></div></div><p>${Math.round(s.coveredPct*100)}% sheltered. Avoids stairs without mapped ramps or lifts.</p><p class="fine">Start and entrance connections are not verified. The green line ends at the nearest mapped path.</p><h2>Path preview</h2><ol>${s.segs.map(segment=>{
    const names=[...segment.ways].map(w=>G.ways[w]?.name).filter(Boolean);
    const label={covered:'Sheltered path',open:'Open-air path',ramp:'Ramp or lift',steps:'Stairs'}[segment.kind];
    return `<li><p>${label} for ${fmtM(segment.len)}${names.length?' along '+escapeHTML([...new Set(names)].join(' / ')):''}.</p></li>`;
  }).join('')}</ol><button class="senior-button" id="nearbyReport">Report a problem</button>`:`<p>${r?'You are near the same mapped path as this place. Check the entrance on site.':'No suitable mapped walking route was found. Try another place or check Google Maps.'}</p>`;
  seniorShell('nearby-route','Walk to '+escapeHTML(place.name),`<p>${escapeHTML(place.address||'')}</p>${directions}<button class="senior-button primary" id="nearbyDirections">Directions in Google Maps</button><button class="senior-button" id="returnToWalk">${routes?.best?'Return to my centre walk':'Back to activities'}</button>`,'Route preview only. Map information may be incomplete.',returnToPlaces);
  clearWalk();
  if(s){
    map.getSource('route').setData({type:'FeatureCollection',features:[{type:'Feature',properties:{role:'active'},geometry:{type:'LineString',coordinates:r.path.map(i=>G.nodes[i])}}]});
    document.getElementById('nearbyReport').onclick=()=>openShelterReport({r,s},{lng:anchor[0],lat:anchor[1],label:nearbyState.label},place);
  }
  const el=document.createElement('button');el.className='nearby-marker selected';el.textContent='D';el.setAttribute('aria-label',place.name);
  nearbyMarkers.push(new maplibregl.Marker({element:el}).setLngLat([place.lng,place.lat]).addTo(map));
  const points=[anchor,[place.lng,place.lat],...(s?r.path.map(i=>G.nodes[i]):[])];
  const bounds=points.reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds(points[0],points[0]));
  map.fitBounds(bounds,{padding:innerWidth<=700?{left:35,right:50,top:40,bottom:innerHeight*.59+40}:{left:510,right:70,top:60,bottom:70},pitch:0,maxZoom:17});
  document.getElementById('nearbyDirections').onclick=()=>{
    const params=new URLSearchParams({api:'1',origin:`${anchor[1]},${anchor[0]}`,destination:`${place.lat},${place.lng}`,travelmode:'walking'});
    document.getElementById('googleGo').href=`https://www.google.com/maps/dir/?${params}`;
    document.getElementById('mapsDialog').showModal();
  };
  document.getElementById('returnToWalk').onclick=()=>restoreNearbyWalk(back);
}

function restoreNearbyWalk(back){
  clearWalk();back();
  if(seniorState.step==='walk'&&routes?.best)drawSeniorRoute();
}
