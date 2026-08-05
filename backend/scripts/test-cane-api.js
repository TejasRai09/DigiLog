const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/bi/cane-performance/procurement?from=2025-10-01&to=2025-11-30',
  method: 'GET',
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('✅ API call successful!');
      console.log('Keys in returned object:', Object.keys(data));
      console.log('Mode split data sample:', data.modeData?.slice(0, 3));
      console.log('Trend data sample:', data.trendData?.slice(0, 3));
      console.log('KPIs:', data.kpis);
      console.log('Sidebar KPIs:', data.sidebar);
      console.log('Overruns sample:', data.overruns?.slice(0, 3));
      console.log('Procurement Flow sample:', data.procurementFlow?.slice(0, 3));
      console.log('Top Centers sample:', data.topCenters?.slice(0, 3));
      console.log('Bottom Centers sample:', data.bottomCenters?.slice(0, 3));
      console.log('DB Rows sample:', data.dbRows?.slice(0, 2));
    } catch (e) {
      console.log('Error parsing response body:', e.message);
      console.log('Raw body:', body);
    }
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
