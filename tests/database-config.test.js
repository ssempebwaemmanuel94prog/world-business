"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createProductionDatabaseConfig
} = require("../scripts/database-config");

const HOST =
  "ep-round-waterfall-b803yfdm-pooler.c-14.us-east-1.aws.neon.tech";

const APPROVED_URL =
  `postgresql://fake_user:fake_password@${HOST}/neondb?sslmode=require&channel_binding=require`;

test("rejects a missing database URL", () => {
  assert.throws(
    () => createProductionDatabaseConfig(undefined),
    /database_url_missing/
  );
});

test("rejects an empty database URL", () => {
  assert.throws(
    () => createProductionDatabaseConfig(""),
    /database_url_missing/
  );
});

test("rejects a malformed database URL", () => {
  assert.throws(
    () => createProductionDatabaseConfig("not-a-url"),
    /database_url_invalid/
  );
});

test("rejects a non-PostgreSQL protocol", () => {
  assert.throws(
    () => createProductionDatabaseConfig("https://example.com/neondb"),
    /database_protocol_not_approved/
  );
});

test("rejects an unexpected production hostname", () => {
  const url = APPROVED_URL.replace(HOST, "example.com");

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /database_host_not_approved/
  );
});

test("rejects an unexpected database name", () => {
  const url = APPROVED_URL.replace("/neondb?", "/otherdb?");

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /database_name_not_approved/
  );
});

test("rejects a missing SSL mode", () => {
  const url = APPROVED_URL.replace("sslmode=require&", "");

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /database_ssl_not_approved/
  );
});

test("rejects an unsupported SSL mode", () => {
  const url = APPROVED_URL.replace("sslmode=require", "sslmode=prefer");

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /database_ssl_not_approved/
  );
});

test("rejects duplicate SSL mode parameters", () => {
  const url = `${APPROVED_URL}&sslmode=verify-full`;

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /database_ssl_not_approved/
  );
});

test("rejects a missing channel_binding=require URL parameter", () => {
  const url = APPROVED_URL.replace("&channel_binding=require", "");

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /channel_binding_requirement_missing/
  );
});

test("rejects a non-required channel_binding URL parameter", () => {
  const url = APPROVED_URL.replace(
    "channel_binding=require",
    "channel_binding=prefer"
  );

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /channel_binding_requirement_missing/
  );
});

test("accepts the approved production configuration", () => {
  assert.deepEqual(
    createProductionDatabaseConfig(APPROVED_URL),
    {
      connectionString: APPROVED_URL,
      enableChannelBinding: true
    }
  );
});

test("accepts explicit verify-full SSL mode", () => {
  const url = APPROVED_URL.replace(
    "sslmode=require",
    "sslmode=verify-full"
  );

  const config = createProductionDatabaseConfig(url);

  assert.equal(config.enableChannelBinding, true);
  assert.equal(config.connectionString, url);
});

test("does not expose credentials in validation errors", () => {
  const secretUrl = APPROVED_URL.replace(HOST, "wrong.example.com");

  assert.throws(
    () => createProductionDatabaseConfig(secretUrl),
    (error) => {
      assert.doesNotMatch(error.message, /fake_user/);
      assert.doesNotMatch(error.message, /fake_password/);
      assert.doesNotMatch(error.message, /wrong\.example\.com/);
      return true;
    }
  );
});

test("accepts the approved URL without an explicit port", () => {
  const config = createProductionDatabaseConfig(APPROVED_URL);

  assert.equal(config.connectionString, APPROVED_URL);
});

test("accepts the explicit PostgreSQL default port", () => {
  const url = APPROVED_URL.replace(HOST, `${HOST}:5432`);

  const config = createProductionDatabaseConfig(url);

  assert.equal(config.connectionString, url);
});

test("rejects an unexpected database port", () => {
  const url = APPROVED_URL.replace(HOST, `${HOST}:6543`);

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /database_port_not_approved/
  );
});

test("rejects a URL fragment", () => {
  const url = `${APPROVED_URL}#unexpected`;

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /database_url_fragment_not_approved/
  );
});

test("rejects missing database username", () => {
  const url = APPROVED_URL.replace(
    "fake_user:fake_password@",
    ":fake_password@"
  );

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /database_credentials_missing/
  );
});

test("rejects missing database password", () => {
  const url = APPROVED_URL.replace(
    "fake_user:fake_password@",
    "fake_user:@"
  );

  assert.throws(
    () => createProductionDatabaseConfig(url),
    /database_credentials_missing/
  );
});
