const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

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
// Safely add contact fields to databases created by older versions.
const existingColumns = new Set(
  db.prepare("PRAGMA table_info(businesses)").all().map(column => column.name)
);

for (const [column, definition] of [
  ["business_email", "TEXT"],
  ["business_phone", "TEXT"],
  ["contact_person", "TEXT"]
]) {
  if (!existingColumns.has(column)) {
    db.exec(`ALTER TABLE businesses ADD COLUMN ${column} ${definition}`);
    console.log(`Database migration: added ${column}`);
  }
}

app.use(express.static(path.join(__dirname, "public")));
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

app.get("/api/businesses", (req, res) => {
  try {
    const businesses = db.prepare(`
      SELECT id, business_name, country, city,
             category, description, website,
             business_email, business_phone, contact_person,
             created_at
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
    const result = db.prepare(`
      INSERT INTO businesses (
        business_name,
        country,
        city,
        category,
        description,
        website,
        business_email,
        business_phone,
        contact_person
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      businessName.trim(),
      country.trim(),
      city.trim(),
      category.trim(),
      description.trim(),
      website ? website.trim() : null,
      businessEmail ? businessEmail.trim() : null,
      businessPhone ? businessPhone.trim() : null,
      contactPerson ? contactPerson.trim() : null
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
