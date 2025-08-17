# Context0 API Routes Documentation

## Base URL

```
Local Development: http://localhost:3000
Production: https://api.context0.tech
```

---

## Health Check Routes

### System Health Check

**Endpoint:** `GET /health`

**Description:** Basic health check endpoint to verify API status.

**Authentication:** None required

**Usage Example:**

```bash
curl -X GET http://localhost:3000/health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-17T10:30:00.000Z"
}
```

### Detailed Health Check

**Endpoint:** `GET /health/detailed`

**Description:** Comprehensive health check including database and external services.

**Authentication:** None required

**Usage Example:**

```bash
curl -X GET http://localhost:3000/health/detailed
```

**Response:**

```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected",
    "arweave": "connected"
  },
  "timestamp": "2025-01-17T10:30:00.000Z"
}
```

### Eizen Health Check

**Endpoint:** `GET /health/eizen`

**Description:** Check the health status of the Eizen vector database service.

**Authentication:** None required

**Usage Example:**

```bash
curl -X GET http://localhost:3000/health/eizen
```

### Memory Service Health Check

**Endpoint:** `GET /health/memory`

**Description:** Check the health status of the memory service.

**Authentication:** None required

**Usage Example:**

```bash
curl -X GET http://localhost:3000/health/memory
```

---

## Authentication & Instance Management Routes

### List User Instances

**Endpoint:** `GET /instances`

**Description:** Retrieve all API key instances for the authenticated user.

**Authentication:** Required (JWT token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Usage Example:**

```bash
curl -X GET http://localhost:3000/instances \
  -H "Authorization: Bearer your_jwt_token"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "abc123-def456-ghi789",
      "key": "ctxkey_abc123def456",
      "description": "My AI Agent Key",
      "contractTxId": "arweave_contract_id",
      "arweaveWalletAddress": "wallet_address",
      "isActive": true,
      "createdAt": "2025-01-17T10:30:00.000Z",
      "lastUsedAt": "2025-01-17T11:00:00.000Z"
    }
  ]
}
```

### Create New Instance

**Endpoint:** `POST /instances/create`

**Description:** Create a new API key instance for the authenticated user.

**Authentication:** Required (JWT token)

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "description": "AI Agent Production Key"
}
```

**Usage Example:**

```bash
curl -X POST http://localhost:3000/instances/create \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "AI Agent Production Key"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "new123-instance456-id789",
    "key": "ctxkey_new123def456",
    "description": "AI Agent Production Key",
    "contractTxId": "new_arweave_contract_id",
    "arweaveWalletAddress": "new_wallet_address",
    "isActive": true,
    "createdAt": "2025-01-17T12:00:00.000Z"
  }
}
```

---

## Memory Management Routes

### Store Memory

**Endpoint:** `POST /memories/insert`

**Description:** Store a new memory with vector embedding generation.

**Authentication:** Required (API Key)

**Headers:**

```
Content-Type: application/json
X-Contract-Hash: <arweave_contract_hash>
```

**Request Body:**

```json
{
  "text": "Important conversation about machine learning algorithms",
  "metadata": {
    "source": "claude_conversation",
    "timestamp": "2025-01-17T10:30:00.000Z",
    "importance": "high"
  }
}
```

**Usage Example:**

```bash
curl -X POST http://localhost:3000/memories/insert \
  -H "Content-Type: application/json" \
  -H "X-Contract-Hash: your_contract_hash" \
  -d '{
    "text": "Important conversation about machine learning algorithms",
    "metadata": {
      "source": "claude_conversation",
      "timestamp": "2025-01-17T10:30:00.000Z",
      "importance": "high"
    }
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "memory_id_123",
    "transactionId": "arweave_tx_id",
    "vectorDimensions": 384
  }
}
```

### Search Memories (Query String)

**Endpoint:** `GET /memories/search`

**Description:** Search memories using query parameters.

**Authentication:** Required (API Key)

**Headers:**

```
X-Contract-Hash: <arweave_contract_hash>
```

**Query Parameters:**

- `query` (required): Search query text
- `k` (optional): Number of results to return (default: 10)
- `filters` (optional): JSON string of metadata filters

**Usage Example:**

```bash
curl -X GET "http://localhost:3000/memories/search?query=machine%20learning&k=5" \
  -H "X-Contract-Hash: your_contract_hash"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "memory_id_123",
      "text": "Important conversation about machine learning algorithms",
      "metadata": {
        "source": "claude_conversation",
        "timestamp": "2025-01-17T10:30:00.000Z",
        "importance": "high"
      },
      "similarity": 0.92
    }
  ]
}
```

### Search Memories (POST Body)

**Endpoint:** `POST /memories/search`

**Description:** Search memories using POST body for complex queries.

**Authentication:** Required (API Key)

**Headers:**

```
Content-Type: application/json
X-Contract-Hash: <arweave_contract_hash>
```

**Request Body:**

```json
{
  "query": "machine learning algorithms",
  "k": 5,
  "filters": {
    "importance": "high",
    "source": "claude_conversation"
  }
}
```

**Usage Example:**

```bash
curl -X POST http://localhost:3000/memories/search \
  -H "Content-Type: application/json" \
  -H "X-Contract-Hash: your_contract_hash" \
  -d '{
    "query": "machine learning algorithms",
    "k": 5,
    "filters": {
      "importance": "high"
    }
  }'
