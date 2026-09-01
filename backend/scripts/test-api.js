const http = require('http');
const jwt = require('jsonwebtoken');

// Generate a valid test token using the JWT secret from .env
const jwtSecret = process.env.JWT_SECRET || 'secret'; // assuming default fallback if not loaded
require('dotenv').config();

const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

const data = JSON.stringify({
  date: '2024-05-15',
  Name: 'Test',
  DeliveryPoint: 'Gate',
  VillageOrCenterCode: '123',
  VehicleType: 'Truck',
  VarietyOfCane: 'CO0238',
  CropType: 'Plant',
  MiddleBrix: 18.5,
  DiseasedCane: 'No',
  StaleCane: 'No',
  ConsignmentConditions: 'Clean'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/forms/brix_yard_sampling',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
