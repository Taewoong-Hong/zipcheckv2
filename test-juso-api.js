// Test JUSO API directly
const https = require('https');
const querystring = require('querystring');

const postData = querystring.stringify({
  confmKey: 'U01TX0FVVEgyMDI1MDgwNzE2NTI0NzExNjAzOTI=',
  currentPage: '1',
  countPerPage: '10',
  keyword: '경기도 파주시',
  resultType: 'json'
});

const options = {
  hostname: 'www.juso.go.kr',
  port: 443,
  path: '/addrlink/addrLinkApi.do',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Content-Length': Buffer.byteLength(postData),
    'Accept': 'application/json',
    'Referer': 'https://www.zipcheck.kr',
    'User-Agent': 'zipcheck/2.0'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n=== Response Body ===');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Raw response (not JSON):', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(postData);
req.end();