```

### Get Memory by ID

**Endpoint:** `GET /memories/search/:id`

**Description:** Retrieve a specific memory by its vector ID.

**Authentication:** Required (API Key)

**Headers:**

```
X-Contract-Hash: <arweave_contract_hash>
```

**Usage Example:**

```bash
curl -X GET http://localhost:3000/memories/search/memory_id_123 \
  -H "X-Contract-Hash: your_contract_hash"
```

### Get Memory Statistics

**Endpoint:** `GET /memories`

**Description:** Get statistics about stored memories for the contract.

**Authentication:** Required (API Key)

**Headers:**

```
X-Contract-Hash: <arweave_contract_hash>
```

**Usage Example:**

```bash
curl -X GET http://localhost:3000/memories \
  -H "X-Contract-Hash: your_contract_hash"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalMemories": 1250,
    "totalVectors": 1250,
    "averageSimilarity": 0.85,
    "lastUpdated": "2025-01-17T11:30:00.000Z"
  }
}
```

---

## Contract Deployment Routes

### Deploy User Contract

**Endpoint:** `POST /deploy`

**Description:** Deploy a new Eizen contract for the authenticated user.

**Authentication:** Required (JWT token)

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:** (Optional configuration)

```json
{
  "config": {
    "dimensions": 384,
    "maxElements": 10000
  }
}
```

**Usage Example:**

```bash
curl -X POST http://localhost:3000/deploy \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "dimensions": 384,
      "maxElements": 10000
    }
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "contractTxId": "new_contract_tx_id",
    "arweaveWalletAddress": "wallet_address",
    "status": "deployed"
  }
}
```

### Check Deployment Status

**Endpoint:** `GET /deploy/status`

**Description:** Check the deployment status for the authenticated user.

**Authentication:** Required (JWT token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Usage Example:**

```bash
curl -X GET http://localhost:3000/deploy/status \
  -H "Authorization: Bearer your_jwt_token"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "deployed",
    "contractTxId": "contract_tx_id",
    "deployedAt": "2025-01-17T09:00:00.000Z"
  }
}
```

---

## Subscription Management Routes

### Get User Subscription

**Endpoint:** `GET /subscriptions`

**Description:** Get subscription details for the authenticated user.

**Authentication:** Required (JWT token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Usage Example:**

```bash
curl -X GET http://localhost:3000/subscriptions \
  -H "Authorization: Bearer your_jwt_token"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "sub_123456",
    "plan": "pro",
    "quotaLimit": 10000,
    "quotaUsed": 2500,
    "isActive": true,
    "renewsAt": "2025-02-17T00:00:00.000Z",
    "createdAt": "2025-01-17T00:00:00.000Z"
  }
}
```

### Create Subscription

**Endpoint:** `POST /subscriptions`

**Description:** Create a new subscription for the authenticated user.

**Authentication:** Required (JWT token)

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "plan": "pro",
  "quotaLimit": 10000
}
```

**Usage Example:**

```bash
curl -X POST http://localhost:3000/subscriptions \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "pro",
    "quotaLimit": 10000
  }'
```

---

## Webhook Routes

### Clerk Registration Webhook

**Endpoint:** `POST /webhook/clerk/registered`

**Description:** Handle Clerk user registration webhooks.

**Authentication:** Webhook signature verification

**Headers:**

```
Content-Type: application/json
X-Clerk-Signature: <webhook_signature>
```

### Web3 Payment Webhook

**Endpoint:** `POST /webhook/payments/web3`

**Description:** Handle Web3 payment verification webhooks.

**Authentication:** Transaction signature verification

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "transactionHash": "0x123456789...",
  "userAddress": "0x742d35Cc...",
  "amount": "0.1",
  "plan": "pro"
}
```

---

## Admin Routes

### Admin Memory Insert

**Endpoint:** `POST /admin/insert`

**Description:** Admin endpoint to insert memories for any contract.

**Authentication:** Required (Admin JWT token)

**Headers:**

```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "contractId": "contract_tx_id",
  "text": "Admin inserted memory",
  "metadata": {
    "source": "admin",
    "type": "system"
  }
}
```

### Admin Memory Search

**Endpoint:** `POST /admin/search`

**Description:** Admin endpoint to search memories in any contract.

**Authentication:** Required (Admin JWT token)

### Get Memory Count

**Endpoint:** `GET /admin/memories/count/:contractId`

**Description:** Get memory count for a specific contract.

**Authentication:** Required (Admin JWT token)

### Admin Deploy Contract

**Endpoint:** `POST /admin/deploy`

**Description:** Admin endpoint to deploy contracts.

**Authentication:** Required (Admin JWT token)

---

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": {
    "title": "Error Type",
    "message": "Detailed error description"
  }
}
```

Common HTTP status codes:

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate-limited based on subscription tiers:

- **Basic**: 100 requests/hour
- **Pro**: 1000 requests/hour
- **Enterprise**: 10000 requests/hour
