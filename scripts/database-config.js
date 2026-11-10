"use strict";

const PRODUCTION_DATABASE = Object.freeze({
  hostname: "ep-round-waterfall-b803yfdm-pooler.c-14.us-east-1.aws.neon.tech",
  database: "neondb"
});

const APPROVED_SSL_MODES = Object.freeze([
  "require",
  "verify-full"
]);

function rejectConfiguration(reason) {
  throw new Error(`Production database configuration rejected: ${reason}`);
}

function createProductionDatabaseConfig(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    rejectConfiguration("database_url_missing");
  }

  let url;

  try {
    url = new URL(databaseUrl);
  } catch {
    rejectConfiguration("database_url_invalid");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    rejectConfiguration("database_protocol_not_approved");
  }

  if (url.hostname.toLowerCase() !== PRODUCTION_DATABASE.hostname) {
    rejectConfiguration("database_host_not_approved");
  }

  if (url.port !== "" && url.port !== "5432") {
    rejectConfiguration("database_port_not_approved");
  }

  if (!url.username || !url.password) {
    rejectConfiguration("database_credentials_missing");
  }

  if (url.hash !== "") {
    rejectConfiguration("database_url_fragment_not_approved");
  }

  if (url.pathname !== `/${PRODUCTION_DATABASE.database}`) {
    rejectConfiguration("database_name_not_approved");
  }

  const sslModes = url.searchParams.getAll("sslmode");

  if (sslModes.length !== 1 || !APPROVED_SSL_MODES.includes(sslModes[0])) {
    rejectConfiguration("database_ssl_not_approved");
  }

  const channelBinding = url.searchParams.getAll("channel_binding");

  if (channelBinding.length !== 1 || channelBinding[0] !== "require") {
    rejectConfiguration("channel_binding_requirement_missing");
  }

  return {
    connectionString: databaseUrl,
    enableChannelBinding: true
  };
}

module.exports = {
  createProductionDatabaseConfig
};
