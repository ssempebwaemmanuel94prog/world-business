"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const session = require("express-session");

const {
  createApplication,
  initializeDatabase,
  startServer
} = require("../server");

const APPROVED_DATABASE_URL =
  "postgresql://fake_user:fake_password@ep-round-waterfall-b803yfdm-pooler.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const VALID_BUSINESS = {
  businessName: "  Example Business  ",
  country: "  Uganda  ",
  city: "  Kampala  ",
  category: "  Technology  ",
  description: "  A test business  ",
  website: "  https://example.com  ",
  businessEmail: "  contact@example.com  ",
  businessPhone: "  +256700000000  ",
  contactPerson: "  Private Contact  "
};

function makePool(handler = async () => ({ rows: [] })) {
  const calls = [];
  let endCalls = 0;

  return {
    calls,
    get endCalls() {
      return endCalls;
    },
    async query(sql, values = []) {
      calls.push({ sql, values });
      return handler(sql, values, calls);
    },
    async end() {
      endCalls += 1;
    }
  };
}

function makeApp(pool, options = {}) {
  return createApplication({
    pool,
    sessionSecret: "test-only-session-secret",
    nodeEnv: "test",
    sessionStoreFactory: () => new session.MemoryStore(),
    ...options
  });
}

async function withHttpServer(app, callback) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

// Application construction

test("createApplication rejects a missing database pool", () => {
  assert.throws(
    () => createApplication({
      sessionSecret: "test-secret"
    }),
    /valid database pool/
  );
});

test("createApplication rejects a pool without query()", () => {
  assert.throws(
    () => createApplication({
      pool: {},
      sessionSecret: "test-secret"
    }),
    /valid database pool/
  );
});

test("createApplication rejects a missing session secret", () => {
  assert.throws(
    () => createApplication({
      pool: makePool()
    }),
    /SESSION_SECRET/
  );
});

test("createApplication passes the supplied pool to the session store factory", () => {
  const pool = makePool();
  let receivedPool;

  const app = createApplication({
    pool,
    sessionSecret: "test-secret",
    sessionStoreFactory(sharedPool) {
      receivedPool = sharedPool;
      return new session.MemoryStore();
    }
  });

  assert.ok(app);
  assert.equal(receivedPool, pool);
});

// Database initialisation

test("initializeDatabase creates the businesses table and logs success", async () => {
  const pool = makePool();
  const messages = [];
  const logger = {
    log(message) {
      messages.push(message);
    }
  };

  await initializeDatabase(pool, logger);

  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].sql, /CREATE TABLE IF NOT EXISTS businesses/);
  assert.match(pool.calls[0].sql, /contact_person TEXT/);
  assert.deepEqual(messages, [
    "Neon PostgreSQL businesses table is ready."
  ]);
});

test("initializeDatabase propagates database errors", async () => {
  const expectedError = new Error("Database unavailable");
  const pool = makePool(async () => {
    throw expectedError;
  });

  await assert.rejects(
    initializeDatabase(pool, { log() {} }),
    error => error === expectedError
  );
});

// HTTP route tests

test("GET /api/health returns the expected health response", async () => {
  const app = makeApp(makePool());

  await withHttpServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      message: "WorldLink Business backend is running"
    });
  });
});

test("GET /api/businesses returns database rows", async () => {
  const rows = [{
    id: "7",
    business_name: "Example Business",
    city: "Kampala",
    category: "Technology"
  }];

  const pool = makePool(async sql => {
    assert.match(sql, /ORDER BY id DESC/);
    return { rows };
  });

  const app = makeApp(pool);

  await withHttpServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/businesses`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { businesses: rows });
  });
});

test("public business query never selects contact_person", async () => {
  let listingSql = "";

  const pool = makePool(async sql => {
    listingSql = sql;
    return { rows: [] };
  });

  const app = makeApp(pool);

  await withHttpServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/businesses`);
    assert.equal(response.status, 200);
  });

  assert.match(listingSql, /SELECT/i);
  assert.doesNotMatch(listingSql, /contact_person/i);
});

