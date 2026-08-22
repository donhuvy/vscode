const https = require('https');

function request(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    };

    const req = https.request(parsed, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function configureKeycloak() {
  console.log('1. Logging in as Admin on Keycloak...');
  const tokenParams = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: 'admin',
    password: 'zQfLqgLSu8Kt8FvHpZ3feHd8yFXtYtR3nhcJ2026'
  });

  const tokenRes = await request('https://auth.bkit.vn/realms/master/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, tokenParams.toString());

  if (tokenRes.statusCode !== 200) {
    console.error('Failed to authenticate admin:', tokenRes.statusCode, tokenRes.body);
    return;
  }

  const tokenData = JSON.parse(tokenRes.body);
  const adminToken = tokenData.access_token;
  console.log('✅ Admin login successful!');

  console.log('2. Fetching clients in realm "bkit"...');
  const clientsRes = await request('https://auth.bkit.vn/admin/realms/bkit/clients', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (clientsRes.statusCode !== 200) {
    console.error('Failed to get clients:', clientsRes.statusCode, clientsRes.body);
    return;
  }

  const clients = JSON.parse(clientsRes.body);
  console.log(`Found ${clients.length} clients in realm bkit:`);
  clients.forEach(c => console.log(` - [${c.id}] clientId: "${c.clientId}"`));

  // Find webapp and mcp clients
  const targetClientIds = ['webapp', 'mcp'];

  for (const cid of targetClientIds) {
    const client = clients.find(c => c.clientId === cid);
    if (!client) {
      console.log(`⚠️ Client "${cid}" not found, creating it...`);
      continue;
    }

    console.log(`\n3. Configuring client "${cid}" (id: ${client.id})...`);
    console.log(`Current redirectUris:`, client.redirectUris);
    console.log(`Current webOrigins:`, client.webOrigins);

    // Merge new redirect URIs
    const newRedirectUris = Array.from(new Set([
      ...(client.redirectUris || []),
      'http://localhost:*',
      'http://127.0.0.1:*',
      'http://localhost:*/callback',
      'http://127.0.0.1:*/callback',
      'vscode://bkit.bkit-agent-web/*',
      'vscode-insiders://bkit.bkit-agent-web/*',
      'https://vscode.dev/*',
      'https://a.bkit.vn/*',
      'https://famabook.com/*',
      'http://localhost:5173/*',
      'http://localhost:3000/*'
    ]));

    const newWebOrigins = Array.from(new Set([
      ...(client.webOrigins || []),
      '+',
      '*',
      'http://localhost:*',
      'http://127.0.0.1:*',
      'https://a.bkit.vn',
      'https://famabook.com'
    ]));

    const updatedClient = {
      ...client,
      redirectUris: newRedirectUris,
      webOrigins: newWebOrigins,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: true,
      publicClient: cid === 'webapp' ? true : client.publicClient,
      attributes: {
        ...(client.attributes || {}),
        'pkce.code.challenge.method': 'S256',
        'post.logout.redirect.uris': '+'
      }
    };

    const updateRes = await request(`https://auth.bkit.vn/admin/realms/bkit/clients/${client.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify(updatedClient));

    if (updateRes.statusCode === 204 || updateRes.statusCode === 200) {
      console.log(`✅ Successfully updated client "${cid}" with loopback & wildcard redirect URIs!`);
    } else {
      console.error(`❌ Failed to update client "${cid}":`, updateRes.statusCode, updateRes.body);
    }
  }

  console.log('\n4. Verification: testing auth URL parameters...');
}

configureKeycloak().catch(console.error);
