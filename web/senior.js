/* A guided, low-text journey over the existing walking graph. */
const seniorState={step:'start',request:0,part:0,view3d:true,activity:'',street:true};
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const minutes=m=>Math.max(1,Math.round(m/WALK_SPEED/60));
const inArea=(lng,lat)=>{const [w,s,e,n]=G.bbox;return lng>=w&&lng<=e&&lat>=s&&lat<=n;};
const distance=(a,b)=>Math.hypot((a[0]-b[0])*Math.cos(a[1]*Math.PI/180),a[1]-b[1])*111320;
const centreName=a=>a.name.replace(/Active Ageing Centre\s*(\(Care\))?/i,'').replace(/Active Centre\s*@?/i,'').replace(/\s+/g,' ').trim();
const streetAddress=a=>a.address.split(',')[0];
function clearWalk(){for(const id of ['route','propose'])map?.getSource(id)?.setData({type:'FeatureCollection',features:[]});Object.values(aacMarkers).forEach(v=>v.el.classList.remove('sel','dim'));}
function setMapMode(){
  if(!map?.getSource('net'))return;
  const planner=mode==='planner'&&document.body.dataset.mode==='planner';
  styleNeighbourhood(planner);
  for(const id of ['net-open','net-cov','net-steps','net-ramp'])map.setLayoutProperty(id,'visibility',planner&&document.getElementById('chkNet').checked?'visible':'none');
  map.setLayoutProperty('bld3d','visibility',planner?(document.getElementById('chk3d').checked?'visible':'none'):'visible');
  map.setPaintProperty('route-active','line-color',planner?['match',['get','k'],'covered','#0f9d8a','steps','#d9483b','ramp','#7b61ff','#c9a227']:'#16634b');
  map.setPaintProperty('route-active','line-width',planner?6:8);
  if(!planner)clearWalk();
  if(mode==='resident'&&['route','walk'].includes(seniorState.step)&&routes?.best)drawSeniorRoute();
}
function goHome(){
  hideStreetPreview();
  clearNearbyMarkers();
  seniorState.request++;window.speechSynthesis?.cancel();document.body.removeAttribute('data-mode');document.body.removeAttribute('data-step');
  document.getElementById('panel').hidden=true;document.getElementById('senior').hidden=true;document.getElementById('welcome').hidden=false;document.getElementById('mapTools').hidden=true;document.getElementById('mapCaption').hidden=true;
  clearWalk();setMapMode();map.easeTo({padding:{top:0,bottom:0,left:0,right:0},center:[103.849,1.335],zoom:15.2,pitch:50});document.getElementById('btnResident').focus();
}
function seniorShell(step,title,content,footer,back){
  hideStreetPreview();
  clearNearbyMarkers();
  seniorState.request++;window.speechSynthesis?.cancel();seniorState.step=step;document.body.dataset.step=step;
  document.getElementById('senior').innerHTML=`<div class="senior-top"><button id="seniorBack">← ${back?'Back':'Home'}</button><button class="listen" id="listenButton">◖ Listen</button></div><main class="senior-body"><div class="eyebrow">${step==='start'?'1 · YOUR START':step==='activity'?'2 · YOUR ACTIVITY':step==='choose'?'3 · YOUR CENTRE':step==='route'?'4 · YOUR WALK':step==='nearby'?'ATMs and CCs':'WALK PREVIEW'}</div><h1 tabindex="-1">${title}</h1>${content}</main><div class="senior-footer">${footer}</div>`;
  document.getElementById('seniorBack').onclick=back||goHome;
  const listen=document.getElementById('listenButton');
  if(!('speechSynthesis' in window))listen.hidden=true;
  listen.onclick=()=>{if(speechSynthesis.speaking){speechSynthesis.cancel();listen.textContent='◖ Listen';return;}const u=new SpeechSynthesisUtterance(document.querySelector('.senior-body').innerText);u.lang='en-SG';u.rate=.85;listen.textContent='■ Stop';u.onend=u.onerror=()=>listen.textContent='◖ Listen';speechSynthesis.speak(u);};
  document.querySelector('.senior-body h1').focus({preventScroll:true});
  document.getElementById('mapTools').hidden=!['route','walk'].includes(step);document.getElementById('mapCaption').hidden=!['route','walk'].includes(step);
}
function seniorStart(){
  mode='resident';strictStepFree=true;shelterWeight=1;selectedAAC=null;routes=null;activeRoute='best';
  document.body.dataset.mode='resident';document.getElementById('welcome').hidden=true;document.getElementById('panel').hidden=true;document.getElementById('senior').hidden=false;clearWalk();setMapMode();
  seniorShell('start','Where are you<br>starting from?',`<button class="senior-button primary" id="locateButton">◎ Use my location</button><div class="divider">or</div><label for="seniorSearch">Enter your block or street</label><input id="seniorSearch" type="text" placeholder="e.g. 79 Toa Payoh Central" autocomplete="off" aria-controls="seniorResults"><div class="senior-status" id="seniorStatus" role="status"></div><div class="senior-results" id="seniorResults"></div><button class="senior-button" id="demoButton">Try a walk in Toa Payoh →</button>`,`Toa Payoh pilot · We’ll look for paths without stairs.`);
  document.getElementById('locateButton').onclick=locateSenior;
  document.getElementById('demoButton').onclick=()=>chooseOrigin(103.8494,1.3331,'Toa Payoh Central · example start');
  const input=document.getElementById('seniorSearch');let timer;
  input.oninput=()=>{clearTimeout(timer);const query=input.value.trim();const request=++seniorState.request;document.getElementById('seniorResults').replaceChildren();if(query.length<3){seniorStatus('');return;}seniorStatus('Looking for your address…');timer=setTimeout(()=>searchSenior(query,request),350);};
}
function seniorStatus(message){const el=document.getElementById('seniorStatus');if(el)el.textContent=message;}
async function searchSenior(query,request){
  try{
    const response=await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`,{...(window.ONEMAP_TOKEN?{headers:{Authorization:window.ONEMAP_TOKEN}}:{}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Search unavailable');const data=await response.json();if(request!==seniorState.request)return;
    const results=(data.results||[]).filter(x=>inArea(+x.LONGITUDE,+x.LATITUDE)).slice(0,5);
    seniorStatus(results.length?'Choose your address below.':'No address found in Toa Payoh. Try your block and street name.');
    const box=document.getElementById('seniorResults');box.innerHTML=results.map((x,i)=>`<button class="senior-button" data-result="${i}">${escapeHTML(x.ADDRESS)}</button>`).join('');
    box.querySelectorAll('button').forEach(b=>b.onclick=()=>{const x=results[+b.dataset.result];chooseOrigin(+x.LONGITUDE,+x.LATITUDE,x.ADDRESS);});
  }catch(e){if(request===seniorState.request)seniorStatus('Address search is unavailable. Try your location, or try the example walk.');}
}
function locateSenior(){
  if(!navigator.geolocation){seniorStatus('Location is unavailable. Please enter your block or street.');return;}
  const request=++seniorState.request;const button=document.getElementById('locateButton');button.disabled=true;button.textContent='Finding your location…';
  navigator.geolocation.getCurrentPosition(p=>{if(request!==seniorState.request)return;button.disabled=false;button.textContent='◎ Use my location';if(p.coords.accuracy>150){seniorStatus('Your location is too approximate. Please enter your block or street.');return;}chooseOrigin(p.coords.longitude,p.coords.latitude,'Your location');},()=>{if(request!==seniorState.request)return;button.disabled=false;button.textContent='◎ Use my location';seniorStatus('We couldn’t get your location. Please enter your block or street.');},{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
}
function chooseOrigin(lng,lat,label){
  if(!inArea(lng,lat)){seniorStatus('We cover Toa Payoh for now. Enter a Toa Payoh address or try the example walk.');return;}
  const node=nearestNode(lng,lat);
  if(distance([lng,lat],G.nodes[node])>120){seniorStatus('We couldn’t find a nearby walking path. Please try a nearby street.');return;}
  origin={lng,lat,label,node};
  if(originMarker)originMarker.remove();
  const el=document.createElement('div');el.className='marker-origin';el.setAttribute('aria-label','Your starting point');originMarker=new maplibregl.Marker({element:el}).setLngLat([lng,lat]).addTo(map);
  map.easeTo({center:[lng,lat],zoom:16,pitch:50});seniorActivities();
}
const ACTIVITY_CHOICES=[
  ['🎨','Arts & crafts','Arts and crafts'],
  ['🧘','Exercise','Exercise and fitness'],
  ['🎵','Music & singing','Karaoke and music'],
  ['📱','Phone skills','Digital skills'],
  ['🪴','Gardening','Gardening'],
  ['🀄','Games & mahjong','Games and mahjong'],
  ['🍳','Cooking','Cooking'],
  ['💬','Health talks','Health talks']
];
function seniorActivities(){
  clearWalk();
  seniorShell('activity','Choose an activity',`<div class="activity-grid">${ACTIVITY_CHOICES.map(([icon,label,value])=>`<button class="activity-choice" data-activity="${escapeHTML(value)}" aria-pressed="${seniorState.activity===value}"><span aria-hidden="true">${icon}</span><strong>${label}</strong></button>`).join('')}</div><button class="senior-button" id="anyActivity">Show all centres →</button><button class="senior-button" id="nearbyButton">ATMs and CCs</button>`,`Sample activities · Call the centre to confirm.`,seniorStart);
  document.querySelectorAll('[data-activity]').forEach(button=>button.onclick=()=>{seniorState.activity=button.dataset.activity;seniorChoose();});
  document.getElementById('nearbyButton').onclick=()=>openNearby(seniorActivities);
  document.getElementById('anyActivity').onclick=()=>{seniorState.activity='';seniorChoose();};
}
function seniorChoose(){
  clearWalk();selectedAAC=null;
  const candidates=G.aacs.filter(a=>inArea(a.lng,a.lat)&&(!seniorState.activity||workshopsFor(a).includes(seniorState.activity))).map(a=>{const dst=nearestNode(a.lng,a.lat);if(distance([a.lng,a.lat],G.nodes[dst])>120)return null;const r=dijkstra(origin.node,dst,'best');if(!r||!r.eds.length)return null;const s=summarize(r);return {a,r,s};}).filter(x=>x&&x.s.len<2500).sort((a,b)=>a.r.cost-b.r.cost);
  seniorState.candidates=candidates;
  seniorShell('choose','Choose a centre',`<p>${seniorState.activity?escapeHTML(seniorState.activity):'Nearby centres'}</p><div id="seniorCentres"></div>${candidates.length>3?'<button class="senior-button" id="moreCentres">More centres</button>':''}<details><summary>Your starting point</summary><p>${escapeHTML(origin.label)}</p></details>`,seniorState.activity?'Sample activities · Call the centre to confirm.':'Paths chosen to avoid stairs and favour shelter.',seniorActivities);
  if(!candidates.length){document.getElementById('seniorCentres').innerHTML='<p>No matching centres with a walk without stairs nearby.</p><button class="senior-button primary" id="changeActivity">Choose another activity</button><button class="senior-button" id="changeStart">Change starting point</button>';document.getElementById('changeActivity').onclick=seniorActivities;document.getElementById('changeStart').onclick=seniorStart;return;}
  renderCentres(3);
  const more=document.getElementById('moreCentres');if(more)more.onclick=()=>{renderCentres(candidates.length);more.hidden=true;};
}
function renderCentres(count){
  const box=document.getElementById('seniorCentres');box.innerHTML=seniorState.candidates.slice(0,count).map(({a,s},i)=>`<button class="centre-choice" data-centre="${escapeHTML(a.id)}">${i===0?'<span class="recommend">SUGGESTED WALK</span>':''}<strong>${escapeHTML(centreName(a))}</strong><span class="centre-address">${escapeHTML(streetAddress(a))}</span><span class="choice-foot"><span>About ${minutes(s.len)} min</span><span aria-hidden="true">→</span></span></button>`).join('');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>seniorRoute(b.dataset.centre));
}
function seniorRoute(id){
  selectedAAC=G.aacs.find(a=>a.id===id);if(!selectedAAC||!inArea(selectedAAC.lng,selectedAAC.lat))return;
  const r=dijkstra(origin.node,nearestNode(selectedAAC.lng,selectedAAC.lat),'best');
  if(!r||!r.eds.length){toast('No walk without stairs found. Please choose another centre.');return;}
  routes={best:{r,s:summarize(r)},shortest:null};activeRoute='best';seniorState.part=0;seniorOverview();
}
function seniorOverview(){
  const a=selectedAAC,s=routes.best.s;
  seniorShell('route','Your walk',`<h2>${escapeHTML(centreName(a))}</h2><p>${escapeHTML(streetAddress(a))}</p><div class="trip-metrics"><div><strong>${minutes(s.len)} min</strong><span>estimated time</span></div><div><strong>${fmtM(s.len)}</strong><span>walking distance</span></div></div><div class="route-note"><b aria-hidden="true">✓</b> No stairs on the mapped path</div><div class="route-note"><b aria-hidden="true">⌂</b> ${Math.round(s.coveredPct*100)}% of the walk is sheltered</div>${shelterReportButton(routes.best)}<button class="senior-button primary" id="previewWalk">Preview my walk →</button><button class="senior-button" id="openMaps">Open Google Maps ↗</button><button class="senior-button" id="nearbyButton">ATMs and CCs</button><details><summary>Centre details</summary><p>${escapeHTML(a.name)}</p><p>${escapeHTML(a.address)}</p>${seniorState.activity?`<p>${escapeHTML(seniorState.activity)} · Sample listing. Call to confirm availability.</p>`:''}${a.hours?`<p>${escapeHTML(a.hours.replace(/&amp;/g,'&'))}</p>`:''}${a.phone?`<a class="senior-button" href="tel:${a.phone.replace(/[^+\d]/g,'')}">Call the centre</a>`:''}<button class="senior-button" id="centreStreet">See the centre in Street View</button></details>`,`Map information may be incomplete. Check paths and crossings as you go.`,seniorChoose);
  bindShelterReport(document.getElementById('senior'),routes.best);
  document.getElementById('previewWalk').onclick=()=>{seniorState.part=0;seniorState.street=true;seniorWalk();};document.getElementById('openMaps').onclick=openGoogleMaps;
  document.getElementById('nearbyButton').onclick=()=>openNearby(seniorOverview);
  document.getElementById('centreStreet').onclick=()=>showStreetPreview([[a.lng,a.lat]],'Near the centre');
  drawSeniorRoute();fitSeniorRoute();
}
function drawSeniorRoute(){
  if(!map.getSource('route'))return;
  clearWalk();aacMarkers[selectedAAC.id]?.el.classList.add('sel');
  map.getSource('route').setData({type:'FeatureCollection',features:[{type:'Feature',properties:{role:'active'},geometry:{type:'LineString',coordinates:routes.best.r.path.map(i=>G.nodes[i])}}]});
}
function fitSeniorRoute(){
  if(!routes?.best)return;
  const coords=routes.best.r.path.map(i=>G.nodes[i]);const bounds=coords.reduce((b,c)=>b.extend(c),new maplibregl.LngLatBounds(coords[0],coords[0]));
  const mobile=innerWidth<=700;map.fitBounds(bounds,{padding:mobile?{left:42,right:65,top:65,bottom:innerHeight*.59+62}:{left:Math.min(540,innerWidth*.42),right:95,top:90,bottom:100},maxZoom:17.5,pitch:seniorState.view3d?50:0,bearing:seniorState.view3d?-15:0,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:700});
}
function seniorWalk(){
  const segs=routes.best.s.segs,i=seniorState.part,segment=segs[i];
  const title={covered:'Under shelter',open:'An open-air stretch',ramp:'A ramp or lift',steps:'Stairs ahead'}[segment.kind];
  const name=[...segment.ways].map(w=>G.ways[w]?.name).find(Boolean);
  seniorShell('walk',title,`<div class="walk-number" aria-hidden="true">${segment.kind==='covered'?'⌂':segment.kind==='ramp'?'↗':'↑'}</div><h2>${fmtM(segment.len)}${name?` along ${escapeHTML(name)}`:''}</h2><p>${segment.kind==='covered'?'This part is marked as sheltered.':segment.kind==='ramp'?'Look for the ramp or lift beside the steps.':'Bring an umbrella for sun or rain.'}</p><div class="walk-progress" aria-label="Part ${i+1} of ${segs.length}">${segs.map((_,n)=>`<i class="${n<=i?'done':''}"></i>`).join('')}</div><p class="fine">Part ${i+1} of ${segs.length} · Preview only</p><div class="button-pair"><button class="senior-button" id="previousPart" ${i===0?'disabled':''}>← Previous</button><button class="senior-button primary" id="nextPart">${i===segs.length-1?'Finish':'Next part →'}</button></div><button class="senior-button" id="toggleStreet">${seniorState.street?'Show map':'Show Street View'}</button><button class="senior-button" id="openMaps">Open Google Maps ↗</button><button class="senior-button" id="nearbyButton">ATMs and CCs</button>`,`Preview only. No imagery? Tap Show map.`,seniorOverview);
  document.getElementById('previousPart').onclick=()=>{seniorState.part--;seniorWalk();};document.getElementById('nextPart').onclick=()=>{if(i===segs.length-1)seniorOverview();else{seniorState.part++;seniorWalk();}};document.getElementById('openMaps').onclick=openGoogleMaps;
  document.getElementById('nearbyButton').onclick=()=>openNearby(seniorWalk);
  document.getElementById('toggleStreet').onclick=()=>{seniorState.street=document.body.dataset.street!=='true';seniorWalk();};
  if(seniorState.street&&window.GOOGLE_MAPS_EMBED_KEY)showStreetPreview(segs.slice(i).flatMap((s,n)=>n?s.coords.slice(1):s.coords),`Street View · Part ${i+1} of ${segs.length}`,segment.len);
  else document.getElementById('toggleStreet').textContent='Show Street View';
  const mid=segment.coords[Math.floor(segment.coords.length/2)];map.easeTo({center:mid,zoom:18.2,pitch:seniorState.view3d?55:0,padding:innerWidth<=700?{top:0,left:0,right:0,bottom:innerHeight*.59}:{top:0,left:470,right:0,bottom:0},duration:700});
}
function openGoogleMaps(){
  const params=new URLSearchParams({api:'1',origin:`${origin.lat},${origin.lng}`,destination:`${selectedAAC.lat},${selectedAAC.lng}`,travelmode:'walking',dir_action:'navigate'});
  document.getElementById('googleGo').href=`https://www.google.com/maps/dir/?${params}`;document.getElementById('mapsDialog').showModal();
}
document.getElementById('closeMaps').onclick=()=>document.getElementById('mapsDialog').close();
document.getElementById('googleGo').onclick=()=>document.getElementById('mapsDialog').close();
document.getElementById('overviewButton').onclick=()=>{if(seniorState.step==='walk')seniorOverview();else fitSeniorRoute();};
document.getElementById('viewButton').onclick=()=>{seniorState.view3d=!seniorState.view3d;document.getElementById('viewButton').textContent=seniorState.view3d?'3D view':'Flat map';document.getElementById('viewButton').setAttribute('aria-pressed',String(seniorState.view3d));if(seniorState.step==='walk')seniorWalk();else fitSeniorRoute();};
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(mode==='resident'&&seniorState.step==='route')fitSeniorRoute();},180);});