test("GET /api/businesses returns a generic error when the database fails", async () => {
  const pool = makePool(async () => {
    throw new Error("Sensitive database details");
  });

  const app = makeApp(pool);

  await withHttpServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/businesses`);

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "Unable to retrieve business listings."
    });
  });
});

test("POST /api/businesses rejects missing required fields", async () => {
  const pool = makePool();
  const app = makeApp(pool);

  await withHttpServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/businesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName: "Incomplete" })
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Please complete all required fields."
    });
  });

  assert.equal(pool.calls.length, 0);
});

test("POST /api/businesses rejects an invalid business email", async () => {
  const pool = makePool();
  const app = makeApp(pool);

  await withHttpServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/businesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...VALID_BUSINESS,
        businessEmail: "not-an-email"
      })
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /valid business email/);
  });

  assert.equal(pool.calls.length, 0);
});

test("POST /api/businesses rejects unsafe website protocols", async () => {
  const pool = makePool();
  const app = makeApp(pool);

  await withHttpServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/businesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...VALID_BUSINESS,
        website: "javascript:alert(1)"
      })
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /http:\/\/ or https:\/\//);
  });

  assert.equal(pool.calls.length, 0);
});

test("POST /api/businesses rejects invalid optional field types", async () => {
  const pool = makePool();
  const app = makeApp(pool);

  await withHttpServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/businesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...VALID_BUSINESS,
        businessPhone: 12345
      })
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Business phone/);
  });

  assert.equal(pool.calls.length, 0);
});

test("POST /api/businesses trims values and returns the inserted ID", async () => {
  const pool = makePool(async (sql, values) => {
    assert.match(sql, /INSERT INTO businesses/);
    return {
      rows: [{ id: "42" }]
    };
  });

  const app = makeApp(pool);

  await withHttpServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/businesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BUSINESS)
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      message: "Business registered successfully.",
      businessId: "42"
    });
  });

  assert.equal(pool.calls.length, 1);
  assert.deepEqual(pool.calls[0].values, [
    "Example Business",
    "Uganda",
    "Kampala",
    "Technology",
    "A test business",
    "https://example.com",
    "contact@example.com",
    "+256700000000",
    "Private Contact"
  ]);
});

test("POST /api/businesses returns a generic error when insertion fails", async () => {
  const pool = makePool(async () => {
    throw new Error("Sensitive database details");
  });

  const app = makeApp(pool);

  await withHttpServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/businesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BUSINESS)
    });

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "Registration could not be completed."
    });
  });
});

// Server startup tests

test("startServer rejects a missing session secret before creating a pool", async () => {
  let poolCreated = false;

  class FakePool {
    constructor() {
      poolCreated = true;
    }
  }

  await assert.rejects(
    startServer({
      env: { DATABASE_URL: APPROVED_DATABASE_URL },
      PoolClass: FakePool
    }),
    /SESSION_SECRET/
  );

  assert.equal(poolCreated, false);
});

test("startServer rejects an invalid database URL before creating a pool", async () => {
  let poolCreated = false;

  class FakePool {
    constructor() {
      poolCreated = true;
    }
  }

  await assert.rejects(
    startServer({
      env: {
        SESSION_SECRET: "test-secret",
        DATABASE_URL: "not-a-valid-database-url"
      },
      PoolClass: FakePool
    }),
    /database_url_invalid/
  );

  assert.equal(poolCreated, false);
});

test("startServer initializes the database before listening and defaults to port 3000", async () => {
  const events = [];
  const pool = makePool(async () => {
    events.push("database");
    return { rows: [] };
  });

  class FakePool {
    constructor(config) {
      assert.deepEqual(config, {
        connectionString: APPROVED_DATABASE_URL,
        enableChannelBinding: true
      });
      return pool;
    }
  }

  const logger = { log() {} };
  let receivedPort;
  let receivedHost;

  const result = await startServer({
    env: {
      SESSION_SECRET: "test-secret",
      DATABASE_URL: APPROVED_DATABASE_URL
    },
    PoolClass: FakePool,
    logger,
    sessionStoreFactory: () => new session.MemoryStore(),
    listen(app, port, host) {
      events.push("listen");
      receivedPort = port;
      receivedHost = host;
      return { fakeServer: true };
    }
  });

  assert.deepEqual(events, ["database", "listen"]);
  assert.equal(receivedPort, 3000);
  assert.equal(receivedHost, "0.0.0.0");
  assert.equal(result.pool, pool);
  assert.ok(result.app);
  assert.deepEqual(result.server, { fakeServer: true });
});

test("startServer respects a supplied port", async () => {
  const pool = makePool();
  let receivedPort;

  class FakePool {
    constructor() {
      return pool;
    }
  }

  await startServer({
    env: {
      SESSION_SECRET: "test-secret",
      DATABASE_URL: APPROVED_DATABASE_URL,
      PORT: "4567"
    },
    PoolClass: FakePool,
    logger: { log() {} },
    sessionStoreFactory: () => new session.MemoryStore(),
    listen(app, port) {
      receivedPort = port;
      return {};
    }
  });

  assert.equal(receivedPort, "4567");
});

test("startServer closes the pool when database initialization fails", async () => {
  const expectedError = new Error("Initialization failed");
  const pool = makePool(async () => {
    throw expectedError;
  });

  class FakePool {
    constructor() {
      return pool;
    }
  }

  await assert.rejects(
    startServer({
      env: {
        SESSION_SECRET: "test-secret",
        DATABASE_URL: APPROVED_DATABASE_URL
      },
      PoolClass: FakePool,
      logger: { log() {} },
      sessionStoreFactory: () => new session.MemoryStore(),
      listen() {
        assert.fail("listen must not run after initialization fails");
      }
    }),
    error => error === expectedError
  );

  assert.equal(pool.endCalls, 1);
});

test("startServer closes the pool when listen throws synchronously", async () => {
  const expectedError = new Error("Listen failed");
  const pool = makePool();

  class FakePool {
    constructor() {
      return pool;
    }
  }

  await assert.rejects(
    startServer({
      env: {
        SESSION_SECRET: "test-secret",
        DATABASE_URL: APPROVED_DATABASE_URL
      },
      PoolClass: FakePool,
      logger: { log() {} },
      sessionStoreFactory: () => new session.MemoryStore(),
      listen() {
        throw expectedError;
      }
    }),
    error => error === expectedError
  );

  assert.equal(pool.endCalls, 1);
});

test("startServer preserves the original error if pool cleanup fails", async () => {
  const expectedError = new Error("Original startup failure");
  const pool = makePool();

  pool.end = async () => {
    throw new Error("Cleanup failure");
  };

  class FakePool {
    constructor() {
      return pool;
    }
  }

  await assert.rejects(
    startServer({
      env: {
        SESSION_SECRET: "test-secret",
        DATABASE_URL: APPROVED_DATABASE_URL
      },
      PoolClass: FakePool,
      logger: { log() {} },
      sessionStoreFactory: () => new session.MemoryStore(),
      listen() {
        throw expectedError;
      }
    }),
    error => error === expectedError
  );
});
