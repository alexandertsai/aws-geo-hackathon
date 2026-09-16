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
  return route&&shelterReportSections(route).length?`<button class="${className}" data-shelter-report>Report missing shelter</button>`:'';
}

function bindShelterReport(container,route){
  const button=container.querySelector('[data-shelter-report]');
  if(button)button.onclick=()=>openShelterReport(route);
}

function openShelterReport(route){
  const sections=shelterReportSections(route);
  if(!sections.length)return;
  const coordinate=point=>`${point[1].toFixed(6)}, ${point[0].toFixed(6)}`;
  const text=[
    'Missing shelter report',
    `Starting point: ${origin.label} (${coordinate([origin.lng,origin.lat])})`,
    `Destination: ${selectedAAC.name}`,
    `Address: ${selectedAAC.address}`,
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
  preview.value=text;
  status.textContent='';
  const submit=document.getElementById('submitShelterReport');
  submit.disabled=false;
  submit.textContent='Submit report';
  submit.onclick=()=>{
    submit.disabled=true;
    submit.textContent='Submitted';
    status.textContent='Report submitted. Thank you for reporting the missing shelter.';
    status.focus();
  };
  dialog.showModal();
}

document.getElementById('closeShelterReport').onclick=()=>document.getElementById('shelterReportDialog').close();
