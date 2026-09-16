function shelterReportSections(route){
  const sections=[];
  let current=null;
  route.r.eds.forEach((edgeId,i)=>{
    const edge=G.edges[edgeId];
    if(edge[3]&F.COVERED){current=null;return;}
    if(!current){current={len:0,coords:[G.nodes[route.r.path[i]]],names:new Set()};sections.push(current);}
    current.len+=edge[2];
    current.coords.push(G.nodes[route.r.path[i+1]]);
    const name=G.ways[edge[4]]?.name;
    if(name)current.names.add(name);
  });
  return sections;
}

function shelterReportButton(route,className='senior-button'){
  return route?`<button class="${className}" data-shelter-report>Report a problem</button>`:'';
}

function bindShelterReport(container,route){
  const button=container.querySelector('[data-shelter-report]');
  if(button)button.onclick=()=>openShelterReport(route);
}

function openShelterReport(route, start=origin, destination=selectedAAC){
  const sections=shelterReportSections(route);

  const coordinate=point=>`${point[1].toFixed(6)}, ${point[0].toFixed(6)}`;
  const text=[
    'Missing shelter report',
    `Starting point: ${start.label} (${coordinate([start.lng,start.lat])})`,
    `Destination: ${destination.name}`,
    `Address: ${destination.address}`,
    `Route distance: ${fmtM(route.s.len)}`,
    `Distance without mapped shelter: ${fmtM(sections.reduce((sum,section)=>sum+section.len,0))}`,
    '',
    'Sections without mapped shelter:',
    ...sections.map((section,i)=>`${i+1}. ${[...section.names].join(' / ')||'Unnamed path'}: ${fmtM(section.len)}\n   Path coordinates (latitude, longitude): ${section.coords.map(coordinate).join(' -> ')}`),
    '',
    'Please review these sections for covered walkways.',
    'Based on OpenStreetMap data. Missing shelter tags may reflect incomplete mapping; on-site verification is needed.'
  ].join('\n');
  const dialog=document.getElementById('shelterReportDialog');
  const preview=document.getElementById('shelterReportText');
  const status=document.getElementById('shelterReportStatus');
  const type=document.getElementById('reportType');
  const notes=document.getElementById('reportNotes');
  type.value='shelter';notes.value='';
  const update=()=>{
    const title=type.options[type.selectedIndex].text;
    preview.value=type.value==='shelter'?text:[title+' report',`Starting point: ${start.label}`,`Destination: ${destination.name}`,`Route distance: ${fmtM(route.s.len)}`,'','Describe the location and problem in the notes below.'].join('\n');
    status.textContent='';submit.disabled=false;submit.textContent='Submit demo report';
  };
  type.onchange=update;
  notes.oninput=()=>{status.textContent='';submit.disabled=false;submit.textContent='Submit demo report';};
  status.textContent='';
  const submit=document.getElementById('submitShelterReport');
  submit.disabled=false;
  submit.textContent='Submit demo report';
  submit.onclick=()=>{
    if(type.value!=='shelter'&&!notes.value.trim()){status.textContent='Please describe the problem and where it is.';notes.focus();return;}
    submit.disabled=true;
    submit.textContent='Demo complete';
    status.textContent='Demo complete. Your report has not been sent or saved.';
    status.focus();
  };
  update();
  dialog.showModal();
}

document.getElementById('closeShelterReport').onclick=()=>document.getElementById('shelterReportDialog').close();