const mapPaintOriginals=new Map();
function styleNeighbourhood(planner){
  const palette=[
    ['background','background-color','#f1f5ed'],
    ['park','fill-color','#a6d88a'],
    ['park','fill-opacity',.85],
    ['landuse_residential','fill-color','#e8eee5'],
    ['landcover_wood','fill-color','#83c795'],
    ['landcover_grass','fill-color','#a7d88c'],
    ['landcover_grass','fill-opacity',.55],
    ['water','fill-color','#80cce3'],
    ['landuse_school','fill-color','#f8e5ab'],
    ['building','fill-color','#ead7b7'],
    ['building-3d','fill-extrusion-opacity',0],
    ['bld3d','fill-extrusion-color',['interpolate',['linear'],['get','h'],4,'#f2d39e',14,'#eeb79e',28,'#b7d9cc',55,'#a7cbdc',100,'#c8c4df']],
    ['bld3d','fill-extrusion-opacity',1]
  ];
  for(const [id,property,value] of palette){
    const layer=map.getStyle().layers.find(layer=>layer.id===id);if(!layer)continue;
    const key=id+':'+property;
    if(!mapPaintOriginals.has(key))mapPaintOriginals.set(key,layer.paint?.[property]??null);
    map.setPaintProperty(id,property,planner?mapPaintOriginals.get(key):value);
  }
}
