const https = require('https');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(data).toString();
    const parsed = new URL(url);
    const req = https.request(
      parsed,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('--- Testing Device Auth with webapp ---');
  const d1 = await post('https://auth.bkit.vn/realms/bkit/protocol/openid-connect/auth/device', {
    client_id: 'webapp',
    scope: 'openid profile email offline_access'
  });
  console.log('webapp device auth:', d1);

  console.log('--- Testing Device Auth with mcp ---');
  const d2 = await post('https://auth.bkit.vn/realms/bkit/protocol/openid-connect/auth/device', {
    client_id: 'mcp',
    client_secret: '8MCZLaIqZ8mwNu6QT7wUtyZAwFbBjcktfdEUvF45lcjw7F7hXdf9pqzvg9cJCZzjxuKuQu4j81iFFhFJ85VHbn',
    scope: 'openid profile email offline_access'
  });
  console.log('mcp device auth:', d2);

  console.log('--- Testing Client Credentials with mcp ---');
  const c1 = await post('https://auth.bkit.vn/realms/bkit/protocol/openid-connect/token', {
    grant_type: 'client_credentials',
    client_id: 'mcp',
    client_secret: '8MCZLaIqZ8mwNu6QT7wUtyZAwFbBjcktfdEUvF45lcjw7F7hXdf9pqzvg9cJCZzjxuKuQu4j81iFFhFJ85VHbn',
    scope: 'openid profile email'
  });
  console.log('mcp client credentials:', c1.status, c1.body.substring(0, 100));
}

run();
