const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = 3000;
const HOST = "127.0.0.1";

const db = new Database(
  path.join(__dirname, "worldbusiness.db")
);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT NOT NULL,
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    website TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({
  extended: false,
  limit: "20kb"
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

app.get("/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

app.get("/businesses.html", (req, res) => {
  res.sendFile(path.join(__dirname, "businesses.html"));
});

app.get("/api/businesses", (req, res) => {
  try {
    const businesses = db.prepare(`
      SELECT id, business_name, country, city,
             category, description, website, created_at
      FROM businesses
      ORDER BY id DESC
    `).all();

    res.json({ businesses });
  } catch (error) {
    console.error("Business listing error:", error.message);

    res.status(500).json({
      error: "Unable to retrieve business listings."
    });
  }
});

app.post("/api/businesses", (req, res) => {
if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
  return res.status(400).json({
    error: "Please submit valid business information."
  });
}  const {
    businessName,
    country,
    city,
    category,
    description,
    website
  } = req.body;

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
    const result = db.prepare(`
      INSERT INTO businesses (
        business_name,
        country,
        city,
        category,
        description,
        website
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      businessName.trim(),
      country.trim(),
      city.trim(),
      category.trim(),
      description.trim(),
      website ? website.trim() : null
    );

    res.status(201).json({
      message: "Business registered successfully.",
      businessId: result.lastInsertRowid
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    res.status(500).json({
      error: "Registration could not be completed."
    });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Backend running at http://${HOST}:${PORT}`);
});
