/* Resolve the real panorama position before choosing the camera direction. */
let streetRequest=0;
const streetMetadataCache=new Map();
function hideStreetPreview(){
  streetRequest++;
  document.body.removeAttribute('data-street');
  const surface=document.getElementById('streetPreview');
  if(surface){surface.hidden=true;surface.querySelector('iframe')?.remove();}
}
function streetHeading(a,b){
  const rad=Math.PI/180,lat1=a[1]*rad,lat2=b[1]*rad,dLng=(b[0]-a[0])*rad;
  return (Math.atan2(Math.sin(dLng)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng))/rad+360)%360;
}
function pathLength(coords){return coords.slice(1).reduce((sum,p,i)=>sum+distance(coords[i],p),0);}
function pointAlongPath(coords,metres){
  for(let i=1;i<coords.length;i++){
    const length=distance(coords[i-1],coords[i]);
    if(length>0&&metres<=length){const t=Math.max(0,metres)/length;return coords[i-1].map((v,j)=>v+(coords[i][j]-v)*t);}
    metres-=length;
  }
  return coords[coords.length-1];
}
function projectToPath(point,coords){
  let best={offset:Infinity,along:0},travelled=0;
  const scaleX=111320*Math.cos(point[1]*Math.PI/180),scaleY=111320;
  for(let i=1;i<coords.length;i++){
    const a=coords[i-1],b=coords[i],dx=(b[0]-a[0])*scaleX,dy=(b[1]-a[1])*scaleY;
    const length=Math.hypot(dx,dy);if(!length)continue;
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*scaleX*dx+(point[1]-a[1])*scaleY*dy)/(length*length)));
    const projection=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],offset=distance(point,projection);
    if(offset<best.offset)best={offset,along:travelled+t*length};
    travelled+=length;
  }
  return best;
}
function orientPanorama(metadata,coords,maxProgress=35){
  if(metadata.status!=='OK'||!metadata.pano_id||!metadata.location)return null;
  const camera=[metadata.location.lng,metadata.location.lat];
  if(!camera.every(Number.isFinite)||distance(camera,coords[0])>35)return null;
  let target,offset;
  if(coords.length===1){target=coords[0];offset=distance(camera,target);if(offset<2)return null;}
  else{
    const projection=projectToPath(camera,coords);
    // A nearby road is not necessarily the walking path. Refuse distant/advanced photos.
    if(projection.offset>18||projection.along>Math.min(35,maxProgress))return null;
    offset=projection.offset;
    let targetMetres=projection.along+18,travelled=0;
    for(let i=1;i<coords.length-1;i++){
      travelled+=distance(coords[i-1],coords[i]);
      const bend=Math.abs(((streetHeading(coords[i],coords[i+1])-streetHeading(coords[i-1],coords[i])+540)%360)-180);
      if(travelled>=projection.along+4&&travelled<targetMetres&&bend>45){targetMetres=travelled;break;}
    }
    target=pointAlongPath(coords,targetMetres);
    if(distance(camera,target)<3)return null;
  }
  return {pano:metadata.pano_id,heading:streetHeading(camera,target),camera,target,offset};
}
async function streetMetadata(point){
  const cacheKey=point.map(n=>n.toFixed(6)).join(',');
  const cached=streetMetadataCache.get(cacheKey);if(cached&&Date.now()-cached.time<300000)return cached.data;
  const params=new URLSearchParams({key:window.GOOGLE_MAPS_EMBED_KEY,location:`${point[1]},${point[0]}`,radius:'35',source:'outdoor'});
  const response=await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${params}`,{signal:AbortSignal.timeout(9000),referrerPolicy:'strict-origin-when-cross-origin'});
  if(!response.ok)throw new Error('Street View unavailable');
  const data=await response.json();
  if(data.status==='OK'||data.status==='ZERO_RESULTS')streetMetadataCache.set(cacheKey,{time:Date.now(),data});
  return data;
}
function streetURL(view){
  const params=new URLSearchParams({key:window.GOOGLE_MAPS_EMBED_KEY,pano:view.pano,heading:String(Math.round(view.heading)%360),pitch:'0',fov:'85',language:'en'});
  // Pin the exact panorama used for the bearing calculation; do not snap again.
  return `https://www.google.com/maps/embed/v1/streetview?${params}`;
}
function streetFallback(request){
  if(request!==streetRequest)return;
  hideStreetPreview();
  const toggle=document.getElementById('toggleStreet');if(toggle)toggle.textContent='Try Street View again';
  let status=document.getElementById('streetStatus');
  if(!status){status=document.createElement('p');status.id='streetStatus';status.className='fine';status.setAttribute('role','status');document.querySelector('.senior-body')?.appendChild(status);}
  status.textContent='No suitable street view here. Use the map for this part.';
}
async function showStreetPreview(coords,label='Street View',maxProgress=35){
  if(!window.GOOGLE_MAPS_EMBED_KEY){toast('Street View is not connected. Showing the map.');return;}
  const request=++streetRequest;
  let surface=document.getElementById('streetPreview');
  if(!surface){surface=document.createElement('section');surface.id='streetPreview';surface.setAttribute('aria-label','Street View preview');document.body.appendChild(surface);}
  surface.innerHTML='<div class="street-toolbar"><strong id="streetLabel"></strong><button id="streetMapButton">Show map</button></div><div class="street-frame"><p class="street-loading" role="status">Finding a view along your walk…</p></div><p>Street View preview · Check the path around you.</p>';
  document.getElementById('streetLabel').textContent=label;surface.hidden=false;document.body.dataset.street='true';
  document.getElementById('streetMapButton').onclick=()=>{seniorState.street=false;hideStreetPreview();const toggle=document.getElementById('toggleStreet');if(toggle){toggle.textContent='Show Street View';toggle.focus();}};
  try{
    const samples=[coords[0]];
    // A second nearby sample helps when the first snap lands on an adjacent road.
    if(coords.length>1&&pathLength(coords)>15&&maxProgress>4)samples.push(pointAlongPath(coords,Math.min(12,maxProgress)));
    const results=await Promise.allSettled(samples.map(streetMetadata));
    if(request!==streetRequest)return;
    const views=results.filter(r=>r.status==='fulfilled').map(r=>orientPanorama(r.value,coords,maxProgress)).filter(Boolean).sort((a,b)=>a.offset-b.offset||distance(a.camera,coords[0])-distance(b.camera,coords[0]));
    if(!views.length){streetFallback(request);return;}
    const frame=document.createElement('iframe');frame.title=label;frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;frame.src=streetURL(views[0]);
    surface.querySelector('.street-frame').replaceChildren(frame);
  }catch(error){streetFallback(request);}
}
