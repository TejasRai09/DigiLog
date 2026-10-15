const https = require('https');
const fs = require('fs');

const code = `flowchart LR
  E1["Step 01\\nAsset Setup\\nSpecs and OEM Schedule"] --> E2["Step 02\\nBreakdown/Maint.\\nOperator logs\\nissue and work"]
  E2 --> E3["Step 03\\nEvidence\\nAttach photos\\nand documents"]
  E3 --> E4["Step 04\\nHOD Review\\nApprove or\\nrequest changes"]
  E4 --> E5["Step 05\\nDigital Record\\nPermanent\\naudit trail"]
  style E1 fill:#bbf7d0,stroke:#16a34a,stroke-width:2px,color:#000
  style E2 fill:#bfdbfe,stroke:#2563eb,stroke-width:2px,color:#000
  style E3 fill:#fef08a,stroke:#ca8a04,stroke-width:2px,color:#000
  style E4 fill:#fed7aa,stroke:#ea580c,stroke-width:2px,color:#000
  style E5 fill:#e9d5ff,stroke:#7c3aed,stroke-width:2px,color:#000`;

const encoded = Buffer.from(code).toString('base64');
const url = 'https://mermaid.ink/img/' + encoded;

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed to download: ${res.statusCode}`);
    return;
  }
  const file = fs.createWriteStream('docs/equipment_flow.png');
  res.pipe(file);
  file.on('finish', () => { 
    file.close(); 
    console.log('Downloaded'); 
  });
}).on('error', (e) => console.error(e));
