require("dotenv").config();

const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const { createProductionDatabaseConfig } = require("./scripts/database-config");
const PgSession = connectPgSimple(session);

const HOST = "0.0.0.0";

async function initializeDatabase(pool, logger = console) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id BIGSERIAL PRIMARY KEY,
      business_name TEXT NOT NULL,
      country TEXT NOT NULL,
      city TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      website TEXT,
      business_email TEXT,
      business_phone TEXT,
      contact_person TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  logger.log("Neon PostgreSQL businesses table is ready.");
}

function createApplication({
  pool,
  sessionSecret,
  nodeEnv = process.env.NODE_ENV,
  sessionStoreFactory = sharedPool => new PgSession({
    pool: sharedPool,
    tableName: "user_sessions",
    createTableIfMissing: true
  })
} = {}) {
  if (!pool || typeof pool.query !== "function") {
    throw new TypeError("A valid database pool is required.");
  }

  if (typeof sessionSecret !== "string" || sessionSecret.length === 0) {
    throw new Error("SESSION_SECRET environment variable is missing.");
  }

  const app = express();

app.use(express.static(path.join(__dirname, "public")));

// WorldLink Business mobile web app
app.get(/^\/mobile$/, (req, res) => {
  res.redirect(308, "/mobile/");
});

app.use("/mobile", express.static(path.join(__dirname, "mobile-app"), {
  index: "index.html"
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({
  extended: false,
  limit: "20kb"
}));

app.set("trust proxy", 1);

app.use(session({
  store: sessionStoreFactory(pool),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));


app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "WorldLink Business backend is running"
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/pricing.html", (req, res) => {
  res.sendFile(path.join(__dirname, "pricing.html"));
});

app.get("/marketing.html", (req, res) => {
  res.sendFile(path.join(__dirname, "marketing.html"));
});

app.get("/advertising.html", (req, res) => {
  res.sendFile(path.join(__dirname, "advertising.html"));
});

app.get("/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

app.get("/businesses.html", (req, res) => {
  res.sendFile(path.join(__dirname, "businesses.html"));
});

app.get("/terms.html", (req, res) => {
  res.sendFile(path.join(__dirname, "terms.html"));
});

app.get("/privacy.html", (req, res) => {
  res.sendFile(path.join(__dirname, "privacy.html"));
});

app.get("/marketplace-rules.html", (req, res) => {
  res.sendFile(path.join(__dirname, "marketplace-rules.html"));
});

app.get("/contact.html", (req, res) => {
  res.sendFile(path.join(__dirname, "contact.html"));
});

app.get("/api/businesses", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, business_name, country, city,
             category, description, website,
             business_email, business_phone,
             created_at
      FROM businesses
      ORDER BY id DESC
    `);

    res.json({ businesses: result.rows });
  } catch (error) {
    console.error("Business listing error:", error.message);

    res.status(500).json({
      error: "Unable to retrieve business listings."
    });
  }
});

app.post("/api/businesses", async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({
      error: "Please submit valid business information."
    });
  }

  const {
    businessName,
    country,
    city,
    category,
    description,
    website,
    businessEmail,
    businessPhone,
    contactPerson
  } = req.body;

  const optionalFields = [
    ["Business email", businessEmail, 254],
    ["Business phone", businessPhone, 40],
    ["Contact person", contactPerson, 120]
  ];

  for (const [label, value, maxLength] of optionalFields) {
    if (
      value !== undefined &&
      value !== null &&
      (
        typeof value !== "string" ||
        value.trim().length > maxLength
      )
    ) {
      return res.status(400).json({
        error: label + " is invalid or too long."
      });
    }
  }

  if (
    businessEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail.trim())
  ) {
    return res.status(400).json({
      error: "Please provide a valid business email address."
    });
  }

  const fields = [
    businessName,
    country,
    city,
    category,
    description
  ];

  if (
    fields.some(
      value =>
        typeof value !== "string" ||
        value.trim().length === 0
    )
  ) {
    return res.status(400).json({
      error: "Please complete all required fields."
    });
  }

  if (fields.some(value => value.trim().length > 2000)) {
    return res.status(400).json({
      error: "One or more fields are too long."
    });
  }

  if (
    website !== undefined &&
    website !== "" &&
    (
      typeof website !== "string" ||
      website.length > 2048
    )
  ) {
    return res.status(400).json({
      error: "Please provide a valid website address."
    });
  }

  if (website) {
    try {
      const parsed = new URL(website);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return res.status(400).json({
        error: "Website must start with http:// or https://."
      });
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO businesses (
        business_name,
        country,
        city,
        category,
        description,
        website,
        business_email,
        business_phone,
        contact_person
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        businessName.trim(),
        country.trim(),
        city.trim(),
        category.trim(),
        description.trim(),
        website ? website.trim() : null,
        businessEmail ? businessEmail.trim() : null,
        businessPhone ? businessPhone.trim() : null,
        contactPerson ? contactPerson.trim() : null
      ]
    );

    res.status(201).json({
      message: "Business registered successfully.",
      businessId: result.rows[0].id
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    res.status(500).json({
      error: "Registration could not be completed."
    });
  }
});

  return app;
}

async function startServer({
  env = process.env,
  PoolClass = Pool,
  listen = (application, port, host, callback) =>
    application.listen(port, host, callback),
  logger = console,
  sessionStoreFactory
} = {}) {
  if (typeof env.SESSION_SECRET !== "string" || env.SESSION_SECRET.length === 0) {
    throw new Error("SESSION_SECRET environment variable is missing.");
  }

  const databaseConfig = createProductionDatabaseConfig(env.DATABASE_URL);
  const pool = new PoolClass(databaseConfig);

  try {
    const appOptions = {
      pool,
      sessionSecret: env.SESSION_SECRET,
      nodeEnv: env.NODE_ENV
    };

    if (sessionStoreFactory) {
      appOptions.sessionStoreFactory = sessionStoreFactory;
    }

    const app = createApplication(appOptions);

    await initializeDatabase(pool, logger);

    const port = env.PORT || 3000;
    const server = listen(app, port, HOST, () => {
      logger.log(`Backend running at http://${HOST}:${port}`);
    });

    return { app, pool, server };
  } catch (error) {
    if (typeof pool.end === "function") {
      try {
        await pool.end();
      } catch {
        // Preserve the original startup error.
      }
    }

    throw error;
  }
}

if (require.main === module) {
  startServer().catch(error => {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  createApplication,
  initializeDatabase,
  startServer
};
