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

async function setupAgentClient() {
  console.log('1. Logging in to Keycloak Admin...');
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
    console.error('Admin login failed:', tokenRes.statusCode, tokenRes.body);
    return;
  }

  const adminToken = JSON.parse(tokenRes.body).access_token;
  console.log('✅ Admin login successful!');

  // 2. Fetch clients in realm 'bkit'
  console.log('2. Fetching clients in realm "bkit"...');
  const clientsRes = await request('https://auth.bkit.vn/admin/realms/bkit/clients', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const clients = JSON.parse(clientsRes.body);
  const existingAgent = clients.find(c => c.clientId === 'agent');
  const existingMcp = clients.find(c => c.clientId === 'mcp');

  // 3. Regenerate clientSecret for 'mcp' to invalidate the leaked secret
  if (existingMcp) {
    console.log('3. Revoking & Regenerating clientSecret for "mcp" server client...');
    const regenRes = await request(`https://auth.bkit.vn/admin/realms/bkit/clients/${existingMcp.id}/client-secret`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (regenRes.statusCode === 200) {
      console.log('✅ Successfully revoked and regenerated new secret for "mcp"!');
    }
  }

  // 4. Create or Update public client 'agent' (NO secret, PKCE S256 only)
  console.log('4. Setting up Public Client "agent" with PKCE S256 (Zero Secret)...');
  const agentClientConfig = {
    clientId: 'agent',
    name: 'BKIT Accounting Agents Desktop',
    description: 'Public Desktop Client for VS Code AI Agents with PKCE S256 (Zero Secret)',
    publicClient: true,
    clientAuthenticatorType: 'client-secret', // Ignored when publicClient = true
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: false,
    redirectUris: [
      'http://localhost:*',
      'http://127.0.0.1:*',
      'http://localhost:*/callback',
      'http://127.0.0.1:*/callback',
      'vscode://bkit.bkit-agent-web/*',
      'vscode-insiders://bkit.bkit-agent-web/*',
      'https://vscode.dev/*'
    ],
    webOrigins: [
      '+',
      '*',
      'http://localhost:*',
      'http://127.0.0.1:*'
    ],
    attributes: {
      'pkce.code.challenge.method': 'S256',
      'post.logout.redirect.uris': '+'
    }
  };

  if (existingAgent) {
    console.log(`Updating existing "agent" client (id: ${existingAgent.id})...`);
    const updateRes = await request(`https://auth.bkit.vn/admin/realms/bkit/clients/${existingAgent.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({ ...existingAgent, ...agentClientConfig }));

    console.log('Update result:', updateRes.statusCode);
  } else {
    console.log('Creating new "agent" public client...');
    const createRes = await request('https://auth.bkit.vn/admin/realms/bkit/clients', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify(agentClientConfig));

    console.log('Create result:', createRes.statusCode);
  }

  console.log('\n5. Verifying client "agent" via Authorization Endpoint...');
}

setupAgentClient().catch(console.error);
