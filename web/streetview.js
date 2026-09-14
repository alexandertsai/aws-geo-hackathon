/* Street View stays inside the app; the map remains one button away. */
function hideStreetPreview(){
  document.body.removeAttribute('data-street');
  const surface=document.getElementById('streetPreview');
  if(surface){surface.hidden=true;surface.querySelector('iframe')?.remove();}
}
function streetHeading(a,b){
  const rad=Math.PI/180,lat1=a[1]*rad,lat2=b[1]*rad,dLng=(b[0]-a[0])*rad;
  return (Math.atan2(Math.sin(dLng)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng))/rad+360)%360;
}
function streetURL(coords){
  const a=coords[0],b=coords.find(p=>distance(a,p)>2);
  const params=new URLSearchParams({key:window.GOOGLE_MAPS_EMBED_KEY,location:`${a[1]},${a[0]}`,radius:'50',source:'outdoor',pitch:'0',fov:'90',language:'en'});
  if(b)params.set('heading',String(Math.round(streetHeading(a,b))));
  return `https://www.google.com/maps/embed/v1/streetview?${params}`;
}
function showStreetPreview(coords,label='Street View'){
  if(!window.GOOGLE_MAPS_EMBED_KEY){toast('Street View is not connected. Showing the map.');return;}
  let surface=document.getElementById('streetPreview');
  if(!surface){surface=document.createElement('section');surface.id='streetPreview';surface.setAttribute('aria-label','Street View preview');document.body.appendChild(surface);}
  surface.innerHTML='<div class="street-toolbar"><strong id="streetLabel"></strong><button id="streetMapButton">Show map</button></div><div class="street-frame"></div><p>Nearby street imagery · May differ from the walking path.</p>';
  document.getElementById('streetLabel').textContent=label;
  const frame=document.createElement('iframe');frame.title=label;frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;frame.src=streetURL(coords);
  surface.querySelector('.street-frame').appendChild(frame);
  surface.hidden=false;document.body.dataset.street='true';
  document.getElementById('streetMapButton').onclick=()=>{seniorState.street=false;hideStreetPreview();const toggle=document.getElementById('toggleStreet');if(toggle){toggle.textContent='Show Street View';toggle.focus();}};
}
